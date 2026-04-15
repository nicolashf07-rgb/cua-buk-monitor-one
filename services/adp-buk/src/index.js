require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const CircuitBreaker = require('opossum');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info', redact: ['req.headers.authorization'], serializers: { err: pino.stdSerializers.err } });

const app = express();
const PORT = process.env.PORT || 3005;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// BUK API Config (real or sandbox)
const BUK_API_URL = process.env.BUK_API_URL || 'http://sandbox-buk:4005';
const BUK_CLIENT_ID = process.env.BUK_CLIENT_ID || 'cua-buk-client';
const BUK_CLIENT_SECRET = process.env.BUK_CLIENT_SECRET || 'cua-buk-secret';

// CORS restrictivo: solo servicios internos Docker
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8000').split(',');
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ============================================================
// MOCK MODE: datos locales (original)
// ============================================================
const MOCK_EMPLOYEES = {
  '12345678-9': { rut: '12345678-9', nombre: 'María', apellido: 'González Pérez', email: 'maria.gonzalez@clinicauandes.cl', cargo: 'Médico Internista', area: 'Medicina Interna', fechaIngreso: '2020-03-15', bossFullName: 'Dr. Carlos Ruiz Tapia', bossEmail: 'cruiz@clinicauandes.cl' },
  '98765432-1': { rut: '98765432-1', nombre: 'Juan', apellido: 'Muñoz Silva', email: 'juan.munoz@clinicauandes.cl', cargo: 'Enfermero UCI', area: 'Unidad de Cuidados Intensivos', fechaIngreso: '2019-07-01', bossFullName: 'Dra. Ana López Fernández', bossEmail: 'alopez@clinicauandes.cl' },
  '11222333-4': { rut: '11222333-4', nombre: 'Catalina', apellido: 'Rojas Díaz', email: 'catalina.rojas@clinicauandes.cl', cargo: 'Administrativa', area: 'Admisión', fechaIngreso: '2021-11-20', bossFullName: 'Pedro Soto Castillo', bossEmail: 'psoto@clinicauandes.cl' },
};

// ============================================================
// REAL MODE: OAuth2 + axios-retry + circuit breaker
// ============================================================

// --- OAuth2 Token Management ---
let tokenCache = { access_token: null, expires_at: 0 };

async function getOAuth2Token() {
  if (tokenCache.access_token && Date.now() < tokenCache.expires_at) {
    return tokenCache.access_token;
  }

  logger.info('[BUK-AUTH] Requesting new OAuth2 token...');
  const res = await axios.post(`${BUK_API_URL}/oauth/token`, {
    client_id: BUK_CLIENT_ID,
    client_secret: BUK_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'read:employees',
  });

  tokenCache = {
    access_token: res.data.access_token,
    expires_at: Date.now() + (res.data.expires_in - 60) * 1000, // refresh 60s before expiry
  };

  logger.info(`[BUK-AUTH] Token obtained, expires in ${res.data.expires_in}s`);
  return tokenCache.access_token;
}

// --- Axios client with retry ---
const bukClient = axios.create({ timeout: 10000 });

axiosRetry(bukClient, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    // Respect Retry-After header on 429 rate limit responses
    if (error.response && error.response.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || error.response.data?.retry_after_seconds || '5');
      logger.info(`[BUK-RETRY] Rate limited (429), waiting ${retryAfter}s`);
      return retryAfter * 1000;
    }
    return axiosRetry.exponentialDelay(retryCount);
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500) ||
      (error.response && error.response.status === 429);
  },
  onRetry: (retryCount, error) => {
    logger.info(`[BUK-RETRY] Attempt ${retryCount}: ${error.message}`);
  },
});

// --- Circuit Breaker ---
const breakerOptions = {
  timeout: 15000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'buk-api',
};

