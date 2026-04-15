-- ============================================
-- Security Upgrade: MFA + Audit improvements
-- Fecha: 2026-04-14
-- ============================================

-- Columna MFA secret para TOTP
ALTER TABLE usuarios.users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(100) DEFAULT NULL;
ALTER TABLE usuarios.users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;

-- Tabla de login attempts (auditoria de seguridad)
CREATE TABLE IF NOT EXISTS usuarios.login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(300) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  failure_reason VARCHAR(100),
  mfa_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_audit_email ON usuarios.login_audit(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_ip ON usuarios.login_audit(ip_address, created_at DESC);

-- Token blacklist persistente (para produccion, reemplazar con Redis)
CREATE TABLE IF NOT EXISTS usuarios.token_blacklist (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id UUID REFERENCES usuarios.users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON usuarios.token_blacklist(expires_at);
