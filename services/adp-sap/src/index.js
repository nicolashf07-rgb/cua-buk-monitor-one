require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Joi = require('joi');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const CircuitBreaker = require('opossum');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info', redact: ['req.headers.authorization'], serializers: { err: pino.stdSerializers.err } });

const app = express();
const PORT = process.env.PORT || 3006;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// SAP API Config (real or sandbox)
const SAP_API_URL = process.env.SAP_API_URL || 'http://sandbox-sap:4006';
const SAP_API_KEY = process.env.SAP_API_KEY || 'sandbox-sap-key';
const SAP_TIMEOUT = parseInt(process.env.SAP_TIMEOUT || '30000');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8000').split(',');
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ============================================================
// Joi Schema: 38 campos en 6 categorías (shared mock+real)
// ============================================================
const businessPartnerSchema = Joi.object({
  title: Joi.string().allow('').optional(),
  first_name: Joi.string().required().messages({ 'any.required': 'first_name es requerido' }),
  last_name: Joi.string().required().messages({ 'any.required': 'last_name es requerido' }),
  second_last_name: Joi.string().allow('').optional(),
  id_number: Joi.string().required().messages({ 'any.required': 'id_number (RUT) es requerido' }),
  id_type: Joi.string().valid('RUT', 'PASSPORT', 'DNI').default('RUT'),
  birth_date: Joi.string().allow('').optional(),
  gender: Joi.string().valid('M', 'F', 'O', '').allow('').optional(),
  nationality: Joi.string().allow('').optional(),
  marital_status: Joi.string().valid('S', 'C', 'D', 'V', '').allow('').optional(),
  name_supplement: Joi.string().allow('').optional(),
  street: Joi.string().allow('').optional(),
  house_number: Joi.string().allow('').optional(),
  city: Joi.string().allow('').optional(),
  region: Joi.string().allow('').optional(),
  postal_code: Joi.string().allow('').optional(),
  country: Joi.string().max(3).default('CL'),
  telephone: Joi.string().allow('').optional(),
  mobile: Joi.string().allow('').optional(),
  email: Joi.string().email().allow('').optional(),
  tax_number: Joi.string().allow('').optional(),
  tax_type: Joi.string().allow('').optional(),
  bank_account: Joi.string().allow('').optional(),
  bank_key: Joi.string().allow('').optional(),
  payment_method: Joi.string().allow('').optional(),
  occupation: Joi.string().allow('').optional(),
  department: Joi.string().allow('').optional(),
  phy_ind: Joi.boolean().default(false),
  phy_num: Joi.string().when('phy_ind', {
    is: true,
    then: Joi.string().required().messages({ 'any.required': 'phy_num es requerido cuando phy_ind es true' }),
    otherwise: Joi.string().allow('').optional(),
  }),
  spl_ty_typ: Joi.string().allow('').optional(),
  nur_ind: Joi.boolean().default(false),
  med_staff_type: Joi.string().allow('').optional(),
  med_staff_group: Joi.string().allow('').optional(),
  fonasa_group: Joi.string().allow('').optional(),
  isapre: Joi.string().allow('').optional(),
  prev_system: Joi.string().allow('').optional(),
  afp: Joi.string().allow('').optional(),
  health_plan: Joi.string().allow('').optional(),
}).options({ stripUnknown: true });

// ============================================================
// Mappers: camelCase ↔ PascalCase
// ============================================================
function toPascalCase(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const pascalKey = key.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    result[pascalKey] = value;
  }
  return result;
}

function fromPascalCase(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    result[snakeKey] = value;
  }
  return result;
}

// ============================================================
// MOCK MODE: local counter
// ============================================================
let bpCounter = 1000000;

// ============================================================
// REAL MODE: axios + retry + circuit breaker
// ============================================================
const sapClient = axios.create({ timeout: SAP_TIMEOUT });

axiosRetry(sapClient, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 5000, // 5s, 10s, 15s for SAP
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500);
  },
  onRetry: (retryCount, error) => {
    logger.info(`[SAP-RETRY] Attempt ${retryCount}: ${error.message}`);
  },
});

const breakerOptions = {
  timeout: SAP_TIMEOUT + 5000, // breaker timeout > axios timeout
  errorThresholdPercentage: 50,
  resetTimeout: 60000, // SAP needs longer recovery
  name: 'sap-api',
};

// CSRF token cache (SAP requires x-csrf-token: Fetch before POST/PUT/DELETE)
let csrfTokenCache = { token: null, cookies: null, expires_at: 0 };

async function fetchCSRFToken() {
  if (csrfTokenCache.token && Date.now() < csrfTokenCache.expires_at) {
    return csrfTokenCache;
  }
  logger.info('[SAP-CSRF] Fetching CSRF token...');
  const res = await sapClient.get(
    `${SAP_API_URL}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner`,
    {
      headers: {
        'X-SAP-API-Key': SAP_API_KEY,
        'x-csrf-token': 'Fetch',
        'Accept': 'application/json',
      },
    }
  );
  const token = res.headers['x-csrf-token'] || 'sandbox-csrf-ok';
  const cookies = res.headers['set-cookie'] || [];
  csrfTokenCache = { token, cookies, expires_at: Date.now() + 1800000 }; // 30min
  logger.info('[SAP-CSRF] Token obtained');
  return csrfTokenCache;
}

