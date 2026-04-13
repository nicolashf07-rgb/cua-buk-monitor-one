require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const JWT_SECRET = process.env.JWT_SECRET || 'cua-buk-secret-dev';

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

// --- Validación de cargo: GET + PUT área/departamento ---
app.get('/api/contrataciones/:id/cargo', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM contratacion.validacion_cargo_form WHERE contratacion_id = $1 ORDER BY created_at DESC LIMIT 1', [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Validación de cargo no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo cargo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/api/contrataciones/:id/cargo', async (req, res) => {
  try {
    const { id } = req.params;
    const { area, cargo, centro_costo, jefe_directo, jefe_email } = req.body;
    // Check if exists
    const existing = await pool.query(
      'SELECT id FROM contratacion.validacion_cargo_form WHERE contratacion_id = $1', [id]
    );
    if (existing.rows.length === 0) {
      // Create
      const result = await pool.query(
        `INSERT INTO contratacion.validacion_cargo_form (contratacion_id, area, cargo, centro_costo, jefe_directo, jefe_email)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, area || null, cargo || null, centro_costo || null, jefe_directo || null, jefe_email || null]
      );
      return res.status(201).json(result.rows[0]);
    }
    // Update
    const result = await pool.query(
      `UPDATE contratacion.validacion_cargo_form SET
         area = COALESCE($2, area),
         cargo = COALESCE($3, cargo),
         centro_costo = COALESCE($4, centro_costo),
         jefe_directo = COALESCE($5, jefe_directo),
         jefe_email = COALESCE($6, jefe_email),
         updated_at = NOW()
       WHERE contratacion_id = $1 RETURNING *`,
      [id, area || null, cargo || null, centro_costo || null, jefe_directo || null, jefe_email || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando cargo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Validación BP (Cargo HIS / phy_num) ---
app.get('/api/contrataciones/:id/bp', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM contratacion.validacion_bp WHERE contratacion_id = $1 ORDER BY created_at DESC LIMIT 1', [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Validación BP no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo BP:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Reportes (consolidado de srv-reportes) ---
app.get('/api/reportes/historico', async (req, res) => {
  try {
    const { estado_clinica, tipo_solicitud } = req.query;
    let query = 'SELECT * FROM reportes.v_historico WHERE 1=1';
    const params = [];
    if (estado_clinica) { params.push(estado_clinica); query += ` AND estado_clinica = $${params.length}`; }
    if (tipo_solicitud) { params.push(tipo_solicitud); query += ` AND tipo_solicitud = $${params.length}`; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ total: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Error obteniendo historico:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/reportes/refresh', async (_req, res) => {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY reportes.v_historico');
    res.json({ status: 'ok', message: 'Vista materializada actualizada', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error refrescando vista:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Auth (consolidado de srv-usuarios) ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nombre, apellido, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });
    const existing = await pool.query('SELECT id FROM usuarios.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'El email ya esta registrado' });
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'SOLICITANTE';
    await pool.query('INSERT INTO usuarios.users (id, email, password_hash, nombre, apellido) VALUES ($1, $2, $3, $4, $5)', [id, email, hashedPassword, nombre || null, apellido || null]);
    const roleResult = await pool.query('SELECT id FROM usuarios.roles WHERE nombre = $1', [userRole]);
    if (roleResult.rows.length > 0) await pool.query('INSERT INTO usuarios.user_roles (user_id, role_id) VALUES ($1, $2)', [id, roleResult.rows[0].id]);
    res.status(201).json({ id, email, nombre, apellido, roles: [userRole] });
  } catch (err) { console.error('Error en register:', err); res.status(500).json({ error: 'Error interno del servidor' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });
    const userResult = await pool.query('SELECT * FROM usuarios.users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Credenciales invalidas' });
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Credenciales invalidas' });
    const rolesResult = await pool.query('SELECT r.nombre FROM usuarios.user_roles ur JOIN usuarios.roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [user.id]);
    const roles = rolesResult.rows.map((r) => r.nombre);
    const token = jwt.sign({ userId: user.id, email: user.email, roles }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, email: user.email, nombre: user.nombre, apellido: user.apellido, roles } });
  } catch (err) { console.error('Error en login:', err); res.status(500).json({ error: 'Error interno del servidor' }); }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token no proporcionado' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userResult = await pool.query('SELECT id, email, nombre, apellido FROM usuarios.users WHERE id = $1', [decoded.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const rolesResult = await pool.query('SELECT r.nombre FROM usuarios.user_roles ur JOIN usuarios.roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [decoded.userId]);
    const roles = rolesResult.rows.map((r) => r.nombre);
    res.json({ ...userResult.rows[0], roles });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token invalido o expirado' });
    console.error('Error en /me:', err); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Run migration on startup, then start server
const { migrate } = require('./migrate');
migrate().then(() => {
  app.listen(PORT, () => {
    console.log(`srv-contratacion running on port ${PORT} (includes reportes + auth)`);
  });
}).catch((err) => {
  console.error('Migration failed, starting anyway:', err.message);
  app.listen(PORT, () => {
    console.log(`srv-contratacion running on port ${PORT} (migration failed)`);
  });
});
