const API_BASE = '';

async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const error = new Error(errorBody.message || errorBody.error || `Error ${res.status}`);
    error.status = res.status;
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
  }
  return data;
}

export function logout() {
  localStorage.removeItem('token');
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
