-- Schema contratacion: 9 tablas con UUID PK, FK reales, enums nativos

-- Tabla principal
CREATE TABLE contratacion.contrataciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idta VARCHAR(20) UNIQUE NOT NULL,
    usuario_id_legacy INT,
    origen contratacion.origen_contratacion NOT NULL DEFAULT 'manual',
    tipo_solicitud contratacion.tipo_solicitud,
    tipo_contrato contratacion.tipo_contrato,
    estado_clinica contratacion.estado_clinica NOT NULL DEFAULT 'Enable',
    estado_seguridad contratacion.estado_seguridad NOT NULL DEFAULT '',
    estado_email contratacion.estado_email NOT NULL DEFAULT '',
    nombre VARCHAR(250),
    apellido1 VARCHAR(250),
    apellido2 VARCHAR(250),
    rut VARCHAR(20),
    cargo_rrhh VARCHAR(250),
    fecha_ingreso DATE,
    fecha_inicio_contrato DATE,
    bossfullname VARCHAR(250),
    bossemail VARCHAR(300),
    mesa_servicio_estado VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contrataciones_idta ON contratacion.contrataciones(idta);
CREATE INDEX idx_contrataciones_rut ON contratacion.contrataciones(rut);
CREATE INDEX idx_contrataciones_estado ON contratacion.contrataciones(estado_clinica, estado_seguridad);

-- Formulario crear usuario (flujo SAP)
CREATE TABLE contratacion.crear_usuario_form (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID NOT NULL REFERENCES contratacion.contrataciones(id) ON DELETE CASCADE,
    rut VARCHAR(20),
    nombre VARCHAR(250),
    apellido1 VARCHAR(250),
    apellido2 VARCHAR(250),
    email VARCHAR(300),
    telefono VARCHAR(50),
    direccion VARCHAR(500),
    comuna VARCHAR(100),
    region VARCHAR(100),
    fecha_nacimiento DATE,
    sexo VARCHAR(20),
    nacionalidad VARCHAR(100),
    estado_civil VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crear_usuario_contratacion ON contratacion.crear_usuario_form(contratacion_id);

-- Validación Business Partner SAP (38 campos en 6 categorías)
CREATE TABLE contratacion.validacion_bp (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID NOT NULL REFERENCES contratacion.contrataciones(id) ON DELETE CASCADE,
    -- Identidad (11 campos)
    title VARCHAR(50),
    first_name VARCHAR(250),
    last_name VARCHAR(250),
    second_last_name VARCHAR(250),
    id_number VARCHAR(50),
    id_type VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(10),
    nationality VARCHAR(100),
    marital_status VARCHAR(50),
    name_supplement VARCHAR(100),
    -- Dirección (6 campos)
    street VARCHAR(500),
    house_number VARCHAR(20),
    city VARCHAR(100),
    region VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(10),
    -- Contacto (3 campos)
    telephone VARCHAR(50),
    mobile VARCHAR(50),
    email VARCHAR(300),
    -- Personal/Fiscal (5+2 campos)
    tax_number VARCHAR(50),
    tax_type VARCHAR(20),
    bank_account VARCHAR(50),
    bank_key VARCHAR(20),
    payment_method VARCHAR(20),
    occupation VARCHAR(250),
    department VARCHAR(250),
    -- Healthcare IS-H (11 campos)
    phy_ind BOOLEAN DEFAULT false,
    phy_num VARCHAR(50),
    spl_ty_typ VARCHAR(50),
    nur_ind BOOLEAN DEFAULT false,
    med_staff_type VARCHAR(50),
    med_staff_group VARCHAR(50),
    fonasa_group VARCHAR(20),
    isapre VARCHAR(100),
    prev_system VARCHAR(50),
    afp VARCHAR(100),
    health_plan VARCHAR(100),
    -- Control
    type_bp INT,
    gpart VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validacion_bp_contratacion ON contratacion.validacion_bp(contratacion_id);

-- Validación de cargo
CREATE TABLE contratacion.validacion_cargo_form (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID NOT NULL REFERENCES contratacion.contrataciones(id) ON DELETE CASCADE,
    cargo VARCHAR(250),
    area VARCHAR(250),
    centro_costo VARCHAR(100),
    jefe_directo VARCHAR(250),
    jefe_email VARCHAR(300),
    fecha_inicio DATE,
    fecha_termino DATE,
    tipo_contrato contratacion.tipo_contrato,
    jornada VARCHAR(100),
    observaciones TEXT,
    validado BOOLEAN DEFAULT false,
    validado_por VARCHAR(250),
    validado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validacion_cargo_contratacion ON contratacion.validacion_cargo_form(contratacion_id);

-- Validación de cuenta
CREATE TABLE contratacion.validacion_cuenta_form (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID NOT NULL REFERENCES contratacion.contrataciones(id) ON DELETE CASCADE,
    email_asignado VARCHAR(300),
    upn VARCHAR(300),
    cuenta_creada BOOLEAN DEFAULT false,
    cuenta_activa BOOLEAN DEFAULT false,
    observaciones TEXT,
    validado BOOLEAN DEFAULT false,
    validado_por VARCHAR(250),
    validado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validacion_cuenta_contratacion ON contratacion.validacion_cuenta_form(contratacion_id);

-- Crear usuario NoSAP
CREATE TABLE contratacion.crear_usuario_nosap (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID NOT NULL REFERENCES contratacion.contrataciones(id) ON DELETE CASCADE,
    rut VARCHAR(20),
    nombre VARCHAR(250),
    apellido1 VARCHAR(250),
    apellido2 VARCHAR(250),
    email VARCHAR(300),
    cargo VARCHAR(250),
    area VARCHAR(250),
    fecha_ingreso DATE,
    tipo_contrato contratacion.tipo_contrato,
    estado_email contratacion.estado_email DEFAULT '',
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crear_usuario_nosap_contratacion ON contratacion.crear_usuario_nosap(contratacion_id);

-- Datos de usuario desde BUK API
CREATE TABLE contratacion.usuario_api_buk (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID REFERENCES contratacion.contrataciones(id) ON DELETE SET NULL,
    rut VARCHAR(20) NOT NULL,
    nombre VARCHAR(250),
    apellido VARCHAR(250),
    email VARCHAR(300),
    cargo VARCHAR(250),
    area VARCHAR(250),
    fecha_ingreso DATE,
    boss_full_name VARCHAR(250),
    boss_email VARCHAR(300),
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuario_api_buk_rut ON contratacion.usuario_api_buk(rut);
CREATE INDEX idx_usuario_api_buk_contratacion ON contratacion.usuario_api_buk(contratacion_id);

-- Historial de cargos
CREATE TABLE contratacion.cargo_his (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID REFERENCES contratacion.contrataciones(id) ON DELETE SET NULL,
    cargo VARCHAR(250),
    area VARCHAR(250),
    centro_costo VARCHAR(100),
    fecha_desde DATE,
    fecha_hasta DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cargo_his_contratacion ON contratacion.cargo_his(contratacion_id);

-- Auditoría de workflow
CREATE TABLE contratacion.auditoria_workflow (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID NOT NULL REFERENCES contratacion.contrataciones(id) ON DELETE CASCADE,
    paso_wf VARCHAR(250) NOT NULL,
    usuario_ejecutor VARCHAR(250),
    detalle TEXT,
    estado_anterior VARCHAR(100),
    estado_nuevo VARCHAR(100),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_contratacion ON contratacion.auditoria_workflow(contratacion_id);
CREATE INDEX idx_auditoria_fecha ON contratacion.auditoria_workflow(created_at);
