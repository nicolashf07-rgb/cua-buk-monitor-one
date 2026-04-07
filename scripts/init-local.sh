#!/bin/bash
# CUA-BUK Monitor One - Inicialización completa ambiente local
# Uso: ./scripts/init-local.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CUA-BUK Monitor One - Init Local            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Verificar Docker
echo -e "${YELLOW}[1/6] Verificando Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Docker no está corriendo. Abre Docker Desktop.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ Docker activo${NC}"

# 2. Build de imágenes
echo -e "${YELLOW}[2/6] Construyendo imágenes Docker...${NC}"
docker compose build --quiet 2>&1
echo -e "${GREEN}  ✓ Imágenes construidas${NC}"

# 3. Levantar servicios
echo -e "${YELLOW}[3/6] Levantando servicios...${NC}"
docker compose up -d 2>&1 | grep -v "^time=" || true
echo -e "${GREEN}  ✓ Servicios iniciados${NC}"

# 4. Esperar que todos estén healthy
echo -e "${YELLOW}[4/6] Esperando health checks...${NC}"
SERVICES="cua-postgres adp-buk adp-sap adp-azuread cua-page srv-contratacion srv-usuarios srv-reportes cua-orq cua-kong"
MAX_WAIT=120
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  ALL_HEALTHY=true
  for svc in $SERVICES; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$STATUS" != "healthy" ]; then
      ALL_HEALTHY=false
      break
    fi
  done

  if $ALL_HEALTHY; then
    break
  fi

  sleep 3
  ELAPSED=$((ELAPSED + 3))
  printf "\r  Esperando... %ds / %ds" "$ELAPSED" "$MAX_WAIT"
done
echo ""

if ! $ALL_HEALTHY; then
  echo -e "${RED}  ✗ Algunos servicios no alcanzaron healthy en ${MAX_WAIT}s${NC}"
  docker ps --format "table {{.Names}}\t{{.Status}}" | sort
  exit 1
fi
echo -e "${GREEN}  ✓ 10/10 servicios healthy${NC}"

# 5. Verificar datos seed
echo -e "${YELLOW}[5/6] Verificando datos seed...${NC}"
CT_COUNT=$(docker exec cua-postgres psql -U cua_admin -d cua_buk_db -t -c "SELECT count(*) FROM contratacion.contrataciones" 2>/dev/null | tr -d ' ')
USR_COUNT=$(docker exec cua-postgres psql -U cua_admin -d cua_buk_db -t -c "SELECT count(*) FROM usuarios.users" 2>/dev/null | tr -d ' ')
ROLE_COUNT=$(docker exec cua-postgres psql -U cua_admin -d cua_buk_db -t -c "SELECT count(*) FROM usuarios.roles" 2>/dev/null | tr -d ' ')
echo -e "${GREEN}  ✓ ${CT_COUNT} contrataciones, ${USR_COUNT} usuarios, ${ROLE_COUNT} roles${NC}"

# 6. Test rápido de endpoints
echo -e "${YELLOW}[6/6] Verificando endpoints...${NC}"
HTTP_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinicauandes.cl","password":"admin123"}')
HTTP_CONTRATACIONES=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/contrataciones)
HTTP_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/)

if [ "$HTTP_LOGIN" = "200" ] && [ "$HTTP_CONTRATACIONES" = "200" ] && [ "$HTTP_FRONTEND" = "200" ]; then
  echo -e "${GREEN}  ✓ Login: ${HTTP_LOGIN} | Contrataciones: ${HTTP_CONTRATACIONES} | Frontend: ${HTTP_FRONTEND}${NC}"
else
  echo -e "${RED}  ✗ Login: ${HTTP_LOGIN} | Contrataciones: ${HTTP_CONTRATACIONES} | Frontend: ${HTTP_FRONTEND}${NC}"
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Sistema listo!${NC}"
echo ""
echo -e "  Frontend:     ${CYAN}http://localhost:8000/${NC}"
echo -e "  Kong Admin:   ${CYAN}http://localhost:8001/${NC}"
echo -e "  PostgreSQL:   ${CYAN}localhost:5432${NC}"
echo ""
echo -e "  Login:        admin@clinicauandes.cl / admin123"
echo -e "  Otros:        cargo@ | bd@ | cuenta@ | visualizar@ (misma pass)"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
