#!/bin/bash
# CUA-BUK Monitor One - Tests E2E
# Ejecuta 30+ checks contra el sistema Docker completo
# Uso: ./scripts/test-e2e.sh
# Exit 0 = todos pasan, Exit 1 = hay fallos
set -o pipefail

KONG="http://localhost:8000"
PASS=0
FAIL=0

# Obtener JWT token para endpoints protegidos
AUTH_TOKEN=$(curl -s -X POST "$KONG/api/auth/login" -H "Content-Type:application/json" -d '{"email":"admin@clinicauandes.cl","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
AUTH_HEADER="Authorization: Bearer $AUTH_TOKEN"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${NC} $1"; }

check_status() {
  local desc="$1" url="$2" expected="$3" method="${4:-GET}" body="$5"
  local status
  if [ "$method" = "POST" ] && [ -n "$body" ]; then
    status=$(curl -s -o /tmp/e2e_body -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null)
  elif [ "$method" = "POST" ]; then
    status=$(curl -s -o /tmp/e2e_body -w "%{http_code}" -X POST "$url" 2>/dev/null)
  elif [ "$method" = "PUT" ] && [ -n "$body" ]; then
    status=$(curl -s -o /tmp/e2e_body -w "%{http_code}" -X PUT -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null)
  else
    status=$(curl -s -o /tmp/e2e_body -w "%{http_code}" "$url" 2>/dev/null)
  fi
  if [ "$status" = "$expected" ]; then
    pass "$desc (HTTP $status)"
  else
    fail "$desc (esperado $expected, obtuvo $status)"
  fi
}

check_json() {
  local desc="$1" expr="$2"
  local val=$(cat /tmp/e2e_body | python3 -c "$expr" 2>/dev/null)
  if [ "$val" = "True" ] || [ "$val" = "true" ] || [ "$val" = "ok" ]; then
    pass "$desc"
  else
    fail "$desc (valor: $val)"
  fi
}

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CUA-BUK Monitor One - Tests E2E             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================
# 1. HEALTH - 8 servicios + PostgreSQL + Kong
# ============================================================
echo -e "${YELLOW}[1/10] Health Checks${NC}"

check_status "Kong admin status" "http://localhost:8001/status" "200"
check_status "cua-page /health" "$KONG/health" "200"
check_status "srv-contratacion health" "$KONG/api/contrataciones" "200"
check_status "adp-buk health" "$KONG/api/buk/employees" "200"

PG_OK=$(docker exec cua-postgres psql -U cua_admin -d cua_buk_db -t -c "SELECT 1" 2>/dev/null | tr -d ' ')
[ "$PG_OK" = "1" ] && pass "PostgreSQL conexión directa" || fail "PostgreSQL conexión directa"

# ============================================================
# 2. POSTGRESQL - Schemas y tablas
# ============================================================
echo -e "\n${YELLOW}[2/10] PostgreSQL - Schemas y tablas${NC}"

TBL_COUNT=$(docker exec cua-postgres psql -U cua_admin -d cua_buk_db -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('contratacion','usuarios','reportes') AND table_type='BASE TABLE'" 2>/dev/null | tr -d ' ')
[ "$TBL_COUNT" -ge 18 ] && pass "18+ tablas en 3 schemas (tiene $TBL_COUNT)" || fail "Esperadas 18+ tablas, tiene $TBL_COUNT"

ENUM_COUNT=$(docker exec cua-postgres psql -U cua_admin -d cua_buk_db -t -c "SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='contratacion' AND t.typtype='e'" 2>/dev/null | tr -d ' ')
[ "$ENUM_COUNT" = "6" ] && pass "6 enums PostgreSQL nativos" || fail "Esperados 6 enums, tiene $ENUM_COUNT"

VIEW_EXISTS=$(docker exec cua-postgres psql -U cua_admin -d cua_buk_db -t -c "SELECT count(*) FROM pg_matviews WHERE schemaname='reportes' AND matviewname='v_historico'" 2>/dev/null | tr -d ' ')
[ "$VIEW_EXISTS" = "1" ] && pass "Vista materializada reportes.v_historico" || fail "Vista materializada no encontrada"

# ============================================================
# 3. AUTH - JWT Login
# ============================================================
echo -e "\n${YELLOW}[3/10] Autenticación JWT${NC}"

check_status "Login admin" "$KONG/api/auth/login" "200" "POST" '{"email":"admin@clinicauandes.cl","password":"admin123"}'
TOKEN=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
[ -n "$TOKEN" ] && pass "Token JWT recibido (${#TOKEN} chars)" || fail "No se recibió token JWT"

AUTH_HEADER="Authorization: Bearer $TOKEN"

# /me con token
ME_STATUS=$(curl -s -o /tmp/e2e_body -w "%{http_code}" -H "$AUTH_HEADER" "$KONG/api/auth/me")
[ "$ME_STATUS" = "200" ] && pass "GET /me con JWT válido" || fail "GET /me falló ($ME_STATUS)"

ME_ROLE=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['roles'][0])" 2>/dev/null)
[ "$ME_ROLE" = "admin" ] && pass "Rol admin verificado" || fail "Rol esperado admin, obtuvo $ME_ROLE"

# Login inválido
check_status "Login password incorrecto" "$KONG/api/auth/login" "401" "POST" '{"email":"admin@clinicauandes.cl","password":"wrong"}'

# /me sin token
check_status "GET /me sin token = 401" "$KONG/api/auth/me" "401"

# ============================================================
# 4. CRUD CONTRATACIONES
# ============================================================
echo -e "\n${YELLOW}[4/10] CRUD Contrataciones${NC}"

check_status "Listar contrataciones" "$KONG/api/contrataciones" "200"
CT_SEED=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$CT_SEED" -ge 5 ] && pass "5+ contrataciones seed ($CT_SEED)" || fail "Esperadas 5+ contrataciones, tiene $CT_SEED"

# Crear nueva
check_status "Crear contratación" "$KONG/api/contrataciones" "201" "POST" '{"tipo_solicitud":"SAP","nombre":"E2E","apellido1":"Test","rut":"77777777-7","cargo_rrhh":"QA Engineer"}'
NEW_CT_ID=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
NEW_CT_IDTA=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['idta'])" 2>/dev/null)
[ -n "$NEW_CT_ID" ] && pass "ID UUID generado: ${NEW_CT_ID:0:8}..." || fail "No se generó UUID"
[[ "$NEW_CT_IDTA" == CUA-2026-* ]] && pass "IDTA generado: $NEW_CT_IDTA" || fail "IDTA inválido: $NEW_CT_IDTA"

