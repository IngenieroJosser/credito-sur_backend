import { Controller, Get } from '@nestjs/common';

/**
 * El pulso del servicio, y QUE version esta corriendo.
 *
 * Lo segundo se agrego el 2026-11-24, despues de que un build fallara en
 * silencio: produccion siguio sirviendo el codigo anterior, y desde fuera no
 * habia forma de saberlo. La consola de Render es de pago, asi que la unica via
 * que queda es la API, y la API no decia nada.
 *
 * `RENDER_GIT_COMMIT` lo pone Render en el entorno. Se publica ABREVIADO -siete
 * caracteres, lo mismo que muestra `git log --oneline`- porque basta para
 * comparar contra el repo y no es un dato que haga falta completo. El endpoint
 * es publico a proposito (lo consulta el indicador de conexion del frontend),
 * asi que aqui no va nada mas del entorno.
 *
 * `arrancadoEn` dice cuando se reinicio el proceso: es como se distingue «mi
 * despliegue entro» de «el commit es el mismo porque el build fallo».
 */
const COMMIT = (
  process.env.RENDER_GIT_COMMIT ??
  process.env.GIT_COMMIT ??
  ''
).slice(0, 7);

const ARRANCADO_EN = new Date().toISOString();

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      status: 'up',
      service: 'api-credisur',
      timestamp: new Date().toISOString(),
      // Cadena vacia cuando se corre fuera de Render (local, pruebas): se
      // informa como `null` para que nadie lea '' como un commit valido.
      commit: COMMIT || null,
      arrancadoEn: ARRANCADO_EN,
    };
  }
}
