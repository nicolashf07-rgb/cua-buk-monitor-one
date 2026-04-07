# CUA-BUK Monitor One — Documento de Infraestructura

> Sistema de Contratación — Clínica Universidad de los Andes
> Fecha: 2026-04-06 | Versión: 1.0.0 | Ambiente: Local (Docker)

---

## 1. Visión General

CUA-BUK Monitor One es la refactorización del monolito C# **CUANDES-BUK-contratacion** hacia una arquitectura de **10 microservicios Node.js dockerizados** organizados en 5 capas AIBO.

El sistema gestiona el flujo completo de contratación de personal clínico, integrando (en modo mock para ambiente local) los servicios BUK HR, SAP TrakCare y Azure Active Directory.

### Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| Archivos totales | 55 |
| Líneas de código | 3,842 |
| Contenedores Docker | 10 |
| Tablas PostgreSQL | 18 |
| Enums nativos | 6 |
| Vistas materializadas | 1 |
| Foreign Keys | 15 |
| Índices | 27 |
| Endpoints API | 22 |
| Tests E2E | 50 |
| Rutas Kong | 8 |

---

## 2. Arquitectura de 5 Capas

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 — PAGE (Presentación)                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ cua-page (:3000) — Next.js 14, App Router, Tailwind CSS    ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  CAPA 2 — MCP (API Gateway)                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ cua-kong (:8000/:8001) — Kong 3.6, configuración declarativa││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  CAPA 3 — ORQ (Orquestación)                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ cua-orq (:3001) — FSM workflows SAP/NoSAP, coordinación ADP││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  CAPA 4 — SRV (Servicios Core)                                   │
│  ┌──────────────────┐┌──────────────────┐┌────────────────────┐│
│  │srv-contratacion  ││srv-usuarios      ││srv-reportes        ││
│  │(:3002)           ││(:3003)           ││(:3004)             ││
│  │CRUD contratac.   ││Auth JWT + RBAC   ││Vista materializada ││
│  └──────────────────┘└──────────────────┘└────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  CAPA 5 — ADP (Adaptadores Externos)                             │
│  ┌──────────────────┐┌──────────────────┐┌────────────────────┐│
│  │adp-buk (:3005)   ││adp-sap (:3006)   ││adp-azuread (:3007) ││
│  │BUK HR mock       ││SAP TrakCare mock ││Azure AD mock       ││
│  └──────────────────┘└──────────────────┘└────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  BASE DE DATOS                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ cua-postgres (:5432) — PostgreSQL 15, 3 schemas, 18 tablas ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Contenedores Docker

Todos los contenedores corren en la red `m1-bf-net` con health checks configurados.

### 3.1 Tabla de Servicios

| Contenedor | Imagen | Puerto | Healthcheck | Dependencias |
|------------|--------|--------|-------------|--------------|
| cua-postgres | postgres:15-alpine | 5432 | pg_isready | — |
| cua-kong | kong:3.6 | 8000, 8001 | kong health | todos los servicios |
| cua-orq | node:20-alpine | 3001 | wget /health | cua-postgres |
| srv-contratacion | node:20-alpine | 3002 | wget /health | cua-postgres |
| srv-usuarios | node:20-alpine | 3003 | wget /health | cua-postgres |
| srv-reportes | node:20-alpine | 3004 | wget /health | cua-postgres |
| adp-buk | node:20-alpine | 3005 | wget /health | — |
| adp-sap | node:20-alpine | 3006 | wget /health | — |
| adp-azuread | node:20-alpine | 3007 | wget /health | — |
| cua-page | node:20-alpine | 3000 | node fetch /health | — |

### 3.2 Tamaños de Imágenes

| Imagen | Tamaño |
|--------|--------|
| cua-buk-cua-page | 223 MB |
| cua-buk-cua-orq | 219 MB |
| cua-buk-srv-usuarios | 216 MB |
| cua-buk-srv-contratacion | 213 MB |
| cua-buk-adp-sap | 212 MB |
| cua-buk-srv-reportes | 212 MB |
| cua-buk-adp-buk | 209 MB |
| cua-buk-adp-azuread | 209 MB |

### 3.3 Variables de Entorno

Definidas en `.env`:

