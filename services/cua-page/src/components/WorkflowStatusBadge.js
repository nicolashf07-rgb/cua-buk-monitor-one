'use client';

const estadoStyles = {
  CREADO: 'bg-gray-700 text-gray-800 dark:text-gray-200',
  VALIDANDO_CARGO: 'bg-yellow-100 text-yellow-800',
  VALIDANDO_EMAIL: 'bg-yellow-100 text-yellow-800',
  CREANDO_BP: 'bg-yellow-100 text-yellow-800',
  CARGO_VALIDADO: 'bg-blue-100 text-blue-800',
  BP_CREADO: 'bg-blue-100 text-blue-800',
  FINALIZADO: 'bg-green-100 text-green-800',
  INTERVENCION_MANUAL: 'bg-red-100 text-red-800',
  Enable: 'bg-green-100 text-green-800',
  Seguridad: 'bg-orange-100 text-orange-800',
  Disable: 'bg-gray-700 text-gray-800 dark:text-gray-200',
};

export default function WorkflowStatusBadge({ estado }) {
  if (!estado) return null;

  const style = estadoStyles[estado] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${style}`}>
      {estado}
    </span>
  );
}
