-- CUA-BUK Monitor One - Inicialización de BD
-- Schemas + Enums

-- Schemas
CREATE SCHEMA IF NOT EXISTS contratacion;
CREATE SCHEMA IF NOT EXISTS usuarios;
CREATE SCHEMA IF NOT EXISTS reportes;

-- Enums del dominio contratacion
CREATE TYPE contratacion.estado_clinica AS ENUM ('Enable', 'Seguridad', 'Disable');
CREATE TYPE contratacion.estado_seguridad AS ENUM ('', 'EnableBP', 'EnableCuenta', 'FinCuenta', 'FinSapManual');
CREATE TYPE contratacion.estado_email AS ENUM ('', 'Manual', 'Finalizado');
CREATE TYPE contratacion.origen_contratacion AS ENUM ('buk', 'manual');
CREATE TYPE contratacion.tipo_solicitud AS ENUM ('SAP', 'NoSAP');
CREATE TYPE contratacion.tipo_contrato AS ENUM ('Indefinido', 'PlazoFijo', 'Honorarios');
