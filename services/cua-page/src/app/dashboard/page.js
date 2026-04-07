'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import ContratacionTable from '@/components/ContratacionTable';
import DashboardCharts from '@/components/DashboardCharts';
import { getMe, getContrataciones, getWorkflows } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [contrataciones, setContrataciones] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    async function fetchData() {
      try {
        const userData = await getMe().catch(() => null);

        if (!userData) {
          localStorage.removeItem('token');
          router.replace('/login');
          return;
        }

        setUser(userData);

        const [contData, wfData] = await Promise.all([
          getContrataciones().catch(() => []),
          getWorkflows().catch(() => ({ data: [] })),
        ]);

        const list = Array.isArray(contData) ? contData : contData?.data || [];
        setContrataciones(list);
        const wfList = Array.isArray(wfData) ? wfData : wfData?.data || [];
        setWorkflows(wfList);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err.message || 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  const stats = {
    total: contrataciones.length,
    activas: contrataciones.filter((c) => c.estado_clinica === 'Enable').length,
    seguridad: contrataciones.filter((c) => c.estado_clinica === 'Seguridad').length,
    finalizadas: contrataciones.filter((c) => c.estado_clinica === 'Disable').length,
  };

  const handleRowClick = (contratacion) => {
    router.push(`/contratacion/${contratacion.id}`);
  };

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
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-300 px-4 py-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border-l-4 border-blue-500 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Contrataciones</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border-l-4 border-green-500 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Activas (Enable)</p>
                <p className="mt-2 text-3xl font-bold text-green-600">{stats.activas}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border-l-4 border-orange-500 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">En Seguridad</p>
                <p className="mt-2 text-3xl font-bold text-orange-600">{stats.seguridad}</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border-l-4 border-gray-400 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Finalizadas (Disable)</p>
                <p className="mt-2 text-3xl font-bold text-gray-500 dark:text-gray-400">{stats.finalizadas}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficas */}
        <DashboardCharts contrataciones={contrataciones} />

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Contrataciones</h2>
          <ContratacionTable
            contrataciones={contrataciones}
            onRowClick={handleRowClick}
          />
        </div>
      </main>
    </div>
  );
}
