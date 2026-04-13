const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4006;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ============================================================
// CONFIG
// ============================================================
const LATENCY_MIN_MS = 200;
const LATENCY_MAX_MS = 800; // SAP is slower
const ERROR_RATE = parseFloat(process.env.SANDBOX_ERROR_RATE || '0.05');
const TIMEOUT_SIMULATE_RATE = parseFloat(process.env.SANDBOX_TIMEOUT_RATE || '0.02'); // 2% timeout

function simulateLatency() {
  const ms = Math.floor(Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS)) + LATENCY_MIN_MS;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// MIDDLEWARE: API Key auth (simula SAP certificate/API key)
// ============================================================
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-sap-api-key'] || req.headers.authorization;
  if (!apiKey) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'X-SAP-API-Key header required' },
    });
  }
  // Accept any key in sandbox
  next();
}

// ============================================================
// STATE: Business Partners created
// ============================================================
let bpSequence = 1000000;
const createdBPs = new Map();

// CSRF token management (SAP real requires x-csrf-token: Fetch before mutating ops)
const csrfTokens = new Set();

function csrfMiddleware(req, res, next) {
  // On GET with x-csrf-token: Fetch header, return a token
  if (req.method === 'GET' && req.headers['x-csrf-token'] === 'Fetch') {
    const token = `sap-csrf-${Date.now()}`;
    csrfTokens.add(token);
    setTimeout(() => csrfTokens.delete(token), 1800000); // 30min expiry
    res.set('x-csrf-token', token);
  }
  // On POST/PUT/DELETE, validate the CSRF token
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const token = req.headers['x-csrf-token'];
    if (!token || !csrfTokens.has(token)) {
      // In sandbox mode, also accept 'sandbox-csrf-ok' for backwards compat
      if (token !== 'sandbox-csrf-ok') {
        return res.status(403).json({
          error: { code: 'CSRF_TOKEN_INVALID', message: 'CSRF token required. GET with x-csrf-token: Fetch first.' },
        });
      }
    }
  }
  next();
}

// Required fields (mirrors Joi validation in adp-sap)
const REQUIRED_FIELDS = ['FirstName', 'LastName', 'IdNumber'];

// ============================================================
// ENDPOINTS
// ============================================================

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sandbox-sap', type: 'sandbox', bps_created: createdBPs.size, timestamp: new Date().toISOString() });
});

// GET /sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner - List/CSRF Fetch
app.get('/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner', authMiddleware, csrfMiddleware, async (req, res) => {
  await simulateLatency();
  const bps = Array.from(createdBPs.values());
  res.json({ d: { results: bps } });
});

// POST /sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner
// Simula SAP TrakCare real endpoint
app.post('/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner', authMiddleware, csrfMiddleware, async (req, res) => {
  // Simulate timeout (2% chance of 30s+ delay)
  if (Math.random() < TIMEOUT_SIMULATE_RATE) {
    await new Promise(resolve => setTimeout(resolve, 35000));
    return res.status(504).json({
      error: { code: 'GATEWAY_TIMEOUT', message: 'SAP system did not respond within timeout' },
    });
  }

  await simulateLatency();

  // Simulate random 500 error
  if (Math.random() < ERROR_RATE) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'SAP system error. Please retry.', details: 'CX_SY_OPEN_SQL_ERROR' },
    });
  }

  const body = req.body;

  // Validate required fields (PascalCase como SAP real)
  const missing = REQUIRED_FIELDS.filter(f => !body[f]);
  if (missing.length > 0) {
    return res.status(400).json({
      error: {
        code: 'MISSING_FIELDS',
        message: `Required fields missing: ${missing.join(', ')}`,
        details: missing.map(f => ({ field: f, message: `${f} is required` })),
      },
    });
  }

  // Validate PhyNum when PhyInd is true (healthcare IS-H)
  if (body.PhyInd === true && !body.PhyNum) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'PhyNum is required when PhyInd is true (registered physician)',
        details: [{ field: 'PhyNum', message: 'Required for IS-H healthcare physician registration' }],
      },
    });
  }

  bpSequence++;
  const gpart = `BP-${String(bpSequence).padStart(10, '0')}`;

  const bp = {
    BusinessPartner: gpart,
    BusinessPartnerFullName: `${body.FirstName} ${body.LastName}`,
    FirstName: body.FirstName,
    LastName: body.LastName,
    IdNumber: body.IdNumber,
    CreationDate: new Date().toISOString().split('T')[0],
    CreationTime: new Date().toISOString().split('T')[1].split('.')[0],
    ...body,
  };

  createdBPs.set(gpart, bp);

  res.status(201).json({
    d: {
      results: bp,
      __metadata: { uri: `A_BusinessPartner('${gpart}')`, type: 'API_BUSINESS_PARTNER.A_BusinessPartnerType' },
    },
  });
});

// GET /sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner/:gpart
app.get("/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner/:gpart", authMiddleware, async (req, res) => {
  await simulateLatency();
  const { gpart } = req.params;
  const bp = createdBPs.get(gpart);

  if (!bp) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Business Partner ${gpart} not found` },
    });
  }

  res.json({ d: { results: bp } });
});

app.listen(PORT, () => {
  console.log(`sandbox-sap running on port ${PORT} (simulates SAP TrakCare API)`);
});
