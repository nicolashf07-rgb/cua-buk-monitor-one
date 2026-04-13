require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const CircuitBreaker = require('opossum');

const app = express();
const PORT = process.env.PORT || 3007;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Azure AD Config (real or sandbox)
const AZURE_AD_URL = process.env.AZURE_AD_URL || 'http://sandbox-azuread:4007';
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || 'sandbox-tenant';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || 'sandbox-client';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || 'sandbox-secret';

app.use(cors());
app.use(express.json());

// ============================================================
// SHARED: Normalize + UPN generation (used by both modes)
// ============================================================
function normalizeText(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Azure AD password policy: min 8 chars, uppercase, lowercase, digit, special
function generateCompliantPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  // Guarantee at least one of each category
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(special);
  const all = upper + lower + digits + special;
  for (let i = 0; i < 8; i++) pwd += pick(all);
  // Shuffle
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// ============================================================
// MOCK MODE: local directory
// ============================================================
const mockExistingUpns = new Set(['maria.gonzalez@clinicauandes.cl', 'juan.munoz@clinicauandes.cl', 'catalina.rojas@clinicauandes.cl']);
const mockCreatedAccounts = new Map();

function generateUpnMock(nombre, apellido) {
  const base = `${normalizeText(nombre)}.${normalizeText(apellido)}`;
  let upn = `${base}@clinicauandes.cl`;
  let counter = 1;
  while (mockExistingUpns.has(upn) || mockCreatedAccounts.has(upn)) { counter++; upn = `${base}${counter}@clinicauandes.cl`; }
  return upn;
}

// ============================================================
// REAL MODE: MSAL token + Graph API client
// ============================================================
let msalTokenCache = { access_token: null, expires_at: 0 };

async function getMSALToken() {
  if (msalTokenCache.access_token && Date.now() < msalTokenCache.expires_at) {
    return msalTokenCache.access_token;
  }

  console.log('[AZURE-AUTH] Requesting MSAL token...');
  const tokenUrl = `${AZURE_AD_URL}/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const res = await axios.post(tokenUrl, {
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });

  msalTokenCache = {
    access_token: res.data.access_token,
    expires_at: Date.now() + (res.data.expires_in - 60) * 1000,
  };

  console.log(`[AZURE-AUTH] MSAL token obtained, expires in ${res.data.expires_in}s`);
  return msalTokenCache.access_token;
}

const graphClient = axios.create({ timeout: 10000 });

axiosRetry(graphClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response && error.response.status >= 500),
  onRetry: (retryCount, error) => console.log(`[AZURE-RETRY] Attempt ${retryCount}: ${error.message}`),
});

const breakerOptions = { timeout: 15000, errorThresholdPercentage: 50, resetTimeout: 30000, name: 'azure-ad-api' };

// Graph API: check if user exists by UPN
async function graphGetUser(upn) {
  const token = await getMSALToken();
  try {
    const res = await graphClient.get(`${AZURE_AD_URL}/v1.0/users/${upn}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { exists: true, user: res.data };
  } catch (err) {
    if (err.response && err.response.status === 404) return { exists: false, user: null };
    throw err;
  }
}

