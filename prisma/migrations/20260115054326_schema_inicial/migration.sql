-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR', 'COBRADOR', 'CONTADOR');

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('VERDE', 'AMARILLO', 'ROJO', 'LISTA_NEGRA');

-- CreateEnum
CREATE TYPE "EstadoPrestamo" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'ACTIVO', 'EN_MORA', 'PAGADO', 'INCUMPLIDO', 'PERDIDA');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'PAGADA', 'PARCIAL', 'VENCIDA', 'PRORROGADA');

-- CreateEnum
CREATE TYPE "FrecuenciaPago" AS ENUM ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoAprobacion" AS ENUM ('NUEVO_CLIENTE', 'NUEVO_PRESTAMO', 'GASTO', 'SOLICITUD_BASE_EFECTIVO', 'PRORROGA_PAGO', 'BAJA_POR_PERDIDA');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('OPERATIVO', 'TRANSPORTE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoCaja" AS ENUM ('PRINCIPAL', 'RUTA');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoSincronizacion" AS ENUM ('PENDIENTE', 'SINCRONIZADO', 'CONFLICTO', 'ERROR');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "correo" VARCHAR(255) NOT NULL,
    "hashContrasena" VARCHAR(255) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20),
    "rol" "RolUsuario" NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "ultimoIngreso" TIMESTAMP(3),
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "debeCambiarContrasena" BOOLEAN NOT NULL DEFAULT false,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',
    "ultimaSincronizacion" TIMESTAMP(3),
    "errorSincronizacion" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(255),
    "esSistema" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" TEXT NOT NULL,
    "modulo" VARCHAR(50) NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(255),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "id" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "permisoId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_roles_usuarios" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3),

    CONSTRAINT "asignaciones_roles_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "dni" VARCHAR(20) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(255),
    "telefono" VARCHAR(20) NOT NULL,
    "direccion" TEXT,
    "referencia" TEXT,
    "nivelRiesgo" "NivelRiesgo" NOT NULL DEFAULT 'VERDE',
    "puntaje" INTEGER NOT NULL DEFAULT 100,
    "ultimaActualizacionRiesgo" TIMESTAMP(3),
    "enListaNegra" BOOLEAN NOT NULL DEFAULT false,
    "razonListaNegra" TEXT,
    "fechaListaNegra" TIMESTAMP(3),
    "agregadoListaNegraPorId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "estadoAprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',
    "ultimaSincronizacion" TIMESTAMP(3),

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "categoria" VARCHAR(100) NOT NULL,
    "marca" VARCHAR(100),
    "modelo" VARCHAR(100),
    "costo" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_productos" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "meses" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "precios_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prestamo" (
    "id" TEXT NOT NULL,
    "numeroPrestamo" VARCHAR(50) NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT,
    "precioProductoId" TEXT,
    "tipoPrestamo" VARCHAR(20) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "tasaInteres" DECIMAL(5,2) NOT NULL,
    "tasaInteresMora" DECIMAL(5,2) NOT NULL,
    "plazoMeses" INTEGER NOT NULL,
    "frecuenciaPago" "FrecuenciaPago" NOT NULL,
    "cantidadCuotas" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPrestamo" NOT NULL DEFAULT 'BORRADOR',
    "creadoPorId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "estadoAprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "interesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "capitalPagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interesPagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interesMoraPagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldoPendiente" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',
    "ultimaSincronizacion" TIMESTAMP(3),

    CONSTRAINT "Prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuotas" (
    "id" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "numeroCuota" INTEGER NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "montoCapital" DECIMAL(10,2) NOT NULL,
    "montoInteres" DECIMAL(10,2) NOT NULL,
    "montoInteresMora" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "montoPagado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fechaPago" TIMESTAMP(3),
    "fechaVencimientoProrroga" TIMESTAMP(3),
    "extensionId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extensiones_pago" (
    "id" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "cuotaId" TEXT,
    "fechaVencimientoOriginal" TIMESTAMP(3) NOT NULL,
    "nuevaFechaVencimiento" TIMESTAMP(3) NOT NULL,
    "razon" TEXT,
    "aprobadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extensiones_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "numeroPago" VARCHAR(50) NOT NULL,
    "clienteId" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "cobradorId" TEXT NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoTotal" DECIMAL(10,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "numeroReferencia" VARCHAR(100),
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',
    "ultimaSincronizacion" TIMESTAMP(3),

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_pago" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "montoCapital" DECIMAL(10,2) NOT NULL,
    "montoInteres" DECIMAL(10,2) NOT NULL,
    "montoInteresMora" DECIMAL(10,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detalles_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recibos" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "numeroRecibo" VARCHAR(50) NOT NULL,
    "contenido" JSONB NOT NULL,
    "rutaPDF" VARCHAR(500),
    "compartidoVia" VARCHAR(50),
    "fechaCompartido" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recibos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "zona" VARCHAR(100) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "cobradorId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_rutas" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cobradorId" TEXT NOT NULL,
    "diaSemana" INTEGER,
    "fechaEspecifica" TIMESTAMP(3),
    "ordenVisita" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignaciones_rutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprobaciones" (
    "id" TEXT NOT NULL,
    "tipoAprobacion" "TipoAprobacion" NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "tablaReferencia" VARCHAR(50) NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "datosSolicitud" JSONB NOT NULL,
    "aprobadoPorId" TEXT,
    "estado" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "comentarios" TEXT,
    "datosAprobados" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "revisadoEn" TIMESTAMP(3),
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "aprobaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cajas" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "tipo" "TipoCaja" NOT NULL,
    "rutaId" TEXT,
    "saldoActual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldoMinimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldoMaximo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "responsableId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL,
    "numeroTransaccion" VARCHAR(50) NOT NULL,
    "cajaId" TEXT NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "tipoReferencia" VARCHAR(50),
    "referenciaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "notas" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "fechaTransaccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "numeroGasto" VARCHAR(50) NOT NULL,
    "rutaId" TEXT,
    "cobradorId" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "tipoGasto" "TipoGasto" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fotoRecibo" VARCHAR(500),
    "aprobadoPorId" TEXT,
    "estadoAprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE',
    "fechaGasto" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "rolUsuario" "RolUsuario",
    "accion" VARCHAR(100) NOT NULL,
    "entidad" VARCHAR(50) NOT NULL,
    "entidadId" TEXT,
    "valoresAnteriores" JSONB,
    "valoresNuevos" JSONB,
    "cambios" JSONB,
    "direccionIP" VARCHAR(45),
    "agenteUsuario" TEXT,
    "endpoint" VARCHAR(500),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cola_sincronizacion" (
    "id" TEXT NOT NULL,
    "nombreTabla" VARCHAR(50) NOT NULL,
    "idRegistro" TEXT NOT NULL,
    "operacion" VARCHAR(10) NOT NULL,
    "datos" JSONB NOT NULL,
    "estado" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntento" TIMESTAMP(3),
    "mensajeError" TEXT,
    "dispositivoCreador" VARCHAR(100),
    "usuarioCreadorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cola_sincronizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Usuario_correo_idx" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_estado_idx" ON "Usuario"("estado");

-- CreateIndex
CREATE INDEX "Usuario_estadoSincronizacion_idx" ON "Usuario"("estadoSincronizacion");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE INDEX "roles_nombre_idx" ON "roles"("nombre");

-- CreateIndex
CREATE INDEX "permisos_modulo_idx" ON "permisos"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_modulo_accion_key" ON "permisos"("modulo", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "roles_permisos_rolId_permisoId_key" ON "roles_permisos"("rolId", "permisoId");

-- CreateIndex
CREATE INDEX "asignaciones_roles_usuarios_usuarioId_idx" ON "asignaciones_roles_usuarios"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_roles_usuarios_usuarioId_rolId_key" ON "asignaciones_roles_usuarios"("usuarioId", "rolId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_codigo_key" ON "Cliente"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_dni_key" ON "Cliente"("dni");

-- CreateIndex
CREATE INDEX "Cliente_dni_idx" ON "Cliente"("dni");

-- CreateIndex
CREATE INDEX "Cliente_nivelRiesgo_idx" ON "Cliente"("nivelRiesgo");

-- CreateIndex
CREATE INDEX "Cliente_enListaNegra_idx" ON "Cliente"("enListaNegra");

-- CreateIndex
CREATE INDEX "Cliente_estadoAprobacion_idx" ON "Cliente"("estadoAprobacion");

-- CreateIndex
CREATE INDEX "Cliente_creadoPorId_idx" ON "Cliente"("creadoPorId");

-- CreateIndex
CREATE INDEX "Cliente_estadoSincronizacion_idx" ON "Cliente"("estadoSincronizacion");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE INDEX "Producto_codigo_idx" ON "Producto"("codigo");

-- CreateIndex
CREATE INDEX "Producto_categoria_idx" ON "Producto"("categoria");

-- CreateIndex
CREATE INDEX "Producto_activo_idx" ON "Producto"("activo");

-- CreateIndex
CREATE INDEX "precios_productos_productoId_idx" ON "precios_productos"("productoId");

-- CreateIndex
CREATE INDEX "precios_productos_meses_idx" ON "precios_productos"("meses");

-- CreateIndex
CREATE UNIQUE INDEX "precios_productos_productoId_meses_key" ON "precios_productos"("productoId", "meses");

-- CreateIndex
CREATE UNIQUE INDEX "Prestamo_numeroPrestamo_key" ON "Prestamo"("numeroPrestamo");

-- CreateIndex
CREATE INDEX "Prestamo_numeroPrestamo_idx" ON "Prestamo"("numeroPrestamo");

-- CreateIndex
CREATE INDEX "Prestamo_clienteId_idx" ON "Prestamo"("clienteId");

-- CreateIndex
CREATE INDEX "Prestamo_estado_idx" ON "Prestamo"("estado");

-- CreateIndex
CREATE INDEX "Prestamo_estadoAprobacion_idx" ON "Prestamo"("estadoAprobacion");

-- CreateIndex
CREATE INDEX "Prestamo_creadoPorId_idx" ON "Prestamo"("creadoPorId");

-- CreateIndex
CREATE INDEX "Prestamo_estadoSincronizacion_idx" ON "Prestamo"("estadoSincronizacion");

-- CreateIndex
CREATE INDEX "Prestamo_fechaInicio_idx" ON "Prestamo"("fechaInicio");

-- CreateIndex
CREATE INDEX "Prestamo_fechaFin_idx" ON "Prestamo"("fechaFin");

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_extensionId_key" ON "cuotas"("extensionId");

-- CreateIndex
CREATE INDEX "cuotas_prestamoId_idx" ON "cuotas"("prestamoId");

-- CreateIndex
CREATE INDEX "cuotas_fechaVencimiento_idx" ON "cuotas"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "cuotas_estado_idx" ON "cuotas"("estado");

-- CreateIndex
CREATE INDEX "cuotas_fechaVencimientoProrroga_idx" ON "cuotas"("fechaVencimientoProrroga");

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_prestamoId_numeroCuota_key" ON "cuotas"("prestamoId", "numeroCuota");

-- CreateIndex
CREATE UNIQUE INDEX "extensiones_pago_cuotaId_key" ON "extensiones_pago"("cuotaId");

-- CreateIndex
CREATE INDEX "extensiones_pago_prestamoId_idx" ON "extensiones_pago"("prestamoId");

-- CreateIndex
CREATE INDEX "extensiones_pago_aprobadoPorId_idx" ON "extensiones_pago"("aprobadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_numeroPago_key" ON "Pago"("numeroPago");

-- CreateIndex
CREATE INDEX "Pago_numeroPago_idx" ON "Pago"("numeroPago");

-- CreateIndex
CREATE INDEX "Pago_clienteId_idx" ON "Pago"("clienteId");

-- CreateIndex
CREATE INDEX "Pago_prestamoId_idx" ON "Pago"("prestamoId");

-- CreateIndex
CREATE INDEX "Pago_cobradorId_idx" ON "Pago"("cobradorId");

-- CreateIndex
CREATE INDEX "Pago_fechaPago_idx" ON "Pago"("fechaPago");

-- CreateIndex
CREATE INDEX "Pago_estadoSincronizacion_idx" ON "Pago"("estadoSincronizacion");

-- CreateIndex
CREATE INDEX "detalles_pago_pagoId_idx" ON "detalles_pago"("pagoId");

-- CreateIndex
CREATE INDEX "detalles_pago_cuotaId_idx" ON "detalles_pago"("cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "detalles_pago_pagoId_cuotaId_key" ON "detalles_pago"("pagoId", "cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_pagoId_key" ON "recibos"("pagoId");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_numeroRecibo_key" ON "recibos"("numeroRecibo");

-- CreateIndex
CREATE INDEX "recibos_numeroRecibo_idx" ON "recibos"("numeroRecibo");

-- CreateIndex
CREATE INDEX "recibos_pagoId_idx" ON "recibos"("pagoId");

-- CreateIndex
CREATE UNIQUE INDEX "rutas_codigo_key" ON "rutas"("codigo");

-- CreateIndex
CREATE INDEX "rutas_codigo_idx" ON "rutas"("codigo");

-- CreateIndex
CREATE INDEX "rutas_cobradorId_idx" ON "rutas"("cobradorId");

-- CreateIndex
CREATE INDEX "rutas_supervisorId_idx" ON "rutas"("supervisorId");

-- CreateIndex
CREATE INDEX "rutas_activa_idx" ON "rutas"("activa");

-- CreateIndex
CREATE INDEX "asignaciones_rutas_rutaId_idx" ON "asignaciones_rutas"("rutaId");

-- CreateIndex
CREATE INDEX "asignaciones_rutas_clienteId_idx" ON "asignaciones_rutas"("clienteId");

-- CreateIndex
CREATE INDEX "asignaciones_rutas_cobradorId_idx" ON "asignaciones_rutas"("cobradorId");

-- CreateIndex
CREATE INDEX "asignaciones_rutas_diaSemana_idx" ON "asignaciones_rutas"("diaSemana");

-- CreateIndex
CREATE INDEX "asignaciones_rutas_fechaEspecifica_idx" ON "asignaciones_rutas"("fechaEspecifica");

-- CreateIndex
CREATE INDEX "asignaciones_rutas_ordenVisita_idx" ON "asignaciones_rutas"("ordenVisita");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_rutas_rutaId_clienteId_fechaEspecifica_key" ON "asignaciones_rutas"("rutaId", "clienteId", "fechaEspecifica");

-- CreateIndex
CREATE INDEX "aprobaciones_tipoAprobacion_idx" ON "aprobaciones"("tipoAprobacion");

-- CreateIndex
CREATE INDEX "aprobaciones_referenciaId_tablaReferencia_idx" ON "aprobaciones"("referenciaId", "tablaReferencia");

-- CreateIndex
CREATE INDEX "aprobaciones_solicitadoPorId_idx" ON "aprobaciones"("solicitadoPorId");

-- CreateIndex
CREATE INDEX "aprobaciones_aprobadoPorId_idx" ON "aprobaciones"("aprobadoPorId");

-- CreateIndex
CREATE INDEX "aprobaciones_estado_idx" ON "aprobaciones"("estado");

-- CreateIndex
CREATE INDEX "aprobaciones_creadoEn_idx" ON "aprobaciones"("creadoEn");

-- CreateIndex
CREATE INDEX "aprobaciones_estadoSincronizacion_idx" ON "aprobaciones"("estadoSincronizacion");

-- CreateIndex
CREATE UNIQUE INDEX "cajas_codigo_key" ON "cajas"("codigo");

-- CreateIndex
CREATE INDEX "cajas_codigo_idx" ON "cajas"("codigo");

-- CreateIndex
CREATE INDEX "cajas_tipo_idx" ON "cajas"("tipo");

-- CreateIndex
CREATE INDEX "cajas_rutaId_idx" ON "cajas"("rutaId");

-- CreateIndex
CREATE INDEX "cajas_responsableId_idx" ON "cajas"("responsableId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_numeroTransaccion_key" ON "Transaccion"("numeroTransaccion");

-- CreateIndex
CREATE INDEX "Transaccion_numeroTransaccion_idx" ON "Transaccion"("numeroTransaccion");

-- CreateIndex
CREATE INDEX "Transaccion_cajaId_idx" ON "Transaccion"("cajaId");

-- CreateIndex
CREATE INDEX "Transaccion_tipo_idx" ON "Transaccion"("tipo");

-- CreateIndex
CREATE INDEX "Transaccion_tipoReferencia_referenciaId_idx" ON "Transaccion"("tipoReferencia", "referenciaId");

-- CreateIndex
CREATE INDEX "Transaccion_creadoPorId_idx" ON "Transaccion"("creadoPorId");

-- CreateIndex
CREATE INDEX "Transaccion_fechaTransaccion_idx" ON "Transaccion"("fechaTransaccion");

-- CreateIndex
CREATE INDEX "Transaccion_estadoSincronizacion_idx" ON "Transaccion"("estadoSincronizacion");

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_numeroGasto_key" ON "Gasto"("numeroGasto");

-- CreateIndex
CREATE INDEX "Gasto_numeroGasto_idx" ON "Gasto"("numeroGasto");

-- CreateIndex
CREATE INDEX "Gasto_rutaId_idx" ON "Gasto"("rutaId");

-- CreateIndex
CREATE INDEX "Gasto_cobradorId_idx" ON "Gasto"("cobradorId");

-- CreateIndex
CREATE INDEX "Gasto_estadoAprobacion_idx" ON "Gasto"("estadoAprobacion");

-- CreateIndex
CREATE INDEX "Gasto_fechaGasto_idx" ON "Gasto"("fechaGasto");

-- CreateIndex
CREATE INDEX "Gasto_estadoSincronizacion_idx" ON "Gasto"("estadoSincronizacion");

-- CreateIndex
CREATE INDEX "registros_auditoria_usuarioId_idx" ON "registros_auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "registros_auditoria_accion_idx" ON "registros_auditoria"("accion");

-- CreateIndex
CREATE INDEX "registros_auditoria_entidad_entidadId_idx" ON "registros_auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "registros_auditoria_creadoEn_idx" ON "registros_auditoria"("creadoEn");

-- CreateIndex
CREATE INDEX "cola_sincronizacion_nombreTabla_idRegistro_idx" ON "cola_sincronizacion"("nombreTabla", "idRegistro");

-- CreateIndex
CREATE INDEX "cola_sincronizacion_estado_idx" ON "cola_sincronizacion"("estado");

-- CreateIndex
CREATE INDEX "cola_sincronizacion_creadoEn_idx" ON "cola_sincronizacion"("creadoEn");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_roles_usuarios" ADD CONSTRAINT "asignaciones_roles_usuarios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_roles_usuarios" ADD CONSTRAINT "asignaciones_roles_usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_agregadoListaNegraPorId_fkey" FOREIGN KEY ("agregadoListaNegraPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_productos" ADD CONSTRAINT "precios_productos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_precioProductoId_fkey" FOREIGN KEY ("precioProductoId") REFERENCES "precios_productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "extensiones_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensiones_pago" ADD CONSTRAINT "extensiones_pago_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensiones_pago" ADD CONSTRAINT "extensiones_pago_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cobradorId_fkey" FOREIGN KEY ("cobradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_pago" ADD CONSTRAINT "detalles_pago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_pago" ADD CONSTRAINT "detalles_pago_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "cuotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_cobradorId_fkey" FOREIGN KEY ("cobradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_rutas" ADD CONSTRAINT "asignaciones_rutas_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_rutas" ADD CONSTRAINT "asignaciones_rutas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_rutas" ADD CONSTRAINT "asignaciones_rutas_cobradorId_fkey" FOREIGN KEY ("cobradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cobradorId_fkey" FOREIGN KEY ("cobradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cola_sincronizacion" ADD CONSTRAINT "cola_sincronizacion_usuarioCreadorId_fkey" FOREIGN KEY ("usuarioCreadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
