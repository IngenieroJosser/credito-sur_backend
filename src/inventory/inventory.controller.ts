import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Get('stats')
  getInventoryStats() {
    return this.inventoryService.getInventoryStats();
  }

  @Get('archived')
  findArchived() {
    return this.inventoryService.findArchived();
  }

  @Post()
  create(@Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.create(createInventoryDto);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportInventario(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('excel')) format: 'excel' | 'pdf',
  ) {
    const result = await this.inventoryService.exportarInventario(format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get()
  async findAll() {
    try {
      return await this.inventoryService.findAll();
    } catch (error) {
      console.error('Error en GET /inventory:', error);
      throw new InternalServerErrorException('Error al obtener productos');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoryService.update(id, updateInventoryDto);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.inventoryService.restore(id);
  }

  @Patch(':id/hide-archived')
  hideArchived(@Param('id') id: string) {
    return this.inventoryService.hideArchived(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
