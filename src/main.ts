import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import { validateEnv } from './common/env.validation';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import type { Request, Response, NextFunction } from 'express';
import { SWAGGER_JWT_AUTH } from './auth/constants/swagger-auth.constants';

const shouldEnableMirrorSync =
  process.env.MIRROR_SYNC_ENABLED === 'true' &&
  Boolean(process.env.MIRROR_VPS_URL) &&
  Boolean(process.env.MIRROR_SYNC_TOKEN);

async function bootstrap() {
  // Validar variables de entorno ANTES de crear la app
  // Si faltan DATABASE_URL o JWT_SECRET, el proceso termina con mensaje claro
  validateEnv();

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Configurar prefijo global para la API
  app.setGlobalPrefix('api-credisur');

  if (shouldEnableMirrorSync) {
    const bullBoardBasePath = '/api-credisur/configuracion/colas';
    const expressAdapter = new ExpressAdapter();
    expressAdapter.setBasePath(bullBoardBasePath);

    try {
      const mirrorSyncQueue = app.get(getQueueToken('mirror-sync-queue'));

      createBullBoard({
        queues: [new BullMQAdapter(mirrorSyncQueue)],
        serverAdapter: expressAdapter,
      });

      const httpServer = app.getHttpAdapter().getInstance();
      httpServer.use(
        bullBoardBasePath,
        (req: Request, res: Response, next: NextFunction) => {
          const user = process.env.BULLBOARD_USER;
          const pass = process.env.BULLBOARD_PASS;

          if (!user || !pass) {
            return res.status(500).json({
              message:
                'Bull Board no configurado (BULLBOARD_USER/BULLBOARD_PASS)',
            });
          }

          const header = req.headers.authorization || '';
          if (!header.startsWith('Basic ')) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
            return res.status(401).send('Unauthorized');
          }

          const decoded = Buffer.from(
            header.slice('Basic '.length),
            'base64',
          ).toString('utf8');
          const idx = decoded.indexOf(':');
          const incomingUser = idx >= 0 ? decoded.slice(0, idx) : '';
          const incomingPass = idx >= 0 ? decoded.slice(idx + 1) : '';

          if (incomingUser !== user || incomingPass !== pass) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
            return res.status(401).send('Unauthorized');
          }

          return next();
        },
      );
      httpServer.use(bullBoardBasePath, expressAdapter.getRouter());
    } catch (e) {
      logger.warn(
        'Bull Board no se inicializó: No se encontró la cola mirror-sync-queue en el contexto. Revisa MIRROR_SYNC_ENABLED y configuración BullMQ.',
      );
    }
  }

  // Aplicar mitigaciones de seguridad XSS y Headers HTTP con Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
          connectSrc: [
            "'self'",
            'https://fcm.googleapis.com',
            'https://credito-sur-backend.onrender.com',
            'https://credito-sur-frontend.onrender.com',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
          ],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
    new SanitizePipe(),
  );

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://credito-sur-frontend.onrender.com',
      'https://creditos-del-sur.vercel.app',
    ],
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Créditos del Sur – API REST')
    .setDescription(
      'Sistema web para la gestión integral de créditos, préstamos y cobranzas de electrodomésticos, orientado a entornos empresariales. Soporta operación continua, control financiero riguroso, auditoría de transacciones y funcionamiento confiable en escenarios con conectividad limitada.',
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
      SWAGGER_JWT_AUTH,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.security = [{ [SWAGGER_JWT_AUTH]: [] }];

  SwaggerModule.setup('api-credisur', app, document, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      displayRequestDuration: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      tryItOutEnabled: true,
      syntaxHighlight: {
        activate: true,
        theme: 'tomorrow-night',
      },
    },
    customCss: `
      .swagger-ui {
        background: #f8fafc;
        color: #0f172a;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .swagger-ui .topbar {
        background: #0f3d2e;
        border-bottom: 1px solid #0b2f23;
      }
      .swagger-ui .topbar-wrapper img,
      .swagger-ui .topbar-wrapper .link,
      .swagger-ui .topbar .download-url-wrapper {
        display: none;
      }
      .swagger-ui .topbar-wrapper::before {
        content: "Creditos del Sur API";
        color: #ffffff;
        font-size: 18px;
        font-weight: 700;
      }
      .swagger-ui .wrapper {
        max-width: 1200px;
        padding: 24px;
      }
      .swagger-ui .info {
        margin: 24px 0;
      }
      .swagger-ui .info .title {
        color: #0f172a;
        font-size: 32px;
        font-weight: 800;
      }
      .swagger-ui .info .description p {
        color: #334155;
        font-size: 15px;
      }
      .swagger-ui .scheme-container,
      .swagger-ui .opblock,
      .swagger-ui .responses-wrapper,
      .swagger-ui .model-box {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        box-shadow: none;
      }
      .swagger-ui .scheme-container {
        padding: 16px 20px;
      }
      .swagger-ui .btn.authorize {
        background: #0f3d2e;
        border-color: #0f3d2e;
        color: #ffffff;
      }
      .swagger-ui .btn.authorize svg {
        fill: #ffffff;
      }
      .swagger-ui .btn.execute {
        background: #1d4ed8;
        border-color: #1d4ed8;
        color: #ffffff;
      }
      .swagger-ui .opblock-tag,
      .swagger-ui .opblock .opblock-summary-path,
      .swagger-ui .opblock .opblock-summary-description,
      .swagger-ui .parameter__name,
      .swagger-ui .response-col_status,
      .swagger-ui .response-col_description {
        color: #0f172a;
      }
      .swagger-ui textarea,
      .swagger-ui input[type="text"],
      .swagger-ui input[type="password"],
      .swagger-ui select {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #94a3b8;
        border-radius: 6px;
      }
      .swagger-ui pre,
      .swagger-ui .highlight-code {
        background: #111827 !important;
        color: #f8fafc !important;
        border-radius: 8px !important;
      }
      .swagger-ui .microlight {
        color: #f8fafc !important;
      }
      .swagger-ui table tbody tr td {
        color: #0f172a;
      }
    `,
    customSiteTitle: 'Créditos del Sur API',
    customfavIcon:
      'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2212%22 y=%2262%22 font-size=%2232%22 font-family=%22Arial%22 font-weight=%22700%22>CDS</text></svg>',
  });

  await app.listen(process.env.PORT ?? 3001);

  const url = await app.getUrl();
  logger.log(`Servidor ejecutándose en: ${url}`);
  logger.log(`Documentación Swagger en: ${url}/api-credisur`);
}

void bootstrap();
