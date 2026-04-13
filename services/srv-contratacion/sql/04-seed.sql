-- Seed: datos realistas para ambiente local — 25 contrataciones

INSERT INTO contratacion.contrataciones (idta, origen, tipo_solicitud, nombre, apellido1, apellido2, rut, cargo_rrhh, fecha_ingreso, fecha_inicio_contrato, estado_clinica, estado_seguridad, estado_email, bossfullname, bossemail) VALUES
    ('CUA-2026-00001', 'buk',    'SAP',   'María',       'González',    'Pérez',      '12345678-9', 'Médico Internista',         '2026-01-10', '2026-02-01', 'Disable',    'FinCuenta',    'Finalizado', 'Dr. Carlos Ruiz',       'cruiz@clinicauandes.cl'),
    ('CUA-2026-00002', 'buk',    'SAP',   'Juan',        'Muñoz',       'Silva',      '98765432-1', 'Enfermero UCI',             '2026-01-20', '2026-02-15', 'Seguridad',  'EnableBP',     '',           'Dra. Ana López',        'alopez@clinicauandes.cl'),
    ('CUA-2026-00003', 'buk',    'NoSAP', 'Catalina',    'Rojas',       'Díaz',       '11222333-4', 'Administrativa Admisión',   '2026-01-25', '2026-03-01', 'Disable',    'FinCuenta',    'Finalizado', 'Pedro Soto',            'psoto@clinicauandes.cl'),
    ('CUA-2026-00004', 'manual', 'SAP',   'Roberto',     'Fernández',   'Castro',     '55666777-8', 'Kinesiólogo',               '2026-02-01', '2026-03-10', 'Enable',     '',             '',           'Dr. Luis Morales',      'lmorales@clinicauandes.cl'),
    ('CUA-2026-00005', 'manual', 'NoSAP', 'Andrea',      'Vargas',      'Molina',     '99888777-6', 'Recepcionista',             '2026-02-05', '2026-03-15', 'Disable',    'FinCuenta',    'Finalizado', 'Carmen Reyes',          'creyes@clinicauandes.cl'),
    ('CUA-2026-00006', 'buk',    'SAP',   'Francisco',   'Soto',        'Hernández',  '15432876-5', 'Cirujano Cardiovascular',   '2026-02-10', '2026-03-20', 'Disable',    'FinCuenta',    'Finalizado', 'Dr. Patricio Ríos',     'prios@clinicauandes.cl'),
    ('CUA-2026-00007', 'buk',    'SAP',   'Valentina',   'Torres',      'Ramírez',    '16789543-2', 'Anestesióloga',             '2026-02-15', '2026-04-01', 'Seguridad',  'EnableCuenta', '',           'Dr. Alejandro Vega',    'avega@clinicauandes.cl'),
    ('CUA-2026-00008', 'manual', 'NoSAP', 'Diego',       'Castillo',    'Flores',     '17654321-0', 'Técnico Laboratorio',       '2026-02-20', '2026-04-01', 'Enable',     '',             '',           'Dra. Mónica Parra',     'mparra@clinicauandes.cl'),
    ('CUA-2026-00009', 'buk',    'SAP',   'Isidora',     'Martínez',    'Contreras',  '18321654-K', 'Nutricionista Clínica',     '2026-02-25', '2026-04-05', 'Disable',    'FinSapManual', '',           'Dra. Javiera Espinoza', 'jespinoza@clinicauandes.cl'),
    ('CUA-2026-00010', 'buk',    'SAP',   'Sebastián',   'Herrera',     'Guzmán',     '19876543-1', 'Traumatólogo',              '2026-03-01', '2026-04-10', 'Enable',     '',             '',           'Dr. Rodrigo Bravo',     'rbravo@clinicauandes.cl'),
    ('CUA-2026-00011', 'manual', 'NoSAP', 'Camila',      'Fuentes',     'Araya',      '20123456-7', 'Secretaria Médica',         '2026-03-05', '2026-04-15', 'Enable',     '',             'Manual',     'Lorena Tapia',          'ltapia@clinicauandes.cl'),
    ('CUA-2026-00012', 'buk',    'SAP',   'Tomás',       'Olivares',    'Sepúlveda',  '21987654-3', 'Pediatra',                  '2026-03-10', '2026-04-20', 'Seguridad',  'EnableBP',     '',           'Dra. Francisca Núñez',  'fnunez@clinicauandes.cl'),
    ('CUA-2026-00013', 'manual', 'SAP',   'Javiera',     'Riquelme',    'Vergara',    '22345678-9', 'Fonoaudióloga',             '2026-03-12', '2026-04-25', 'Enable',     '',             '',           'Dr. Marcelo Salas',     'msalas@clinicauandes.cl'),
    ('CUA-2026-00014', 'buk',    'NoSAP', 'Matías',      'Vera',        'Pizarro',    '23456789-0', 'Auxiliar Enfermería',       '2026-03-15', '2026-05-01', 'Enable',     '',             '',           'Enf. Claudia Medina',   'cmedina@clinicauandes.cl'),
    ('CUA-2026-00015', 'manual', 'SAP',   'Antonella',   'Bravo',       'Lagos',      '24567890-1', 'Matrona',                   '2026-03-18', '2026-05-01', 'Enable',     '',             '',           'Dra. Paula Cifuentes',  'pcifuentes@clinicauandes.cl'),
    ('CUA-2026-00016', 'buk',    'SAP',   'Nicolás',     'Alarcón',     'Moreno',     '13579246-8', 'Neurólogo',                 '2026-03-20', '2026-05-05', 'Disable',    'FinCuenta',    'Finalizado', 'Dr. Fernando Leiva',    'fleiva@clinicauandes.cl'),
    ('CUA-2026-00017', 'buk',    'NoSAP', 'Constanza',   'Paredes',     'Villalobos', '24681357-9', 'Terapeuta Ocupacional',     '2026-03-22', '2026-05-10', 'Disable',    'FinCuenta',    'Finalizado', 'Dra. Beatriz Campos',   'bcampos@clinicauandes.cl'),
    ('CUA-2026-00018', 'manual', 'SAP',   'Ignacio',     'Carrasco',    'Reyes',      '11335577-2', 'Cardiólogo',                '2026-03-25', '2026-05-15', 'Seguridad',  'EnableBP',     '',           'Dr. Eduardo Zamora',    'ezamora@clinicauandes.cl'),
    ('CUA-2026-00019', 'buk',    'SAP',   'Fernanda',    'Espinoza',    'Muñoz',      '22446688-0', 'Dermatóloga',               '2026-03-28', '2026-05-20', 'Enable',     '',             '',           'Dra. Loreto Aravena',   'laravena@clinicauandes.cl'),
    ('CUA-2026-00020', 'manual', 'NoSAP', 'Felipe',      'Guzmán',      'Tapia',      '33557799-1', 'Paramédico',                '2026-04-01', '2026-05-25', 'Enable',     '',             '',           'Enf. Patricia Lagos',   'plagos@clinicauandes.cl'),
    ('CUA-2026-00021', 'buk',    'SAP',   'Gabriela',    'Cifuentes',   'Ortiz',      '44668800-2', 'Ginecóloga',                '2026-04-02', '2026-06-01', 'Disable',    'FinCuenta',    'Finalizado', 'Dr. Andrés Moya',       'amoya@clinicauandes.cl'),
    ('CUA-2026-00022', 'buk',    'SAP',   'Benjamín',    'Navarro',     'Figueroa',   '55779911-3', 'Oncólogo',                  '2026-04-03', '2026-06-05', 'Seguridad',  'EnableCuenta', '',           'Dra. Isabel Donoso',    'idonoso@clinicauandes.cl'),
    ('CUA-2026-00023', 'manual', 'NoSAP', 'Sofía',       'Peña',        'Cortés',     '66880022-4', 'Asistente Dental',          '2026-04-04', '2026-06-10', 'Disable',    'FinCuenta',    'Finalizado', 'Dr. Claudio Ibáñez',    'cibanez@clinicauandes.cl'),
    ('CUA-2026-00024', 'buk',    'SAP',   'Martín',      'Sandoval',    'Rojas',      '77991133-5', 'Urólogo',                   '2026-04-05', '2026-06-15', 'Enable',     '',             '',           'Dr. Gonzalo Pinto',     'gpinto@clinicauandes.cl'),
    ('CUA-2026-00025', 'manual', 'SAP',   'Florencia',   'Avendaño',    'Cáceres',    '88002244-6', 'Oftalmóloga',               '2026-04-07', '2026-06-20', 'Enable',     '',             '',           'Dra. Macarena Silva',   'msilva@clinicauandes.cl');

