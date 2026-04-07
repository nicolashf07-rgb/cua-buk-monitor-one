'use client';

import { useState, useEffect } from 'react';
import { getBukEmployee } from '@/lib/api';

// ============================================================
// Configuración de cada transición
// ============================================================
const TRANSICION_CONFIG = {
  VALIDAR_CARGO: {
    label: 'Validar Cargo',
    descripcion: 'Consultar datos del empleado en BUK HR por RUT',
    color: 'bg-yellow-600 hover:bg-yellow-700',
    icon: '🔍',
    secciones: [
      {
        titulo: 'Búsqueda BUK',
        campos: [
          { key: 'rut', label: 'RUT del empleado', placeholder: '12345678-9', required: true },
        ],
      },
    ],
    buildDatos: (form) => ({ rut: form.rut }),
    hasBukLookup: true,
  },
  CARGO_VALIDADO: {
    label: 'Confirmar Cargo',
    descripcion: 'Confirmar que los datos del cargo son correctos',
    color: 'bg-blue-600 hover:bg-blue-700',
    icon: '✅',
    secciones: [],
    buildDatos: () => ({}),
  },
  CREAR_BP: {
    label: 'Crear Business Partner SAP',
    descripcion: 'Crear BP en SAP TrakCare — 38 campos en 6 categorías',
    color: 'bg-purple-600 hover:bg-purple-700',
    icon: '🏥',
    secciones: [
      {
        titulo: '1. Identidad',
        descripcion: '11 campos de identificación personal',
        campos: [
          { key: 'title', label: 'Título', placeholder: 'Sr./Sra./Dr.' },
          { key: 'first_name', label: 'Nombre', placeholder: 'María', required: true },
          { key: 'last_name', label: 'Primer Apellido', placeholder: 'González', required: true },
          { key: 'second_last_name', label: 'Segundo Apellido', placeholder: 'Pérez' },
          { key: 'id_number', label: 'RUT / N° Documento', placeholder: '12345678-9', required: true },
          { key: 'id_type', label: 'Tipo Documento', type: 'select', options: ['RUT', 'PASSPORT', 'DNI'] },
          { key: 'birth_date', label: 'Fecha Nacimiento', type: 'date' },
          { key: 'gender', label: 'Género', type: 'select', options: ['M', 'F', 'O'] },
          { key: 'nationality', label: 'Nacionalidad', placeholder: 'Chilena' },
          { key: 'marital_status', label: 'Estado Civil', type: 'select', options: ['S', 'C', 'D', 'V'] },
          { key: 'name_supplement', label: 'Suplemento Nombre', placeholder: 'Jr., III, etc.' },
        ],
      },
      {
        titulo: '2. Dirección',
        descripcion: '6 campos de domicilio',
        campos: [
          { key: 'street', label: 'Calle / Dirección', placeholder: 'Av. Plaza 2501' },
          { key: 'house_number', label: 'Número', placeholder: '2501' },
          { key: 'city', label: 'Ciudad / Comuna', placeholder: 'Las Condes' },
          { key: 'region', label: 'Región', placeholder: 'Metropolitana' },
          { key: 'postal_code', label: 'Código Postal', placeholder: '7550000' },
          { key: 'country', label: 'País', placeholder: 'CL' },
        ],
      },
      {
        titulo: '3. Contacto',
        descripcion: '3 campos de comunicación',
        campos: [
          { key: 'telephone', label: 'Teléfono Fijo', placeholder: '+56223456789' },
          { key: 'mobile', label: 'Celular', placeholder: '+56912345678' },
          { key: 'email', label: 'Email', placeholder: 'nombre@clinicauandes.cl', type: 'email' },
        ],
      },
      {
        titulo: '4. Fiscal',
        descripcion: '2 campos tributarios',
        campos: [
          { key: 'tax_number', label: 'Número Tributario', placeholder: 'RUT empresa o persona' },
          { key: 'tax_type', label: 'Tipo Impuesto', placeholder: 'IVA, Renta, etc.' },
        ],
      },
      {
        titulo: '5. Laboral / Bancario',
        descripcion: '5 campos de empleo y pago',
        campos: [
          { key: 'occupation', label: 'Ocupación / Cargo', placeholder: 'Médico Internista' },
          { key: 'department', label: 'Departamento', placeholder: 'Medicina Interna' },
          { key: 'bank_account', label: 'Cuenta Bancaria', placeholder: 'Nro. cuenta' },
          { key: 'bank_key', label: 'Banco', placeholder: 'BancoEstado, Santander, etc.' },
          { key: 'payment_method', label: 'Método de Pago', placeholder: 'Transferencia, Cheque' },
        ],
      },
      {
        titulo: '6. Healthcare IS-H',
        descripcion: '11 campos médicos SAP — phy_num requerido si es médico registrado',
        campos: [
          { key: 'phy_ind', label: '¿Es médico registrado?', type: 'checkbox' },
          { key: 'phy_num', label: 'N° Registro Médico (SIS)', placeholder: 'MED-12345', dependsOn: 'phy_ind', requiredIf: 'phy_ind' },
          { key: 'spl_ty_typ', label: 'Especialidad', placeholder: 'Internista, Cirujano, etc.', dependsOn: 'phy_ind' },
          { key: 'nur_ind', label: '¿Es personal de enfermería?', type: 'checkbox' },
          { key: 'med_staff_type', label: 'Tipo Personal Médico', placeholder: 'Médico, Enfermero, Técnico' },
          { key: 'med_staff_group', label: 'Grupo Personal Médico', placeholder: 'Staff, Residente, Becado' },
          { key: 'fonasa_group', label: 'Grupo FONASA', type: 'select', options: ['A', 'B', 'C', 'D'] },
          { key: 'isapre', label: 'ISAPRE', placeholder: 'Colmena, Cruz Blanca, Banmédica...' },
          { key: 'prev_system', label: 'Sistema Previsional', placeholder: 'AFP, IPS' },
          { key: 'afp', label: 'AFP', placeholder: 'Habitat, Cuprum, Capital, Modelo...' },
          { key: 'health_plan', label: 'Plan de Salud', placeholder: 'Plan complementario' },
        ],
      },
    ],
    buildDatos: (form) => {
      const bp = {};
      const bpFields = [
        'title', 'first_name', 'last_name', 'second_last_name', 'id_number', 'id_type',
        'birth_date', 'gender', 'nationality', 'marital_status', 'name_supplement',
        'street', 'house_number', 'city', 'region', 'postal_code', 'country',
        'telephone', 'mobile', 'email', 'tax_number', 'tax_type',
        'occupation', 'department', 'bank_account', 'bank_key', 'payment_method',
        'phy_ind', 'phy_num', 'spl_ty_typ', 'nur_ind', 'med_staff_type', 'med_staff_group',
        'fonasa_group', 'isapre', 'prev_system', 'afp', 'health_plan',
      ];
      for (const key of bpFields) {
        if (form[key] !== undefined && form[key] !== '') {
          bp[key] = form[key];
        }
      }
      return { rut: form.id_number, bp };
    },
  },
  BP_CREADO: {
    label: 'Confirmar BP Creado',
    descripcion: 'Confirmar que el Business Partner fue creado exitosamente en SAP',
    color: 'bg-blue-600 hover:bg-blue-700',
    icon: '✅',
    secciones: [],
    buildDatos: () => ({}),
  },
  VALIDAR_EMAIL: {
    label: 'Validar Email / Cuenta AD',
    descripcion: 'Verificar si el email existe en Azure AD. Si no existe, se puede crear la cuenta.',
    color: 'bg-indigo-600 hover:bg-indigo-700',
    icon: '📧',
    secciones: [
      {
        titulo: 'Validación Azure AD',
        campos: [
          { key: 'email', label: 'Email a validar', placeholder: 'nombre@clinicauandes.cl', required: true, type: 'email' },
        ],
      },
    ],
    buildDatos: (form) => ({ email: form.email }),
    hasAdLookup: true,
  },
  EMAIL_VALIDADO: {
    label: 'Confirmar Email Validado',
    descripcion: 'Confirmar que el email/cuenta AD fue validado correctamente',
    color: 'bg-green-600 hover:bg-green-700',
    icon: '✅',
    secciones: [],
    buildDatos: () => ({}),
  },
  ERROR: {
    label: 'Reportar Error',
    descripcion: 'Enviar a intervención manual por un problema detectado',
    color: 'bg-red-600 hover:bg-red-700',
    icon: '⚠️',
    secciones: [],
    buildDatos: () => ({}),
  },
  REINTENTAR: {
    label: 'Reintentar Flujo',
    descripcion: 'Reiniciar el flujo desde el estado CREADO',
    color: 'bg-orange-600 hover:bg-orange-700',
    icon: '🔄',
    secciones: [],
    buildDatos: () => ({}),
  },
};

