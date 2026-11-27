const { basename, dirname, extname, join, resolve } = require('node:path');
const { access, readFile, realpath, stat, writeFile } = require('node:fs/promises');
const { parseArgs } = require('node:util');

const MAX_EXCEL = 8 * 1024 * 1024;
const MAX_DECISIONES = 2 * 1024 * 1024;

async function leerArchivo(ruta, limite) {
  const info = await stat(ruta);
  if (!info.isFile() || info.size > limite) throw new Error('Uno de los archivos no es válido o excede el tamaño permitido.');
  return readFile(ruta);
}

async function guardarFueraDeGit(ruta, extension, datos) {
  const destino = resolve(ruta);
  if (extname(destino).toLowerCase() !== extension) throw new Error('La extensión de la salida no es válida.');
  const carpeta = await realpath(dirname(destino));
  for (let dir = carpeta; ; dir = dirname(dir)) {
    const enGit = await access(join(dir, '.git')).then(() => true, (error) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    });
    if (enGit) throw new Error('La salida contiene datos privados y debe guardarse fuera de Git.');
    if (dirname(dir) === dir) break;
  }
  await writeFile(join(carpeta, basename(destino)), datos, { flag: 'wx', mode: 0o600 });
}

async function main() {
  const { values } = parseArgs({
    options: {
      cartera: { type: 'string' },
      inventario: { type: 'string' },
      salida: { type: 'string' },
      decisiones: { type: 'string' },
      'modelo-decisiones': { type: 'string' },
    },
  });
  const { cartera, inventario, salida, decisiones } = values;
  if (!cartera || !inventario || !salida) {
    throw new Error('Use --cartera archivo.xlsx --inventario archivo.xlsx --salida carpeta/consolidado.xlsx.');
  }
  const { prepararHistoricos } = require('../dist/importaciones/preparacion/preparar-historicos');
  const { generarConsolidadoHistorico } = require('../dist/importaciones/preparacion/consolidado-historico');
  const [bytesCartera, bytesInventario, aprobaciones] = await Promise.all([
    leerArchivo(cartera, MAX_EXCEL),
    leerArchivo(inventario, MAX_EXCEL),
    decisiones ? leerArchivo(decisiones, MAX_DECISIONES).then((json) => JSON.parse(json.toString('utf8').replace(/^\uFEFF/, ''))) : undefined,
  ]);
  const resultado = await prepararHistoricos(
    { nombre: basename(cartera), bytes: bytesCartera },
    { nombre: basename(inventario), bytes: bytesInventario },
    aprobaciones,
  );
  await guardarFueraDeGit(salida, '.xlsx', await generarConsolidadoHistorico(resultado));
  if (values['modelo-decisiones']) {
    const plantilla = {
      version: resultado.version, versiones: resultado.versiones,
      fuentes: resultado.decisiones.fuentes, reglas: {}, filas: [],
    };
    await guardarFueraDeGit(values['modelo-decisiones'], '.json', JSON.stringify(plantilla, null, 2) + '\n');
  }
  const conteos = {};
  for (const { tipo, estado } of resultado.filas) {
    conteos[tipo] ??= { PARA_VALIDAR: 0, REVISAR: 0, CONSOLIDADO: 0 };
    conteos[tipo][estado]++;
  }
  console.log(JSON.stringify({
    versiones: resultado.versiones, huellaDecisiones: resultado.huellaDecisiones,
    total: resultado.filas.length, porTipo: conteos,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
