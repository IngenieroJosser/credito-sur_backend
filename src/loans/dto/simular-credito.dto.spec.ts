import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SimularCreditoDto } from './simular-credito.dto';

/**
 * `POST /loans/simular` aceptaba cualquier cuerpo: el controlador recibia
 * `@Body() body: any` y sin DTO el ValidationPipe global no tiene contra que validar.
 *
 * Importa mas que otros endpoints porque ese es el ORIGEN UNICO de la matematica de credito:
 * la pantalla de edicion lo llama en vez de recalcular la formula, que fue justo la fuente de
 * divergencias en pesos que ya se corrigio.
 *
 * Estas pruebas cuidan las dos mitades:
 *
 *  1. Que el pipe no se lleve por delante ninguno de los NUEVE campos que el controlador
 *     lee. Con `whitelist: true` un campo que el DTO no declare se descarta EN SILENCIO, y
 *     un campo que falte cambia el calculo sin que nada avise.
 *  2. Que lo permisivo siga siendo permisivo. El DTO valida tipos y NO rangos ni enums a
 *     proposito, porque de eso ya se defiende el servicio; si alguien le pone un `Min(1)`,
 *     estas pruebas fallan y explican por que no se debe.
 */
describe('SimularCreditoDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const metadata = {
    type: 'body' as const,
    metatype: SimularCreditoDto,
  };

  /** Los nueve campos que `simularPlan` lee del cuerpo, inventariados sobre el metodo. */
  const CAMPOS_QUE_EL_CONTROLADOR_LEE = [
    'tipoAmortizacion',
    'monto',
    'tasaInteres',
    'cantidadCuotas',
    'plazoMeses',
    'frecuenciaPago',
    'fechaInicio',
    'tipoPrestamo',
    'cuotaInicial',
  ];

  const cuerpoCompleto = {
    tipoAmortizacion: 'INTERES_SIMPLE',
    monto: 1_000_000,
    tasaInteres: 20,
    cantidadCuotas: 45,
    plazoMeses: 1.5,
    frecuenciaPago: 'DIARIO',
    fechaInicio: '2026-03-01',
    tipoPrestamo: 'EFECTIVO',
    cuotaInicial: 0,
  };

  it('no descarta ninguno de los nueve campos que el controlador lee', async () => {
    const resultado = await pipe.transform(cuerpoCompleto, metadata);

    expect(Object.keys(resultado).sort()).toEqual(
      [...CAMPOS_QUE_EL_CONTROLADOR_LEE].sort(),
    );
  });

  it('conserva un plazo FRACCIONARIO', async () => {
    // 45 cuotas diarias son 1,5 meses. Redondearlo antes del calculo cambia el interes
    // cobrado, asi que el DTO no debe volverlo entero.
    const resultado = (await pipe.transform(
      { ...cuerpoCompleto, plazoMeses: 1.5 },
      metadata,
    )) as SimularCreditoDto;
    expect(resultado.plazoMeses).toBe(1.5);
  });

  describe('lo que ahora se rechaza y antes pasaba', () => {
    it('un monto que es texto', async () => {
      // Antes `Number(body?.monto) || 0` lo convertia en 0 EN SILENCIO y devolvia ceros,
      // como si el credito no tuviera interes.
      await expect(
        pipe.transform({ ...cuerpoCompleto, monto: 'mucho' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un monto negativo', async () => {
      await expect(
        pipe.transform({ ...cuerpoCompleto, monto: -5 }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('una fecha que no es fecha', async () => {
      await expect(
        pipe.transform(
          { ...cuerpoCompleto, fechaInicio: 'el proximo mes' },
          metadata,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('lo que sigue pasando A PROPOSITO', () => {
    /**
     * El servicio empieza con `if (!(monto > 0) || !(cantidadCuotas > 0)) return` ceros, y el
     * unico llamador ya se guarda igual. Si el DTO exigiera `Min(1)`, ese mismo dato pasaria
     * de una respuesta en ceros a un 400, y la vista previa en vivo dejaria de funcionar
     * mientras el usuario teclea.
     */
    it('monto y cuotas en cero: los guarda el servicio, no el DTO', async () => {
      const resultado = (await pipe.transform(
        { ...cuerpoCompleto, monto: 0, cantidadCuotas: 0 },
        metadata,
      )) as SimularCreditoDto;
      expect(resultado.monto).toBe(0);
      expect(resultado.cantidadCuotas).toBe(0);
    });

    /**
     * `tipoAmortizacion`, `frecuenciaPago` y `tipoPrestamo` entran como texto y el servicio
     * los normaliza mas abajo. Un `@IsEnum` aqui rechazaria valores que hoy sabe interpretar.
     */
    it('los tres campos de enum entran como texto, sin validar contra el enum', async () => {
      const resultado = (await pipe.transform(
        {
          ...cuerpoCompleto,
          tipoAmortizacion: 'interes_simple',
          frecuenciaPago: 'diario',
        },
        metadata,
      )) as SimularCreditoDto;
      expect(resultado.tipoAmortizacion).toBe('interes_simple');
      expect(resultado.frecuenciaPago).toBe('diario');
    });
  });

  it('descarta lo que el controlador no usa, sin fallar', async () => {
    const resultado = await pipe.transform(
      { ...cuerpoCompleto, clienteId: 'otro', idempotencyKey: 'X' },
      metadata,
    );
    expect(Object.keys(resultado)).not.toContain('clienteId');
    expect(Object.keys(resultado)).not.toContain('idempotencyKey');
  });
});
