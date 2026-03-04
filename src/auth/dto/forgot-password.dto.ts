import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNumberString, Length } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@creditsur.com' })
  @IsEmail()
  correo: string;
}

export class VerifyResetCodeDto {
  @ApiProperty({ example: 'admin@creditsur.com' })
  @IsEmail()
  correo: string;

  @ApiProperty({ example: '123456', description: 'Codigo de 6 digitos enviado al correo' })
  @IsNumberString()
  @Length(6, 6)
  codigo: string;

  @ApiProperty({ example: 'NuevaContrasena123' })
  @IsString()
  @MinLength(6)
  nuevaContrasena: string;
}
