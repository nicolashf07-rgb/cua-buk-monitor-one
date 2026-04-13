'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import NavBar from '@/components/NavBar';
import WorkflowStatusBadge from '@/components/WorkflowStatusBadge';
import WorkflowStepper from '@/components/WorkflowStepper';
import TransicionModal from '@/components/TransicionModal';
import { getMe, getContratacion, getContratacionCargo, getContratacionBP, getWorkflows, getWorkflowEstado, transicionarWorkflow } from '@/lib/api';

// Labels legibles para campos de contratación
const FIELD_LABELS = {
  idta: 'ID Contratación',
  origen: 'Origen',
  tipo_solicitud: 'Tipo Solicitud',
  tipo_contrato: 'Tipo Contrato',
  estado_clinica: 'Estado Clínica',
  estado_seguridad: 'Estado Seguridad',
  estado_email: 'Estado Email',
  nombre: 'Nombre',
  apellido1: 'Primer Apellido',
  apellido2: 'Segundo Apellido',
  rut: 'RUT',
  cargo_rrhh: 'Cargo RRHH',
  fecha_ingreso: 'Fecha Ingreso',
  fecha_inicio_contrato: 'Inicio Contrato',
  bossfullname: 'Jefe Directo',
  bossemail: 'Email Jefe',
  mesa_servicio_estado: 'Mesa Servicio',
  usuario_id_legacy: 'ID Legacy',
};

const ESTADO_FIELDS = ['estado_clinica', 'estado_seguridad', 'estado_email'];
const HIDDEN_FIELDS = ['id', 'created_at', 'updated_at'];

function formatDate(val) {
  if (!val) return '-';
  try {
    return new Date(val).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return val;
  }
}

