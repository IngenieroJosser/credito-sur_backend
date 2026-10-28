import { Prisma } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateSyncConflictDto {
  @IsString()
  @IsNotEmpty()
  entidad: string;

  @IsString()
  @IsNotEmpty()
  operacion: string;

  // `Prisma.InputJsonValue`: es la columna `Json` donde se guarda la operacion que no
  // se pudo sincronizar. El `@IsNotEmpty()` de arriba es lo unico que la valida.
  @IsNotEmpty()
  datos: Prisma.InputJsonValue;

  @IsString()
  @IsNotEmpty()
  errorMotivo: string;

  @IsInt()
  @IsOptional()
  statusCode?: number;

  @IsString()
  @IsNotEmpty()
  endpoint: string;
}
