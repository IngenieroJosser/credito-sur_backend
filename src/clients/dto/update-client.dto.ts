import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  // Versión optimista: `version` del cliente en el momento en que el usuario
  // empezó a editar. Si al aplicar el cambio el servidor tiene una versión más
  // nueva, se rechaza como conflicto (evita sobrescribir en silencio ediciones
  // concurrentes / offline). Opcional: si no se envía, no se verifica.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;
}
