const API_BASE = '';

// --- Auto Token Refresh ---
let refreshTimer = null;

function scheduleTokenRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Refresh 5 minutos antes de expirar (token dura 1h = 60min, refresh a los 55min)
  refreshTimer = setTimeout(async () => {
    try {
      const data = await apiFetch('/api/auth/refresh', { method: 'POST' });
      if (data.token) localStorage.setItem('token', data.token);
      scheduleTokenRefresh();
    } catch (_) { /* token expired, user will be redirected to login */ }
  }, 55 * 60 * 1000);
}

async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const csrfToken = typeof window !== 'undefined' ? localStorage.getItem('csrf_token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const error = new Error(errorBody.message || errorBody.error || `Error ${res.status}`);
    error.status = res.status;
    error.body = errorBody;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    localStorage.setItem('token', data.token);
    if (data.csrf_token) localStorage.setItem('csrf_token', data.csrf_token);
    scheduleTokenRefresh();
  }
  return data;
}

export async function loginWithMFA(email, password, totpCode) {
  const data = await apiFetch('/api/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ email, password, totp_code: totpCode }),
  });
  if (data.token) {
    localStorage.setItem('token', data.token);
    if (data.csrf_token) localStorage.setItem('csrf_token', data.csrf_token);
    scheduleTokenRefresh();
  }
  return data;
}

export async function logout() {
  if (refreshTimer) clearTimeout(refreshTimer);
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (_) { /* server logout failed, clear local anyway */ }
  localStorage.removeItem('token');
  localStorage.removeItem('csrf_token');
}

export async function refreshToken() {
  const data = await apiFetch('/api/auth/refresh', { method: 'POST' });
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
}

export async function setupMFA() {
  return apiFetch('/api/auth/mfa/setup', { method: 'POST' });
}

export async function getMe() {
  return apiFetch('/api/auth/me');
}

export async function getContrataciones() {
  return apiFetch('/api/contrataciones');
}

export async function getContratacion(id) {
  return apiFetch(`/api/contrataciones/${id}`);
}

export async function createContratacion(data) {
  return apiFetch('/api/contrataciones', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWorkflows() {
  return apiFetch('/api/workflow');
}

export async function getWorkflowEstado(id) {
  return apiFetch(`/api/workflow/${id}/estado`);
}

export async function iniciarWorkflow(data) {
  return apiFetch('/api/workflow/iniciar', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function transicionarWorkflow(id, transicion, datos = {}) {
  return apiFetch(`/api/workflow/${id}/transicionar`, {
    method: 'POST',
    body: JSON.stringify({ transicion, datos }),
  });
}

export async function getHistorico() {
  return apiFetch('/api/reportes/historico');
}

export async function getBukEmployee(rut) {
  return apiFetch(`/api/buk/employees/${rut}`);
}

export async function getContratacionCargo(id) {
  return apiFetch(`/api/contrataciones/${id}/cargo`);
}

export async function getContratacionBP(id) {
  return apiFetch(`/api/contrataciones/${id}/bp`);
}

export async function getCargoHisCatalogo() {
  return apiFetch('/api/cargo-his');
}
