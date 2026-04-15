'use client';

import { useState } from 'react';
import { login, loginWithMFA } from '@/lib/api';

export default function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mfaRequired) {
        if (!totpCode || totpCode.length !== 6) {
          setError('Ingrese el codigo de 6 digitos de su autenticador');
          setLoading(false);
          return;
        }
        const data = await loginWithMFA(email, password, totpCode);
        if (onSuccess) onSuccess(data);
      } else {
        const data = await login(email, password);
        if (onSuccess) onSuccess(data);
      }
    } catch (err) {
      if (err.body?.mfa_required) {
        setMfaRequired(true);
        setError('');
      } else {
        setError(err.message || 'Error al iniciar sesion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-800">CUA-BUK Monitor One</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Sistema de Contratacion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mfaRequired}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
              placeholder="usuario@clinicauandes.cl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mfaRequired}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          {mfaRequired && (
            <div>
              <label htmlFor="totp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Codigo de Autenticacion (6 digitos)
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Abra Google Authenticator e ingrese el codigo
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-300 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-800 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {mfaRequired ? 'Verificando...' : 'Ingresando...'}
              </span>
            ) : (
              mfaRequired ? 'Verificar Codigo' : 'Iniciar Sesion'
            )}
          </button>

          {mfaRequired && (
            <button
              type="button"
              onClick={() => { setMfaRequired(false); setTotpCode(''); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Volver al login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