async function createBPInSAP(pascalData) {
  const csrf = await fetchCSRFToken();
  const res = await sapClient.post(
    `${SAP_API_URL}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner`,
    pascalData,
    {
      headers: {
        'X-SAP-API-Key': SAP_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-csrf-token': csrf.token,
      },
    }
  );
  return res.data;
}

const breaker = new CircuitBreaker(createBPInSAP, breakerOptions);
breaker.on('open', () => logger.info('[SAP-CIRCUIT] OPEN - SAP unavailable'));
breaker.on('halfOpen', () => logger.info('[SAP-CIRCUIT] HALF-OPEN - Testing SAP...'));
breaker.on('close', () => logger.info('[SAP-CIRCUIT] CLOSED - SAP recovered'));

// Parse SAP OData response → internal format
function parseSAPResponse(sapData) {
  const bp = sapData.d?.results || sapData;
  return {
    gpart: bp.BusinessPartner || bp.gpart,
    status: 'created',
    data: fromPascalCase(bp),
  };
}

// ============================================================
// ENDPOINTS
// ============================================================

app.get('/health', (_req, res) => {
  const health = {
    status: 'ok',
    service: 'adp-sap',
    mock_mode: MOCK_MODE,
    timestamp: new Date().toISOString(),
  };
  if (!MOCK_MODE) {
    health.sap_api_url = SAP_API_URL;
    health.sap_timeout = SAP_TIMEOUT;
    health.circuit_breaker = breaker.status.name === 'open' ? 'OPEN' : breaker.status.name === 'halfOpen' ? 'HALF-OPEN' : 'CLOSED';
  } else {
    health.bp_counter = bpCounter;
  }
  res.json(health);
});

app.post('/api/sap/business-partner', async (req, res) => {
  // Validate with Joi (shared between mock and real)
  const { error, value } = businessPartnerSchema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      error: 'Validación SAP BP fallida',
      details: error.details.map(d => ({ campo: d.path.join('.'), mensaje: d.message, tipo: d.type })),
      total_errores: error.details.length,
    });
  }

  // --- MOCK MODE ---
  if (MOCK_MODE) {
    bpCounter++;
    const responsePascal = toPascalCase(value);
    return res.status(201).json({
      gpart: `BP-MOCK-${bpCounter}`,
      status: 'created',
      message: 'Business Partner creado en SAP (mock)',
      data: responsePascal,
      campos_recibidos: Object.keys(value).length,
      mock_mode: true,
      timestamp: new Date().toISOString(),
    });
  }

  // --- REAL MODE ---
  try {
    const pascalData = toPascalCase(value);
    const sapResponse = await breaker.fire(pascalData);
    const parsed = parseSAPResponse(sapResponse);

    res.status(201).json({
      gpart: parsed.gpart,
      status: parsed.status,
      message: 'Business Partner creado en SAP',
      data: parsed.data,
      campos_recibidos: Object.keys(value).length,
      mock_mode: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[SAP-ERROR] ${err.message}`);

    if (err.message && err.message.includes('Breaker is open')) {
      return res.status(503).json({ error: 'SAP unavailable (circuit breaker open)', mock_mode: false });
    }

    if (err.response) {
      const sapError = err.response.data?.error || {};
      const sapCode = sapError.code || 'UNKNOWN';
      // Map SAP-specific error codes to actionable messages
      const sapErrorMap = {
        'CX_SY_OPEN_SQL_ERROR': 'SAP database error - retry recommended',
        'CX_SY_CONVERSION_ERROR': 'Data type mismatch in SAP fields',
        'MISSING_FIELDS': 'Required SAP fields missing',
        'VALIDATION_ERROR': 'SAP field validation failed',
        'GATEWAY_TIMEOUT': 'SAP system timeout',
      };
      return res.status(err.response.status).json({
        error: sapErrorMap[sapCode] || sapError.message || 'SAP API error',
        code: sapCode,
        details: sapError.details || null,
        mock_mode: false,
      });
    }

    // Invalidate CSRF token on connection errors (may be expired)
    csrfTokenCache = { token: null, cookies: null, expires_at: 0 };
    res.status(500).json({ error: 'Error connecting to SAP', details: err.message, mock_mode: false });
  }
});

app.get('/api/sap/business-partner/:gpart', async (req, res) => {
  const { gpart } = req.params;
  if (MOCK_MODE) {
    return res.json({ gpart, status: 'active', message: 'BP consultado (mock)', mock_mode: true, timestamp: new Date().toISOString() });
  }

  try {
    const sapRes = await sapClient.get(
      `${SAP_API_URL}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner/${gpart}`,
      { headers: { 'X-SAP-API-Key': SAP_API_KEY } }
    );
    const bp = sapRes.data.d?.results || sapRes.data;
    res.json({ gpart: bp.BusinessPartner || gpart, status: 'active', data: fromPascalCase(bp), mock_mode: false });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message || err.message, mock_mode: false });
  }
});

app.listen(PORT, () => {
  logger.info(`adp-sap running on port ${PORT} (MOCK_MODE=${MOCK_MODE})`);
  if (!MOCK_MODE) {
    logger.info(`  SAP_API_URL: ${SAP_API_URL}`);
    logger.info(`  SAP_TIMEOUT: ${SAP_TIMEOUT}ms`);
  }
});