-- Formularios crear usuario SAP (para las finalizadas)
INSERT INTO contratacion.crear_usuario_form (contratacion_id, rut, nombre, apellido1, apellido2, email, telefono, direccion, comuna, region, fecha_nacimiento, sexo, nacionalidad)
SELECT id, rut, nombre, apellido1, apellido2, LOWER(REPLACE(REPLACE(REPLACE(REPLACE(nombre,'á','a'),'é','e'),'í','i'),'ó','o')) || '.' || LOWER(REPLACE(REPLACE(REPLACE(REPLACE(apellido1,'á','a'),'é','e'),'í','i'),'ó','o')) || '@clinicauandes.cl', '+569' || LPAD(FLOOR(random()*90000000+10000000)::text, 8, '0'), 'Av. Plaza 2501', 'Las Condes', 'Metropolitana', '1985-06-15', 'Femenino', 'Chilena'
FROM contratacion.contrataciones WHERE tipo_solicitud = 'SAP' AND estado_clinica = 'Disable';

-- Crear usuario NoSAP (para las finalizadas)
INSERT INTO contratacion.crear_usuario_nosap (contratacion_id, rut, nombre, apellido1, apellido2, email, cargo, area, fecha_ingreso, estado_email)
SELECT id, rut, nombre, apellido1, apellido2, LOWER(REPLACE(REPLACE(REPLACE(REPLACE(nombre,'á','a'),'é','e'),'í','i'),'ó','o')) || '.' || LOWER(REPLACE(REPLACE(REPLACE(REPLACE(apellido1,'á','a'),'é','e'),'í','i'),'ó','o')) || '@clinicauandes.cl', cargo_rrhh, 'Clínica', fecha_ingreso, 'Finalizado'
FROM contratacion.contrataciones WHERE tipo_solicitud = 'NoSAP' AND estado_clinica = 'Disable';