| Variable | Valor | Usado por |
|----------|-------|-----------|
| POSTGRES_USER | cua_admin | cua-postgres |
| POSTGRES_PASSWORD | cua_local_2026 | cua-postgres |
| POSTGRES_DB | cua_buk_db | cua-postgres |
| DATABASE_URL | postgresql://cua_admin:cua_local_2026@cua-postgres:5432/cua_buk_db | orq, srv-*, todos los que conectan a BD |
| JWT_SECRET | cua-buk-local-jwt-secret-2026-dev-only | srv-usuarios, cua-orq |
| MOCK_MODE | true | adp-buk, adp-sap, adp-azuread |
| NODE_ENV | development | todos |

### 3.4 Red Docker

- **Nombre:** m1-bf-net
- **Driver:** bridge
- **Volumen persistente:** pg-data (datos PostgreSQL)

---

## 4. Base de Datos PostgreSQL

### 4.1 Schemas

| Schema | Propósito | Tablas | Owner |
|--------|-----------|--------|-------|
| contratacion | Dominio principal de contratación | 11 | srv-contratacion, cua-orq |
| usuarios | Autenticación y RBAC | 7 | srv-usuarios |
| reportes | Vistas de reporting | 1 (materializada) | srv-reportes |

### 4.2 Enums Nativos

| Enum | Valores | Reemplaza |
|------|---------|-----------|
| estado_clinica | Enable, Seguridad, Disable | nvarchar(50) ti_clinica_estado |
| estado_seguridad | (vacío), EnableBP, EnableCuenta, FinCuenta, FinSapManual | nvarchar(50) ti_seguridad_estado |
| estado_email | (vacío), Manual, Finalizado | nvarchar(50) mesa_servicio_estado |
| origen_contratacion | buk, manual | No existía en legacy |
| tipo_solicitud | SAP, NoSAP | nvarchar(50) tipo_solicitud |
| tipo_contrato | Indefinido, PlazoFijo, Honorarios | No existía en legacy |

### 4.3 Schema `contratacion` — 11 Tablas

#### contratacion.contrataciones (tabla principal)
| Columna | Tipo | Constraints |
|---------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| idta | VARCHAR(20) | UNIQUE NOT NULL (CUA-2026-NNNNN) |
| usuario_id_legacy | INT | Referencia al ID legacy |
| origen | origen_contratacion | NOT NULL DEFAULT 'manual' |
| tipo_solicitud | tipo_solicitud | |
| tipo_contrato | tipo_contrato | |
| estado_clinica | estado_clinica | NOT NULL DEFAULT 'Enable' |
| estado_seguridad | estado_seguridad | NOT NULL DEFAULT '' |
| estado_email | estado_email | NOT NULL DEFAULT '' |
| nombre | VARCHAR(250) | |
| apellido1 | VARCHAR(250) | |
| apellido2 | VARCHAR(250) | |
| rut | VARCHAR(20) | |
| cargo_rrhh | VARCHAR(250) | |
| fecha_ingreso | DATE | |
| fecha_inicio_contrato | DATE | |
| bossfullname | VARCHAR(250) | |
| bossemail | VARCHAR(300) | |
| mesa_servicio_estado | VARCHAR(50) | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**Índices:** idx_contrataciones_idta, idx_contrataciones_rut, idx_contrataciones_estado

#### contratacion.crear_usuario_form (flujo SAP)
| Columna | Tipo | Constraints |
|---------|------|-------------|
| id | UUID | PK |
| contratacion_id | UUID | FK → contrataciones ON DELETE CASCADE |
| rut, nombre, apellido1, apellido2 | VARCHAR | Datos personales |
| email | VARCHAR(300) | |
| telefono | VARCHAR(50) | |
| direccion | VARCHAR(500) | |
| comuna, region | VARCHAR(100) | |
| fecha_nacimiento | DATE | |
| sexo | VARCHAR(20) | |
| nacionalidad | VARCHAR(100) | |
| estado_civil | VARCHAR(50) | |
| created_at, updated_at | TIMESTAMPTZ | |

#### contratacion.validacion_bp (SAP Business Partner — 38+ campos)
| Categoría | Campos | Detalle |
|-----------|--------|---------|
| Identidad (11) | title, first_name, last_name, second_last_name, id_number, id_type, birth_date, gender, nationality, marital_status, name_supplement | |
| Dirección (6) | street, house_number, city, region, postal_code, country | |
| Contacto (3) | telephone, mobile, email | |
| Fiscal (2) | tax_number, tax_type | |
| Personal/Laboral (7) | bank_account, bank_key, payment_method, occupation, department | |
| Healthcare IS-H (11) | phy_ind, phy_num, spl_ty_typ, nur_ind, med_staff_type, med_staff_group, fonasa_group, isapre, prev_system, afp, health_plan | |
| Control (3) | type_bp, gpart, status | |

