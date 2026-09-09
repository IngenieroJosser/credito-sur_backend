/**
 * ============================================================
 * TIPOS COMPARTIDOS — Filtros de consultas Prisma
 * ============================================================
 *
 * Reemplaza el uso de `where: any` y `as any` en los servicios
 * de pagos, préstamos y actualización de datos.
 *
 * Al usar Prisma.XxxWhereInput TypeScript verifica en compilación
 * que los campos existan en el schema — evita bugs como el que
 * puso cuotas de otros clientes en 0.
 */

import { Prisma, EstadoPrestamo, RolUsuario } from '@prisma/client';

/**
 * Filtros para consultas de pagos (findMany / count).
 * Reemplaza `where: any` en PaymentsService.findAll y exportPayments.
 */
export type PagoWhereInput = Prisma.PagoWhereInput;

/**
 * Filtros para consultas de préstamos (findMany / count).
 * Reemplaza `where: any` en LoansService.getAllLoans.
 */
export type PrestamoWhereInput = Prisma.PrestamoWhereInput;

/**
 * Datos permitidos al actualizar un préstamo.
 * Reemplaza `updateData: any` y `data: any` en LoansService.updateLoan.
 */
export interface UpdateLoanData {
  monto?: number;
  tasaInteres?: number;
  tasaInteresMora?: number;
  plazoMeses?: number;
  cantidadCuotas?: number;
  frecuenciaPago?: Prisma.EnumFrecuenciaPagoFilter | string;
  estado?: EstadoPrestamo;
  notas?: string;
  garantia?: string;
  cuotaInicial?: number;
  tipoAmortizacion?: string;
  fechaInicio?: string | Date;
  archivos?: unknown; // Manejado por separado, no va a Prisma directamente
  estadoSincronizacion?: string;
  interesTotal?: number;
  saldoPendiente?: number;
}

/**
 * Dato tipado para el UPDATE de préstamo en Prisma.
 * Solo incluye campos seguros que existen en el schema.
 */
export type PrestamoUpdateInput = Prisma.PrestamoUpdateInput;

/**
 * Tipo del resultado de `prisma.prestamo.findMany()` con includes
 * usados en getAllLoans — evita `prestamo as any`.
 */
export type PrestamoConRelaciones = Prisma.PrestamoGetPayload<{
  include: {
    cliente: {
      select: {
        id: true;
        nombres: true;
        apellidos: true;
        dni: true;
        telefono: true;
        nivelRiesgo: true;
        asignacionesRuta: {
          where: { activa: true };
          select: {
            ruta: {
              select: { id: true; nombre: true; codigo: true };
            };
          };
          take: 1;
        };
      };
    };
    producto: { select: { id: true; nombre: true; categoria: true } };
    precioProducto: { select: { id: true; meses: true; precio: true } };
    cuotas: {
      select: {
        id: true;
        numeroCuota: true;
        estado: true;
        fechaVencimiento: true;
        monto: true;
        montoPagado: true;
        montoInteresMora: true;
      };
    };
    creadoPor: { select: { id: true; nombres: true; apellidos: true } };
  };
}>;

/**
 * Tipo del resultado de `prisma.pago.findMany()` con includes
 * usados en exportPayments — evita `p: any` en forEach.
 */
export type PagoConRelacionesExport = Prisma.PagoGetPayload<{
  include: {
    cliente: { select: { nombres: true; apellidos: true; dni: true } };
    prestamo: { select: { numeroPrestamo: true } };
    cobrador: { select: { nombres: true; apellidos: true; rol: true } };
  };
}>;

/**
 * Quién hace la petición: es lo que `JwtStrategy.validate()` deja en `req.user`
 * y lo que los servicios reciben como `actor` para filtrar por jurisdicción
 * (un supervisor solo ve sus rutas, un cobrador solo sus clientes).
 *
 * El rol va tipado con el enum a secas. Antes las 41 firmas repetían
 * `RolUsuario` unido a `string`, y ese `string` anulaba el enum: TypeScript no
 * podía avisar de un `'COORDINADRO'` mal escrito. Quitarlo no rompió nada,
 * porque el valor real siempre es el enum: `validate()` lo lee de la base.
 */
export interface ActorUsuario {
  id?: string;
  rol?: RolUsuario;
}

/**
 * Lo que el JWT deja en `req.user` (ver `JwtStrategy.validate`).
 *
 * Los controladores lo recibían como `req: any`, y por eso nadie se enteraba de
 * que en varios sitios se leían campos inexistentes: `req.user.sub` y
 * `req.user.userId`. Casi siempre iban en cadena detrás de `id`, así que no se
 * notaba; en la configuración del sistema no había cadena y el resultado era
 * que se guardaba sin registrar quién la había cambiado.
 */
export interface UsuarioAutenticado {
  id: string;
  correo?: string;
  nombres?: string;
  rol: RolUsuario;
  permisos?: string[];
}

/** Request de Express ya autenticado por el guard de JWT. */
export interface RequestConUsuario {
  user: UsuarioAutenticado;
  headers?: Record<string, string | string[] | undefined>;
}
