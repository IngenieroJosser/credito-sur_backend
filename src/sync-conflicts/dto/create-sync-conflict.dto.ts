import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateSyncConflictDto {
  @IsString()
  @IsNotEmpty()
  entidad: string;

  @IsString()
  @IsNotEmpty()
  operacion: string;

  @IsNotEmpty()
  datos: any;

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
