import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ArchivadosService } from './archivados.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../auth/guards/permisos.guard';
import { Permisos } from '../auth/decorators/permisos.decorator';
import { SWAGGER_JWT_AUTH } from '../auth/constants/swagger-auth.constants';

@ApiTags('archivados')
@ApiBearerAuth(SWAGGER_JWT_AUTH)
@UseGuards(JwtAuthGuard, PermisosGuard)
@Permisos('archivados')
@Controller('archivados')
export class ArchivadosController {
  constructor(private readonly archivadosService: ArchivadosService) {}

  @Get()
  listar() {
    return this.archivadosService.listar();
  }
}
