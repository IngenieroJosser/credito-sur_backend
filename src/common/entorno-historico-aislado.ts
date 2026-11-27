export function esEntornoHistoricoAislado(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.CREDISUR_HABILITAR_CARGA_HISTORICA_PRUEBA !== '1' ||
      env.NODE_ENV === 'production' || !env.DATABASE_URL) return false;
  try {
    const url = new URL(env.DATABASE_URL);
    return url.protocol === 'postgresql:' && url.hostname === '127.0.0.1' &&
      url.port === '55483' && url.pathname === '/fase3_pruebas';
  } catch {
    return false;
  }
}
