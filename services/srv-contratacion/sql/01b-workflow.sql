-- Tablas de workflow para el orquestador

CREATE TABLE contratacion.workflows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contratacion_id UUID NOT NULL REFERENCES contratacion.contrataciones(id) ON DELETE CASCADE,
    tipo_solicitud contratacion.tipo_solicitud NOT NULL,
    estado_actual VARCHAR(50) NOT NULL DEFAULT 'CREADO',
    xstate_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_contratacion ON contratacion.workflows(contratacion_id);
CREATE INDEX idx_workflows_estado ON contratacion.workflows(estado_actual);

CREATE TABLE contratacion.transition_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES contratacion.workflows(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50) NOT NULL,
    transicion VARCHAR(100) NOT NULL,
    datos JSONB,
    resultado JSONB,
    error TEXT,
    duracion_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transition_log_workflow ON contratacion.transition_log(workflow_id);
CREATE INDEX idx_transition_log_fecha ON contratacion.transition_log(created_at);
