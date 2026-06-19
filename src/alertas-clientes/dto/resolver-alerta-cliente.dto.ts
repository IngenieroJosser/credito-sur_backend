import { IsNotEmpty, IsString } from 'class-validator';

export class ResolverAlertaClienteDto {
  @IsString()
  @IsNotEmpty()
  motivoResolucion: string;
}
