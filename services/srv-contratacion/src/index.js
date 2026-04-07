require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper: genera idta CUA-2026-00001
async function generateIdta() {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total FROM contratacion.contrataciones WHERE idta LIKE $1`,
    [`CUA-${year}-%`]
  );
  const next = (result.rows[0].total || 0) + 1;
  return `CUA-${year}-${String(next).padStart(5, '0')}`;
}

// --- Health ---
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'srv-contratacion', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.json({ status: 'ok', service: 'srv-contratacion', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// --- Listar contrataciones ---
app.get('/api/contrataciones', async (req, res) => {
  try {
    const { estado_clinica, tipo_solicitud, origen } = req.query;
    let query = 'SELECT * FROM contratacion.contrataciones WHERE 1=1';
    const params = [];

    if (estado_clinica) { params.push(estado_clinica); query += ` AND estado_clinica = $${params.length}`; }
    if (tipo_solicitud) { params.push(tipo_solicitud); query += ` AND tipo_solicitud = $${params.length}`; }
    if (origen) { params.push(origen); query += ` AND origen = $${params.length}`; }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listando contrataciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Obtener contratación por ID ---
app.get('/api/contrataciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM contratacion.contrataciones WHERE id = $1', [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contratación no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo contratación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Crear contratación ---
app.post('/api/contrataciones', async (req, res) => {
  try {
    const id = uuidv4();
    const idta = await generateIdta();
    const {
      tipo_solicitud, origen, nombre, apellido1, apellido2, rut,
      cargo_rrhh, fecha_ingreso, fecha_inicio_contrato, tipo_contrato,
      bossfullname, bossemail,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO contratacion.contrataciones
        (id, idta, tipo_solicitud, origen, nombre, apellido1, apellido2, rut,
         cargo_rrhh, fecha_ingreso, fecha_inicio_contrato, tipo_contrato,
         bossfullname, bossemail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [id, idta, tipo_solicitud || null, origen || 'manual',
       nombre || null, apellido1 || null, apellido2 || null, rut || null,
       cargo_rrhh || null, fecha_ingreso || null, fecha_inicio_contrato || null,
       tipo_contrato || null, bossfullname || null, bossemail || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creando contratación:', err);
    res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
  }
});

// --- Actualizar contratación ---
app.put('/api/contrataciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo_solicitud, estado_clinica, estado_seguridad, estado_email,
      nombre, apellido1, apellido2, rut, cargo_rrhh,
      fecha_ingreso, fecha_inicio_contrato, tipo_contrato,
      bossfullname, bossemail, mesa_servicio_estado,
    } = req.body;

    const result = await pool.query(
      `UPDATE contratacion.contrataciones SET
         tipo_solicitud = COALESCE($2, tipo_solicitud),
         estado_clinica = COALESCE($3, estado_clinica),
         estado_seguridad = COALESCE($4, estado_seguridad),
         estado_email = COALESCE($5, estado_email),
         nombre = COALESCE($6, nombre),
         apellido1 = COALESCE($7, apellido1),
         apellido2 = COALESCE($8, apellido2),
         rut = COALESCE($9, rut),
         cargo_rrhh = COALESCE($10, cargo_rrhh),
         fecha_ingreso = COALESCE($11, fecha_ingreso),
         fecha_inicio_contrato = COALESCE($12, fecha_inicio_contrato),
         tipo_contrato = COALESCE($13, tipo_contrato),
         bossfullname = COALESCE($14, bossfullname),
         bossemail = COALESCE($15, bossemail),
         mesa_servicio_estado = COALESCE($16, mesa_servicio_estado),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, tipo_solicitud || null, estado_clinica || null, estado_seguridad || null,
       estado_email || null, nombre || null, apellido1 || null, apellido2 || null,
       rut || null, cargo_rrhh || null, fecha_ingreso || null,
       fecha_inicio_contrato || null, tipo_contrato || null,
       bossfullname || null, bossemail || null, mesa_servicio_estado || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contratación no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando contratación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`srv-contratacion running on port ${PORT}`);
});
