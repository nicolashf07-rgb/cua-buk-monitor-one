const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4007;

app.use(cors());
app.use(express.json());

// ============================================================
// CONFIG
// ============================================================
const LATENCY_MIN_MS = 50;
const LATENCY_MAX_MS = 300;
const ERROR_RATE = parseFloat(process.env.SANDBOX_ERROR_RATE || '0.03');

function simulateLatency() {
  const ms = Math.floor(Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS)) + LATENCY_MIN_MS;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// STATE: MSAL tokens + Azure AD directory
// ============================================================
const VALID_TOKENS = new Set();

const directory = new Map([
  ['maria.gonzalez@clinicauandes.cl', { id: uuidv4(), displayName: 'María González', userPrincipalName: 'maria.gonzalez@clinicauandes.cl', mail: 'maria.gonzalez@clinicauandes.cl', accountEnabled: true, jobTitle: 'Médico Internista' }],
  ['juan.munoz@clinicauandes.cl', { id: uuidv4(), displayName: 'Juan Muñoz', userPrincipalName: 'juan.munoz@clinicauandes.cl', mail: 'juan.munoz@clinicauandes.cl', accountEnabled: true, jobTitle: 'Enfermero UCI' }],
  ['catalina.rojas@clinicauandes.cl', { id: uuidv4(), displayName: 'Catalina Rojas', userPrincipalName: 'catalina.rojas@clinicauandes.cl', mail: 'catalina.rojas@clinicauandes.cl', accountEnabled: true, jobTitle: 'Administrativa' }],
]);

// ============================================================
// MIDDLEWARE: Bearer token validation (simula Graph API auth)
// ============================================================
function graphAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'InvalidAuthenticationToken', message: 'Access token is empty.' },
    });
  }
  const token = auth.split(' ')[1];
  if (!VALID_TOKENS.has(token)) {
    return res.status(401).json({
      error: { code: 'InvalidAuthenticationToken', message: 'Access token validation failure. Token expired or invalid.' },
    });
  }
  next();
}

// ============================================================
// ENDPOINTS
// ============================================================

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sandbox-azuread', type: 'sandbox', users_count: directory.size, timestamp: new Date().toISOString() });
});

// POST /{tenant}/oauth2/v2.0/token - MSAL client credentials
app.post('/:tenant/oauth2/v2.0/token', async (req, res) => {
  await simulateLatency();
  const { client_id, client_secret, grant_type, scope } = req.body;

  if (grant_type !== 'client_credentials') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'AADSTS70011: Only client_credentials grant supported.',
    });
  }
  if (!client_id || !client_secret) {
    return res.status(400).json({
      error: 'invalid_client',
      error_description: 'AADSTS7000215: Invalid client secret provided.',
    });
  }

  const token = `eyJ-sandbox-azuread-${uuidv4()}`;
  VALID_TOKENS.add(token);
  setTimeout(() => VALID_TOKENS.delete(token), 3600000);

  res.json({
    token_type: 'Bearer',
    expires_in: 3599,
    ext_expires_in: 3599,
    access_token: token,
  });
});

// GET /v1.0/users/{upn} - Get user by UPN (Graph API format)
app.get('/v1.0/users/:upn', graphAuthMiddleware, async (req, res) => {
  await simulateLatency();

  if (Math.random() < ERROR_RATE) {
    return res.status(503).json({
      error: { code: 'ServiceUnavailable', message: 'Azure AD temporarily unavailable' },
    });
  }

  const { upn } = req.params;
  const user = directory.get(upn.toLowerCase());

  if (!user) {
    return res.status(404).json({
      error: { code: 'Request_ResourceNotFound', message: `Resource '${upn}' does not exist.` },
    });
  }

  res.json({ '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users/$entity', ...user });
});

// POST /v1.0/users - Create user (Graph API format)
app.post('/v1.0/users', graphAuthMiddleware, async (req, res) => {
  await simulateLatency();

  if (Math.random() < ERROR_RATE) {
    return res.status(503).json({
      error: { code: 'ServiceUnavailable', message: 'Azure AD temporarily unavailable' },
    });
  }

  const { displayName, mailNickname, userPrincipalName, accountEnabled, passwordProfile } = req.body;

  // Validate password complexity (Azure AD policy: min 8 chars, 3 of 4 categories)
  if (passwordProfile && passwordProfile.password) {
    const pwd = passwordProfile.password;
    let categories = 0;
    if (/[A-Z]/.test(pwd)) categories++;
    if (/[a-z]/.test(pwd)) categories++;
    if (/[0-9]/.test(pwd)) categories++;
    if (/[^A-Za-z0-9]/.test(pwd)) categories++;
    if (pwd.length < 8 || categories < 3) {
      return res.status(400).json({
        error: {
          code: 'PasswordPolicyViolation',
          message: 'Password must be at least 8 characters and contain at least 3 of: uppercase, lowercase, digit, special character.',
        },
      });
    }
  }

  if (!displayName || !mailNickname || !userPrincipalName) {
    return res.status(400).json({
      error: {
        code: 'Request_BadRequest',
        message: 'Required properties: displayName, mailNickname, userPrincipalName',
        details: [
          !displayName && { code: 'PropertyRequired', message: 'displayName' },
          !mailNickname && { code: 'PropertyRequired', message: 'mailNickname' },
          !userPrincipalName && { code: 'PropertyRequired', message: 'userPrincipalName' },
        ].filter(Boolean),
      },
    });
  }

  const upnLower = userPrincipalName.toLowerCase();
  if (directory.has(upnLower)) {
    return res.status(409).json({
      error: {
        code: 'Request_Conflict',
        message: `A user with UPN '${userPrincipalName}' already exists.`,
      },
    });
  }

  const newUser = {
    id: uuidv4(),
    displayName,
    mailNickname,
    userPrincipalName: upnLower,
    mail: upnLower,
    accountEnabled: accountEnabled !== false,
    jobTitle: null,
    createdDateTime: new Date().toISOString(),
  };

  directory.set(upnLower, newUser);

  res.status(201).json(newUser);
});

// GET /v1.0/users - List users (Graph API format)
app.get('/v1.0/users', graphAuthMiddleware, async (req, res) => {
  await simulateLatency();
  const users = Array.from(directory.values());
  res.json({
    '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users',
    value: users,
  });
});

app.listen(PORT, () => {
  console.log(`sandbox-azuread running on port ${PORT} (simulates Azure AD Graph API)`);
});
