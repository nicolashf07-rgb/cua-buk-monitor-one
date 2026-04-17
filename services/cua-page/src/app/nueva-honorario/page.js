'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { getMe, iniciarWorkflow, getCargoHisCatalogo } from '@/lib/api';

const TIPO_CONTRATO_OPTIONS = [
  { value: 'Honorarios', label: 'Honorarios' },
  { value: 'PlazoFijo', label: 'Plazo Fijo' },
];

export default function NuevaHonorarioPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [cargoHisList, setCargoHisList] = useState([]);
  const [form, setForm] = useState({
    nombre: '',
    apellido1: '',
    apellido2: '',
    rut: '',
    cargo_rrhh: '',
    cargo_his: '',
    area: '',
    departamento: '',
    fecha_ingreso: '',
    fecha_inicio_contrato: '',
    tipo_contrato: 'Honorarios',
    bossfullname: '',
    bossemail: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    getMe().then(setUser).catch(() => { localStorage.removeItem('token'); router.replace('/login'); });
    getCargoHisCatalogo().then(setCargoHisList).catch(() => setCargoHisList([]));
  }, [router]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(null); setLoading(true);
    try {
      const result = await iniciarWorkflow({
        tipo_solicitud: 'NoSAP',
        ...form,
      });
      setSuccess(result);
    } catch (err) {
      setError(err.message || 'Error al crear contratacion Honorario');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NavBar userEmail={user?.email} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Ingreso Manual Personal Honorario</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Personal por honorarios o plazo fijo (sin BP SAP)</p>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="text-green-800 font-semibold">Contratacion Honorario creada exitosamente</p>
                <p className="text-green-700 text-sm mt-1">Workflow ID: <span className="font-mono">{success.workflow_id}</span></p>
                <p className="text-green-700 text-sm">Tipo contrato: <span className="font-semibold">{form.tipo_contrato}</span></p>
                <button
                  onClick={() => router.push(`/contratacion/${success.contratacion_id}`)}
                  className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  Ir al detalle para ejecutar el flujo
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">X</button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Seccion: Datos Personales */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Datos Personales</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombres <span className="text-red-500">*</span>
                  </label>
                  <input id="nombre" name="nombre" type="text" required value={form.nombre} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="apellido1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Apellido Paterno <span className="text-red-500">*</span>
                  </label>
                  <input id="apellido1" name="apellido1" type="text" required value={form.apellido1} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="apellido2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Apellido Materno <span className="text-red-500">*</span>
                  </label>
                  <input id="apellido2" name="apellido2" type="text" required value={form.apellido2} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="rut" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    RUT <span className="text-red-500">*</span>
                  </label>
                  <input id="rut" name="rut" type="text" required placeholder="12345678-9" value={form.rut} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Seccion: Cargo y Area */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Cargo y Area</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cargo_rrhh" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cargo RRHH <span className="text-red-500">*</span>
                  </label>
                  <input id="cargo_rrhh" name="cargo_rrhh" type="text" required value={form.cargo_rrhh} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="cargo_his" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cargo HIS
                  </label>
                  <select id="cargo_his" name="cargo_his" value={form.cargo_his} onChange={handleChange} className={inputClass}>
                    <option value="">Seleccionar cargo HIS</option>
                    {cargoHisList.map((c) => (
                      <option key={c.codigo} value={c.codigo}>{c.nombre} - {c.codigo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="departamento" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Departamento <span className="text-red-500">*</span>
                  </label>
                  <input id="departamento" name="departamento" type="text" required value={form.departamento} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="area" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Area <span className="text-red-500">*</span>
                  </label>
                  <input id="area" name="area" type="text" required value={form.area} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="tipo_contrato" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Contrato <span className="text-red-500">*</span>
                  </label>
                  <select id="tipo_contrato" name="tipo_contrato" required value={form.tipo_contrato} onChange={handleChange} className={inputClass}>
                    {TIPO_CONTRATO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seccion: Fechas y Jefatura */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Fechas y Jefatura</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fecha_ingreso" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Ingreso a la Clinica
                  </label>
                  <input id="fecha_ingreso" name="fecha_ingreso" type="date" value={form.fecha_ingreso} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="fecha_inicio_contrato" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fecha Inicio del Contrato
                  </label>
                  <input id="fecha_inicio_contrato" name="fecha_inicio_contrato" type="date" value={form.fecha_inicio_contrato} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="bossfullname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre Jefe Directo
                  </label>
                  <input id="bossfullname" name="bossfullname" type="text" value={form.bossfullname} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="bossemail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Jefe Directo
                  </label>
                  <input id="bossemail" name="bossemail" type="email" placeholder="jefe@clinicauandes.cl" value={form.bossemail} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button type="submit" disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
                {loading ? 'Creando...' : 'Crear Contratacion Honorario'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
