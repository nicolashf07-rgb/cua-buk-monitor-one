export async function GET() {
  return Response.json({ status: 'ok', service: 'cua-page', timestamp: new Date().toISOString() });
}
