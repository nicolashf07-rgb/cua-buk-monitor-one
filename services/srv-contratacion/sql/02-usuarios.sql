-- Schema usuarios: 7 tablas RBAC con 5 roles seed

CREATE TABLE usuarios.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(300) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(250) NOT NULL,
    apellido VARCHAR(250),
    activo BOOLEAN NOT NULL DEFAULT true,
    ultimo_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion VARCHAR(250),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES usuarios.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES usuarios.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

CREATE TABLE usuarios.permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion VARCHAR(250),
    recurso VARCHAR(100) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios.role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES usuarios.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES usuarios.permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

CREATE TABLE usuarios.device_cookies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES usuarios.users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(500) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    trusted BOOLEAN DEFAULT false,
    last_used TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_cookies_user ON usuarios.device_cookies(user_id);

CREATE TABLE usuarios.login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(300) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason VARCHAR(100),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON usuarios.login_attempts(email, attempted_at);
CREATE INDEX idx_login_attempts_ip ON usuarios.login_attempts(ip_address, attempted_at);

-- Seed: 5 roles
INSERT INTO usuarios.roles (nombre, descripcion) VALUES
    ('admin', 'Administrador - acceso total'),
    ('cargo', 'Validación de cargo - crear usuarios'),
    ('bd', 'Validación BP SAP - business partner'),
    ('cuenta', 'Validación de cuentas AD'),
    ('visualizar', 'Solo lectura - visualización');
