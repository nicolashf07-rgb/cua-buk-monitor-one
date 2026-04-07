'use client';

import { useState } from 'react';
import WorkflowStatusBadge from './WorkflowStatusBadge';

const PAGE_SIZE = 10;

export default function ContratacionTable({ contrataciones = [], onRowClick }) {
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [page, setPage] = useState(1);

  // Filtrar
  const filtered = contrataciones.filter((c) => {
    const matchSearch = !search || [c.idta, c.nombre, c.apellido1, c.rut, c.cargo_rrhh]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(search.toLowerCase()));
    const matchEstado = !filterEstado || c.estado_clinica === filterEstado;
    const matchTipo = !filterTipo || c.tipo_solicitud === filterTipo;
    return matchSearch && matchEstado && matchTipo;
  });

  // Paginar
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page on filter change
  const handleSearchChange = (v) => { setSearch(v); setPage(1); };
  const handleEstadoChange = (v) => { setFilterEstado(v); setPage(1); };
  const handleTipoChange = (v) => { setFilterTipo(v); setPage(1); };

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por IDTA, nombre, RUT, cargo..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => handleEstadoChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="Enable">Enable (Activa)</option>
          <option value="Seguridad">Seguridad</option>
          <option value="Disable">Disable (Finalizada)</option>
        </select>
        <select
          value={filterTipo}
          onChange={(e) => handleTipoChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los tipos</option>
          <option value="SAP">SAP</option>
          <option value="NoSAP">NoSAP</option>
        </select>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}{search || filterEstado || filterTipo ? ' (filtrado)' : ''}</span>
        {totalPages > 1 && (
          <span>Pagina {page} de {totalPages}</span>
        )}
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-8 text-center text-gray-500 dark:text-gray-400">
          {search || filterEstado || filterTipo
            ? 'No se encontraron contrataciones con esos filtros'
            : 'No hay contrataciones'}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IDTA</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">RUT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seguridad</th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paginated.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onRowClick && onRowClick(c)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-700">{c.idta}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{c.nombre} {c.apellido1}</td>
                    <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">{c.rut}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${c.tipo_solicitud === 'SAP' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'}`}>
                        {c.tipo_solicitud}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><WorkflowStatusBadge estado={c.estado_clinica} /></td>
                    <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap"><WorkflowStatusBadge estado={c.estado_seguridad} /></td>
                    <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {c.fecha_ingreso ? new Date(c.fecha_ingreso).toLocaleDateString('es-CL') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                p === page ? 'bg-blue-700 text-white' : 'border hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
