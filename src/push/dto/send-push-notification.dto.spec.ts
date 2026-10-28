import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { SendPushNotificationDto } from './send-push-notification.dto';

/**
 * `POST /push/send` recibia `@Body() data: any`.
 *
 * La forma SI estaba escrita, pero como una INTERFAZ en `push.service.ts`, y eso no sirve
 * para validar: el ValidationPipe necesita una CLASE con decoradores, porque una interfaz no
 * existe en tiempo de ejecucion. Tipar el parametro con la interfaz habria comprobado la
 * llamada al servicio y habria dejado el cuerpo igual de crudo. Esta prueba existe para que
 * eso quede fijado.
 *
 * Lo que mas importa es `roleFilter`: decide A QUIEN se le manda la notificacion. Un valor
 * que no sea un rol conocido merece un 400, no un filtro silencioso que no encuentra a nadie.
 */
describe('SendPushNotificationDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const metadata = {
    type: 'body' as const,
    metatype: SendPushNotificationDto,
  };

  /** Los ocho campos que `sendPushNotification` lee. */
  const CAMPOS_QUE_EL_SERVICIO_LEE = [
    'title',
    'body',
    'icon',
    'badge',
    'tag',
    'data',
    'userId',
    'roleFilter',
  ];

  const cuerpoCompleto = {
    title: 'Cuota vencida',
    body: 'El cliente Ana Munoz tiene una cuota vencida',
    icon: '/icons/alerta.png',
    badge: '/icons/badge.png',
    tag: 'mora',
    data: { prestamoId: 'p-1' },
    userId: '3f1a6c2e-8b4d-4f2a-9c1e-5d7b8a9f0c31',
    roleFilter: [RolUsuario.COBRADOR, RolUsuario.SUPERVISOR],
  };

  it('no descarta ninguno de los ocho campos que el servicio lee', async () => {
    const resultado = await pipe.transform(cuerpoCompleto, metadata);

    expect(Object.keys(resultado).sort()).toEqual(
      [...CAMPOS_QUE_EL_SERVICIO_LEE].sort(),
    );
  });

  it('acepta el mínimo: título y cuerpo', async () => {
    const resultado = await pipe.transform(
      { title: 'Hola', body: 'Mensaje' },
      metadata,
    );
    expect(resultado).toEqual({ title: 'Hola', body: 'Mensaje' });
  });

  describe('lo que ahora se rechaza y antes pasaba', () => {
    it('sin título', async () => {
      await expect(
        pipe.transform({ body: 'Mensaje' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sin cuerpo', async () => {
      await expect(
        pipe.transform({ title: 'Hola' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    /**
     * El que de verdad importa: `roleFilter` decide a quien se le manda. Con un rol
     * inventado el filtro no encontraba a nadie y el envio parecia haber funcionado.
     */
    it('un rol que no existe en roleFilter', async () => {
      await expect(
        pipe.transform(
          { ...cuerpoCompleto, roleFilter: ['JEFE_DE_TODO'] },
          metadata,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('roleFilter que no es un arreglo', async () => {
      await expect(
        pipe.transform({ ...cuerpoCompleto, roleFilter: 'COBRADOR' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un userId que no es uuid', async () => {
      await expect(
        pipe.transform({ ...cuerpoCompleto, userId: 'ana' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('`data` se valida como objeto, no su contenido: lo consume el cliente', async () => {
    const resultado = (await pipe.transform(
      { title: 'a', body: 'b', data: { lo: 'que', sea: 1, anidado: { x: 2 } } },
      metadata,
    )) as SendPushNotificationDto;
    expect(resultado.data).toEqual({ lo: 'que', sea: 1, anidado: { x: 2 } });
  });

  it('descarta lo que el servicio no usa, sin fallar', async () => {
    const resultado = await pipe.transform(
      { title: 'a', body: 'b', urgente: true, ttl: 3600 },
      metadata,
    );
    expect(resultado).toEqual({ title: 'a', body: 'b' });
  });
});
