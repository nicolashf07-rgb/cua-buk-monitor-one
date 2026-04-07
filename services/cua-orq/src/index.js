require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// URLs de servicios internos
const SRV_CONTRATACION_URL = process.env.SRV_CONTRATACION_URL || 'http://srv-contratacion:3002';
const ADP_BUK_URL = process.env.ADP_BUK_URL || 'http://adp-buk:3005';
const ADP_SAP_URL = process.env.ADP_SAP_URL || 'http://adp-sap:3006';
const ADP_AZUREAD_URL = process.env.ADP_AZUREAD_URL || 'http://adp-azuread:3007';

// ============================================================
// FSM: Definición de estados y transiciones válidas
// ============================================================
// Flujo SAP:    CREADO → VALIDANDO_CARGO → CARGO_VALIDADO → CREANDO_BP → BP_CREADO → VALIDANDO_EMAIL → FINALIZADO
// Flujo NoSAP:  CREADO → VALIDANDO_EMAIL → FINALIZADO
// Fallback:     Cualquier estado → INTERVENCION_MANUAL

const FSM_TRANSITIONS = {
  SAP: {
    CREADO:           { VALIDAR_CARGO:    'VALIDANDO_CARGO' },
    VALIDANDO_CARGO:  { CARGO_VALIDADO:   'CARGO_VALIDADO',  ERROR: 'INTERVENCION_MANUAL' },
    CARGO_VALIDADO:   { CREAR_BP:         'CREANDO_BP' },
    CREANDO_BP:       { BP_CREADO:        'BP_CREADO',       ERROR: 'INTERVENCION_MANUAL' },
    BP_CREADO:        { VALIDAR_EMAIL:    'VALIDANDO_EMAIL' },
    VALIDANDO_EMAIL:  { EMAIL_VALIDADO:   'FINALIZADO',      ERROR: 'INTERVENCION_MANUAL' },
    FINALIZADO:       {},
    INTERVENCION_MANUAL: { REINTENTAR: 'CREADO' },
  },
  NoSAP: {
    CREADO:           { VALIDAR_EMAIL:    'VALIDANDO_EMAIL' },
    VALIDANDO_EMAIL:  { EMAIL_VALIDADO:   'FINALIZADO',      ERROR: 'INTERVENCION_MANUAL' },
    FINALIZADO:       {},
    INTERVENCION_MANUAL: { REINTENTAR: 'CREADO' },
  },
};

function getNextState(tipo, estadoActual, transicion) {
  const flow = FSM_TRANSITIONS[tipo];
  if (!flow) return null;
  const transitions = flow[estadoActual];
  if (!transitions) return null;
  return transitions[transicion] || null;
}

// ============================================================
// Helpers: llamadas HTTP a servicios internos
// ============================================================
async function callService(url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data, duracion_ms: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message, duracion_ms: Date.now() - start };
  }
}

