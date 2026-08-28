import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Traduce cualquier error a algo que una persona pueda leer y actuar.
 *
 * No había filtro global, así que lo que reventara por debajo salía tal cual
 * hacia la pantalla. Simulando el sistema con varios usuarios a la vez, esto es
 * lo que le habría llegado al usuario:
 *
 *   - "se ha detectado un deadlock" (texto de Postgres, en 1 de 150 operaciones)
 *   - "" (once operaciones fallaron con el mensaje vacío)
 *   - "Invalid `prisma.$queryRaw()` invocation: Raw query failed. Code: `40P01`"
 *
 * Nada de eso le dice a nadie qué hacer. Peor: un mensaje vacío se ve como si
 * la operación se hubiera perdido, y quien está en caja la vuelve a intentar.
 *
 * Aquí se traducen los errores conocidos de base de datos y se le pone un
 * código de referencia a los desconocidos, para que el usuario pueda decirlo
 * por teléfono y se encuentre en el log. El detalle técnico se registra del
 * lado del servidor y no viaja al navegador.
 */
@Catch()
export class ErroresClarosFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const donde = `${req?.method ?? ''} ${req?.url ?? ''}`.trim();

    const { status, mensaje, cuerpoOriginal, registrar } = this.traducir(
      exception,
      donde,
    );

    if (registrar) {
      this.logger.error(
        `${donde} -> ${status}: ${mensaje}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (cuerpoOriginal && typeof cuerpoOriginal === 'object') {
      // Se conserva la forma que ya devolvía el endpoint (los errores de
      // validación traen su lista de campos, y el frontend la usa), pero con el
      // mensaje garantizado.
      res.status(status).json({ ...cuerpoOriginal, message: mensaje });
      return;
    }

    res.status(status).json({
      statusCode: status,
      message: mensaje,
      path: req?.url,
      timestamp: new Date().toISOString(),
    });
  }

  private traducir(exception: unknown, donde: string) {
    // ── Errores que el propio código lanzó a propósito ──────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const cuerpo = exception.getResponse();
      const mensaje = this.textoDe(cuerpo) || this.porStatus(status);

      return {
        status,
        mensaje,
        cuerpoOriginal: typeof cuerpo === 'object' ? cuerpo : null,
        // Un 4xx es el sistema funcionando: se avisó de algo que no se podía
        // hacer. Solo se registran los 5xx.
        registrar: status >= 500,
      };
    }

    // ── Errores de base de datos ────────────────────────────────────────────
    const traducido = this.traducirBaseDeDatos(exception);
    if (traducido) {
      return {
        status: traducido.status,
        mensaje: traducido.mensaje,
        cuerpoOriginal: null,
        registrar: true,
      };
    }

    // ── Cualquier otra cosa ─────────────────────────────────────────────────
    const referencia = this.codigoDeReferencia();
    this.logger.error(
      `${donde} -> referencia ${referencia}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      mensaje:
        'Ocurrió un error inesperado y la operación no se realizó. ' +
        `Vuelva a intentarlo; si sigue pasando, reporte el código ${referencia}.`,
      cuerpoOriginal: null,
      registrar: false, // ya se registró arriba, con la referencia
    };
  }

  private traducirBaseDeDatos(exception: unknown) {
    const conflicto = HttpStatus.CONFLICT;
    const peticionMala = HttpStatus.BAD_REQUEST;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const meta: any = exception.meta ?? {};

      switch (exception.code) {
        case 'P2002':
          return {
            status: conflicto,
            mensaje:
              'Ya existe un registro con ese dato' +
              (meta.target
                ? ` (${[].concat(meta.target).join(', ')})`
                : '') +
              '. Revise si lo está creando dos veces.',
          };

        case 'P2003':
          return {
            status: peticionMala,
            mensaje:
              'La operación apunta a un registro que no existe o que ya fue eliminado. ' +
              'Actualice la pantalla y vuelva a intentarlo.',
          };

        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            mensaje:
              'El registro que intenta modificar ya no existe. ' +
              'Puede que alguien lo haya eliminado mientras usted trabajaba.',
          };

        case 'P2028':
          return {
            status: conflicto,
            mensaje:
              'La operación tardó demasiado y se canceló sin guardar nada. ' +
              'Vuelva a intentarlo.',
          };

        case 'P2024':
          return {
            status: HttpStatus.SERVICE_UNAVAILABLE,
            mensaje:
              'El sistema está atendiendo muchas operaciones al mismo tiempo. ' +
              'Espere unos segundos y vuelva a intentarlo.',
          };

        case 'P2010': {
          // Consulta cruda fallida: el detalle trae el código de Postgres.
          const texto = String(meta.message ?? exception.message ?? '');
          if (/deadlock|40P01/i.test(texto)) {
            return {
              status: conflicto,
              mensaje:
                'Otra persona estaba moviendo la misma caja en ese momento y ' +
                'la operación se canceló sin guardar nada. Vuelva a intentarlo.',
            };
          }
          if (/40001|could not serialize/i.test(texto)) {
            return {
              status: conflicto,
              mensaje:
                'Dos operaciones sobre los mismos datos coincidieron y esta se ' +
                'canceló sin guardar nada. Vuelva a intentarlo.',
            };
          }
          return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            mensaje:
              'No se pudo completar la consulta a la base de datos y no se guardó nada. ' +
              'Vuelva a intentarlo.',
          };
        }
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: peticionMala,
        mensaje:
          'Los datos enviados no tienen el formato que el sistema espera. ' +
          'Revise el formulario; si está completo, reporte el problema.',
      };
    }

    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        mensaje:
          'No hay conexión con la base de datos en este momento. ' +
          'Espere un momento y vuelva a intentarlo.',
      };
    }

    // Errores de Postgres que llegan sin envolver.
    const codigo = (exception as any)?.code;
    if (typeof codigo === 'string' && /^[0-9A-Z]{5}$/.test(codigo)) {
      if (codigo === '40P01') {
        return {
          status: conflicto,
          mensaje:
            'Otra persona estaba moviendo los mismos datos en ese momento y la ' +
            'operación se canceló sin guardar nada. Vuelva a intentarlo.',
        };
      }
      if (codigo === '40001') {
        return {
          status: conflicto,
          mensaje:
            'Dos operaciones coincidieron sobre los mismos datos y esta se ' +
            'canceló sin guardar nada. Vuelva a intentarlo.',
        };
      }
    }

    return null;
  }

  /**
   * Saca el texto de un cuerpo de excepción, que según cómo se lanzó puede ser
   * una cadena, un objeto con `message`, o un objeto con una lista de mensajes
   * de validación.
   */
  private textoDe(cuerpo: unknown): string {
    if (typeof cuerpo === 'string') return cuerpo.trim();

    if (cuerpo && typeof cuerpo === 'object') {
      const mensaje = (cuerpo as any).message;
      if (typeof mensaje === 'string') return mensaje.trim();
      if (Array.isArray(mensaje)) {
        const limpios = mensaje
          .map((m) => String(m ?? '').trim())
          .filter(Boolean);
        if (limpios.length > 0) return limpios.join('. ');
      }
      const error = (cuerpo as any).error;
      if (typeof error === 'string') return error.trim();
    }

    return '';
  }

  /**
   * Un mensaje que sirva cuando la excepción vino sin texto. Un error mudo es
   * peor que uno feo: quien está en caja no sabe si la operación se hizo.
   */
  private porStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Los datos enviados no son válidos. Revise el formulario y vuelva a intentarlo.';
      case HttpStatus.UNAUTHORIZED:
        return 'Su sesión no es válida o expiró. Vuelva a iniciar sesión.';
      case HttpStatus.FORBIDDEN:
        return 'Su usuario no tiene permiso para hacer esta operación.';
      case HttpStatus.NOT_FOUND:
        return 'No se encontró el registro solicitado.';
      case HttpStatus.CONFLICT:
        return 'La operación choca con el estado actual de los datos. Actualice la pantalla y vuelva a intentarlo.';
      case HttpStatus.REQUEST_TIMEOUT:
        return 'La operación tardó demasiado y se canceló sin guardar nada. Vuelva a intentarlo.';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'El archivo es demasiado grande.';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Demasiados intentos seguidos. Espere un momento y vuelva a intentarlo.';
      default:
        return status >= 500
          ? 'Ocurrió un error en el servidor y la operación no se realizó. Vuelva a intentarlo.'
          : 'No se pudo completar la operación.';
    }
  }

  /** Código corto para que el usuario lo repita y se encuentre en el log. */
  private codigoDeReferencia(): string {
    const tiempo = Date.now().toString(36).toUpperCase();
    const azar = Math.floor(Math.random() * 46656)
      .toString(36)
      .toUpperCase()
      .padStart(3, '0');
    return `ERR-${tiempo}-${azar}`;
  }
}
