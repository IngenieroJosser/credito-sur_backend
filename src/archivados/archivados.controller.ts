import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ArchivadosService } from './archivados.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../auth/guards/permisos.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permisos } from '../auth/decorators/permisos.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SWAGGER_JWT_AUTH } from '../auth/constants/swagger-auth.constants';
import { RolUsuario } from '@prisma/client';
import { RequestConUsuario } from '../common/types';

@ApiTags('archivados')
@ApiBearerAuth(SWAGGER_JWT_AUTH)
@UseGuards(JwtAuthGuard, PermisosGuard, RolesGuard)
@Permisos('archivados')
@Controller('archivados')
export class ArchivadosController {
  constructor(private readonly archivadosService: ArchivadosService) {}

  @Get()
  listar() {
    return this.archivadosService.listar();
  }

  /**
   * Borrado definitivo de un registro ya archivado.
   *
   * Solo lo hacen superadministrador y administrador: es irreversible y, si el
   * registro tiene dinero (pagos, movimientos, asientos), el servicio lo
   * rechaza. El borrado normal nunca llega aqui: primero se archiva.
   */
  @Delete(':tipo/:entidadId')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar definitivamente un elemento archivado',
    description:
      'Borra de la base un registro previamente archivado. Se rechaza si tiene pagos o movimientos de dinero.',
  })
  eliminarDefinitivo(
    @Param('tipo') tipo: string,
    @Param('entidadId') entidadId: string,
    @Request() req: RequestConUsuario,
  ) {
    return this.archivadosService.eliminarDefinitivo(
      tipo,
      entidadId,
      req.user.id,
    );
  }
}
