#!/usr/bin/env node
// CUA-BUK Monitor One - Health Check de todos los servicios
// Uso: node scripts/check-all-services.mjs

const KONG_URL = 'http://localhost:8000';

const services = [
  { name: 'Kong Gateway',      url: `http://localhost:8001/status`,       expect: 200 },
  { name: 'PostgreSQL',        check: 'docker',                          container: 'cua-postgres' },
  { name: 'cua-orq',           url: `${KONG_URL}/api/workflow`,          expect: 200 },
  { name: 'srv-contratacion',  url: `${KONG_URL}/api/contrataciones`,    expect: 200 },
  { name: 'srv-usuarios',      url: `${KONG_URL}/api/auth/login`,        method: 'POST',
    body: JSON.stringify({ email: 'admin@clinicauandes.cl', password: 'admin123' }), expect: 200 },
  { name: 'srv-reportes',      url: `${KONG_URL}/api/reportes/historico`, expect: 200 },
  { name: 'adp-buk',           url: `${KONG_URL}/api/buk/employees/12345678-9`, expect: 200 },
  { name: 'adp-sap',           url: `${KONG_URL}/api/sap/business-partner`,     method: 'POST',
    body: JSON.stringify({ first_name: 'Test', last_name: 'Check', id_number: '99999999-9' }), expect: 201 },
  { name: 'adp-azuread',       url: `${KONG_URL}/api/azure-ad/validar-email`,   method: 'POST',
    body: JSON.stringify({ email: 'test@clinicauandes.cl' }), expect: 200 },
  { name: 'cua-page',          url: `${KONG_URL}/health`,                expect: 200 },
];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const NC = '\x1b[0m';

async function checkDocker(container) {
  const { execSync } = await import('child_process');
  try {
    const status = execSync(`docker inspect --format='{{.State.Health.Status}}' ${container}`, { encoding: 'utf8' }).trim();
    return status === 'healthy' ? { ok: true, detail: 'healthy' } : { ok: false, detail: status };
  } catch {
    return { ok: false, detail: 'not found' };
  }
}

async function checkHttp(svc) {
  try {
    const opts = { method: svc.method === 'POST' ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' } };
    if (svc.body) opts.body = svc.body;
    const start = Date.now();
    const res = await fetch(svc.url, opts);
    const ms = Date.now() - start;
    const ok = svc.expect ? res.status === svc.expect : res.ok;
    return { ok, detail: `${res.status} (${ms}ms)` };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

async function main() {
  console.log(`\n${CYAN}╔══════════════════════════════════════════════════╗${NC}`);
  console.log(`${CYAN}║     CUA-BUK Monitor One - Health Check           ║${NC}`);
  console.log(`${CYAN}╚══════════════════════════════════════════════════╝${NC}\n`);

  let passed = 0;
  let failed = 0;

  for (const svc of services) {
    const result = svc.check === 'docker'
      ? await checkDocker(svc.container)
      : await checkHttp(svc);

    if (result.ok) {
      console.log(`  ${GREEN}✓${NC} ${svc.name.padEnd(20)} ${result.detail}`);
      passed++;
    } else {
      console.log(`  ${RED}✗${NC} ${svc.name.padEnd(20)} ${result.detail}`);
      failed++;
    }
  }

  console.log(`\n  ${CYAN}Resultado: ${passed} PASS / ${failed} FAIL${NC}\n`);

  if (failed > 0) {
    console.log(`  ${RED}Algunos servicios no responden correctamente.${NC}`);
    process.exit(1);
  } else {
    console.log(`  ${GREEN}Todos los servicios operativos.${NC}`);
    process.exit(0);
  }
}

main();