**FK:** contratacion_id → contrataciones ON DELETE CASCADE

#### contratacion.validacion_cargo_form
Campos: cargo, area, centro_costo, jefe_directo, jefe_email, fecha_inicio, fecha_termino, tipo_contrato, jornada, observaciones, validado (BOOLEAN), validado_por, validado_at.

#### contratacion.validacion_cuenta_form
Campos: email_asignado, upn, cuenta_creada (BOOLEAN), cuenta_activa (BOOLEAN), observaciones, validado (BOOLEAN), validado_por, validado_at.

#### contratacion.crear_usuario_nosap
Campos: rut, nombre, apellido1, apellido2, email, cargo, area, fecha_ingreso, tipo_contrato, estado_email, observaciones.

#### contratacion.usuario_api_buk
Campos: rut (NOT NULL), nombre, apellido, email, cargo, area, fecha_ingreso, boss_full_name, boss_email, raw_data (JSONB).
**FK:** contratacion_id → contrataciones ON DELETE SET NULL

#### contratacion.cargo_his
Campos: cargo, area, centro_costo, fecha_desde, fecha_hasta, activo (BOOLEAN).
**FK:** contratacion_id → contrataciones ON DELETE SET NULL

#### contratacion.auditoria_workflow
Campos: paso_wf (NOT NULL), usuario_ejecutor, detalle, estado_anterior, estado_nuevo, ip_address.
**FK:** contratacion_id → contrataciones ON DELETE CASCADE

#### contratacion.workflows
| Columna | Tipo | Constraints |
|---------|------|-------------|
| id | UUID | PK |
| contratacion_id | UUID | FK → contrataciones ON DELETE CASCADE |
| tipo_solicitud | tipo_solicitud | NOT NULL |
| estado_actual | VARCHAR(50) | NOT NULL DEFAULT 'CREADO' |
| xstate_snapshot | JSONB | Para recovery de estado |
| created_at, updated_at | TIMESTAMPTZ | |

#### contratacion.transition_log
| Columna | Tipo | Constraints |
|---------|------|-------------|
| id | UUID | PK |
| workflow_id | UUID | FK → workflows ON DELETE CASCADE |
| estado_anterior | VARCHAR(50) | |
| estado_nuevo | VARCHAR(50) | NOT NULL |
| transicion | VARCHAR(100) | NOT NULL |
| datos | JSONB | Input de la transición |
| resultado | JSONB | Output de la acción |
| error | TEXT | Mensaje de error si falló |
| duracion_ms | INT | Tiempo de ejecución |
| created_at | TIMESTAMPTZ | |

### 4.4 Schema `usuarios` — 7 Tablas

| Tabla | Campos principales | Constraints |
|-------|-------------------|-------------|
| users | id UUID PK, email UNIQUE NOT NULL, password_hash, nombre, apellido, activo, ultimo_login | |
| roles | id UUID PK, nombre UNIQUE NOT NULL, descripcion | 5 seed: admin, cargo, bd, cuenta, visualizar |
| user_roles | user_id FK, role_id FK | UNIQUE(user_id, role_id), CASCADE |
| permissions | id UUID PK, nombre UNIQUE, recurso, accion | |
| role_permissions | role_id FK, permission_id FK | UNIQUE(role_id, permission_id), CASCADE |
| device_cookies | user_id FK, device_fingerprint, token_hash, ip_address, trusted, expires_at | OWASP security |
| login_attempts | email, ip_address, success, failure_reason, attempted_at | Brute force protection |

### 4.5 Schema `reportes` — 1 Vista Materializada

**reportes.v_historico**: JOIN de 4 tablas (contrataciones + crear_usuario_form + validacion_bp + validacion_cargo_form + crear_usuario_nosap) con campo calculado `estado_completo`.

- **Índice único:** idx_v_historico_id (habilita REFRESH CONCURRENTLY)
- **Refresh:** POST /api/reportes/refresh

