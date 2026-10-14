import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MirrorSyncService } from './mirror-sync.service';

/**
 * Qué se replica al servidor remoto y qué no.
 *
 * Por qué existe este archivo: `mirror-sync` no tenía ninguna prueba y es el que
 * decide qué escrituras viajan al VPS. Dos formas de fallar, las dos silenciosas:
 * que deje de encolar algo que sí debía replicarse —y esa fila solo exista en un
 * lado—, o que empiece a encolar lo que estaba excluido.
 *
 * La lista de exclusiones es el punto frágil: está escrita a mano dentro del
 * método, así que un modelo nuevo entra a la sincronización por omisión y nadie
 * lo revisa.
 */
describe('MirrorSyncService', () => {
  let service: MirrorSyncService;
  let cola: { add: jest.Mock };

  const evento = (model: string, action = 'create') => ({
    model,
    action,
    data: { id: 'x-1' },
  });

  beforeEach(async () => {
    cola = { add: jest.fn().mockResolvedValue(undefined) };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        MirrorSyncService,
        { provide: getQueueToken('mirror-sync-queue'), useValue: cola },
      ],
    }).compile();

    service = modulo.get<MirrorSyncService>(MirrorSyncService);
  });

  it('encola una escritura normal para replicarla', async () => {
    await service.handleDatabaseWriteEvent(evento('Prestamo'));

    expect(cola.add).toHaveBeenCalledTimes(1);
    const [nombre, carga] = cola.add.mock.calls[0];
    expect(nombre).toBe('sync-record');
    expect(carga).toEqual(evento('Prestamo'));
  });

  describe('lo que NO se replica', () => {
    // La lista va escrita aquí a propósito: si alguien la toca en el servicio,
    // esta prueba falla y obliga a decir por qué.
    it.each(['SyncConflict', 'AuditLog', 'Session', 'PushSubscription'])(
      '%s se queda en este equipo',
      async (model) => {
        await service.handleDatabaseWriteEvent(evento(model));
        expect(cola.add).not.toHaveBeenCalled();
      },
    );

    it('un modelo NO listado sí se replica: la exclusión es por lista, no por defecto', async () => {
      // Esto es lo que hay que recordar al añadir una tabla nueva: entra a la
      // sincronización sola, sin que nadie lo decida.
      await service.handleDatabaseWriteEvent(evento('TablaNueva'));
      expect(cola.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('cuando la cola falla', () => {
    it('no deja que el fallo tumbe la escritura que lo origina', async () => {
      // El evento llega DESPUÉS de que la fila ya se guardó. Si esto lanzara,
      // una caída de Redis haría fallar operaciones que ya están en firme.
      cola.add.mockRejectedValue(new Error('Redis caído'));

      await expect(
        service.handleDatabaseWriteEvent(evento('Pago')),
      ).resolves.toBeUndefined();
    });

    it('ese registro NO se reintenta: se pierde y solo queda el log', async () => {
      // Comportamiento actual, fijado para que cambiarlo sea deliberado.
      //
      // Los 1.000 reintentos con espera progresiva protegen del VPS caído, pero
      // solo valen si el trabajo ENTRÓ en la cola. Si falla el `add` —Redis
      // caído, cola llena— no hay segundo intento ni rastro recuperable: esa
      // escritura nunca llega al otro lado y nadie se entera.
      cola.add.mockRejectedValue(new Error('Redis caído'));

      await service.handleDatabaseWriteEvent(evento('Pago'));

      expect(cola.add).toHaveBeenCalledTimes(1);
    });
  });

  it('pide reintentos con espera progresiva y conserva los fallidos', async () => {
    // `removeOnFail: false` es lo que permite revisar después qué no se replicó.
    await service.handleDatabaseWriteEvent(evento('Cliente'));

    const [, , opciones] = cola.add.mock.calls[0];
    expect(opciones).toEqual(
      expect.objectContaining({
        attempts: 1000,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      }),
    );
  });
});
