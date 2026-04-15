'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, setupMFA } from '@/lib/api';
import NavBar from '@/components/NavBar';

export default function MFASetupPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mfaData, setMfaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    getMe().then(setUser).catch(() => router.replace('/login'));
  }, [router]);

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await setupMFA();
      setMfaData(data);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Error configurando MFA');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <NavBar userEmail={user.email} />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Configurar Autenticacion de Dos Factores (MFA)</h1>

        {!mfaData && !success && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              La autenticacion de dos factores agrega una capa extra de seguridad a su cuenta.
              Necesitara una app como Google Authenticator o Authy.
            </p>
            {user.roles?.includes('admin') && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                  MFA es obligatorio para usuarios con rol administrador.
                </p>
              </div>
            )}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-4 py-3 rounded-md text-sm mb-4">
                {error}
              </div>
            )}
            <button
              onClick={handleSetup}
              disabled={loading}
              className="px-6 py-2 bg-blue-800 text-white rounded-md hover:bg-blue-900 disabled:opacity-50"
            >
              {loading ? 'Configurando...' : 'Activar MFA'}
            </button>
          </div>
        )}

        {mfaData && success && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 mb-6">
              <p className="text-green-800 dark:text-green-200 font-medium">MFA activado exitosamente</p>
            </div>

            <h2 className="text-lg font-semibold mb-3">Paso 1: Escanear codigo QR</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
              Abra Google Authenticator y escanee este codigo QR:
            </p>

            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 text-center">
              <div className="bg-white inline-block p-4 rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaData.otpauth_uri)}`}
                  alt="QR Code MFA"
                  width={200}
                  height={200}
                />
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-3">Paso 2: Codigo manual (alternativa)</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
              Si no puede escanear el QR, ingrese este codigo manualmente:
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-3 mb-6">
              <code className="text-lg font-mono tracking-widest break-all">{mfaData.secret}</code>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                Guarde este codigo en un lugar seguro. Si pierde acceso a su autenticador, necesitara este codigo para recuperar su cuenta.
              </p>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 px-6 py-2 bg-blue-800 text-white rounded-md hover:bg-blue-900"
            >
              Ir al Dashboard
            </button>
          </div>
        )}
      </div>
    </>
  );
}
