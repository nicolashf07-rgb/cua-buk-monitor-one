require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino/file', options: { destination: 1 } } } : {}),
  redact: ['req.headers.authorization', 'password', 'password_hash', 'mfa_secret'],
  serializers: { err: pino.stdSerializers.err },
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET no configurado. Setear variable de entorno.');
  process.exit(1);
}

const helmet = require('helmet');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8000').split(',');

const app = express();
const PORT = process.env.PORT || 3002;

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Correlation ID middleware
app.use((req, _res, next) => {
  req.correlationId = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// --- Security Middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const token = authHeader.split(' ')[1];
    if (tokenBlacklist.has(token)) return res.status(401).json({ error: 'Token revocado' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado' });
    return res.status(401).json({ error: 'Token invalido' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) return res.status(403).json({ error: 'Sin roles asignados' });
    const hasRole = req.user.roles.some(r => roles.includes(r) || r === 'admin');
    if (!hasRole) return res.status(403).json({ error: 'Permisos insuficientes', requerido: roles });
    next();
  };
}

// --- Audit Logger ---
async function auditLog(req, action, detail) {
  try {
    await pool.query(
      `INSERT INTO contratacion.auditoria_workflow (contratacion_id, paso_wf, usuario_ejecutor, detalle, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [null, action, req.user?.email || 'anonymous', detail, req.ip]
    );
  } catch (_) { /* audit failure should not break request */ }
}

const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// --- Token Blacklist (in-memory, produccion usar Redis) ---
const tokenBlacklist = new Set();
setInterval(() => { tokenBlacklist.clear(); }, 3600000);

// --- CSRF Token Generation ---
function generateCsrfToken() { return crypto.randomBytes(32).toString('hex'); }
const csrfTokens = new Map(); // sessionId → token
setInterval(() => { csrfTokens.clear(); }, 3600000);

function csrfMiddleware(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const csrfHeader = req.headers['x-csrf-token'];
  const userId = req.user?.userId;
  if (!userId) return next(); // auth middleware handles this
  const storedToken = csrfTokens.get(userId);
  if (!storedToken || storedToken !== csrfHeader) {
    return res.status(403).json({ error: 'Token CSRF invalido o faltante' });
  }
  next();
}

// --- Account Lockout ---
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

async function isAccountLocked(email) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as fails FROM usuarios.login_audit
       WHERE email = $1 AND success = false AND created_at > NOW() - INTERVAL '15 minutes'`,
      [email]
    );
    return parseInt(result.rows[0].fails) >= LOCKOUT_THRESHOLD;
  } catch { return false; }
}

async function recordLoginAttempt(email, success, ip, reason) {
  try {
    await pool.query(
      `INSERT INTO usuarios.login_audit (email, success, ip_address, failure_reason) VALUES ($1, $2, $3, $4)`,
      [email, success, ip, reason || null]
    );
  } catch (_) { /* non-blocking */ }
}

// --- Request Logger Middleware ---
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip,
      user: req.user?.email || 'anonymous',
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    originalEnd.apply(res, args);
  };
  next();
}

// --- MFA Enforcement for admin ---
function requireMfaForAdmin(req, res, next) {
  if (req.user?.roles?.includes('admin') && !req.user?.mfa) {
    return res.status(403).json({
      error: 'MFA requerido para administradores',
      hint: 'Use POST /api/auth/mfa/verify para login con MFA',
      mfa_required: true,
    });
  }
  next();
}

app.use(requestLogger);

// --- Input Validation Schemas ---
const VALID_TIPOS = ['SAP', 'NoSAP'];
const VALID_ORIGENES = ['buk', 'manual'];
const VALID_ESTADOS_CLINICA = ['Enable', 'Seguridad', 'Disable'];
const RUT_REGEX = /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/;

function validateContratacionInput(body) {
  const errors = [];
  if (body.nombre && (typeof body.nombre !== 'string' || body.nombre.length > 250)) errors.push('nombre: max 250 chars');
  if (body.apellido1 && (typeof body.apellido1 !== 'string' || body.apellido1.length > 250)) errors.push('apellido1: max 250 chars');
  if (body.rut && !RUT_REGEX.test(body.rut)) errors.push('rut: formato invalido (ej: 12.345.678-9)');
  if (body.tipo_solicitud && !VALID_TIPOS.includes(body.tipo_solicitud)) errors.push(`tipo_solicitud: debe ser ${VALID_TIPOS.join(' o ')}`);
  if (body.origen && !VALID_ORIGENES.includes(body.origen)) errors.push(`origen: debe ser ${VALID_ORIGENES.join(' o ')}`);
  if (body.estado_clinica && !VALID_ESTADOS_CLINICA.includes(body.estado_clinica)) errors.push('estado_clinica: valor invalido');
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) errors.push('email: formato invalido');
  return errors;
}

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