### 4.6 Foreign Keys (15 total)

| Tabla origen | Columna | Referencia | ON DELETE |
|-------------|---------|------------|-----------|
| crear_usuario_form | contratacion_id | contrataciones | CASCADE |
| validacion_bp | contratacion_id | contrataciones | CASCADE |
| validacion_cargo_form | contratacion_id | contrataciones | CASCADE |
| validacion_cuenta_form | contratacion_id | contrataciones | CASCADE |
| crear_usuario_nosap | contratacion_id | contrataciones | CASCADE |
| auditoria_workflow | contratacion_id | contrataciones | CASCADE |
| workflows | contratacion_id | contrataciones | CASCADE |
| usuario_api_buk | contratacion_id | contrataciones | SET NULL |
| cargo_his | contratacion_id | contrataciones | SET NULL |
| transition_log | workflow_id | workflows | CASCADE |
| user_roles | user_id | users | CASCADE |
| user_roles | role_id | roles | CASCADE |
| device_cookies | user_id | users | CASCADE |
| role_permissions | role_id | roles | CASCADE |
| role_permissions | permission_id | permissions | CASCADE |

### 4.7 Datos Seed

- **5 contrataciones** mock (3 origen BUK + 2 manual, mix SAP/NoSAP)
- **5 usuarios** con bcrypt hash de "admin123"
- **5 roles** asignados (1 por usuario)
- **1 registro** crear_usuario_form, validacion_bp implícita, crear_usuario_nosap, usuario_api_buk
- **1 registro** auditoria_workflow
- Vista materializada pre-refrescada

---

## 5. API Gateway — Kong 3.6

### 5.1 Configuración

- Modo: Declarativo (sin base de datos)
- Archivo: `infra/kong/kong.yml`
- Proxy: puerto 8000
- Admin: puerto 8001

### 5.2 Rutas

| Ruta | Path | Servicio destino |
|------|------|-----------------|
| orq-routes | /api/workflow | cua-orq:3001 |
| contratacion-routes | /api/contrataciones | srv-contratacion:3002 |
| auth-routes | /api/auth | srv-usuarios:3003 |
| reportes-routes | /api/reportes | srv-reportes:3004 |
| buk-routes | /api/buk | adp-buk:3005 |
| sap-routes | /api/sap | adp-sap:3006 |
| azuread-routes | /api/azure-ad | adp-azuread:3007 |
| frontend-routes | / | cua-page:3000 |

---

## 6. Servicios — Detalle

### 6.1 cua-orq (Orquestador) — Puerto 3001

**Dependencias npm:** express, pg, xstate, uuid, cors, dotenv

**Endpoints:**
| Método | Path | Función |
|--------|------|---------|
| GET | /health | Health check con estado BD |
| POST | /api/workflow/iniciar | Crea contratación vía srv-contratacion + workflow con estado CREADO |
| POST | /api/workflow/:id/transicionar | Ejecuta transición FSM + acción automática + log |
| GET | /api/workflow/:id/estado | Estado actual + historial + transiciones disponibles |
| GET | /api/workflow | Lista todos los workflows con datos contratación |

**FSM — Máquina de Estados Finitos:**

Flujo SAP (7 transiciones):
```
CREADO → VALIDANDO_CARGO → CARGO_VALIDADO → CREANDO_BP → BP_CREADO → VALIDANDO_EMAIL → FINALIZADO
```

Flujo NoSAP (2 transiciones):
```
CREADO → VALIDANDO_EMAIL → FINALIZADO
```

Fallback: Cualquier estado → INTERVENCION_MANUAL (via transición ERROR)
Recovery: INTERVENCION_MANUAL → CREADO (via transición REINTENTAR)

**Acciones automáticas por transición:**
| Transición | Servicio llamado | Acción |
|------------|-----------------|--------|
| VALIDAR_CARGO | adp-buk | GET /api/buk/employees/:rut |
| CREAR_BP | adp-sap | POST /api/sap/business-partner |
| VALIDAR_EMAIL | adp-azuread | POST /api/azure-ad/validar-email |

**Sincronización de estados:** Al transicionar un workflow, el orquestador actualiza automáticamente los campos `estado_clinica` y `estado_seguridad` en la tabla `contrataciones` según un mapeo predefinido.

### 6.2 srv-contratacion — Puerto 3002

