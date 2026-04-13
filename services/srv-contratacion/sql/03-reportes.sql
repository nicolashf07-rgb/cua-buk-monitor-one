-- Schema reportes: vista materializada v_historico

CREATE MATERIALIZED VIEW reportes.v_historico AS
SELECT
    c.id,
    c.idta,
    c.origen,
    c.tipo_solicitud,
    c.tipo_contrato,
    c.estado_clinica,
    c.estado_seguridad,
    c.estado_email,
    c.nombre,
    c.apellido1,
    c.apellido2,
    c.rut,
    c.cargo_rrhh,
    c.fecha_ingreso,
    c.fecha_inicio_contrato,
    c.bossfullname,
    c.bossemail,
    c.mesa_servicio_estado,
    c.created_at,
    c.updated_at,
    -- Datos crear usuario form
    cuf.email AS cuf_email,
    cuf.telefono AS cuf_telefono,
    cuf.direccion AS cuf_direccion,
    cuf.comuna AS cuf_comuna,
    cuf.fecha_nacimiento AS cuf_fecha_nacimiento,
    -- Datos validacion BP
    vbp.first_name AS bp_first_name,
    vbp.last_name AS bp_last_name,
    vbp.gpart AS bp_gpart,
    vbp.status AS bp_status,
    vbp.phy_ind AS bp_phy_ind,
    vbp.phy_num AS bp_phy_num,
    -- Datos validacion cargo
    vcf.cargo AS vcf_cargo,
    vcf.area AS vcf_area,
    vcf.centro_costo AS vcf_centro_costo,
    vcf.validado AS vcf_validado,
    vcf.validado_por AS vcf_validado_por,
    -- Datos NoSAP
    cns.email AS nosap_email,
    cns.estado_email AS nosap_estado_email,
    -- Estado completo calculado
    CASE
        WHEN c.estado_clinica = 'Disable' THEN 'Cerrado'
        WHEN c.estado_seguridad = 'FinCuenta' OR c.estado_seguridad = 'FinSapManual' THEN 'Finalizado'
        WHEN c.estado_clinica = 'Seguridad' THEN 'En Seguridad'
        ELSE 'Activo'
    END AS estado_completo
FROM contratacion.contrataciones c
LEFT JOIN contratacion.crear_usuario_form cuf ON c.id = cuf.contratacion_id
LEFT JOIN contratacion.validacion_bp vbp ON c.id = vbp.contratacion_id
LEFT JOIN contratacion.validacion_cargo_form vcf ON c.id = vcf.contratacion_id
LEFT JOIN contratacion.crear_usuario_nosap cns ON c.id = cns.contratacion_id;

CREATE UNIQUE INDEX idx_v_historico_id ON reportes.v_historico(id);
