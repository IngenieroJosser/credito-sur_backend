import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      status: 'up',
      service: 'api-credisur',
      timestamp: new Date().toISOString(),
    };
  }
}