-- Validación BP para SAP finalizadas
INSERT INTO contratacion.validacion_bp (contratacion_id, first_name, last_name, second_last_name, id_number, id_type, gender, nationality, email, phy_ind, phy_num, gpart, status)
SELECT id, nombre, apellido1, apellido2, rut, 'RUT', 'M', 'Chilena',
  LOWER(REPLACE(REPLACE(REPLACE(REPLACE(nombre,'á','a'),'é','e'),'í','i'),'ó','o')) || '.' || LOWER(REPLACE(REPLACE(REPLACE(REPLACE(apellido1,'á','a'),'é','e'),'í','i'),'ó','o')) || '@clinicauandes.cl',
  true, 'MED-' || LPAD(FLOOR(random()*99999)::text, 5, '0'), 'BP-' || LPAD(FLOOR(random()*9999999)::text, 7, '0'), 'completado'
FROM contratacion.contrataciones WHERE tipo_solicitud = 'SAP' AND estado_clinica = 'Disable';

-- Datos BUK API para las de origen buk
INSERT INTO contratacion.usuario_api_buk (contratacion_id, rut, nombre, apellido, email, cargo, area, fecha_ingreso, boss_full_name, boss_email)
SELECT id, rut, nombre, apellido1 || ' ' || COALESCE(apellido2, ''),
  LOWER(REPLACE(REPLACE(REPLACE(REPLACE(nombre,'á','a'),'é','e'),'í','i'),'ó','o')) || '.' || LOWER(REPLACE(REPLACE(REPLACE(REPLACE(apellido1,'á','a'),'é','e'),'í','i'),'ó','o')) || '@clinicauandes.cl',
  cargo_rrhh, 'Clínica U. Andes', fecha_ingreso, bossfullname, bossemail