**Dependencias npm:** express, pg, uuid, cors, dotenv

**Endpoints:**
| Método | Path | Función |
|--------|------|---------|
| GET | /health | Health check con estado BD |
| GET | /api/contrataciones | Lista con filtros opcionales (estado_clinica, tipo_solicitud, origen) |
| GET | /api/contrataciones/:id | Detalle por UUID |
| POST | /api/contrataciones | Crear (auto-genera idta CUA-2026-NNNNN) |
| PUT | /api/contrataciones/:id | Actualizar (COALESCE para update parcial) |

**Generación IDTA:** `CUA-{año}-{secuencial 5 dígitos}` basado en COUNT del año actual.

### 6.3 srv-usuarios — Puerto 3003

**Dependencias npm:** express, pg, bcryptjs, jsonwebtoken, uuid, cors, dotenv

**Endpoints:**
| Método | Path | Función |
|--------|------|---------|
| GET | /health | Health check |
| POST | /api/auth/register | Registro con bcrypt (10 rounds) + asignación de rol |
| POST | /api/auth/login | Login, retorna JWT (8h expiración) con {userId, email, roles} |
| GET | /api/auth/me | Verificación de token, retorna usuario + roles |

**Seguridad:**
- Passwords: bcrypt con 10 salt rounds
- Tokens: JWT HS256, 8 horas de expiración
- Roles via JOIN usuarios.user_roles + usuarios.roles

**Roles RBAC (5):**
| Rol | Descripción | Legacy equivalente |
|-----|-------------|-------------------|
| admin | Acceso total | bukemp_admin |
| cargo | Crear usuarios / validar cargo | bukemp_cargo |
| bd | Validar Business Partner SAP | bukemp_bd |
| cuenta | Validar cuentas AD | bukemp_cuenta |
| visualizar | Solo lectura | bukemp_visualizar |

### 6.4 srv-reportes — Puerto 3004

**Dependencias npm:** express, pg, cors, dotenv

**Endpoints:**
| Método | Path | Función |
|--------|------|---------|
| GET | /health | Health check |
| GET | /api/reportes/historico | Query v_historico con filtros (estado_clinica, tipo_solicitud) |
| POST | /api/reportes/refresh | REFRESH MATERIALIZED VIEW CONCURRENTLY |

### 6.5 adp-buk (Adaptador BUK HR) — Puerto 3005

**Dependencias npm:** express, cors, dotenv
**Modo:** MOCK_MODE=true (siempre en local)

**Endpoints:**
| Método | Path | Función |
|--------|------|---------|
| GET | /health | Health check |
| GET | /api/buk/employees/:rut | Buscar empleado por RUT |
| GET | /api/buk/employees | Listar todos (utilidad dev) |

**Validaciones:**
- Formato RUT chileno: /^\d{7,8}[0-9kK]$/ → 400 si inválido
- RUT no encontrado → 404

**Empleados Mock (3):**
| RUT | Nombre | Cargo | Área |
|-----|--------|-------|------|
| 12345678-9 | María González Pérez | Médico Internista | Medicina Interna |
| 98765432-1 | Juan Muñoz Silva | Enfermero UCI | UCI |
| 11222333-4 | Catalina Rojas Díaz | Administrativa | Admisión |

### 6.6 adp-sap (Adaptador SAP TrakCare) — Puerto 3006

**Dependencias npm:** express, cors, dotenv, joi
**Modo:** MOCK_MODE=true

**Endpoints:**
| Método | Path | Función |
|--------|------|---------|
| GET | /health | Health check |
| POST | /api/sap/business-partner | Crear BP con validación Joi 38 campos |
| GET | /api/sap/business-partner/:gpart | Consultar BP (utilidad dev) |

**Validación Joi — 38 campos en 6 categorías:**
| Categoría | Campos | Campos requeridos |
|-----------|--------|-------------------|
| Identidad | 11 | first_name, last_name, id_number |
| Dirección | 6 | — |
| Contacto | 3 | — |
| Fiscal | 2 | — |
| Personal/Laboral | 5 | — |
| Healthcare IS-H | 11 | phy_num (solo si phy_ind=true) |

**Validación condicional:** Si `phy_ind=true` (médico registrado), entonces `phy_num` es requerido.

**Respuesta:** gpart incremental `BP-MOCK-NNNNNN`, payload en PascalCase (first_name → FirstName).

