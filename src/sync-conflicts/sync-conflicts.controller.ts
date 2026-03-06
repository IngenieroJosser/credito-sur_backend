import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { SyncConflictsService } from './sync-conflicts.service';
import { CreateSyncConflictDto } from './dto/create-sync-conflict.dto';
import { UpdateSyncConflictDto } from './dto/update-sync-conflict.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sync-conflicts')
export class SyncConflictsController {
  constructor(private readonly syncConflictsService: SyncConflictsService) {}

  @Post('report-failed')
  create(@Body() createSyncConflictDto: CreateSyncConflictDto, @Request() req) {
    // Both cobrador and others can report failures
    return this.syncConflictsService.create(createSyncConflictDto, req.user.id);
  }

  @Roles('SUPER_ADMINISTRADOR', 'ADMIN', 'COORDINADOR')
  @Get()
  findAll(@Request() req) {
    return this.syncConflictsService.findAll(req.user);
  }

  @Roles('SUPER_ADMINISTRADOR', 'ADMIN', 'COORDINADOR')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.syncConflictsService.findOne(id, req.user);
  }

  @Roles('SUPER_ADMINISTRADOR', 'ADMIN', 'COORDINADOR')
  @Patch(':id/resolve')
  resolve(@Param('id') id: string, @Body('accion') accion: string, @Request() req) {
    const token = req.headers.authorization;
    return this.syncConflictsService.resolveConflict(id, accion, req.user.id, token);
  }

  @Roles('SUPER_ADMINISTRADOR', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.syncConflictsService.remove(id);
  }
}
