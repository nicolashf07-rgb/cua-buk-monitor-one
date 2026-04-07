require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3005;
const MOCK_MODE = true;

app.use(cors());
app.use(express.json());

// ============================================================
// HEALTH
// ============================================================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'adp-gateway', services: ['buk', 'sap', 'azuread'], mock_mode: MOCK_MODE, timestamp: new Date().toISOString() });
});

// ============================================================
// BUK HR ADAPTER
// ============================================================
function isValidRut(rut) {
  if (!rut || typeof rut !== 'string') return false;
  const cleaned = rut.replace(/\./g, '').replace(/-/g, '');
  return /^\d{7,8}[0-9kK]$/.test(cleaned);
}

const MOCK_EMPLOYEES = {
  '12345678-9': { rut: '12345678-9', nombre: 'María', apellido: 'González Pérez', email: 'maria.gonzalez@clinicauandes.cl', cargo: 'Médico Internista', area: 'Medicina Interna', fechaIngreso: '2020-03-15', bossFullName: 'Dr. Carlos Ruiz Tapia', bossEmail: 'cruiz@clinicauandes.cl' },
  '98765432-1': { rut: '98765432-1', nombre: 'Juan', apellido: 'Muñoz Silva', email: 'juan.munoz@clinicauandes.cl', cargo: 'Enfermero UCI', area: 'UCI', fechaIngreso: '2019-07-01', bossFullName: 'Dra. Ana López Fernández', bossEmail: 'alopez@clinicauandes.cl' },
  '11222333-4': { rut: '11222333-4', nombre: 'Catalina', apellido: 'Rojas Díaz', email: 'catalina.rojas@clinicauandes.cl', cargo: 'Administrativa', area: 'Admisión', fechaIngreso: '2021-11-20', bossFullName: 'Pedro Soto Castillo', bossEmail: 'psoto@clinicauandes.cl' },
};

app.get('/api/buk/employees', (_req, res) => {
  res.json({ total: Object.keys(MOCK_EMPLOYEES).length, data: Object.values(MOCK_EMPLOYEES), mock_mode: MOCK_MODE });
});

app.get('/api/buk/employees/:rut', (req, res) => {
  const { rut } = req.params;
  if (!isValidRut(rut)) return res.status(400).json({ error: 'Formato de RUT inválido', rut, mock_mode: MOCK_MODE });
  const emp = MOCK_EMPLOYEES[rut];
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado en BUK', rut, mock_mode: MOCK_MODE });
  res.json({ ...emp, mock_mode: MOCK_MODE });
});

// ============================================================
// SAP TRAKCARE ADAPTER
// ============================================================
let bpCounter = 1000000;

const bpSchema = Joi.object({
  title: Joi.string().allow('').optional(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  second_last_name: Joi.string().allow('').optional(),
  id_number: Joi.string().required(),
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
  phy_num: Joi.string().when('phy_ind', { is: true, then: Joi.string().required(), otherwise: Joi.string().allow('').optional() }),
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

function toPascalCase(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')] = value;
  }
  return result;
}

app.post('/api/sap/business-partner', (req, res) => {
  const { error, value } = bpSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: 'Validación SAP BP fallida', details: error.details.map(d => ({ campo: d.path.join('.'), mensaje: d.message })), total_errores: error.details.length });
  bpCounter++;
  res.status(201).json({ gpart: `BP-MOCK-${bpCounter}`, status: 'created', message: 'Business Partner creado en SAP (mock)', data: toPascalCase(value), campos_recibidos: Object.keys(value).length, mock_mode: MOCK_MODE, timestamp: new Date().toISOString() });
});

app.get('/api/sap/business-partner/:gpart', (req, res) => {
  res.json({ gpart: req.params.gpart, status: 'active', mock_mode: MOCK_MODE, timestamp: new Date().toISOString() });
});

// ============================================================
// AZURE AD ADAPTER
// ============================================================
const existingUpns = new Set(['maria.gonzalez@clinicauandes.cl', 'juan.munoz@clinicauandes.cl', 'catalina.rojas@clinicauandes.cl']);
const createdAccounts = new Map();

function normalizeText(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function generateUpn(nombre, apellido) {
  const base = `${normalizeText(nombre)}.${normalizeText(apellido)}`;
  let upn = `${base}@clinicauandes.cl`;
  let counter = 1;
  while (existingUpns.has(upn) || createdAccounts.has(upn)) { counter++; upn = `${base}${counter}@clinicauandes.cl`; }
  return upn;
}

app.post('/api/azure-ad/validar-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email es requerido' });
  const emailLower = email.toLowerCase();
  const exists = existingUpns.has(emailLower) || createdAccounts.has(emailLower);
  res.json({ exists, upn: exists ? emailLower : null, suggestedUpn: exists ? null : emailLower.includes('@clinicauandes.cl') ? emailLower : emailLower.replace(/@.*/, '@clinicauandes.cl'), mock_mode: MOCK_MODE });
});

app.post('/api/azure-ad/crear-cuenta', (req, res) => {
  const { nombre, apellido, email } = req.body;
  if (!nombre || !apellido) return res.status(400).json({ error: 'nombre y apellido son requeridos' });
  const upn = generateUpn(nombre, apellido);
  existingUpns.add(upn);
  createdAccounts.set(upn, { nombre, apellido, email: email || null, displayName: `${nombre} ${apellido}`, upn, accountEnabled: true, created_at: new Date().toISOString() });
  res.status(201).json({ upn, created: true, displayName: `${nombre} ${apellido}`, accountEnabled: true, mock_mode: MOCK_MODE, timestamp: new Date().toISOString() });
});

app.get('/api/azure-ad/cuentas', (_req, res) => {
  res.json({ total: createdAccounts.size, data: Array.from(createdAccounts.values()), mock_mode: MOCK_MODE });
});

// ============================================================
app.listen(PORT, () => {
  console.log(`adp-gateway running on port ${PORT} (MOCK_MODE=${MOCK_MODE}) - BUK + SAP + AzureAD`);
});
