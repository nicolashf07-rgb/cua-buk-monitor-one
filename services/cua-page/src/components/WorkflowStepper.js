'use client';

const STEPS_SAP = [
  { estado: 'CREADO', label: 'Creado', icon: '📋' },
  { estado: 'VALIDANDO_CARGO', label: 'Validando Cargo', icon: '🔍' },
  { estado: 'CARGO_VALIDADO', label: 'Cargo Validado', icon: '✅' },
  { estado: 'CREANDO_BP', label: 'Creando BP SAP', icon: '🏥' },
  { estado: 'BP_CREADO', label: 'BP Creado', icon: '✅' },
  { estado: 'VALIDANDO_EMAIL', label: 'Validando Email', icon: '📧' },
  { estado: 'FINALIZADO', label: 'Finalizado', icon: '🎉' },
];

const STEPS_NOSAP = [
  { estado: 'CREADO', label: 'Creado', icon: '📋' },
  { estado: 'VALIDANDO_EMAIL', label: 'Validando Email', icon: '📧' },
  { estado: 'FINALIZADO', label: 'Finalizado', icon: '🎉' },
];

function getStepIndex(steps, estadoActual) {
  if (estadoActual === 'INTERVENCION_MANUAL') return -1;
  const idx = steps.findIndex((s) => s.estado === estadoActual);
  return idx >= 0 ? idx : 0;
}

export default function WorkflowStepper({ tipo, estadoActual }) {
  const steps = tipo === 'SAP' ? STEPS_SAP : STEPS_NOSAP;
  const currentIdx = getStepIndex(steps, estadoActual);

  if (estadoActual === 'INTERVENCION_MANUAL') {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg p-4 text-center">
        <span className="text-2xl">⚠️</span>
        <p className="text-red-200 font-semibold mt-1">Intervención Manual Requerida</p>
        <p className="text-red-400 text-sm">El flujo tuvo un error y necesita atención manual.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;

          return (
            <div key={step.estado} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                    ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-900' : ''}
                    ${isFuture ? 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400' : ''}
                  `}
                >
                  {isCompleted ? '✓' : step.icon}
                </div>
                <span
                  className={`mt-2 text-xs text-center max-w-[80px] leading-tight
                    ${isCurrent ? 'text-blue-700 font-semibold' : ''}
                    ${isCompleted ? 'text-green-700' : ''}
                    ${isFuture ? 'text-gray-500 dark:text-gray-400' : ''}
                  `}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    i < currentIdx ? 'bg-green-400' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