### 6.7 adp-azuread (Adaptador Azure AD) — Puerto 3007

**Dependencias npm:** express, cors, dotenv
**Modo:** MOCK_MODE=true

**Endpoints:**
| Método | Path | Función |
|--------|------|---------|
| GET | /health | Health check |
| POST | /api/azure-ad/validar-email | Verificar si email/UPN existe en directorio |
| POST | /api/azure-ad/crear-cuenta | Crear cuenta con UPN normalizado |
| GET | /api/azure-ad/cuentas | Listar cuentas creadas (utilidad dev) |

**Normalización de acentos:** María → maria, González → gonzalez (NFD + strip diacritics)

**Deduplicación incremental de UPN:**
- maria.gonzalez@clinicauandes.cl (existe)
- maria.gonzalez2@clinicauandes.cl (primera dedup)
- maria.gonzalez3@clinicauandes.cl (segunda dedup)

**UPNs pre-existentes mock:** maria.gonzalez@, juan.munoz@, catalina.rojas@clinicauandes.cl

### 6.8 cua-page (Frontend) — Puerto 3000

**Stack:** Next.js 14.2.5, React 18, Tailwind CSS 3.4, App Router
**Build:** Docker multi-stage (builder + standalone runner)
**Líneas de código frontend:** 1,276

**Páginas (7):**
| Ruta | Archivo | Función | Protegida |
|------|---------|---------|-----------|
| / | page.js | Redirect a /login o /dashboard | No |
| /login | login/page.js | Formulario login con LoginForm | No |
| /dashboard | dashboard/page.js | Stats + tabla contrataciones | Sí |
| /nueva-sap | nueva-sap/page.js | Formulario contratación SAP (8 campos) | Sí |
| /nueva-nosap | nueva-nosap/page.js | Formulario contratación NoSAP (6 campos) | Sí |
| /contratacion/[id] | contratacion/[id]/page.js | Detalle + workflow + transiciones | Sí |
| /historico | historico/page.js | Vista materializada con filtros | Sí |
| /health | health/route.js | API route para healthcheck | No |

**Componentes (4):**
| Componente | Función |
|------------|---------|
| NavBar | Barra superior azul, links de navegación, usuario, logout |
| LoginForm | Formulario email/password con loading y error states |
| ContratacionTable | Tabla con badges de estado, filas clickeables |
| WorkflowStatusBadge | Badge de colores según estado del workflow |

**API Helper (src/lib/api.js):**
- Base URL vacía (misma origin via Kong)
- Token JWT en localStorage
- 12 funciones: login, logout, getMe, getContrataciones, getContratacion, createContratacion, getWorkflows, getWorkflowEstado, iniciarWorkflow, transicionarWorkflow, getHistorico, getBukEmployee

---

## 7. Estructura de Archivos

```
cua-buk-monitor-one/
├── .env                                    # Variables de entorno
├── docker-compose.yml                      # 10 servicios (226 líneas)
│
├── infra/
│   ├── kong/
│   │   └── kong.yml                        # Configuración declarativa Kong (8 rutas)
│   └── postgres/
│       ├── 00-init.sql                     # Schemas + 6 enums
│       ├── 01-contratacion.sql             # 9 tablas contratación (223 líneas)
│       ├── 01b-workflow.sql                # workflows + transition_log
│       ├── 02-usuarios.sql                 # 7 tablas RBAC + 5 roles seed
│       ├── 03-reportes.sql                 # Vista materializada v_historico
│       └── 04-seed.sql                     # 5 contrataciones + 5 usuarios
│
├── scripts/
│   ├── init-local.sh                       # Inicialización completa (6 pasos)
│   ├── stop-local.sh                       # Detener preservando datos
│   ├── reset-local.sh                      # Destruir y recrear todo
│   ├── check-all-services.mjs              # Health check 10 servicios
│   └── test-e2e.sh                         # 50 tests E2E (10 secciones)
│
└── services/
    ├── cua-orq/                            # Orquestador (345 líneas)
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    │
    ├── srv-contratacion/                   # CRUD contrataciones (154 líneas)
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    │
    ├── srv-usuarios/                       # Auth JWT + RBAC (173 líneas)
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    │
    ├── srv-reportes/                       # Reportes (70 líneas)
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    │
    ├── adp-buk/                            # Adaptador BUK mock (108 líneas)
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    │
    ├── adp-sap/                            # Adaptador SAP mock (153 líneas)
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    │
    ├── adp-azuread/                        # Adaptador Azure AD mock (151 líneas)
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/index.js
    │
    └── cua-page/                           # Frontend Next.js 14
        ├── Dockerfile                      # Multi-stage build (standalone)
        ├── jsconfig.json                   # Alias @/ → src/
        ├── next.config.js                  # output: standalone
        ├── package.json
        ├── postcss.config.js
        ├── tailwind.config.js
        └── src/
            ├── app/
            │   ├── globals.css
            │   ├── layout.js               # Root layout
            │   ├── page.js                 # Root redirect
            │   ├── login/page.js
            │   ├── dashboard/page.js
            │   ├── nueva-sap/page.js
            │   ├── nueva-nosap/page.js
            │   ├── contratacion/[id]/page.js
            │   ├── historico/page.js
            │   └── health/route.js         # API route healthcheck
            ├── components/
            │   ├── NavBar.js
            │   ├── LoginForm.js
            │   ├── ContratacionTable.js
            │   └── WorkflowStatusBadge.js
            └── lib/
                └── api.js                  # 12 funciones API helper
```

