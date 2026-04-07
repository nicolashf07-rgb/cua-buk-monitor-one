'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import WorkflowStatusBadge from '@/components/WorkflowStatusBadge';
import { getMe, getHistorico } from '@/lib/api';

export default function HistoricoPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    async function fetchData() {
      try {
        const [userData, historico] = await Promise.all([
          getMe().catch(() => null),
          getHistorico().catch(() => []),
        ]);

        if (!userData) {
          localStorage.removeItem('token');
          router.replace('/login');
          return;
        }

        setUser(userData);
        const list = Array.isArray(historico) ? historico : historico?.data || [];
        setData(list);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  const estadoOptions = useMemo(() => {
    const set = new Set(data.map((d) => d.estado_clinica).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const tipoOptions = useMemo(() => {
    const set = new Set(data.map((d) => d.tipo_solicitud).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (filterEstado && d.estado_clinica !== filterEstado) return false;
      if (filterTipo && d.tipo_solicitud !== filterTipo) return false;
      return true;
    });
  }, [data, filterEstado, filterTipo]);

  // Detect all columns from data
  const columns = useMemo(() => {
    if (data.length === 0) return [];
    const keys = new Set();
    data.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NavBar userEmail={user?.email} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Historico de Contrataciones</h1>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-300 px-4 py-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estado Clinica
            </label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {estadoOptions.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo Solicitud
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {tipoOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filtered.length} de {data.length} registros
            </span>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
            No hay registros
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
                        >
                          {col.includes('estado') ? (
                            <WorkflowStatusBadge estado={row[col]} />
                          ) : col.includes('fecha') && row[col] ? (
                            new Date(row[col]).toLocaleDateString('es-CL')
                          ) : (
                            String(row[col] ?? '-')
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
