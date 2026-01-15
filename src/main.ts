import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000', 
  });

  const config = new DocumentBuilder()
    .setTitle('Créditos del Sur – API REST')
    .setDescription(
      'Sistema web para la gestión integral de créditos, préstamos y cobranzas de electrodomésticos, orientado a entornos empresariales. Soporta operación continua, control financiero riguroso, auditoría de transacciones y funcionamiento confiable en escenarios con conectividad limitada.'
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Ingrese el token JWT',
        in: 'header',
      },
      'jwt-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
