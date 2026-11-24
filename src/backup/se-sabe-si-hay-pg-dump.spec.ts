import { BackupService } from './backup.service';
import { BackupExcelService } from './backup-excel.service';
import { comoPrisma, type DobleDePrisma } from '../common/testing/dobles';

/**
 * Si el servidor puede hacer el volcado SQL, se sabe SIN correr un respaldo.
 *
 * ── Por que hacia falta ────────────────────────────────────────────────────
 *
 * El respaldo genera dos cosas: un Excel de las tablas y un volcado SQL con
 * `pg_dump`. El volcado es opcional a proposito —y asi esta escrito en el
 * servicio—, asi que un respaldo sin volcado contesta `estado: 'EXITOSO'`. Pero
 * un `.xlsx` no restaura PostgreSQL: lo que restaura es el volcado.
 *
 * Y saber si `pg_dump` esta en el servidor no se podia:
 *
 *   - `config.pgDumpPath` dice la ruta CONFIGURADA, que por defecto es
 *     «pg_dump», o sea «buscalo en el PATH». No dice si esta ahi.
 *   - la consola (shell) de Render es DE PAGO, asi que nadie puede entrar a
 *     escribir `pg_dump --version`;
 *   - y la unica via que quedaba era generar un respaldo entero —un Excel y una
 *     fila en `BackupRun`— solo para leerle el mensaje de error.
 *
 * Asi que `GET /backup/status` ahora lo comprueba de verdad. `--version` no
 * toca la base de datos.
 *
 * Medido en la maquina de desarrollo, que es justo el caso que importa: hay
 * PostgreSQL 18.1 instalado y `pg_dump` **no esta en el PATH** (ENOENT). O sea
 * que «esta instalado» y «el servicio lo encuentra» no son lo mismo, ni aqui ni
 * en Render.
 */
const prismaConUltimoRespaldo = (ultimo: unknown): DobleDePrisma => ({
  backupRun: {
    findFirst: jest.fn().mockResolvedValue(ultimo),
  },
});

const servicio = () => {
  const doble = prismaConUltimoRespaldo(null);
  const excel = {} as BackupExcelService;
  return {
    servicio: new BackupService(comoPrisma(doble), excel),
    doble,
  };
};

describe('el estado de respaldos dice si se puede hacer el volcado', () => {
  const PREVIO = process.env.PG_DUMP_PATH;

  afterEach(() => {
    if (PREVIO === undefined) delete process.env.PG_DUMP_PATH;
    else process.env.PG_DUMP_PATH = PREVIO;
  });

  it('con un binario que no existe, lo dice y no se calla', async () => {
    // Una ruta que con seguridad no existe: es el caso de Render sin la
    // variable, donde el nombre suelto no se resuelve en el PATH.
    process.env.PG_DUMP_PATH = 'pg_dump_que_no_existe_en_ningun_sitio';

    const { servicio: s } = servicio();
    const estado = await s.getStatus();

    expect(estado.config.pgDumpDisponible).toBe(false);
    expect(estado.config.pgDumpVersion).toBeNull();
    // El mensaje tiene que nombrar la variable: sin eso dice que algo falta y
    // no dice que hacer.
    expect(estado.config.pgDumpError).toContain('PG_DUMP_PATH');
    // Y tiene que decir la consecuencia, que es la parte cara de equivocar:
    // «EXITOSO» sin volcado se lee como «tengo respaldo».
    expect(estado.config.pgDumpError).toMatch(/restaura/i);
  });

  it('no inventa una version cuando no hay binario', async () => {
    process.env.PG_DUMP_PATH = 'pg_dump_que_no_existe_en_ningun_sitio';

    const { servicio: s } = servicio();
    const estado = await s.getStatus();

    /*
     * En null, no en cadena vacia: un «» en la pantalla se leeria como una
     * version que no se alcanzo a mostrar. Es la misma regla que ya costo un
     * incidente con los ceros que no eran huecos.
     */
    expect(estado.config.pgDumpVersion).toBeNull();
  });

  it('lo comprueba UNA vez por proceso, no en cada recarga de la pantalla', async () => {
    /*
     * La pantalla pide el estado al abrirse y al refrescar. Lanzar un proceso
     * cada vez seria gratuito pero innecesario: el binario no puede aparecer
     * sin un despliegue nuevo, y un despliegue arranca otro proceso.
     *
     * Se mide por el tiempo de la segunda llamada contra la primera, que es lo
     * unico observable desde fuera sin tocar lo privado.
     */
    process.env.PG_DUMP_PATH = 'pg_dump_que_no_existe_en_ningun_sitio';
    const { servicio: s } = servicio();

    await s.getStatus();
    const antes = process.hrtime.bigint();
    await s.getStatus();
    const msSegunda = Number(process.hrtime.bigint() - antes) / 1e6;

    // Un `execFile` fallido cuesta milisegundos de sobra; leer el cache es
    // inmediato. El piso es generoso a proposito para no ser una prueba
    // frágil: lo que se vigila es que no se vuelva a lanzar el proceso.
    expect(msSegunda).toBeLessThan(15);
  });

  it('sigue devolviendo lo que ya devolvia', async () => {
    // El campo nuevo es aditivo: la pantalla usa `lastRun` y `backupDir`.
    process.env.PG_DUMP_PATH = 'pg_dump_que_no_existe_en_ningun_sitio';
    const { servicio: s } = servicio();
    const estado = await s.getStatus();

    expect(estado).toHaveProperty('lastRun', null);
    expect(typeof estado.config.backupDir).toBe('string');
    expect(estado.config.pgDumpPath).toBe(
      'pg_dump_que_no_existe_en_ningun_sitio',
    );
  });
});
