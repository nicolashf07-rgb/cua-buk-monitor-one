'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS_CLINICA = {
  Enable: '#22c55e',
  Seguridad: '#f97316',
  Disable: '#6b7280',
};

const COLORS_TIPO = {
  SAP: '#6366f1',
  NoSAP: '#06b6d4',
};

const COLORS_ORIGEN = {
  buk: '#8b5cf6',
  manual: '#ec4899',
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
      <span className="font-medium">{payload[0].name}: </span>
      <span className="font-bold">{payload[0].value}</span>
    </div>
  );
}

export default function DashboardCharts({ contrataciones = [] }) {
  // Datos para pie chart estado clínica
  const clinicaData = Object.entries(
    contrataciones.reduce((acc, c) => {
      const key = c.estado_clinica || 'Sin estado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Datos para pie chart tipo solicitud
  const tipoData = Object.entries(
    contrataciones.reduce((acc, c) => {
      const key = c.tipo_solicitud || 'Sin tipo';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Datos para bar chart por origen
  const origenData = Object.entries(
    contrataciones.reduce((acc, c) => {
      const key = c.origen || 'Sin origen';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Datos para bar chart: contrataciones por mes
  const porMes = contrataciones.reduce((acc, c) => {
    const date = c.created_at || c.fecha_ingreso;
    if (!date) return acc;
    const mes = new Date(date).toLocaleDateString('es-CL', { month: 'short' });
    acc[mes] = (acc[mes] || 0) + 1;
    return acc;
  }, {});
  const mesData = Object.entries(porMes).map(([name, value]) => ({ name, value }));

  if (contrataciones.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
      {/* Pie: Estado Clínica */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Por Estado Clínica</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={clinicaData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${name} (${value})`}
            >
              {clinicaData.map((entry) => (
                <Cell key={entry.name} fill={COLORS_CLINICA[entry.name] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Pie: Tipo Solicitud */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Por Tipo Solicitud</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={tipoData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${name} (${value})`}
            >
              {tipoData.map((entry) => (
                <Cell key={entry.name} fill={COLORS_TIPO[entry.name] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar: Origen */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Por Origen</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={origenData} barSize={40}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {origenData.map((entry) => (
                <Cell key={entry.name} fill={COLORS_ORIGEN[entry.name] || '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