// ============================================================
// Componente field renderer
// ============================================================
function FormField({ campo, value, onChange, form }) {
  // Campo condicional
  if (campo.dependsOn && !form[campo.dependsOn]) return null;

  const isRequired = campo.required || (campo.requiredIf && form[campo.requiredIf]);

  if (campo.type === 'checkbox') {
    return (
      <label className="flex items-center gap-3 cursor-pointer py-1">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(campo.key, e.target.checked)}
          className="w-5 h-5 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{campo.label}</span>
      </label>
    );
  }

  if (campo.type === 'select') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {campo.label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <select
          value={value || ''}
          onChange={(e) => onChange(campo.key, e.target.value)}
          required={isRequired}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option value="">Seleccionar...</option>
          {campo.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {campo.label} {isRequired && <span className="text-red-500">*</span>}
      </label>
      <input
        type={campo.type || 'text'}
        value={value || ''}
        onChange={(e) => onChange(campo.key, e.target.value)}
        placeholder={campo.placeholder}
        required={isRequired}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      />
    </div>
  );
}

// ============================================================
// Modal principal
// ============================================================
export default function TransicionModal({ transicion, contratacion, onConfirm, onCancel, loading }) {
  const config = TRANSICION_CONFIG[transicion] || {
    label: transicion, descripcion: '', color: 'bg-gray-600', icon: '▶', secciones: [], buildDatos: () => ({}),
  };

  const [form, setForm] = useState(() => {
    const initial = {};
    if (contratacion) {
      initial.rut = contratacion.rut || '';
      initial.first_name = contratacion.nombre || '';
      initial.last_name = contratacion.apellido1 || '';
      initial.second_last_name = contratacion.apellido2 || '';
      initial.id_number = contratacion.rut || '';
      initial.email = '';
      initial.occupation = contratacion.cargo_rrhh || '';
    }
    return initial;
  });

  // BUK lookup state
  const [bukResult, setBukResult] = useState(null);
  const [bukLoading, setBukLoading] = useState(false);
  const [bukError, setBukError] = useState('');

  // AD lookup state
  const [adResult, setAdResult] = useState(null);
  const [adCreating, setAdCreating] = useState(false);
  const [adCreated, setAdCreated] = useState(null);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // BUK: buscar empleado
  const handleBukLookup = async () => {
    if (!form.rut) return;
    setBukLoading(true);
    setBukError('');
    try {
      const data = await getBukEmployee(form.rut);
      setBukResult(data);
    } catch (err) {
      setBukError(err.message || 'Empleado no encontrado');
      setBukResult(null);
    } finally {
      setBukLoading(false);
    }
  };

  // AD: crear cuenta
  const handleAdCreate = async () => {
    setAdCreating(true);
    try {
      const res = await fetch('/api/azure-ad/crear-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: contratacion?.nombre || form.first_name || 'N/A',
          apellido: contratacion?.apellido1 || form.last_name || 'N/A',
          email: form.email,
        }),
      });
      const data = await res.json();
      setAdCreated(data);
    } catch {
      setAdCreated({ error: 'Error creando cuenta' });
    } finally {
      setAdCreating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const datos = config.buildDatos(form);
    onConfirm(datos);
  };

  const hasSecciones = config.secciones.length > 0;
  const totalCampos = config.secciones.reduce((sum, s) => sum + s.campos.length, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 dark:bg-gray-950 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{config.label}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{config.descripcion}</p>
            </div>
            {totalCampos > 0 && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full">
                {totalCampos} campos
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {hasSecciones ? (
              <div className="space-y-6">
                {config.secciones.map((seccion, si) => (
                  <div key={si}>
                    <div className="mb-3">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">{seccion.titulo}</h4>
                      {seccion.descripcion && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{seccion.descripcion}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {seccion.campos.map((campo) => (
                        <FormField
                          key={campo.key}
                          campo={campo}
                          value={form[campo.key]}
                          onChange={handleChange}
                          form={form}
                        />
                      ))}
                    </div>

                    {/* BUK Lookup result */}
                    {config.hasBukLookup && si === 0 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleBukLookup}
                          disabled={bukLoading || !form.rut}
                          className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg hover:bg-yellow-200 disabled:opacity-50 transition-colors"
                        >
                          {bukLoading ? 'Buscando...' : '🔍 Buscar en BUK'}
                        </button>
                        {bukError && <p className="text-red-600 text-xs mt-2">{bukError}</p>}
                        {bukResult && (
                          <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                            <p className="font-semibold text-green-800">Empleado encontrado en BUK</p>
                            <div className="grid grid-cols-2 gap-1 mt-1 text-green-700">
                              <span>Nombre: {bukResult.nombre} {bukResult.apellido}</span>
                              <span>Cargo: {bukResult.cargo}</span>
                              <span>Área: {bukResult.area}</span>
                              <span>Email: {bukResult.email}</span>
                              <span>Jefe: {bukResult.bossFullName}</span>
                              <span>Ingreso: {bukResult.fechaIngreso}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AD Lookup / Create */}
                    {config.hasAdLookup && si === 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Al ejecutar la transición, se verificará si el email existe en Azure AD.
                          Si no existe, podrá crear la cuenta después.
                        </p>
                        {adCreated && !adCreated.error && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                            <p className="font-semibold text-green-800">Cuenta Azure AD creada</p>
                            <p className="text-green-700">UPN: {adCreated.upn}</p>
                            <p className="text-green-700">Display: {adCreated.displayName}</p>
                          </div>
                        )}
                        {!adCreated && form.email && (
                          <button
                            type="button"
                            onClick={handleAdCreate}
                            disabled={adCreating}
                            className="text-sm bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-200 disabled:opacity-50 transition-colors"
                          >
                            {adCreating ? 'Creando...' : '📧 Crear cuenta AD antes de validar'}
                          </button>
                        )}
                      </div>
                    )}

                    {si < config.secciones.length - 1 && <hr className="mt-4 border-gray-200 dark:border-gray-800" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">¿Confirmar esta acción?</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-950 flex-shrink-0 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${config.color}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Ejecutando...
                </span>
              ) : (
                `${config.icon} ${config.label}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