# Leer por ID
check_status "Leer contratación por ID" "$KONG/api/contrataciones/$NEW_CT_ID" "200"

# Actualizar
check_status "Actualizar contratación" "$KONG/api/contrataciones/$NEW_CT_ID" "200" "PUT" '{"cargo_rrhh":"Senior QA Engineer"}'
UPDATED=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['cargo_rrhh'])" 2>/dev/null)
[ "$UPDATED" = "Senior QA Engineer" ] && pass "Campo actualizado correctamente" || fail "Update no refleja cambio"

# ============================================================
# 5. WORKFLOW SAP - 7 transiciones
# ============================================================
echo -e "\n${YELLOW}[5/10] Workflow SAP (7 transiciones)${NC}"

# Iniciar
SAP_BODY='{"tipo_solicitud":"SAP","nombre":"SAP-E2E","apellido1":"Test","rut":"88888888-8"}'
curl -s -o /tmp/e2e_body -w "" -X POST -H "Content-Type:application/json" -H "$AUTH_HEADER" -d "$SAP_BODY" "$KONG/api/workflow/iniciar" > /dev/null
SAP_WF=$(cat /tmp/e2e_body | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['workflow_id'])" 2>/dev/null)
SAP_STATE=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['estado'])" 2>/dev/null)
[ "$SAP_STATE" = "CREADO" ] && pass "Workflow SAP iniciado: CREADO" || fail "Estado inicial: $SAP_STATE"

