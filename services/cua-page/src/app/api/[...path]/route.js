// Proxy API route - replaces Kong for Railway deployment
// Routes /api/X to the corresponding backend service via private networking
// SECURITY: Validates paths against whitelist, sanitizes input, adds timeout

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

// SECURITY: Whitelist of allowed path segments (prevent path traversal)
const ALLOWED_SERVICES = new Set(Object.keys(SERVICE_MAP));
const PATH_SEGMENT_REGEX = /^[a-zA-Z0-9\-_]+$/;

function getBackendUrl(path) {
  const service = path[0];
  if (!ALLOWED_SERVICES.has(service)) return null;

  // Validate each path segment to prevent traversal
  for (const segment of path) {
    if (!PATH_SEGMENT_REGEX.test(segment) && !isValidUUID(segment)) return null;
  }

  const backendBase = SERVICE_MAP[service];
  const fullPath = '/api/' + path.join('/');
  return backendBase + fullPath;
}

function isValidUUID(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function handler(request, { params }) {
  const path = params.path;

  // SECURITY: Limit path depth
  if (path.length > 5) {
    return Response.json({ error: 'Path too deep' }, { status: 400 });
  }

  const backendUrl = getBackendUrl(path);

  if (!backendUrl) {
    return Response.json({ error: 'Service not found' }, { status: 404 });
  }

  try {
    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');

    // Forward auth header only
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);

    const fetchOptions = {
      method: request.method,
      headers,
      signal: AbortSignal.timeout(30000), // 30s timeout
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
    console.error(`Proxy error for ${path[0]}:`, error.message);
    // SECURITY: Don't leak backend URL or error details
    return Response.json({ error: 'Service unavailable' }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
