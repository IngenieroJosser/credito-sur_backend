import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SyncConflictsService } from './sync-conflicts.service';
import { CreateSyncConflictDto } from './dto/create-sync-conflict.dto';
import { UpdateSyncConflictDto } from './dto/update-sync-conflict.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { RequestConUsuario } from '../common/types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sync-conflicts')
export class SyncConflictsController {
  constructor(private readonly syncConflictsService: SyncConflictsService) {}

  @Post('report-failed')
  create(
    @Body() createSyncConflictDto: CreateSyncConflictDto,
    @Request() req: RequestConUsuario,
  ) {
    // Both cobrador and others can report failures
    return this.syncConflictsService.create(createSyncConflictDto, req.user.id);
  }

  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  @Get()
  findAll(@Request() req: RequestConUsuario) {
    return this.syncConflictsService.findAll(req.user);
  }

  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestConUsuario) {
    return this.syncConflictsService.findOne(id, req.user);
  }

  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  @Patch(':id/resolve')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  resolve(
    @Param('id') id: string,
    @Body('accion') accion: string,
    @Request() req: RequestConUsuario,
  ) {
    // Ya no se lee la cabecera Authorization: el servicio NO usaba ese token
    // (el parametro se llamaba `_token`) porque firma uno propio con la
    // identidad del CREADOR del conflicto, no la de quien resuelve. Eso es
    // deliberado y esta explicado alli: reenviar con el token de quien pulsa
    // permitia que un rol bajo guardara una operacion privilegiada y, al
    // resolverla un admin, se ejecutara con privilegios de admin.
    return this.syncConflictsService.resolveConflict(id, accion, req.user.id);
  }

  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.syncConflictsService.remove(id);
  }
}
