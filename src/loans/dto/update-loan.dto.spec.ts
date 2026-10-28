import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  EstadoPrestamo,
  FrecuenciaPago,
  TipoAmortizacion,
} from '@prisma/client';
import { UpdateLoanDto } from './update-loan.dto';

/**
 * `PATCH /loans/:id` aceptaba cualquier cuerpo.
 *
 * El controlador recibia `@Body() updateData: any`, y sin un DTO el ValidationPipe global
 * no tiene contra que validar: cualquier campo, de cualquier tipo, llegaba al servicio y
 * de ahi a Prisma. `UpdateLoanDto` existia desde antes y no tenia un solo consumidor.
 *
 * Estas pruebas cuidan las dos mitades del arreglo:
 *
 *  1. Que el pipe NO se lleve por delante ninguno de los catorce campos que `updateLoan`
 *     lee de ese cuerpo. Con `whitelist: true`, un campo que el DTO no declare se
 *     descarta EN SILENCIO: si alguien quita `version` del DTO, el control de conflictos
 *     por bloqueo optimista deja de funcionar y nada avisa. Esta prueba avisa.
 *  2. Que lo invalido se rechace, que es lo que antes no pasaba.
 */
describe('UpdateLoanDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const metadata = {
    type: 'body' as const,
    metatype: UpdateLoanDto,
  };

  /** Los catorce campos que `updateLoan` lee del cuerpo, inventariados sobre el metodo. */
  const CAMPOS_QUE_EL_SERVICIO_LEE = [
    'monto',
    'tasaInteres',
    'tasaInteresMora',
    'plazoMeses',
    'cantidadCuotas',
    'frecuenciaPago',
    'estado',
    'tipoAmortizacion',
    'cuotaInicial',
    'fechaInicio',
    'notas',
    'garantia',
    'version',
    'archivos',
  ];

  const cuerpoCompleto = {
    monto: 1_000_000,
    tasaInteres: 20,
    tasaInteresMora: 5,
    plazoMeses: 1.5,
    cantidadCuotas: 45,
    frecuenciaPago: FrecuenciaPago.DIARIO,
    estado: EstadoPrestamo.ACTIVO,
    tipoAmortizacion: TipoAmortizacion.INTERES_SIMPLE,
    cuotaInicial: 100_000,
    fechaInicio: '2026-03-01',
    notas: 'Ajuste de plazo',
    garantia: 'Nevera',
    version: 3,
    archivos: [
      {
        tipoContenido: 'CONTRATO_PRESTAMO',
        tipoArchivo: 'application/pdf',
        nombreOriginal: 'contrato.pdf',
        nombreAlmacenamiento: 'abc123.pdf',
        ruta: 'loans/abc123.pdf',
        tamanoBytes: 1024,
      },
    ],
  };

  it('no descarta ninguno de los campos que el servicio lee', async () => {
    const resultado = await pipe.transform(cuerpoCompleto, metadata);

    expect(Object.keys(resultado).sort()).toEqual(
      [...CAMPOS_QUE_EL_SERVICIO_LEE].sort(),
    );
  });

  it('conserva `version`: de ella depende el control de conflictos', async () => {
    // Se prueba aparte porque es la que mas facil se cae: el frontend la manda
    // (`EditarPrestamoModal`) pero su propio tipo no la declaraba, y el DTO que habia
    // antes (`PartialType(CreateLoanDto)`) tampoco estaba en uso.
    const resultado = await pipe.transform({ version: 7 }, metadata);
    expect(resultado).toEqual({ version: 7 });
  });

  it('conserva `estado` y `archivos`, que `PartialType(CreateLoanDto)` no traeria', async () => {
    const resultado = await pipe.transform(
      { estado: EstadoPrestamo.EN_MORA, archivos: [] },
      metadata,
    );
    expect(resultado).toEqual({
      estado: EstadoPrestamo.EN_MORA,
      archivos: [],
    });
  });

  /**
   * Casi se introduce una regresion aqui: el primer intento reusaba el
   * `CreateMultimediaDto` de clientes, cuyo `tipoContenido` valida contra
   * `TIPOS_CONTENIDO_CLIENTE` (cuatro valores: foto de perfil, cedula por los dos lados,
   * comprobante de domicilio). Los adjuntos de un credito usan otros del mismo enum y
   * habrian sido rechazados. Esta prueba lo fija.
   */
  it('acepta los tipos de adjunto propios de un credito', async () => {
    for (const tipoContenido of [
      'CONTRATO_PRESTAMO',
      'FOTO_PRODUCTO',
      'OTRO_DOCUMENTO',
      'COMPROBANTE_TRANSFERENCIA',
    ]) {
      await expect(
        pipe.transform(
          {
            archivos: [{ tipoContenido, tipoArchivo: 'application/pdf' }],
          },
          metadata,
        ),
      ).resolves.toHaveProperty('archivos');
    }
  });

  it('rechaza un tipo de adjunto que no esta en el enum', async () => {
    await expect(
      pipe.transform(
        { archivos: [{ tipoContenido: 'CUALQUIER_COSA', tipoArchivo: 'x' }] },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta un cuerpo parcial: es un PATCH', async () => {
    const resultado = await pipe.transform({ notas: 'solo la nota' }, metadata);
    expect(resultado).toEqual({ notas: 'solo la nota' });
  });

  describe('lo que ahora se rechaza y antes pasaba', () => {
    it('un monto que no es numero', async () => {
      await expect(
        pipe.transform({ monto: 'mucho' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un monto negativo', async () => {
      await expect(
        pipe.transform({ monto: -5 }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un estado que no existe', async () => {
      await expect(
        pipe.transform({ estado: 'CANCELADO_POR_EL_CLIENTE' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('una frecuencia que no existe', async () => {
      await expect(
        pipe.transform({ frecuenciaPago: 'CADA_LUNES' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('una fecha que no es fecha', async () => {
      await expect(
        pipe.transform({ fechaInicio: 'el proximo mes' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cero cuotas', async () => {
      await expect(
        pipe.transform({ cantidadCuotas: 0 }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('descarta lo que el servicio no usa, sin fallar', async () => {
    // `forbidNonWhitelisted` no esta activado, asi que un campo de sobra no es un error:
    // simplemente no llega. Se comprueba que no llegue.
    const resultado = await pipe.transform(
      { notas: 'ok', clienteId: 'otro-cliente', estadoSincronizacion: 'X' },
      metadata,
    );
    expect(resultado).toEqual({ notas: 'ok' });
  });
});