FROM contratacion.contrataciones WHERE origen = 'buk';

-- Auditoría para todas
INSERT INTO contratacion.auditoria_workflow (contratacion_id, paso_wf, usuario_ejecutor, detalle, estado_anterior, estado_nuevo)
SELECT id, 'Crear Contratación', 'admin@clinicauandes.cl', 'Contratación ingresada al sistema', NULL, 'Enable'
FROM contratacion.contrataciones;

INSERT INTO contratacion.auditoria_workflow (contratacion_id, paso_wf, usuario_ejecutor, detalle, estado_anterior, estado_nuevo)
SELECT id, 'Finalizar Proceso', 'admin@clinicauandes.cl', 'Proceso completado exitosamente', 'Seguridad', 'Disable'
FROM contratacion.contrataciones WHERE estado_clinica = 'Disable';

-- Refresh vista materializada
REFRESH MATERIALIZED VIEW reportes.v_historico;

-- Usuarios del sistema (password: admin123)
INSERT INTO usuarios.users (email, password_hash, nombre, apellido) VALUES
    ('admin@clinicauandes.cl',      '$2a$10$bCOwUEzEAqXxiSze55DQMO0IeSWra84OYFseets5ga1exNYphGwOS', 'Carlos',   'Ruiz'),
    ('cargo@clinicauandes.cl',      '$2a$10$bCOwUEzEAqXxiSze55DQMO0IeSWra84OYFseets5ga1exNYphGwOS', 'Lorena',   'Tapia'),
    ('bd@clinicauandes.cl',         '$2a$10$bCOwUEzEAqXxiSze55DQMO0IeSWra84OYFseets5ga1exNYphGwOS', 'Marcelo',  'Salas'),
    ('cuenta@clinicauandes.cl',     '$2a$10$bCOwUEzEAqXxiSze55DQMO0IeSWra84OYFseets5ga1exNYphGwOS', 'Claudia',  'Medina'),
    ('visualizar@clinicauandes.cl', '$2a$10$bCOwUEzEAqXxiSze55DQMO0IeSWra84OYFseets5ga1exNYphGwOS', 'Paula',    'Cifuentes');

-- Asignar roles
INSERT INTO usuarios.user_roles (user_id, role_id) SELECT u.id, r.id FROM usuarios.users u, usuarios.roles r WHERE u.email = 'admin@clinicauandes.cl' AND r.nombre = 'admin';
INSERT INTO usuarios.user_roles (user_id, role_id) SELECT u.id, r.id FROM usuarios.users u, usuarios.roles r WHERE u.email = 'cargo@clinicauandes.cl' AND r.nombre = 'cargo';
INSERT INTO usuarios.user_roles (user_id, role_id) SELECT u.id, r.id FROM usuarios.users u, usuarios.roles r WHERE u.email = 'bd@clinicauandes.cl' AND r.nombre = 'bd';
INSERT INTO usuarios.user_roles (user_id, role_id) SELECT u.id, r.id FROM usuarios.users u, usuarios.roles r WHERE u.email = 'cuenta@clinicauandes.cl' AND r.nombre = 'cuenta';
INSERT INTO usuarios.user_roles (user_id, role_id) SELECT u.id, r.id FROM usuarios.users u, usuarios.roles r WHERE u.email = 'visualizar@clinicauandes.cl' AND r.nombre = 'visualizar';
