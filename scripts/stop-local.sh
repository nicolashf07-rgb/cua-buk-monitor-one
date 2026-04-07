#!/bin/bash
# CUA-BUK Monitor One - Detener servicios (preserva datos)
# Uso: ./scripts/stop-local.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${CYAN}Deteniendo CUA-BUK Monitor One...${NC}"
docker compose stop 2>&1 | grep -v "^time=" || true
echo -e "${GREEN}✓ Servicios detenidos. Datos preservados en volumen pg-data.${NC}"
echo -e "  Para reiniciar: ${CYAN}docker compose start${NC}"
echo -e "  Para reiniciar limpio: ${CYAN}./scripts/reset-local.sh${NC}"