---

## 8. Flujos de Negocio

### 8.1 Flujo SAP Completo

```
Operador (rol cargo) → Crea contratación tipo SAP
    │
    ▼
[1] CREADO ──VALIDAR_CARGO──▶ [2] VALIDANDO_CARGO
    │                              │ Llama adp-buk GET /employees/:rut
    │                              │ Obtiene datos del empleado desde BUK
    │                              ▼
[3] CARGO_VALIDADO ◀─────── CARGO_VALIDADO
    │
    ▼ CREAR_BP
[4] CREANDO_BP
    │ Llama adp-sap POST /business-partner
    │ Envía 38 campos, recibe gpart (BP-MOCK-NNNNNN)
    ▼
[5] BP_CREADO ──VALIDAR_EMAIL──▶ [6] VALIDANDO_EMAIL
    │                                   │ Llama adp-azuread POST /validar-email
    │                                   │ Verifica si UPN existe en directorio
    │                                   ▼
[7] FINALIZADO ◀──────────── EMAIL_VALIDADO
    │
    ▼
contratacion.estado_clinica = 'Disable'
contratacion.estado_seguridad = 'FinCuenta'
```

### 8.2 Flujo NoSAP Completo

```
Operador → Crea contratación tipo NoSAP
    │
    ▼
[1] CREADO ──VALIDAR_EMAIL──▶ [2] VALIDANDO_EMAIL
    │                               │ Llama adp-azuread POST /validar-email
    │                               ▼
[3] FINALIZADO ◀──────────── EMAIL_VALIDADO
```

### 8.3 Flujo de Error / Intervención Manual

```
Cualquier estado ──ERROR──▶ INTERVENCION_MANUAL
                                    │
                                    ▼ REINTENTAR
                                  CREADO (reinicia flujo)
```

---

## 9. Seguridad

| Aspecto | Implementación | Legacy |
|---------|---------------|--------|
| Autenticación | JWT HS256 (8h expiración) | Azure AD claims |
| Passwords | bcrypt 10 salt rounds | N/A (Azure AD) |
| RBAC | 5 roles via tabla (admin, cargo, bd, cuenta, visualizar) | 5 roles via Azure AD claims |
| SQL Injection | Queries parametrizadas ($1, $2...) en todas las queries | 10+ vulnerabilidades string interpolation |
| Secrets | Variables de entorno (.env) | 5+ hardcodeados en código |
| Brute force | Tabla login_attempts (preparada) | No existía |
| Device trust | Tabla device_cookies (preparada, OWASP) | No existía |
| API Gateway | Kong como único punto de entrada | Exposición directa |

---

## 10. Scripts Operacionales

### 10.1 init-local.sh
Proceso de 6 pasos:
1. Verificar Docker corriendo
2. Build de imágenes (docker compose build)
3. Levantar servicios (docker compose up -d)
4. Esperar health checks (timeout 120s)
5. Verificar datos seed en PostgreSQL
6. Test endpoints (login, contrataciones, frontend)

### 10.2 stop-local.sh
- `docker compose stop` (preserva volumen pg-data)
- Para reiniciar: `docker compose start`

