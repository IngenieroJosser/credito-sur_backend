import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  findAll(@Request() req) {
    if (!req.user || !req.user.id) return [];
    return this.notificacionesService.findAll(req.user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Request() req: any) {
    // Se pasa el usuario para que nadie marque como leída una notificación
    // ajena (antes markAsRead recibía solo el id, sin dueño).
    return this.notificacionesService.markAsRead(id, req.user?.id);
  }
}