// --- Catalogo Cargo HIS ---
app.get('/api/cargo-his', authMiddleware, async (_req, res) => {
  try {
    const result = await pool.query('SELECT codigo, nombre FROM contratacion.cargo_his_catalogo WHERE activo = true ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo cargo HIS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Listar contrataciones (auth + role) ---
app.get('/api/contrataciones', authMiddleware, requireRole('admin', 'cargo', 'bd', 'cuenta', 'visualizar'), async (req, res) => {
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
    logger.error('Error listando contrataciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Obtener contratación por ID ---
app.get('/api/contrataciones/:id', authMiddleware, requireRole('admin', 'cargo', 'bd', 'cuenta', 'visualizar'), async (req, res) => {
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
    logger.error('Error obteniendo contratación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Crear contratación ---
app.post('/api/contrataciones', authMiddleware, requireMfaForAdmin, requireRole('admin', 'cargo'), csrfMiddleware, async (req, res) => {
  try {
    const validationErrors = validateContratacionInput(req.body);
    if (validationErrors.length > 0) return res.status(400).json({ error: 'Datos invalidos', detalles: validationErrors });
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
    logger.error('Error creando contratación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Actualizar contratación ---
app.put('/api/contrataciones/:id', authMiddleware, requireMfaForAdmin, requireRole('admin', 'cargo', 'bd'), csrfMiddleware, async (req, res) => {
  try {
    const validationErrors = validateContratacionInput(req.body);
    if (validationErrors.length > 0) return res.status(400).json({ error: 'Datos invalidos', detalles: validationErrors });
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
    logger.error('Error actualizando contratación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Validación de cargo: GET + PUT área/departamento ---
app.get('/api/contrataciones/:id/cargo', authMiddleware, requireRole('admin', 'cargo', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM contratacion.validacion_cargo_form WHERE contratacion_id = $1 ORDER BY created_at DESC LIMIT 1', [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Validación de cargo no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error obteniendo cargo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/api/contrataciones/:id/cargo', authMiddleware, requireMfaForAdmin, requireRole('admin', 'cargo'), csrfMiddleware, async (req, res) => {
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
    logger.error('Error actualizando cargo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Validación BP (Cargo HIS / phy_num) ---
app.get('/api/contrataciones/:id/bp', authMiddleware, requireRole('admin', 'bd', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM contratacion.validacion_bp WHERE contratacion_id = $1 ORDER BY created_at DESC LIMIT 1', [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Validación BP no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error obteniendo BP:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Reportes (consolidado de srv-reportes) ---
app.get('/api/reportes/historico', authMiddleware, requireRole('admin', 'visualizar'), async (req, res) => {
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
    logger.error('Error obteniendo historico:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/reportes/refresh', authMiddleware, requireRole('admin'), async (_req, res) => {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY reportes.v_historico');
    res.json({ status: 'ok', message: 'Vista materializada actualizada', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Error refrescando vista:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- CSRF token endpoint ---
app.get('/api/auth/csrf', authMiddleware, (req, res) => {
  const csrfToken = generateCsrfToken();
  csrfTokens.set(req.user.userId, csrfToken);
  res.json({ csrf_token: csrfToken });
});

// --- Auth (consolidado de srv-usuarios) ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nombre, apellido, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });
    if (password.length < 12) return res.status(400).json({ error: 'Password debe tener minimo 12 caracteres' });
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password debe tener mayuscula, numero y caracter especial' });
    }
    const existing = await pool.query('SELECT id FROM usuarios.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'El email ya esta registrado' });
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'SOLICITANTE';
    await pool.query('INSERT INTO usuarios.users (id, email, password_hash, nombre, apellido) VALUES ($1, $2, $3, $4, $5)', [id, email, hashedPassword, nombre || null, apellido || null]);
    const roleResult = await pool.query('SELECT id FROM usuarios.roles WHERE nombre = $1', [userRole]);
    if (roleResult.rows.length > 0) await pool.query('INSERT INTO usuarios.user_roles (user_id, role_id) VALUES ($1, $2)', [id, roleResult.rows[0].id]);
    res.status(201).json({ id, email, nombre, apellido, roles: [userRole] });
  } catch (err) { logger.error('Error en register:', err); res.status(500).json({ error: 'Error interno del servidor' }); }
});

// Rate limiting para login (in-memory, simple)
const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const attempts = loginAttempts.get(key) || [];
  const recent = attempts.filter(t => now - t < 60000); // ventana de 1 minuto
  if (recent.length >= 5) {
    return res.status(429).json({ error: 'Demasiados intentos. Espere 1 minuto.' });
  }
  recent.push(now);
  loginAttempts.set(key, recent);
  next();
}

app.post('/api/auth/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email y password son requeridos' });

    // Account lockout check
    if (await isAccountLocked(email)) {
      await recordLoginAttempt(email, false, req.ip, 'account_locked');
      return res.status(423).json({ error: 'Cuenta bloqueada temporalmente. Intente en 15 minutos.' });
    }

    const userResult = await pool.query('SELECT * FROM usuarios.users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      await recordLoginAttempt(email, false, req.ip, 'user_not_found');
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await recordLoginAttempt(email, false, req.ip, 'wrong_password');
      await auditLog(req, 'LOGIN_FAILED', `Intento fallido: ${email}`);
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const rolesResult = await pool.query('SELECT r.nombre FROM usuarios.user_roles ur JOIN usuarios.roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [user.id]);
    const roles = rolesResult.rows.map((r) => r.nombre);

    // Si admin tiene MFA configurado, forzar login MFA
    if (roles.includes('admin') && user.mfa_enabled) {
      return res.status(200).json({ mfa_required: true, message: 'MFA requerido. Use /api/auth/mfa/verify' });
    }

    await recordLoginAttempt(email, true, req.ip, null);
    await auditLog(req, 'LOGIN', `Login exitoso: ${email}`);
    const token = jwt.sign({ userId: user.id, email: user.email, roles }, JWT_SECRET, { expiresIn: '1h' });

    // Generar CSRF token para la sesion
    const csrfToken = generateCsrfToken();
    csrfTokens.set(user.id, csrfToken);

    res.json({ token, csrf_token: csrfToken, user: { id: user.id, email: user.email, nombre: user.nombre, apellido: user.apellido, roles } });
  } catch (err) { logger.error('Error en login:', err); res.status(500).json({ error: 'Error interno del servidor' }); }
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
    logger.error('Error en /me:', err); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Logout (revocar token) ---
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  tokenBlacklist.add(req.token);
  await auditLog(req, 'LOGOUT', `Logout: ${req.user.email}`);
  res.json({ message: 'Sesion cerrada' });
});

// --- Refresh token (emitir nuevo antes de expirar) ---
app.post('/api/auth/refresh', authMiddleware, async (req, res) => {
  try {
    // Blacklist el token actual
    tokenBlacklist.add(req.token);
    // Emitir nuevo token con los mismos claims
    const newToken = jwt.sign(
      { userId: req.user.userId, email: req.user.email, roles: req.user.roles },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    await auditLog(req, 'TOKEN_REFRESH', `Token renovado: ${req.user.email}`);
    res.json({ token: newToken });
  } catch (err) {
    res.status(500).json({ error: 'Error renovando token' });
  }
});

// --- TOTP/MFA Setup (infraestructura) ---
app.post('/api/auth/mfa/setup', authMiddleware, async (req, res) => {
  try {
    const secret = crypto.randomBytes(20).toString('hex');
    // Guardar secret asociado al usuario (en produccion usar tabla dedicada)
    await pool.query(
      `UPDATE usuarios.users SET mfa_secret = $1 WHERE id = $2`,
      [secret, req.user.userId]
    );
    // Generar URI para app authenticator (otpauth://totp/CUA-BUK:{email}?secret={base32}&issuer=CUA-BUK)
    const base32Secret = Buffer.from(secret, 'hex').toString('base64').replace(/=/g, '');
    const otpauthUri = `otpauth://totp/CUA-BUK:${req.user.email}?secret=${base32Secret}&issuer=CUA-BUK&digits=6&period=30`;
    await auditLog(req, 'MFA_SETUP', `MFA configurado: ${req.user.email}`);
    res.json({ secret: base32Secret, otpauth_uri: otpauthUri, message: 'Escanear QR con Google Authenticator' });
  } catch (err) {
    res.status(500).json({ error: 'Error configurando MFA' });
  }
});

app.post('/api/auth/mfa/verify', async (req, res) => {
  try {
    const { email, password, totp_code } = req.body;
    if (!email || !password || !totp_code) return res.status(400).json({ error: 'email, password y totp_code requeridos' });

    // Verificar credenciales normales
    const userResult = await pool.query('SELECT * FROM usuarios.users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Credenciales invalidas' });
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Credenciales invalidas' });

    // Verificar TOTP (time-based: ventana de 30s, +-1 step)
    if (!user.mfa_secret) return res.status(400).json({ error: 'MFA no configurado para este usuario' });

    const time = Math.floor(Date.now() / 30000);
    const validCodes = [-1, 0, 1].map(offset => {
      const hmac = crypto.createHmac('sha1', Buffer.from(user.mfa_secret, 'hex'));
      hmac.update(Buffer.from(BigInt(time + offset).toString(16).padStart(16, '0'), 'hex'));
      const hash = hmac.digest();
      const offset_val = hash[hash.length - 1] & 0xf;
      const code = ((hash[offset_val] & 0x7f) << 24 | hash[offset_val + 1] << 16 | hash[offset_val + 2] << 8 | hash[offset_val + 3]) % 1000000;
      return String(code).padStart(6, '0');
    });

    if (!validCodes.includes(totp_code)) {
      await auditLog(req, 'MFA_FAILED', `TOTP invalido: ${email}`);
      return res.status(401).json({ error: 'Codigo TOTP invalido' });
    }

    // Login exitoso con MFA
    const rolesResult = await pool.query('SELECT r.nombre FROM usuarios.user_roles ur JOIN usuarios.roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [user.id]);
    const roles = rolesResult.rows.map(r => r.nombre);
    const token = jwt.sign({ userId: user.id, email: user.email, roles, mfa: true }, JWT_SECRET, { expiresIn: '1h' });
    await auditLog(req, 'LOGIN_MFA', `Login MFA exitoso: ${email}`);
    res.json({ token, user: { id: user.id, email: user.email, roles }, mfa_verified: true });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando MFA' });
  }
});

// --- Global Error Handler (prevent stack trace leaks) ---
app.use((err, req, res, _next) => {
  logger.error({ err, correlationId: req.correlationId, path: req.originalUrl }, 'Unhandled error');
  res.status(500).json({ error: 'Error interno del servidor', correlationId: req.correlationId });
});

// Unhandled rejection / exception safety net
process.on('unhandledRejection', (reason) => { logger.error({ err: reason }, 'Unhandled rejection'); });
process.on('uncaughtException', (err) => { logger.fatal({ err }, 'Uncaught exception'); process.exit(1); });

// Run migration on startup, then start server
const { migrate } = require('./migrate');
migrate().then(() => {
  app.listen(PORT, () => {
    logger.info(`srv-contratacion running on port ${PORT} (includes reportes + auth)`);
  });
}).catch((err) => {
  logger.error('Migration failed, starting anyway:', err.message);
  app.listen(PORT, () => {
    logger.info(`srv-contratacion running on port ${PORT} (migration failed)`);
  });
});
