const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4005;

app.use(cors());
app.use(express.json());

// ============================================================
// CONFIG: Simulated behavior
// ============================================================
const LATENCY_MIN_MS = 100;
const LATENCY_MAX_MS = 400;
const ERROR_RATE = parseFloat(process.env.SANDBOX_ERROR_RATE || '0.05'); // 5% random errors
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60000;

// Rate limit tracking
const rateLimitMap = new Map();

function simulateLatency() {
  const ms = Math.floor(Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS)) + LATENCY_MIN_MS;
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldSimulateError() {
  return Math.random() < ERROR_RATE;
}

// ============================================================
// MIDDLEWARE: Rate Limiting (simula BUK rate limit real)
// ============================================================
function rateLimitMiddleware(req, res, next) {
  const key = req.headers.authorization || req.ip;
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count++;
  rateLimitMap.set(key, entry);

  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  res.set('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.set('X-RateLimit-Remaining', remaining);
  res.set('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Max ${RATE_LIMIT_MAX} requests per minute`,
      retry_after_seconds: Math.ceil((entry.resetAt - now) / 1000),
    });
  }
  next();
}

// ============================================================
// MIDDLEWARE: OAuth2 Bearer Token validation
// ============================================================
const VALID_TOKENS = new Set();

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token required. POST /oauth/token to obtain one.',
    });
  }
  const token = auth.split(' ')[1];
  if (!VALID_TOKENS.has(token)) {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Token expired or invalid. POST /oauth/token to refresh.',
    });
  }
  next();
}

// ============================================================
// DATABASE: Realistic Chilean employee data
// ============================================================
const EMPLOYEES = [
  { id: 1001, rut: '12345678-9', first_name: 'María', last_name: 'González', second_last_name: 'Pérez', email: 'maria.gonzalez@clinicauandes.cl', position: 'Médico Internista', department: 'Medicina Interna', hire_date: '2020-03-15', boss_name: 'Dr. Carlos Ruiz Tapia', boss_email: 'cruiz@clinicauandes.cl', status: 'active', salary_type: 'monthly' },
  { id: 1002, rut: '98765432-1', first_name: 'Juan', last_name: 'Muñoz', second_last_name: 'Silva', email: 'juan.munoz@clinicauandes.cl', position: 'Enfermero UCI', department: 'Unidad de Cuidados Intensivos', hire_date: '2019-07-01', boss_name: 'Dra. Ana López Fernández', boss_email: 'alopez@clinicauandes.cl', status: 'active', salary_type: 'monthly' },
  { id: 1003, rut: '11222333-4', first_name: 'Catalina', last_name: 'Rojas', second_last_name: 'Díaz', email: 'catalina.rojas@clinicauandes.cl', position: 'Administrativa Admisión', department: 'Admisión', hire_date: '2021-11-20', boss_name: 'Pedro Soto Castillo', boss_email: 'psoto@clinicauandes.cl', status: 'active', salary_type: 'monthly' },
  { id: 1004, rut: '15432876-5', first_name: 'Francisco', last_name: 'Soto', second_last_name: 'Hernández', email: 'francisco.soto@clinicauandes.cl', position: 'Cirujano Cardiovascular', department: 'Cirugía', hire_date: '2018-01-10', boss_name: 'Dr. Patricio Ríos', boss_email: 'prios@clinicauandes.cl', status: 'active', salary_type: 'monthly' },
  { id: 1005, rut: '16789543-2', first_name: 'Valentina', last_name: 'Torres', second_last_name: 'Ramírez', email: 'valentina.torres@clinicauandes.cl', position: 'Anestesióloga', department: 'Anestesiología', hire_date: '2022-06-01', boss_name: 'Dr. Alejandro Vega', boss_email: 'avega@clinicauandes.cl', status: 'active', salary_type: 'monthly' },
];

// ============================================================
// ENDPOINTS
// ============================================================

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sandbox-buk', type: 'sandbox', timestamp: new Date().toISOString() });
});

// OAuth2 Token (simula BUK OAuth2 client credentials)
app.post('/oauth/token', async (req, res) => {
  await simulateLatency();
  const { client_id, client_secret, grant_type } = req.body;

  if (grant_type !== 'client_credentials') {
    return res.status(400).json({ error: 'unsupported_grant_type', message: 'Only client_credentials supported' });
  }
  if (!client_id || !client_secret) {
    return res.status(400).json({ error: 'invalid_client', message: 'client_id and client_secret required' });
  }

  // Validate scope if provided (real BUK API requires valid scopes)
  const requestedScope = req.body.scope || 'read:employees';
  const validScopes = ['read:employees', 'write:employees', 'read:absences'];
  const scopes = requestedScope.split(' ').filter(s => validScopes.includes(s));
  if (scopes.length === 0) {
    return res.status(400).json({ error: 'invalid_scope', message: `Valid scopes: ${validScopes.join(', ')}` });
  }

  // Accept any client_id/secret in sandbox mode
  const token = `sandbox-buk-${uuidv4()}`;
  VALID_TOKENS.add(token);

  // Auto-expire after 1 hour
  setTimeout(() => VALID_TOKENS.delete(token), 3600000);

  res.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: scopes.join(' '),
  });
});

// GET /api/v1/chile/employees - List with pagination (simula BUK API real)
app.get('/api/v1/chile/employees', authMiddleware, rateLimitMiddleware, async (req, res) => {
  await simulateLatency();

  if (shouldSimulateError()) {
    return res.status(500).json({ error: 'Internal Server Error', message: 'BUK API temporarily unavailable' });
  }

  const page = parseInt(req.query.page) || 1;
  const per_page = parseInt(req.query.per_page) || 10;
  const start = (page - 1) * per_page;
  const data = EMPLOYEES.slice(start, start + per_page);

  res.json({
    data,
    pagination: {
      page,
      per_page,
      total_entries: EMPLOYEES.length,
      total_pages: Math.ceil(EMPLOYEES.length / per_page),
    },
  });
});

// GET /api/v1/chile/employees/:rut - Single employee (simula BUK API real)
app.get('/api/v1/chile/employees/:identifier', authMiddleware, rateLimitMiddleware, async (req, res) => {
  await simulateLatency();

  if (shouldSimulateError()) {
    return res.status(500).json({ error: 'Internal Server Error', message: 'BUK API temporarily unavailable' });
  }

  const { identifier } = req.params;
  const employee = EMPLOYEES.find(e => e.rut === identifier || e.id === parseInt(identifier));

  if (!employee) {
    return res.status(404).json({ error: 'Not Found', message: `Employee ${identifier} not found` });
  }

  res.json({ data: employee });
});

app.listen(PORT, () => {
  console.log(`sandbox-buk running on port ${PORT} (simulates BUK HR API)`);
});