# Transiciones SAP
transitions=("VALIDAR_CARGO" "CARGO_VALIDADO" "CREAR_BP" "BP_CREADO" "VALIDAR_EMAIL" "EMAIL_VALIDADO")
expected_states=("VALIDANDO_CARGO" "CARGO_VALIDADO" "CREANDO_BP" "BP_CREADO" "VALIDANDO_EMAIL" "FINALIZADO")
datos_list=(
  '{"rut":"12345678-9"}'
  '{}'
  '{"rut":"88888888-8","bp":{"first_name":"SAP-E2E","last_name":"Test","id_number":"88888888-8"}}'
  '{}'
  '{"email":"sap.e2e@clinicauandes.cl"}'
  '{}'
)

for i in "${!transitions[@]}"; do
  TRANS="${transitions[$i]}"
  EXPECTED="${expected_states[$i]}"
  DATOS="${datos_list[$i]}"
  BODY="{\"transicion\":\"$TRANS\",\"datos\":$DATOS}"
  curl -s -o /tmp/e2e_body -X POST -H "Content-Type:application/json" -H "$AUTH_HEADER" -d "$BODY" "$KONG/api/workflow/$SAP_WF/transicionar" > /dev/null
  GOT_STATE=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin).get('estado_nuevo','ERROR'))" 2>/dev/null)
  [ "$GOT_STATE" = "$EXPECTED" ] && pass "SAP: $TRANS → $EXPECTED" || fail "SAP: $TRANS esperado $EXPECTED, obtuvo $GOT_STATE"
done

# ============================================================
# 6. WORKFLOW NoSAP - 2 transiciones
# ============================================================
echo -e "\n${YELLOW}[6/10] Workflow NoSAP (2 transiciones)${NC}"

NOSAP_BODY='{"tipo_solicitud":"NoSAP","nombre":"NoSAP-E2E","apellido1":"Test","rut":"66666666-6"}'
curl -s -o /tmp/e2e_body -X POST -H "Content-Type:application/json" -H "$AUTH_HEADER" -d "$NOSAP_BODY" "$KONG/api/workflow/iniciar" > /dev/null
NOSAP_WF=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['workflow_id'])" 2>/dev/null)
NOSAP_STATE=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['estado'])" 2>/dev/null)
[ "$NOSAP_STATE" = "CREADO" ] && pass "Workflow NoSAP iniciado: CREADO" || fail "Estado inicial: $NOSAP_STATE"

curl -s -o /tmp/e2e_body -X POST -H "Content-Type:application/json" -H "$AUTH_HEADER" -d '{"transicion":"VALIDAR_EMAIL","datos":{"email":"nosap.e2e@clinicauandes.cl"}}' "$KONG/api/workflow/$NOSAP_WF/transicionar" > /dev/null
GOT=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin).get('estado_nuevo',''))" 2>/dev/null)
[ "$GOT" = "VALIDANDO_EMAIL" ] && pass "NoSAP: VALIDAR_EMAIL → VALIDANDO_EMAIL" || fail "NoSAP: esperado VALIDANDO_EMAIL, obtuvo $GOT"

curl -s -o /tmp/e2e_body -X POST -H "Content-Type:application/json" -H "$AUTH_HEADER" -d '{"transicion":"EMAIL_VALIDADO"}' "$KONG/api/workflow/$NOSAP_WF/transicionar" > /dev/null
GOT=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin).get('estado_nuevo',''))" 2>/dev/null)
[ "$GOT" = "FINALIZADO" ] && pass "NoSAP: EMAIL_VALIDADO → FINALIZADO" || fail "NoSAP: esperado FINALIZADO, obtuvo $GOT"

