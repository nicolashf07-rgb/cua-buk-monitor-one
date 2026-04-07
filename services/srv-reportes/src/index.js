require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'srv-reportes', timestamp: new Date().toISOString() });
});

// --- Historico report ---
app.get('/api/reportes/historico', async (req, res) => {
  try {
    const { estado_clinica, tipo_solicitud } = req.query;

    let query = 'SELECT * FROM reportes.v_historico WHERE 1=1';
    const params = [];

    if (estado_clinica) {
      params.push(estado_clinica);
      query += ` AND estado_clinica = $${params.length}`;
    }

    if (tipo_solicitud) {
      params.push(tipo_solicitud);
      query += ` AND tipo_solicitud = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({
      total: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error('Error obteniendo historico:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Refresh materialized view ---
app.post('/api/reportes/refresh', async (_req, res) => {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY reportes.v_historico');
    res.json({
      status: 'ok',
      message: 'Vista materializada actualizada exitosamente',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error refrescando vista materializada:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`srv-reportes running on port ${PORT}`);
});