### 10.3 reset-local.sh
- Confirmación interactiva (y/N)
- `docker compose down -v --remove-orphans` (destruye datos)
- Reconstruye y ejecuta init-local.sh

### 10.4 check-all-services.mjs
Health check de 10 servicios con tiempos de respuesta en ms.
Exit 0 si todos pasan, exit 1 si alguno falla.

### 10.5 test-e2e.sh
**50 tests en 10 secciones:**

| Sección | Tests | Qué verifica |
|---------|-------|-------------|
| 1. Health Checks | 5 | Kong, PostgreSQL, cua-page, srv-contratacion, adp-buk |
| 2. PostgreSQL | 3 | 18 tablas, 6 enums, vista materializada |
| 3. Auth JWT | 6 | Login correcto, token, /me, rol admin, login inválido, sin token |
| 4. CRUD Contrataciones | 7 | Listar, seed, crear, UUID, IDTA, leer, actualizar |
| 5. Workflow SAP | 7 | Iniciar + 6 transiciones hasta FINALIZADO |
| 6. Workflow NoSAP | 3 | Iniciar + 2 transiciones hasta FINALIZADO |
| 7. Adaptadores Mock | 11 | BUK (3), SAP (4), AzureAD (4) |
| 8. Reportes | 3 | Histórico, conteo, refresh vista |
| 9. CORS | 1 | Headers presentes |
| 10. Frontend | 3 | HTTP 200, /health, contiene "CUA-BUK" |
| **TOTAL** | **50** | |

---

## 11. Acceso al Sistema

### URLs
| Recurso | URL |
|---------|-----|
| Frontend | http://localhost:8000/ |
| Kong Admin | http://localhost:8001/ |
| PostgreSQL | localhost:5432 |

### Credenciales (ambiente local)
| Email | Password | Rol |
|-------|----------|-----|
| admin@clinicauandes.cl | admin123 | admin |
| cargo@clinicauandes.cl | admin123 | cargo |
| bd@clinicauandes.cl | admin123 | bd |
| cuenta@clinicauandes.cl | admin123 | cuenta |
| visualizar@clinicauandes.cl | admin123 | visualizar |

### Base de datos
| Parámetro | Valor |
|-----------|-------|
| Host | localhost |
| Puerto | 5432 |
| Base de datos | cua_buk_db |
| Usuario | cua_admin |
| Password | cua_local_2026 |

---

## 12. Comandos Rápidos

```bash
# Iniciar todo desde cero
./scripts/init-local.sh

# Verificar estado
node scripts/check-all-services.mjs

# Correr tests E2E
./scripts/test-e2e.sh

# Detener (preserva datos)
./scripts/stop-local.sh

# Reiniciar rápido
docker compose start

# Reset completo (destruye datos)
./scripts/reset-local.sh

# Ver logs de un servicio
docker logs cua-orq -f

# Acceder a PostgreSQL
docker exec -it cua-postgres psql -U cua_admin -d cua_buk_db

# Rebuild un servicio específico
docker compose up --build -d cua-orq
```

---

## 13. Mapeo Legacy → Monitor One

| Componente Legacy (C#) | Componente Monitor One | Mejora |
|------------------------|----------------------|--------|
| Monolito ASP.NET MVC | 10 microservicios Node.js | Desacoplamiento |
| SQL Server Azure | PostgreSQL 15 Docker | Portabilidad local |
| 0 FK, UsuarioId int | UUID PK + 15 FK reales | Integridad referencial |
| nvarchar(50) para estados | 6 enums PostgreSQL nativos | Type-safety |
| View_Historico (vista SQL) | v_historico (MATERIALIZED VIEW) | REFRESH CONCURRENTLY |
| Azure AD claims | JWT + bcrypt + RBAC tablas | Independencia de Azure |
| 4 Logic Apps Azure | cua-orq FSM (SAP/NoSAP) | Sin vendor lock-in |
| String interpolation SQL | Queries parametrizadas ($1) | Seguridad |
| Secrets hardcodeados | Variables de entorno (.env) | Seguridad |
| 0 tests, 0 Docker, 0 CI | 50 tests E2E, Docker Compose, scripts | Automatización |
| Razor Views (25+) | Next.js 14 + Tailwind (7 páginas) | SPA moderna |
| Deploy manual Azure | docker-compose up | One-command local |