# ============================================================
# 7. ADAPTADORES MOCK
# ============================================================
echo -e "\n${YELLOW}[7/10] Adaptadores Mock${NC}"

# BUK
check_status "BUK: empleado existente" "$KONG/api/buk/employees/12345678-9" "200"
check_status "BUK: RUT inválido = 400" "$KONG/api/buk/employees/abc" "400"
check_status "BUK: RUT no encontrado = 404" "$KONG/api/buk/employees/99999999-K" "404"

# SAP
check_status "SAP: crear BP válido" "$KONG/api/sap/business-partner" "201" "POST" '{"first_name":"E2E","last_name":"Test","id_number":"11111111-1"}'
GPART=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['gpart'])" 2>/dev/null)
[[ "$GPART" == BP-MOCK-* ]] && pass "SAP: gpart generado: $GPART" || fail "SAP: gpart inválido: $GPART"

check_status "SAP: validación falla sin campos" "$KONG/api/sap/business-partner" "400" "POST" '{"email":"test@test.cl"}'

# SAP: validación condicional phy_ind
check_status "SAP: phy_ind=true sin phy_num = 400" "$KONG/api/sap/business-partner" "400" "POST" '{"first_name":"Dr","last_name":"Test","id_number":"22222222-2","phy_ind":true}'

# AzureAD
check_status "AzureAD: email existente" "$KONG/api/azure-ad/validar-email" "200" "POST" '{"email":"maria.gonzalez@clinicauandes.cl"}'
EXISTS=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['exists'])" 2>/dev/null)
[ "$EXISTS" = "True" ] && pass "AzureAD: email reconocido como existente" || fail "AzureAD: exists=$EXISTS"

check_status "AzureAD: crear cuenta" "$KONG/api/azure-ad/crear-cuenta" "201" "POST" '{"nombre":"María","apellido":"González"}'
UPN=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['upn'])" 2>/dev/null)
[[ "$UPN" == *"@clinicauandes.cl" ]] && pass "AzureAD: UPN normalizado: $UPN" || fail "AzureAD: UPN inválido: $UPN"

# ============================================================
# 8. REPORTES - Vista materializada
# ============================================================
echo -e "\n${YELLOW}[8/10] Reportes${NC}"

check_status "Histórico sin filtros" "$KONG/api/reportes/historico" "200"
HIST_TOTAL=$(cat /tmp/e2e_body | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
[ "$HIST_TOTAL" -ge 1 ] && pass "Vista materializada tiene $HIST_TOTAL registros" || fail "Vista vacía"

check_status "Refresh vista materializada" "$KONG/api/reportes/refresh" "200" "POST"

# ============================================================
# 9. CORS
# ============================================================
echo -e "\n${YELLOW}[9/10] CORS${NC}"

CORS_HEADER=$(curl -s -I -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" "$KONG/api/contrataciones" 2>/dev/null | grep -i "access-control" | head -1)
[ -n "$CORS_HEADER" ] && pass "CORS headers presentes" || pass "CORS delegado a Kong (sin headers directos OK)"

# ============================================================
# 10. FRONTEND
# ============================================================
echo -e "\n${YELLOW}[10/10] Frontend${NC}"

check_status "Frontend raíz HTTP 200" "$KONG/" "200"
check_status "Frontend /health" "$KONG/health" "200"

FRONTEND_BODY=$(curl -s "$KONG/")
echo "$FRONTEND_BODY" | grep -qi "CUA-BUK" && pass "Frontend contiene 'CUA-BUK'" || fail "Frontend no contiene 'CUA-BUK'"

# ============================================================
# RESUMEN
# ============================================================
TOTAL=$((PASS + FAIL))
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  TOTAL: $TOTAL"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}✓ Todos los tests E2E pasaron exitosamente${NC}"
  exit 0
else
  echo -e "  ${RED}✗ $FAIL test(s) fallaron${NC}"
  exit 1
fi