function formatDateTime(val) {
  if (!val) return '-';
  try {
    return new Date(val).toLocaleString('es-CL', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return val;
  }
}

export default function ContratacionDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [user, setUser] = useState(null);
  const [contratacion, setContratacion] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [workflowEstado, setWorkflowEstado] = useState(null);
  const [cargoData, setCargoData] = useState(null);
  const [bpData, setBpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastResult, setLastResult] = useState(null);

  // Modal state
  const [modalTransicion, setModalTransicion] = useState(null);

  const fetchData = async () => {
    try {
      const [userData, contData] = await Promise.all([
        getMe().catch(() => null),
        getContratacion(id).catch(() => null),
      ]);

      if (!userData) {
        localStorage.removeItem('token');
        router.replace('/login');
        return;
      }

      setUser(userData);
      setContratacion(contData);

      // Fetch cargo and BP data (optional, may not exist)
      try { const cargo = await getContratacionCargo(id); setCargoData(cargo); } catch { /* no cargo data */ }
      try { const bp = await getContratacionBP(id); setBpData(bp); } catch { /* no BP data */ }

      try {
        const wfs = await getWorkflows();
        const wfList = Array.isArray(wfs) ? wfs : wfs?.data || [];
        const match = wfList.find(
          (w) => String(w.contratacion_id) === String(id)
        );
        if (match) {
          setWorkflow(match);
          const estado = await getWorkflowEstado(match.id).catch(() => null);
          setWorkflowEstado(estado);
        }
      } catch {
        // workflow fetch optional
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    fetchData();
  }, [id]);

  const handleTransicionClick = (transicion) => {
    setModalTransicion(transicion);
    setSuccessMsg('');
    setError('');
    setLastResult(null);
  };

  const handleTransicionConfirm = async (datos) => {
    setActionLoading(true);
    setError('');
    try {
      const result = await transicionarWorkflow(workflow.id, modalTransicion, datos);
      setLastResult(result);
      setSuccessMsg(`Transición "${modalTransicion}" ejecutada: ${result.estado_anterior} → ${result.estado_nuevo}`);
      setModalTransicion(null);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Error al ejecutar transición');
      setModalTransicion(null);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-3 text-sm">Cargando contratación...</p>
        </div>
      </div>
    );
  }

  const estadoActual = workflowEstado?.estado_actual || workflow?.estado_actual || 'CREADO';
  const tipoSolicitud = workflowEstado?.tipo_solicitud || workflow?.tipo_solicitud || contratacion?.tipo_solicitud || 'SAP';
  const historial = workflowEstado?.historial || [];
  const transicionesDisponibles = workflowEstado?.transiciones_disponibles || [];

  const detailFields = contratacion
    ? Object.entries(contratacion).filter(([key]) => !HIDDEN_FIELDS.includes(key))
    : [];

  // Separar campos de estado y datos
  const estadoFields = detailFields.filter(([key]) => ESTADO_FIELDS.includes(key));
  const dataFields = detailFields.filter(([key]) => !ESTADO_FIELDS.includes(key));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NavBar userEmail={user?.email} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-700 hover:text-blue-900 text-sm mb-2 inline-flex items-center gap-1"
            >
              ← Volver al Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {contratacion?.idta || `Contratación #${id.slice(0, 8)}`}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {contratacion?.nombre} {contratacion?.apellido1} {contratacion?.apellido2} — {contratacion?.rut}
            </p>
          </div>
          <div className="text-right">
            <WorkflowStatusBadge estado={estadoActual} />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Flujo {tipoSolicitud}</p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm flex justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700">✕</button>
          </div>
        )}

        {/* Workflow Stepper */}
        {workflow && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Progreso del Workflow</h2>
            <WorkflowStepper tipo={tipoSolicitud} estadoActual={estadoActual} />
          </div>
        )}

        {/* Action buttons */}
        {workflow && transicionesDisponibles.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Acciones Disponibles</h2>
            <div className="flex flex-wrap gap-3">
              {transicionesDisponibles.map((t) => {
                const BUTTON_STYLES = {
                  VALIDAR_CARGO: { bg: 'bg-yellow-600 hover:bg-yellow-700', icon: '🔍', label: 'Validar Cargo (BUK)' },
                  CARGO_VALIDADO: { bg: 'bg-blue-600 hover:bg-blue-700', icon: '✅', label: 'Confirmar Cargo' },
                  CREAR_BP: { bg: 'bg-purple-600 hover:bg-purple-700', icon: '🏥', label: 'Crear BP SAP' },
                  BP_CREADO: { bg: 'bg-blue-600 hover:bg-blue-700', icon: '✅', label: 'Confirmar BP' },
                  VALIDAR_EMAIL: { bg: 'bg-indigo-600 hover:bg-indigo-700', icon: '📧', label: 'Validar Email (AD)' },
                  EMAIL_VALIDADO: { bg: 'bg-green-600 hover:bg-green-700', icon: '✅', label: 'Confirmar Email' },
                  ERROR: { bg: 'bg-red-600 hover:bg-red-700', icon: '⚠️', label: 'Reportar Error' },
                  REINTENTAR: { bg: 'bg-orange-600 hover:bg-orange-700', icon: '🔄', label: 'Reintentar Flujo' },
                };
                const style = BUTTON_STYLES[t] || { bg: 'bg-gray-600 hover:bg-gray-700', icon: '▶', label: t };

                return (
                  <button
                    key={t}
                    onClick={() => handleTransicionClick(t)}
                    className={`px-5 py-3 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-2 ${style.bg}`}
                  >
                    <span className="text-lg">{style.icon}</span>
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Workflow finalizado */}
        {workflow && estadoActual === 'FINALIZADO' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-center">
            <span className="text-4xl">🎉</span>
            <h3 className="text-green-800 font-bold text-lg mt-2">Contratación Finalizada</h3>
            <p className="text-green-600 text-sm mt-1">El flujo de {tipoSolicitud} se completó exitosamente.</p>
          </div>
        )}

        {/* Last action result */}
        {lastResult && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Resultado de última acción</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-blue-500">Transición:</span>
                <span className="ml-1 font-medium">{lastResult.transicion}</span>
              </div>
              <div>
                <span className="text-blue-500">Resultado:</span>
                <span className={`ml-1 font-medium ${lastResult.accion_resultado === 'exitosa' ? 'text-green-700' : 'text-red-700'}`}>
                  {lastResult.accion_resultado}
                </span>
              </div>
              <div>
                <span className="text-blue-500">Duración:</span>
                <span className="ml-1 font-medium">{lastResult.duracion_ms}ms</span>
              </div>
              {lastResult.accion_detalle?.gpart && (
                <div>
                  <span className="text-blue-500">GPART:</span>
                  <span className="ml-1 font-mono font-medium">{lastResult.accion_detalle.gpart}</span>
                </div>
              )}
              {lastResult.accion_detalle?.upn && (
                <div>
                  <span className="text-blue-500">UPN:</span>
                  <span className="ml-1 font-mono font-medium">{lastResult.accion_detalle.upn}</span>
                </div>
              )}
              {lastResult.accion_detalle?.nombre && (
                <div>
                  <span className="text-blue-500">Empleado:</span>
                  <span className="ml-1 font-medium">{lastResult.accion_detalle.nombre} {lastResult.accion_detalle.apellido}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Datos contratación */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Datos de la Contratación</h2>
            {contratacion ? (
              <dl className="space-y-3">
                {dataFields.map(([key, value]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{FIELD_LABELS[key] || key.replace(/_/g, ' ')}</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {key.includes('fecha') ? formatDate(value) : String(value ?? '-')}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Sin datos</p>
            )}
          </div>

          {/* Cargo, BP y Estados */}
          <div className="space-y-6">
            {/* Cargo / Area / Departamento */}
            {cargoData && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Cargo / Area</h2>
                <dl className="space-y-2 text-sm">
                  {cargoData.cargo && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Cargo</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{cargoData.cargo}</dd></div>}
                  {cargoData.area && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Area</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{cargoData.area}</dd></div>}
                  {cargoData.centro_costo && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Centro Costo</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{cargoData.centro_costo}</dd></div>}
                  {cargoData.jefe_directo && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Jefe Directo</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{cargoData.jefe_directo}</dd></div>}
                  {cargoData.validado !== undefined && <div className="flex justify-between py-1"><dt className="text-gray-500 dark:text-gray-400">Validado</dt><dd className="font-medium">{cargoData.validado ? <span className="text-green-600">Si</span> : <span className="text-yellow-600">Pendiente</span>}</dd></div>}
                </dl>
              </div>
            )}

            {/* Business Partner SAP / Cargo HIS */}
            {bpData && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Business Partner SAP</h2>
                <dl className="space-y-2 text-sm">
                  {bpData.gpart && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">GPART</dt><dd className="font-mono font-medium text-gray-900 dark:text-gray-100">{bpData.gpart}</dd></div>}
                  {bpData.status && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Estado BP</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{bpData.status}</dd></div>}
                  {bpData.phy_ind && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Medico Registrado</dt><dd className="font-medium text-green-600">Si</dd></div>}
                  {bpData.phy_num && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Cargo HIS (phy_num)</dt><dd className="font-mono font-medium text-blue-700 dark:text-blue-400">{bpData.phy_num}</dd></div>}
                  {bpData.med_staff_type && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Tipo Staff Medico</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{bpData.med_staff_type}</dd></div>}
                  {bpData.fonasa_group && <div className="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"><dt className="text-gray-500 dark:text-gray-400">Grupo FONASA</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{bpData.fonasa_group}</dd></div>}
                  {bpData.isapre && <div className="flex justify-between py-1"><dt className="text-gray-500 dark:text-gray-400">ISAPRE</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{bpData.isapre}</dd></div>}
                </dl>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Estados</h2>
              <div className="space-y-3">
                {estadoFields.map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{FIELD_LABELS[key]}</span>
                    <WorkflowStatusBadge estado={value || '(vacío)'} />
                  </div>
                ))}
                {workflow && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Estado Workflow</span>
                    <WorkflowStatusBadge estado={estadoActual} />
                  </div>
                )}
              </div>
            </div>

            {/* Info del workflow */}
            {workflow && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Workflow</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">ID</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">{workflow.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Tipo</span>
                    <span className="font-medium">{tipoSolicitud}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Creado</span>
                    <span>{formatDateTime(workflow.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Transiciones</span>
                    <span className="font-medium">{historial.length}</span>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* Historial de transiciones */}
        {historial.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Historial de Transiciones ({historial.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Transición</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">De</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">A</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duración</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {historial.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{h.transicion}</td>
                      <td className="px-4 py-3"><WorkflowStatusBadge estado={h.de} /></td>
                      <td className="px-4 py-3"><WorkflowStatusBadge estado={h.a} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{h.duracion_ms ? `${h.duracion_ms}ms` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(h.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sin workflow */}
        {!workflow && contratacion && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <span className="text-2xl">📋</span>
            <p className="text-yellow-800 font-medium mt-2">Esta contratación no tiene workflow asociado</p>
            <p className="text-yellow-600 text-sm mt-1">Fue creada directamente sin pasar por el orquestador.</p>
          </div>
        )}
      </main>

      {/* Modal de transición */}
      {modalTransicion && (
        <TransicionModal
          transicion={modalTransicion}
          contratacion={contratacion}
          onConfirm={handleTransicionConfirm}
          onCancel={() => setModalTransicion(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