// Graph API: create user
async function graphCreateUser(displayName, mailNickname, upn) {
  const token = await getMSALToken();
  const res = await graphClient.post(`${AZURE_AD_URL}/v1.0/users`, {
    displayName,
    mailNickname,
    userPrincipalName: upn,
    accountEnabled: true,
    passwordProfile: {
      forceChangePasswordNextSignIn: true,
      password: generateCompliantPassword(),
    },
  }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  return res.data;
}

const validateBreaker = new CircuitBreaker(graphGetUser, breakerOptions);
const createBreaker = new CircuitBreaker(graphCreateUser, breakerOptions);

validateBreaker.on('open', () => console.log('[AZURE-CIRCUIT] VALIDATE OPEN'));
createBreaker.on('open', () => console.log('[AZURE-CIRCUIT] CREATE OPEN'));

// Real mode UPN generation with Graph API query
async function generateUpnReal(nombre, apellido) {
  const base = `${normalizeText(nombre)}.${normalizeText(apellido)}`;
  let upn = `${base}@clinicauandes.cl`;
  let counter = 1;

  while (true) {
    const result = await validateBreaker.fire(upn);
    if (!result.exists) return upn;
    counter++;
    upn = `${base}${counter}@clinicauandes.cl`;
    if (counter > 20) throw new Error('UPN dedup exceeded 20 attempts');
  }
}

// ============================================================
// ENDPOINTS
// ============================================================

app.get('/health', (_req, res) => {
  const health = { status: 'ok', service: 'adp-azuread', mock_mode: MOCK_MODE, timestamp: new Date().toISOString() };
  if (!MOCK_MODE) {
    health.azure_ad_url = AZURE_AD_URL;
    health.tenant_id = AZURE_TENANT_ID;
    health.circuit_breaker_validate = validateBreaker.status.name === 'open' ? 'OPEN' : 'CLOSED';
    health.circuit_breaker_create = createBreaker.status.name === 'open' ? 'OPEN' : 'CLOSED';
    health.token_cached = !!msalTokenCache.access_token && Date.now() < msalTokenCache.expires_at;
  } else {
    health.upns_existentes = mockExistingUpns.size;
    health.cuentas_creadas = mockCreatedAccounts.size;
  }
  res.json(health);
});

app.post('/api/azure-ad/validar-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email es requerido' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Formato de email inválido', email });

  const emailLower = email.toLowerCase();

  if (MOCK_MODE) {
    const exists = mockExistingUpns.has(emailLower) || mockCreatedAccounts.has(emailLower);
    const suggestedUpn = exists ? null : emailLower.includes('@clinicauandes.cl') ? emailLower : emailLower.replace(/@.*/, '@clinicauandes.cl');
    return res.json({ exists, upn: exists ? emailLower : null, suggestedUpn, mock_mode: true });
  }

  try {
    const result = await validateBreaker.fire(emailLower);
    res.json({
      exists: result.exists,
      upn: result.exists ? result.user.userPrincipalName : null,
      suggestedUpn: result.exists ? null : emailLower,
      mock_mode: false,
    });
  } catch (err) {
    console.error(`[AZURE-ERROR] validar-email: ${err.message}`);
    res.status(503).json({ error: 'Azure AD unavailable', mock_mode: false });
  }
});

app.post('/api/azure-ad/crear-cuenta', async (req, res) => {
  const { nombre, apellido, email } = req.body;
  if (!nombre || !apellido) return res.status(400).json({ error: 'nombre y apellido son requeridos' });

  if (MOCK_MODE) {
    const upn = generateUpnMock(nombre, apellido);
    mockExistingUpns.add(upn);
    mockCreatedAccounts.set(upn, { nombre, apellido, email: email || null, displayName: `${nombre} ${apellido}`, upn, accountEnabled: true, created_at: new Date().toISOString() });
    return res.status(201).json({ upn, created: true, displayName: `${nombre} ${apellido}`, accountEnabled: true, normalizado: { nombre_original: nombre, nombre_normalizado: normalizeText(nombre), apellido_original: apellido, apellido_normalizado: normalizeText(apellido) }, mock_mode: true, timestamp: new Date().toISOString() });
  }

  try {
    const upn = await generateUpnReal(nombre, apellido);
    const mailNickname = upn.split('@')[0];
    const user = await createBreaker.fire(`${nombre} ${apellido}`, mailNickname, upn);

    res.status(201).json({
      upn: user.userPrincipalName || upn,
      created: true,
      displayName: user.displayName,
      accountEnabled: user.accountEnabled,
      id: user.id,
      normalizado: { nombre_original: nombre, nombre_normalizado: normalizeText(nombre), apellido_original: apellido, apellido_normalizado: normalizeText(apellido) },
      mock_mode: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[AZURE-ERROR] crear-cuenta: ${err.message}`);
    if (err.response && err.response.status === 409) {
      return res.status(409).json({ error: 'UPN already exists in Azure AD', mock_mode: false });
    }
    res.status(503).json({ error: 'Azure AD unavailable', details: err.message, mock_mode: false });
  }
});

app.get('/api/azure-ad/cuentas', async (_req, res) => {
  if (MOCK_MODE) {
    return res.json({ total: mockCreatedAccounts.size, data: Array.from(mockCreatedAccounts.values()), mock_mode: true });
  }
  try {
    const token = await getMSALToken();
    const graphRes = await graphClient.get(`${AZURE_AD_URL}/v1.0/users`, { headers: { Authorization: `Bearer ${token}` } });
    const users = graphRes.data.value || [];
    res.json({ '@odata.context': graphRes.data['@odata.context'] || null, total: users.length, data: users, mock_mode: false });
  } catch (err) {
    res.status(503).json({ error: 'Azure AD unavailable', mock_mode: false });
  }
});

app.listen(PORT, () => {
  console.log(`adp-azuread running on port ${PORT} (MOCK_MODE=${MOCK_MODE})`);
  if (!MOCK_MODE) console.log(`  AZURE_AD_URL: ${AZURE_AD_URL}\n  TENANT: ${AZURE_TENANT_ID}`);
});
