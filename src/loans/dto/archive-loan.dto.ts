import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ArchiveLoanDto {
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsString()
  @IsNotEmpty()
  archivarPorId: string;
}
