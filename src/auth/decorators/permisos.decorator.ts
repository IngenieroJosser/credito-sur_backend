import { SetMetadata } from '@nestjs/common';

export const CLAVE_PERMISOS = 'permisos';

export const Permisos = (...permisos: string[]) =>
  SetMetadata(CLAVE_PERMISOS, permisos);
