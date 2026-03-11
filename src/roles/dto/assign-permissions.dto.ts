import { IsArray, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPermissionsDto {
  @ApiProperty({
    description: 'Array of Permission IDs to assign to the role',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  permisosIds: string[];
}
