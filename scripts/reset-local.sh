#!/bin/bash
# CUA-BUK Monitor One - Reset completo (destruye datos y recrea)
# Uso: ./scripts/reset-local.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚠ RESET: Esto destruirá TODOS los datos y volúmenes.${NC}"
read -p "¿Continuar? (y/N): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Cancelado."
  exit 0
fi

echo -e "${CYAN}[1/3] Deteniendo y eliminando contenedores + volúmenes...${NC}"
docker compose down -v --remove-orphans 2>&1 | grep -v "^time=" || true
echo -e "${GREEN}  ✓ Limpieza completada${NC}"

echo -e "${CYAN}[2/3] Reconstruyendo imágenes...${NC}"
docker compose build --quiet 2>&1
echo -e "${GREEN}  ✓ Imágenes reconstruidas${NC}"

echo -e "${CYAN}[3/3] Levantando servicios frescos...${NC}"
exec "$SCRIPT_DIR/init-local.sh"