// Acciones automáticas por transición
async function executeTransitionAction(workflow, transicion, datos) {
  const { tipo_solicitud, contratacion_id } = workflow;

  switch (transicion) {
    case 'VALIDAR_CARGO': {
      // Consultar datos del empleado en BUK por RUT
      const rut = datos?.rut;
      if (!rut) return { ok: true, data: { message: 'Sin RUT, validación manual' } };
      return await callService(`${ADP_BUK_URL}/api/buk/employees/${rut}`);
    }

    case 'CREAR_BP': {
      // Crear Business Partner en SAP
      const bpData = datos?.bp || { first_name: 'N/A', last_name: 'N/A', id_number: datos?.rut || 'N/A' };
      return await callService(`${ADP_SAP_URL}/api/sap/business-partner`, {
        method: 'POST',
        body: JSON.stringify(bpData),
      });
    }

    case 'VALIDAR_EMAIL': {
      // Validar email en Azure AD
      const email = datos?.email;
      if (!email) return { ok: true, data: { message: 'Sin email, validación manual' } };
      return await callService(`${ADP_AZUREAD_URL}/api/azure-ad/validar-email`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    }

    default:
      return { ok: true, data: { message: `Transición ${transicion} no requiere acción automática` } };
  }
}

// Guardar log de transición
async function logTransition(workflowId, estadoAnterior, estadoNuevo, transicion, datos, resultado, error, duracionMs) {
  await pool.query(
    `INSERT INTO contratacion.transition_log
     (workflow_id, estado_anterior, estado_nuevo, transicion, datos, resultado, error, duracion_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [workflowId, estadoAnterior, estadoNuevo, transicion,
     datos ? JSON.stringify(datos) : null,
     resultado ? JSON.stringify(resultado) : null,
     error || null, duracionMs || 0]
  );
}

// Actualizar estado de contratación según estado workflow
async function syncContratacionEstado(contratacionId, estadoNuevo) {
  const mapping = {
    CREADO: { estado_clinica: 'Enable', estado_seguridad: '' },
    VALIDANDO_CARGO: { estado_clinica: 'Enable', estado_seguridad: '' },
    CARGO_VALIDADO: { estado_clinica: 'Seguridad', estado_seguridad: 'EnableBP' },
    CREANDO_BP: { estado_clinica: 'Seguridad', estado_seguridad: 'EnableBP' },
    BP_CREADO: { estado_clinica: 'Seguridad', estado_seguridad: 'EnableCuenta' },
    VALIDANDO_EMAIL: { estado_clinica: 'Seguridad', estado_seguridad: 'EnableCuenta' },
    FINALIZADO: { estado_clinica: 'Disable', estado_seguridad: 'FinCuenta' },
    INTERVENCION_MANUAL: { estado_clinica: 'Seguridad', estado_seguridad: 'FinSapManual' },
  };
  const m = mapping[estadoNuevo];
  if (!m) return;
  await pool.query(
    `UPDATE contratacion.contrataciones SET estado_clinica = $2, estado_seguridad = $3, updated_at = NOW() WHERE id = $1`,
    [contratacionId, m.estado_clinica, m.estado_seguridad]
  );
}

// ============================================================
// Endpoints
// ============================================================

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'cua-orq', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.json({ status: 'ok', service: 'cua-orq', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// --- Iniciar workflow ---
app.post('/api/workflow/iniciar', async (req, res) => {
  try {
    const { tipo_solicitud, contratacion_id, nombre, apellido1, apellido2, rut, cargo_rrhh } = req.body;

    if (!tipo_solicitud || !['SAP', 'NoSAP'].includes(tipo_solicitud)) {
      return res.status(400).json({ error: 'tipo_solicitud debe ser SAP o NoSAP' });
    }

    let ctId = contratacion_id;

    // Si no se pasa contratacion_id, crear una nueva vía srv-contratacion
    if (!ctId) {
      const srvRes = await callService(`${SRV_CONTRATACION_URL}/api/contrataciones`, {
        method: 'POST',
        body: JSON.stringify({ tipo_solicitud, nombre, apellido1, apellido2, rut, cargo_rrhh }),
      });
      if (!srvRes.ok) {
        return res.status(500).json({ error: 'Error creando contratación', detalle: srvRes.data || srvRes.error });
      }
      ctId = srvRes.data.id;
    }

    // Crear workflow
    const wfResult = await pool.query(
      `INSERT INTO contratacion.workflows (contratacion_id, tipo_solicitud, estado_actual)
       VALUES ($1, $2, 'CREADO') RETURNING *`,
      [ctId, tipo_solicitud]
    );
    const wf = wfResult.rows[0];

    // Log creación
    await logTransition(wf.id, null, 'CREADO', 'INICIAR', req.body, null, null, 0);

    // Auditoría
    await pool.query(
      `INSERT INTO contratacion.auditoria_workflow (contratacion_id, paso_wf, detalle, estado_nuevo)
       VALUES ($1, 'Workflow Iniciado', $2, 'CREADO')`,
      [ctId, `Tipo: ${tipo_solicitud}`]
    );

    res.status(201).json({
      workflow_id: wf.id,
      contratacion_id: ctId,
      tipo_solicitud: wf.tipo_solicitud,
      estado: wf.estado_actual,
      created_at: wf.created_at,
    });
  } catch (err) {
    console.error('Error al iniciar workflow:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Transicionar workflow ---
app.post('/api/workflow/:id/transicionar', async (req, res) => {
  try {
    const { id } = req.params;
    const { transicion, datos } = req.body;

    if (!transicion) {
      return res.status(400).json({ error: 'transicion es requerida' });
    }

    // Cargar workflow actual
    const wfResult = await pool.query('SELECT * FROM contratacion.workflows WHERE id = $1', [id]);
    if (wfResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow no encontrado' });
    }
    const wf = wfResult.rows[0];
    const estadoAnterior = wf.estado_actual;

    // Validar transición con FSM
    const estadoNuevo = getNextState(wf.tipo_solicitud, estadoAnterior, transicion);
    if (!estadoNuevo) {
      const flujo = FSM_TRANSITIONS[wf.tipo_solicitud]?.[estadoAnterior] || {};
      return res.status(400).json({
        error: `Transición '${transicion}' no válida desde estado '${estadoAnterior}'`,
        transiciones_validas: Object.keys(flujo),
        tipo_solicitud: wf.tipo_solicitud,
      });
    }

    // Ejecutar acción asociada a la transición
    const actionResult = await executeTransitionAction(wf, transicion, datos || {});

    // Si la acción falló y no es ERROR explícito, forzar INTERVENCION_MANUAL
    let estadoFinal = estadoNuevo;
    if (!actionResult.ok && transicion !== 'ERROR' && transicion !== 'REINTENTAR') {
      estadoFinal = getNextState(wf.tipo_solicitud, estadoAnterior, 'ERROR') || 'INTERVENCION_MANUAL';
    }

    // Actualizar workflow
    await pool.query(
      'UPDATE contratacion.workflows SET estado_actual = $2, updated_at = NOW() WHERE id = $1',
      [id, estadoFinal]
    );

    // Sincronizar estado en contrataciones
    await syncContratacionEstado(wf.contratacion_id, estadoFinal);

    // Log
    await logTransition(id, estadoAnterior, estadoFinal, transicion, datos,
      actionResult.data || null, actionResult.error || null, actionResult.duracion_ms || 0);

    // Auditoría
    await pool.query(
      `INSERT INTO contratacion.auditoria_workflow (contratacion_id, paso_wf, detalle, estado_anterior, estado_nuevo)
       VALUES ($1, $2, $3, $4, $5)`,
      [wf.contratacion_id, transicion, JSON.stringify(actionResult.data || {}), estadoAnterior, estadoFinal]
    );

    res.json({
      workflow_id: id,
      contratacion_id: wf.contratacion_id,
      tipo_solicitud: wf.tipo_solicitud,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoFinal,
      transicion,
      accion_resultado: actionResult.ok ? 'exitosa' : 'fallida',
      accion_detalle: actionResult.data || { error: actionResult.error },
      duracion_ms: actionResult.duracion_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error al transicionar workflow:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Estado del workflow ---
app.get('/api/workflow/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;

    const wfResult = await pool.query('SELECT * FROM contratacion.workflows WHERE id = $1', [id]);
    if (wfResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow no encontrado' });
    }
    const wf = wfResult.rows[0];

    // Historial de transiciones
    const logResult = await pool.query(
      'SELECT * FROM contratacion.transition_log WHERE workflow_id = $1 ORDER BY created_at ASC',
      [id]
    );

    // Transiciones disponibles
    const flujo = FSM_TRANSITIONS[wf.tipo_solicitud]?.[wf.estado_actual] || {};

    res.json({
      workflow_id: wf.id,
      contratacion_id: wf.contratacion_id,
      tipo_solicitud: wf.tipo_solicitud,
      estado_actual: wf.estado_actual,
      transiciones_disponibles: Object.keys(flujo),
      historial: logResult.rows.map((r) => ({
        de: r.estado_anterior,
        a: r.estado_nuevo,
        transicion: r.transicion,
        duracion_ms: r.duracion_ms,
        error: r.error,
        fecha: r.created_at,
      })),
      created_at: wf.created_at,
      updated_at: wf.updated_at,
    });
  } catch (err) {
    console.error('Error al obtener estado:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Listar workflows ---
app.get('/api/workflow', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.*, c.idta, c.nombre, c.apellido1, c.rut
       FROM contratacion.workflows w
       JOIN contratacion.contrataciones c ON w.contratacion_id = c.id
       ORDER BY w.created_at DESC`
    );
    res.json({ total: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Error listando workflows:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`cua-orq running on port ${PORT}`);
});
