require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3005;
const MOCK_MODE = true;

app.use(cors());
app.use(express.json());

// Validar formato RUT chileno (12345678-9 o 12.345.678-9)
function isValidRut(rut) {
  if (!rut || typeof rut !== 'string') return false;
  const cleaned = rut.replace(/\./g, '').replace(/-/g, '');
  return /^\d{7,8}[0-9kK]$/.test(cleaned);
}

// Mock employee database - 3 empleados con datos realistas chilenos
const MOCK_EMPLOYEES = {
  '12345678-9': {
    rut: '12345678-9',
    nombre: 'María',
    apellido: 'González Pérez',
    email: 'maria.gonzalez@clinicauandes.cl',
    cargo: 'Médico Internista',
    area: 'Medicina Interna',
    fechaIngreso: '2020-03-15',
    bossFullName: 'Dr. Carlos Ruiz Tapia',
    bossEmail: 'cruiz@clinicauandes.cl',
  },
  '98765432-1': {
    rut: '98765432-1',
    nombre: 'Juan',
    apellido: 'Muñoz Silva',
    email: 'juan.munoz@clinicauandes.cl',
    cargo: 'Enfermero UCI',
    area: 'Unidad de Cuidados Intensivos',
    fechaIngreso: '2019-07-01',
    bossFullName: 'Dra. Ana López Fernández',
    bossEmail: 'alopez@clinicauandes.cl',
  },
  '11222333-4': {
    rut: '11222333-4',
    nombre: 'Catalina',
    apellido: 'Rojas Díaz',
    email: 'catalina.rojas@clinicauandes.cl',
    cargo: 'Administrativa',
    area: 'Admisión',
    fechaIngreso: '2021-11-20',
    bossFullName: 'Pedro Soto Castillo',
    bossEmail: 'psoto@clinicauandes.cl',
  },
};

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'adp-buk',
    mock_mode: MOCK_MODE,
    employees_count: Object.keys(MOCK_EMPLOYEES).length,
    timestamp: new Date().toISOString(),
  });
});

// --- Get employee by RUT ---
app.get('/api/buk/employees/:rut', (req, res) => {
  const { rut } = req.params;

  if (!isValidRut(rut)) {
    return res.status(400).json({
      error: 'Formato de RUT inválido',
      rut,
      ejemplo: '12345678-9',
      mock_mode: MOCK_MODE,
    });
  }

  const employee = MOCK_EMPLOYEES[rut];

  if (!employee) {
    return res.status(404).json({
      error: 'Empleado no encontrado en BUK',
      rut,
      mock_mode: MOCK_MODE,
    });
  }

  res.json({
    ...employee,
    mock_mode: MOCK_MODE,
  });
});

// --- List all employees (utility for dev) ---
app.get('/api/buk/employees', (_req, res) => {
  const employees = Object.values(MOCK_EMPLOYEES);
  res.json({
    total: employees.length,
    data: employees,
    mock_mode: MOCK_MODE,
  });
});

app.listen(PORT, () => {
  console.log(`adp-buk running on port ${PORT} (MOCK_MODE=${MOCK_MODE})`);
});
