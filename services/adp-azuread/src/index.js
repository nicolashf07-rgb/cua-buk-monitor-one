require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3007;
const MOCK_MODE = true;

app.use(cors());
app.use(express.json());

// Pre-existing UPNs in the mock Azure AD directory
const existingUpns = new Set([
  'maria.gonzalez@clinicauandes.cl',
  'juan.munoz@clinicauandes.cl',
  'catalina.rojas@clinicauandes.cl',
]);

// Track created accounts for deduplication
const createdAccounts = new Map();

// Normalize accents: María -> maria, González -> gonzalez
function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generate UPN with incremental deduplication
// nombre.apellido@clinicauandes.cl -> nombre.apellido2@ -> nombre.apellido3@
function generateUpn(nombre, apellido) {
  const normNombre = normalizeText(nombre);
  const normApellido = normalizeText(apellido);
  const base = `${normNombre}.${normApellido}`;
  let upn = `${base}@clinicauandes.cl`;
  let counter = 1;

  while (existingUpns.has(upn) || createdAccounts.has(upn)) {
    counter++;
    upn = `${base}${counter}@clinicauandes.cl`;
  }

  return upn;
}

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'adp-azuread',
    mock_mode: MOCK_MODE,
    upns_existentes: existingUpns.size,
    cuentas_creadas: createdAccounts.size,
    timestamp: new Date().toISOString(),
  });
});

// --- Validar email / UPN ---
app.post('/api/azure-ad/validar-email', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email es requerido' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Formato de email inválido', email });
  }

  const emailLower = email.toLowerCase();
  const exists = existingUpns.has(emailLower) || createdAccounts.has(emailLower);

  // Si existe, retorna el UPN; si no, sugiere uno basado en el email
  const suggestedUpn = exists
    ? null
    : emailLower.includes('@clinicauandes.cl')
      ? emailLower
      : emailLower.replace(/@.*/, '@clinicauandes.cl');

  res.json({
    exists,
    upn: exists ? emailLower : null,
    suggestedUpn,
    mock_mode: MOCK_MODE,
  });
});

// --- Crear cuenta Azure AD ---
app.post('/api/azure-ad/crear-cuenta', (req, res) => {
  const { nombre, apellido, email } = req.body;

  if (!nombre || !apellido) {
    return res.status(400).json({
      error: 'nombre y apellido son requeridos',
    });
  }

  const upn = generateUpn(nombre, apellido);

  // Registrar en directorio mock
  existingUpns.add(upn);
  createdAccounts.set(upn, {
    nombre,
    apellido,
    email: email || null,
    displayName: `${nombre} ${apellido}`,
    upn,
    accountEnabled: true,
    created_at: new Date().toISOString(),
  });

  res.status(201).json({
    upn,
    created: true,
    displayName: `${nombre} ${apellido}`,
    accountEnabled: true,
    normalizado: {
      nombre_original: nombre,
      nombre_normalizado: normalizeText(nombre),
      apellido_original: apellido,
      apellido_normalizado: normalizeText(apellido),
    },
    mock_mode: MOCK_MODE,
    timestamp: new Date().toISOString(),
  });
});

// --- Listar cuentas creadas (utility dev) ---
app.get('/api/azure-ad/cuentas', (_req, res) => {
  const cuentas = Array.from(createdAccounts.values());
  res.json({
    total: cuentas.length,
    data: cuentas,
    upns_preexistentes: Array.from(existingUpns).filter(
      (upn) => !createdAccounts.has(upn)
    ),
    mock_mode: MOCK_MODE,
  });
});

app.listen(PORT, () => {
  console.log(`adp-azuread running on port ${PORT} (MOCK_MODE=${MOCK_MODE})`);
});
