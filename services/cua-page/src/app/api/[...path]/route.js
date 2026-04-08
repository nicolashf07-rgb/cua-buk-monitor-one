// Proxy API route - replaces Kong for Railway deployment
// Routes /api/X to the corresponding backend service via private networking

// Consolidated for Railway Trial (5 services + PostgreSQL)
// srv-contratacion also serves /api/reportes
// adp-gateway serves /api/buk, /api/sap, /api/azure-ad
const SRV_CONTRATACION = process.env.SRV_CONTRATACION_URL || 'http://localhost:3002';
const ADP_GATEWAY = process.env.ADP_GATEWAY_URL || 'http://localhost:3005';

const SERVICE_MAP = {
  'workflow': process.env.CUA_ORQ_URL || 'http://localhost:3001',
  'contrataciones': SRV_CONTRATACION,
  'auth': SRV_CONTRATACION,
  'reportes': SRV_CONTRATACION,
  'buk': ADP_GATEWAY,
  'sap': ADP_GATEWAY,
  'azure-ad': ADP_GATEWAY,
};

function getBackendUrl(path) {
  // path is like ['auth', 'login'] or ['contrataciones', 'abc-123']
  const service = path[0];
  const backendBase = SERVICE_MAP[service];
  if (!backendBase) return null;
  const fullPath = '/api/' + path.join('/');
  return backendBase + fullPath;
}

async function handler(request, { params }) {
  const path = params.path;
  const backendUrl = getBackendUrl(path);

  if (!backendUrl) {
    return Response.json({ error: 'Service not found' }, { status: 404 });
  }

  try {
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');

    // Forward auth header
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);

    const fetchOptions = {
      method: request.method,
      headers,
    };

    // Forward body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(backendUrl, fetchOptions);
    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error(`Proxy error for ${backendUrl}:`, error.message);
    return Response.json({ error: 'Backend service unavailable', detail: error.message }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