async function fetchEmployeeFromBUK(rut) {
  const token = await getOAuth2Token();
  const res = await bukClient.get(`${BUK_API_URL}/api/v1/chile/employees/${rut}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

const breaker = new CircuitBreaker(fetchEmployeeFromBUK, breakerOptions);

breaker.on('open', () => logger.info('[BUK-CIRCUIT] OPEN - BUK API unavailable, using fallback'));
breaker.on('halfOpen', () => logger.info('[BUK-CIRCUIT] HALF-OPEN - Testing BUK API...'));
breaker.on('close', () => logger.info('[BUK-CIRCUIT] CLOSED - BUK API recovered'));

// --- EmployeeDTO Mapper: BUK API response → internal DTO ---
function mapBukToDTO(bukData) {
  const emp = bukData.data || bukData;
  return {
    rut: emp.rut,
    nombre: emp.first_name || emp.nombre,
    apellido: `${emp.last_name || ''} ${emp.second_last_name || ''}`.trim() || emp.apellido,
    email: emp.email,
    cargo: emp.position || emp.cargo,
    area: emp.department || emp.area,
    fechaIngreso: emp.hire_date || emp.fechaIngreso,
    bossFullName: emp.boss_name || emp.bossFullName,
    bossEmail: emp.boss_email || emp.bossEmail,
  };
}

// ============================================================
// HELPERS
// ============================================================
function isValidRut(rut) {
  if (!rut || typeof rut !== 'string') return false;
  const cleaned = rut.replace(/\./g, '').replace(/-/g, '');
  return /^\d{7,8}[0-9kK]$/.test(cleaned);
}

// ============================================================
// ENDPOINTS
// ============================================================

app.get('/health', async (_req, res) => {
  const health = {
    status: 'ok',
    service: 'adp-buk',
    mock_mode: MOCK_MODE,
    timestamp: new Date().toISOString(),
  };

  // No exponer detalles internos en health check
  if (!MOCK_MODE) {
    health.circuit_breaker = breaker.status.name === 'open' ? 'OPEN' : 'OK';
  }

  res.json(health);
});

app.get('/api/buk/employees/:rut', async (req, res) => {
  const { rut } = req.params;

  if (!isValidRut(rut)) {
    return res.status(400).json({ error: 'Formato de RUT inválido', rut, ejemplo: '12345678-9', mock_mode: MOCK_MODE });
  }

  // --- MOCK MODE ---
  if (MOCK_MODE) {
    const employee = MOCK_EMPLOYEES[rut];
    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado en BUK', rut, mock_mode: true });
    }
    return res.json({ ...employee, mock_mode: true });
  }

  // --- REAL MODE ---
  try {
    const bukData = await breaker.fire(rut);
    const dto = mapBukToDTO(bukData);
    res.json({ ...dto, mock_mode: false });
  } catch (err) {
    logger.error(`[BUK-ERROR] ${err.message}`);

    if (err.message && err.message.includes('Breaker is open')) {
      return res.status(503).json({ error: 'BUK API unavailable (circuit breaker open)', rut, mock_mode: false });
    }

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error || err.response.data?.message || 'BUK API error',
        rut,
        mock_mode: false,
      });
    }

    res.status(500).json({ error: 'Error connecting to BUK API', details: err.message, rut, mock_mode: false });
  }
});

app.get('/api/buk/employees', async (req, res) => {
  if (MOCK_MODE) {
    return res.json({ total: Object.keys(MOCK_EMPLOYEES).length, data: Object.values(MOCK_EMPLOYEES), mock_mode: true });
  }

  try {
    const token = await getOAuth2Token();
    const page = req.query.page || 1;
    const per_page = req.query.per_page || 10;
    const bukRes = await bukClient.get(`${BUK_API_URL}/api/v1/chile/employees`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, per_page },
    });
    const employees = (bukRes.data.data || []).map(emp => mapBukToDTO({ data: emp }));
    const pagination = bukRes.data.pagination || { page: Number(page), per_page: Number(per_page), total_entries: employees.length, total_pages: 1 };
    res.json({ total: pagination.total_entries, data: employees, pagination, mock_mode: false });
  } catch (err) {
    logger.error(`[BUK-ERROR] List: ${err.message}`);
    res.status(500).json({ error: 'Error listing employees from BUK', mock_mode: false });
  }
});

app.listen(PORT, () => {
  logger.info(`adp-buk running on port ${PORT} (MOCK_MODE=${MOCK_MODE})`);
  if (!MOCK_MODE) {
    logger.info(`  BUK_API_URL: ${BUK_API_URL}`);
    logger.info(`  Circuit breaker: ${breakerOptions.errorThresholdPercentage}% threshold, ${breakerOptions.resetTimeout}ms reset`);
  }
});
