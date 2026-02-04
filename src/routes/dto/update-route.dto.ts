import { PartialType } from '@nestjs/mapped-types';
import { CreateRouteDto } from './create-route.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRouteDto extends PartialType(CreateRouteDto) {
  @ApiProperty({ description: 'Estado activo/inactivo', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}