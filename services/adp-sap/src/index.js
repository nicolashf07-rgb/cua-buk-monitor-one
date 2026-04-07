require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3006;
const MOCK_MODE = true;

app.use(cors());
app.use(express.json());

// Incrementing counter for mock BPs
let bpCounter = 1000000;

// Joi schema: 38 campos en 6 categorías con validación condicional
const businessPartnerSchema = Joi.object({
  // --- Categoría 1: Identidad (11 campos) ---
  title: Joi.string().allow('').optional(),
  first_name: Joi.string().required().messages({
    'any.required': 'first_name es requerido',
  }),
  last_name: Joi.string().required().messages({
    'any.required': 'last_name es requerido',
  }),
  second_last_name: Joi.string().allow('').optional(),
  id_number: Joi.string().required().messages({
    'any.required': 'id_number (RUT) es requerido',
  }),
  id_type: Joi.string().valid('RUT', 'PASSPORT', 'DNI').default('RUT'),
  birth_date: Joi.string().allow('').optional(),
  gender: Joi.string().valid('M', 'F', 'O', '').allow('').optional(),
  nationality: Joi.string().allow('').optional(),
  marital_status: Joi.string().valid('S', 'C', 'D', 'V', '').allow('').optional(),
  name_supplement: Joi.string().allow('').optional(),

  // --- Categoría 2: Dirección (6 campos) ---
  street: Joi.string().allow('').optional(),
  house_number: Joi.string().allow('').optional(),
  city: Joi.string().allow('').optional(),
  region: Joi.string().allow('').optional(),
  postal_code: Joi.string().allow('').optional(),
  country: Joi.string().max(3).default('CL'),

  // --- Categoría 3: Contacto (3 campos) ---
  telephone: Joi.string().allow('').optional(),
  mobile: Joi.string().allow('').optional(),
  email: Joi.string().email().allow('').optional(),

  // --- Categoría 4: Fiscal (2 campos) ---
  tax_number: Joi.string().allow('').optional(),
  tax_type: Joi.string().allow('').optional(),

  // --- Categoría 5: Personal/Laboral (5 campos) ---
  bank_account: Joi.string().allow('').optional(),
  bank_key: Joi.string().allow('').optional(),
  payment_method: Joi.string().allow('').optional(),
  occupation: Joi.string().allow('').optional(),
  department: Joi.string().allow('').optional(),

  // --- Categoría 6: Healthcare IS-H (11 campos) ---
  phy_ind: Joi.boolean().default(false),
  // phy_num requerido SOLO si phy_ind es true
  phy_num: Joi.string().when('phy_ind', {
    is: true,
    then: Joi.string().required().messages({
      'any.required': 'phy_num es requerido cuando phy_ind es true (médico registrado)',
    }),
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

// Mapeo camelCase -> PascalCase para respuesta SAP
function toPascalCase(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const pascalKey = key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    result[pascalKey] = value;
  }
  return result;
}

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'adp-sap',
    mock_mode: MOCK_MODE,
    bp_counter: bpCounter,
    timestamp: new Date().toISOString(),
  });
});

// --- Create Business Partner ---
app.post('/api/sap/business-partner', (req, res) => {
  const { error, value } = businessPartnerSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      error: 'Validación SAP BP fallida',
      details: error.details.map((d) => ({
        campo: d.path.join('.'),
        mensaje: d.message,
        tipo: d.type,
      })),
      total_errores: error.details.length,
    });
  }

  bpCounter++;

  const responsePascal = toPascalCase(value);

  res.status(201).json({
    gpart: `BP-MOCK-${bpCounter}`,
    status: 'created',
    message: 'Business Partner creado en SAP (mock)',
    data: responsePascal,
    campos_recibidos: Object.keys(value).length,
    mock_mode: MOCK_MODE,
    timestamp: new Date().toISOString(),
  });
});

// --- Get Business Partner (utility) ---
app.get('/api/sap/business-partner/:gpart', (req, res) => {
  const { gpart } = req.params;
  res.json({
    gpart,
    status: 'active',
    message: 'Business Partner consultado (mock)',
    mock_mode: MOCK_MODE,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`adp-sap running on port ${PORT} (MOCK_MODE=${MOCK_MODE})`);
});
