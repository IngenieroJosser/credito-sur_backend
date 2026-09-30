import { ApiProperty } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * El cuerpo de `POST /push/send`.
 *
 * Antes el controlador recibia `@Body() data: any`. La forma SI estaba escrita, pero como
 * una INTERFAZ en `push.service.ts`, y eso no sirve para validar: el ValidationPipe necesita
 * una CLASE con decoradores, porque una interfaz no existe en tiempo de ejecucion. O sea que
 * tipar el parametro con la interfaz habria comprobado la llamada al servicio y habria dejado
 * el cuerpo igual de crudo. De ahi esta clase.
 *
 * El endpoint esta limitado por rol (superadmin, admin, coordinador), asi que no estaba
 * abierto a cualquiera; pero un cuerpo sin validar llegaba hasta `webpush`, y `roleFilter`
 * se usa para DECIDIR A QUIEN se le manda: un valor que no sea un rol conocido merece un 400
 * y no un filtro silencioso que no encuentra a nadie.
 *
 * La interfaz del servicio se conserva como el contrato interno; esta clase es la puerta.
 */
export class SendPushNotificationDto {
  @ApiProperty({ description: 'Título de la notificación' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Cuerpo del mensaje' })
  @IsString()
  body: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  badge?: string;

  @ApiProperty({ required: false, description: 'Agrupa notificaciones' })
  @IsString()
  @IsOptional()
  tag?: string;

  /**
   * Carga libre que viaja al service worker. Se valida que sea un objeto y no su contenido:
   * lo consume el cliente, no el backend.
   */
  @ApiProperty({ required: false, type: Object })
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Enviar solo a este usuario' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false, enum: RolUsuario, isArray: true })
  @IsArray()
  @IsEnum(RolUsuario, { each: true })
  @IsOptional()
  roleFilter?: RolUsuario[];
}
