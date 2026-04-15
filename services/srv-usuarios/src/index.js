require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info', redact: ['req.headers.authorization'], serializers: { err: pino.stdSerializers.err } });

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { logger.error('FATAL: JWT_SECRET no configurado.'); process.exit(1); }

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8000').split(',');
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'srv-usuarios', timestamp: new Date().toISOString() });
});

// --- Register ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nombre, apellido, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son requeridos' });
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM usuarios.users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El email ya esta registrado' });
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'SOLICITANTE';

    await pool.query(
      `INSERT INTO usuarios.users (id, email, password_hash, nombre, apellido)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, email, hashedPassword, nombre || null, apellido || null]
    );

    // Assign role
    const roleResult = await pool.query(
      'SELECT id FROM usuarios.roles WHERE nombre = $1',
      [userRole]
    );
    if (roleResult.rows.length > 0) {
      await pool.query(
        'INSERT INTO usuarios.user_roles (user_id, role_id) VALUES ($1, $2)',
        [id, roleResult.rows[0].id]
      );
    }

    res.status(201).json({
      id,
      email,
      nombre,
      apellido,
      roles: [userRole],
    });
  } catch (err) {
    logger.error('Error en register:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Login ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son requeridos' });
    }

    const userResult = await pool.query(
      'SELECT * FROM usuarios.users WHERE email = $1',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    // Fetch roles
    const rolesResult = await pool.query(
      `SELECT r.nombre FROM usuarios.user_roles ur
       JOIN usuarios.roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = rolesResult.rows.map((r) => r.nombre);

    const token = jwt.sign(
      { userId: user.id, email: user.email, roles },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        roles,
      },
    });
  } catch (err) {
    logger.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Me (token verification) ---
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const userResult = await pool.query(
      'SELECT id, email, nombre, apellido FROM usuarios.users WHERE id = $1',
      [decoded.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const rolesResult = await pool.query(
      `SELECT r.nombre FROM usuarios.user_roles ur
       JOIN usuarios.roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [decoded.userId]
    );
    const roles = rolesResult.rows.map((r) => r.nombre);

    const user = userResult.rows[0];
    res.json({ ...user, roles });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token invalido o expirado' });
    }
    logger.error('Error en /me:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(PORT, () => {
  logger.info(`srv-usuarios running on port ${PORT}`);
});
