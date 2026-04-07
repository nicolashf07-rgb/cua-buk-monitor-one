'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { getMe, iniciarWorkflow } from '@/lib/api';

export default function NuevaNoSapPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    nombre: '', apellido1: '', apellido2: '', rut: '', email: '', cargo: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    getMe().then(setUser).catch(() => { localStorage.removeItem('token'); router.replace('/login'); });
  }, [router]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(null); setLoading(true);
    try {
      const result = await iniciarWorkflow({ tipo_solicitud: 'NoSAP', ...form, cargo_rrhh: form.cargo });
      setSuccess(result);
    } catch (err) {
      setError(err.message || 'Error al crear contratacion NoSAP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NavBar userEmail={user?.email} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Nueva Contratacion NoSAP</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Flujo corto: Email → Finalizado (sin BP)</p>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="text-green-800 font-semibold">Contratacion NoSAP creada exitosamente</p>
                <p className="text-green-700 text-sm mt-1">Workflow ID: <span className="font-mono">{success.workflow_id}</span></p>
                <button
                  onClick={() => router.push(`/contratacion/${success.contratacion_id}`)}
                  className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  Ir al detalle para ejecutar el flujo →
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">✕</button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: 'nombre', label: 'Nombre', required: true },
                { name: 'apellido1', label: 'Primer Apellido', required: true },
                { name: 'apellido2', label: 'Segundo Apellido' },
                { name: 'rut', label: 'RUT', required: true, placeholder: '12345678-9' },
                { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'nombre@clinicauandes.cl' },
                { name: 'cargo', label: 'Cargo', required: true },
              ].map((f) => (
                <div key={f.name}>
                  <label htmlFor={f.name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    id={f.name} name={f.name} type={f.type || 'text'} required={f.required}
                    placeholder={f.placeholder || ''} value={form[f.name]} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors">
                {loading ? 'Creando...' : 'Crear Contratacion NoSAP'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
