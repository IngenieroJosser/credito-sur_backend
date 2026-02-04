import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  app.enableCors({
    origin: 'http://localhost:3000',
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
      'jwt-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Diseño ultra premium con efecto glassmorphism y minimalismo extremo
  const premiumCss = `
    /* ===== RESET Y BASE ===== */
    .swagger-ui * {
      box-sizing: border-box;
    }
    
    /* ===== FONDO PRINCIPAL ===== */
    .swagger-ui {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      min-height: 100vh;
    }
    
    /* ===== HEADER ULTRA PREMIUM ===== */
    .swagger-ui .topbar {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(0, 55, 135, 0.08);
      padding: 0;
      height: 80px;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 30px rgba(0, 55, 135, 0.05);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    
    .swagger-ui .topbar-wrapper {
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .swagger-ui .topbar-wrapper img {
      display: none;
    }
    
    .swagger-ui .topbar-wrapper .link {
      display: none;
    }
    
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
    
    /* Logo personalizado premium */
    .swagger-ui .topbar-wrapper::before {
      content: 'CRÉDITOS DEL SUR';
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #003787;
      text-transform: uppercase;
      position: relative;
    }
    
    .swagger-ui .topbar-wrapper::after {
      content: 'API Documentation';
      font-size: 12px;
      font-weight: 400;
      color: #64748b;
      letter-spacing: 2px;
      text-transform: uppercase;
      position: absolute;
      top: 50px;
      left: 40px;
    }
    
    /* ===== CONTENEDOR PRINCIPAL ===== */
    .swagger-ui .wrapper {
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px;
    }
    
    /* ===== PANEL DE INFORMACIÓN ===== */
    .swagger-ui .info {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      padding: 50px;
      margin: 30px 0 50px;
      border: 1px solid rgba(0, 55, 135, 0.08);
      box-shadow: 0 20px 60px rgba(0, 55, 135, 0.08);
      position: relative;
      overflow: hidden;
    }
    
    .swagger-ui .info::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, #003787 0%, #ff7300 100%);
    }
    
    .swagger-ui .info .title {
      color: #003787;
      font-size: 42px;
      font-weight: 900;
      margin-bottom: 15px;
      letter-spacing: -0.5px;
      line-height: 1.1;
      position: relative;
      display: inline-block;
    }
    
    .swagger-ui .info .title::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 0;
      width: 60px;
      height: 4px;
      background: linear-gradient(90deg, #ff7300 0%, #003787 100%);
      border-radius: 2px;
    }
    
    .swagger-ui .info .description {
      margin-top: 30px;
      padding-left: 25px;
      border-left: 3px solid rgba(0, 55, 135, 0.1);
    }
    
    .swagger-ui .info .description p {
      color: #475569;
      font-size: 17px;
      line-height: 1.8;
      margin-bottom: 20px;
      font-weight: 400;
    }
    
    /* ===== BOTÓN AUTHORIZE PREMIUM ===== */
    .swagger-ui .scheme-container {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      margin: 40px 0;
      padding: 25px 30px;
      border: 1px solid rgba(0, 55, 135, 0.08);
      box-shadow: 0 10px 40px rgba(0, 55, 135, 0.05);
    }
    
    .swagger-ui .auth-wrapper {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .swagger-ui .btn.authorize {
      background: linear-gradient(135deg, #003787 0%, #002a6e 100%);
      border: none;
      color: white;
      border-radius: 12px;
      padding: 14px 32px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.5px;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 8px 25px rgba(0, 55, 135, 0.2);
    }
    
    .swagger-ui .btn.authorize::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.6s;
    }
    
    .swagger-ui .btn.authorize:hover {
      background: linear-gradient(135deg, #ff7300 0%, #e56700 100%);
      transform: translateY(-3px);
      box-shadow: 0 15px 35px rgba(255, 115, 0, 0.3);
    }
    
    .swagger-ui .btn.authorize:hover::before {
      left: 100%;
    }
    
    .swagger-ui .btn.authorize svg {
      fill: white;
      margin-right: 10px;
      width: 20px;
      height: 20px;
    }
    
    /* ===== TAGS/CATEGORÍAS ===== */
    .swagger-ui .opblock-tag {
      color: #003787;
      font-size: 28px;
      font-weight: 800;
      padding: 30px 0 20px;
      border-bottom: 2px solid rgba(0, 55, 135, 0.08);
      margin-bottom: 30px;
      letter-spacing: -0.5px;
      position: relative;
      transition: all 0.3s ease;
    }
    
    .swagger-ui .opblock-tag:hover {
      color: #ff7300;
      border-bottom-color: #ff7300;
    }
    
    .swagger-ui .opblock-tag small {
      color: #64748b;
      font-size: 14px;
      font-weight: 500;
      margin-left: 15px;
      opacity: 0.7;
      letter-spacing: 0.5px;
    }
    
    /* ===== ENDPOINTS (OPBLOCKS) ===== */
    .swagger-ui .opblock {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(10px);
      border-radius: 18px;
      margin-bottom: 25px;
      border: 1px solid rgba(0, 55, 135, 0.08);
      box-shadow: 0 8px 30px rgba(0, 55, 135, 0.05);
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .swagger-ui .opblock:hover {
      transform: translateY(-5px);
      box-shadow: 0 20px 50px rgba(0, 55, 135, 0.1);
      border-color: rgba(0, 55, 135, 0.15);
    }
    
    .swagger-ui .opblock .opblock-summary {
      padding: 25px 30px;
      border: none;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    /* Colores por método HTTP */
    .swagger-ui .opblock.opblock-get {
      border-left: 6px solid #003787;
    }
    
    .swagger-ui .opblock.opblock-post {
      border-left: 6px solid #10b981;
    }
    
    .swagger-ui .opblock.opblock-put {
      border-left: 6px solid #f59e0b;
    }
    
    .swagger-ui .opblock.opblock-delete {
      border-left: 6px solid #ef4444;
    }
    
    /* BADGE MÉTODO HTTP */
    .swagger-ui .opblock .opblock-summary-method {
      min-width: 100px;
      padding: 12px 0;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      text-align: center;
      text-transform: uppercase;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      position: relative;
      overflow: hidden;
    }
    
    .swagger-ui .opblock.opblock-get .opblock-summary-method {
      background: linear-gradient(135deg, #003787 0%, #002a6e 100%);
      color: white;
    }
    
    .swagger-ui .opblock.opblock-post .opblock-summary-method {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    
    .swagger-ui .opblock.opblock-put .opblock-summary-method {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
    }
    
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
    }
    
    /* RUTA DEL ENDPOINT */
    .swagger-ui .opblock .opblock-summary-path {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      letter-spacing: -0.3px;
    }
    
    .swagger-ui .opblock .opblock-summary-path a {
      color: inherit;
      text-decoration: none;
    }
    
    .swagger-ui .opblock .opblock-summary-path a:hover {
      color: #ff7300;
    }
    
    .swagger-ui .opblock .opblock-summary-description {
      color: #64748b;
      font-size: 15px;
      margin-left: auto;
      font-weight: 500;
    }
    
    /* ===== CONTENIDO EXPANDIDO ===== */
    .swagger-ui .opblock .opblock-body {
      padding: 0 30px 30px;
    }
    
    .swagger-ui .opblock .opblock-section {
      background: rgba(248, 250, 252, 0.5);
      border-radius: 14px;
      padding: 25px;
      margin-top: 20px;
      border: 1px solid rgba(0, 55, 135, 0.05);
    }
    
    /* ===== TABS ===== */
    .swagger-ui .tab {
      border: none;
      margin: 30px 0;
      display: flex;
      gap: 10px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      padding: 8px;
      border-radius: 14px;
      border: 1px solid rgba(0, 55, 135, 0.08);
    }
    
    .swagger-ui .tab li {
      flex: 1;
      text-align: center;
      color: #64748b;
      border: none;
      padding: 15px 25px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 15px;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .swagger-ui .tab li:hover {
      color: #003787;
      background: rgba(0, 55, 135, 0.05);
    }
    
    .swagger-ui .tab li.active {
      color: white;
      background: linear-gradient(135deg, #003787 0%, #002a6e 100%);
      box-shadow: 0 4px 15px rgba(0, 55, 135, 0.2);
    }
    
    /* ===== PARÁMETROS ===== */
    .swagger-ui .parameters-container {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      border-radius: 14px;
      padding: 25px;
      margin: 20px 0;
      border: 1px solid rgba(0, 55, 135, 0.08);
    }
    
    .swagger-ui .parameter__name {
      color: #003787;
      font-weight: 700;
      font-size: 15px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
    
    .swagger-ui .parameter__type {
      color: #ff7300;
      font-weight: 600;
      font-size: 13px;
      background: rgba(255, 115, 0, 0.1);
      padding: 3px 10px;
      border-radius: 20px;
      margin-left: 10px;
    }
    
    .swagger-ui .parameter__in {
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      background: rgba(100, 116, 139, 0.1);
      padding: 3px 10px;
      border-radius: 20px;
      margin-left: 10px;
    }
    
    /* ===== INPUTS Y TEXTAREAS ===== */
    .swagger-ui input[type="text"],
    .swagger-ui input[type="password"],
    .swagger-ui input[type="email"],
    .swagger-ui input[type="number"],
    .swagger-ui textarea,
    .swagger-ui select {
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid rgba(0, 55, 135, 0.1);
      border-radius: 12px;
      padding: 14px 20px;
      font-size: 15px;
      font-family: 'Inter', sans-serif;
      color: #1e293b;
      transition: all 0.3s ease;
      width: 100%;
      box-shadow: 0 2px 8px rgba(0, 55, 135, 0.02);
    }
    
    .swagger-ui input[type="text"]:focus,
    .swagger-ui input[type="password"]:focus,
    .swagger-ui input[type="email"]:focus,
    .swagger-ui input[type="number"]:focus,
    .swagger-ui textarea:focus,
    .swagger-ui select:focus {
      outline: none;
      border-color: #003787;
      box-shadow: 0 0 0 4px rgba(0, 55, 135, 0.1);
      background: white;
    }
    
    /* ===== BOTÓN EXECUTE ===== */
    .swagger-ui .btn.execute {
      background: linear-gradient(135deg, #003787 0%, #002a6e 100%);
      border: none;
      color: white;
      border-radius: 12px;
      padding: 16px 32px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 25px rgba(0, 55, 135, 0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 30px auto;
    }
    
    .swagger-ui .btn.execute:hover {
      background: linear-gradient(135deg, #ff7300 0%, #e56700 100%);
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 15px 35px rgba(255, 115, 0, 0.3);
    }
    
    .swagger-ui .btn.execute:active {
      transform: translateY(-1px) scale(1.01);
    }
    
    /* ===== RESPONSES ===== */
    .swagger-ui .responses-wrapper {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      border-radius: 14px;
      padding: 25px;
      margin: 20px 0;
      border: 1px solid rgba(0, 55, 135, 0.08);
    }
    
    .swagger-ui .response-col_status {
      color: #003787;
      font-weight: 700;
      font-size: 15px;
      min-width: 120px;
    }
    
    .swagger-ui .response-col_description {
      color: #475569;
      font-size: 15px;
      line-height: 1.6;
    }
    
    /* ===== MODELOS ===== */
    .swagger-ui .model-box {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      border-radius: 14px;
      padding: 25px;
      margin: 20px 0;
      border: 1px solid rgba(0, 55, 135, 0.08);
      position: relative;
    }
    
    .swagger-ui .model-box::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(to bottom, #003787 0%, #ff7300 100%);
      border-radius: 4px 0 0 4px;
    }
    
    .swagger-ui .model-title {
      color: #003787;
      font-weight: 800;
      font-size: 18px;
      margin-bottom: 15px;
      letter-spacing: -0.3px;
    }
    
    .swagger-ui .model {
      color: #475569;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 14px;
    }
    
    /* ===== SCHEMA ===== */
    .swagger-ui .scheme-container {
      position: relative;
    }
    
    /* ===== SCROLLBAR PERSONALIZADO ===== */
    .swagger-ui ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    .swagger-ui ::-webkit-scrollbar-track {
      background: rgba(0, 55, 135, 0.05);
      border-radius: 10px;
    }
    
    .swagger-ui ::-webkit-scrollbar-thumb {
      background: linear-gradient(135deg, #003787 0%, #ff7300 100%);
      border-radius: 10px;
    }
    
    .swagger-ui ::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(135deg, #002a6e 0%, #e56700 100%);
    }
    
    /* ===== ANIMACIONES ===== */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .swagger-ui .opblock {
      animation: fadeInUp 0.6s ease-out;
    }
    
    /* ===== FOOTER ===== */
    .swagger-ui .footer {
      display: none;
    }
    
    /* ===== LOADER PERSONALIZADO ===== */
    .swagger-ui .loading-container .loading::after {
      content: 'Cargando...';
      color: #003787;
      font-weight: 600;
      font-size: 16px;
    }
    
    /* ===== ESTADOS DE ERROR ===== */
    .swagger-ui .error {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
      border: 1px solid #fca5a5;
      color: #dc2626;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      font-weight: 500;
    }
    
    /* ===== MEDIA QUERIES ===== */
    @media (max-width: 768px) {
      .swagger-ui .wrapper {
        padding: 20px;
      }
      
      .swagger-ui .info {
        padding: 30px;
      }
      
      .swagger-ui .info .title {
        font-size: 32px;
      }
      
      .swagger-ui .opblock .opblock-summary {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }
      
      .swagger-ui .opblock .opblock-summary-description {
        margin-left: 0;
      }
      
      .swagger-ui .tab {
        flex-direction: column;
      }
    }
    
    /* ===== EFECTO GLASSMORPHISM EXTRA ===== */
    .swagger-ui .info,
    .swagger-ui .scheme-container,
    .swagger-ui .opblock,
    .swagger-ui .parameters-container,
    .swagger-ui .responses-wrapper,
    .swagger-ui .model-box {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 
        0 8px 32px rgba(0, 55, 135, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }
    
    /* ===== BADGE DE VERSIÓN ===== */
    .swagger-ui .info .version-stamp {
      background: linear-gradient(135deg, #003787 0%, #ff7300 100%);
      color: white;
      padding: 6px 20px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      position: absolute;
      top: 30px;
      right: 30px;
      box-shadow: 0 4px 15px rgba(0, 55, 135, 0.2);
    }
    
    /* ===== ESTILOS PARA CÓDIGO ===== */
    .swagger-ui pre {
      background: rgba(0, 55, 135, 0.03) !important;
      border-radius: 12px !important;
      border: 1px solid rgba(0, 55, 135, 0.08) !important;
      padding: 25px !important;
      font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
      font-size: 14px !important;
      line-height: 1.6 !important;
    }
    
    .swagger-ui code {
      background: rgba(0, 55, 135, 0.1);
      color: #003787;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      font-weight: 500;
    }
    
    /* ===== SEPARADORES ELEGANTES ===== */
    .swagger-ui .opblock-tag-section {
      margin-bottom: 50px;
      position: relative;
    }
    
    .swagger-ui .opblock-tag-section::after {
      content: '';
      position: absolute;
      bottom: -25px;
      left: 0;
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, 
        transparent 0%, 
        rgba(0, 55, 135, 0.2) 50%, 
        transparent 100%);
    }
    
    /* ===== BOTÓN "TRY IT OUT" ===== */
    .swagger-ui .try-out {
      position: absolute;
      right: 30px;
      top: 50%;
      transform: translateY(-50%);
    }
    
    .swagger-ui .try-out .btn {
      background: linear-gradient(135deg, #003787 0%, #002a6e 100%);
      border: none;
      color: white;
      border-radius: 10px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .swagger-ui .try-out .btn:hover {
      background: linear-gradient(135deg, #ff7300 0%, #e56700 100%);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(255, 115, 0, 0.3);
    }
    
    /* ===== TOOLTIPS ===== */
    .swagger-ui .parameter__extension,
    .swagger-ui .parameter__extension + .parameter__enum {
      color: #64748b;
      font-size: 12px;
      font-style: italic;
      margin-top: 5px;
      opacity: 0.8;
    }
    
    /* ===== ESTILOS PARA REQUIRED ===== */
    .swagger-ui .parameter__required {
      color: #ff7300;
      font-weight: 700;
      margin-left: 5px;
    }
    
    /* ===== EFECTO DE ILUMINACIÓN ===== */
    .swagger-ui .info .title span {
      position: relative;
      display: inline-block;
    }
    
    .swagger-ui .info .title span::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, 
        transparent 0%, 
        rgba(255, 115, 0, 0.5) 50%, 
        transparent 100%);
      animation: glow 3s ease-in-out infinite;
    }
    
    @keyframes glow {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    
    /* ===== ESTILOS FINALES DE PULIDO ===== */
    .swagger-ui .btn {
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
    }
    
    .swagger-ui select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23003787' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 15px center;
      background-size: 16px;
      padding-right: 45px;
    }
    
    /* ===== MARCA DE AGUA DISCRETA ===== */
    .swagger-ui::after {
      content: 'Créditos del Sur © 2024';
      position: fixed;
      bottom: 20px;
      right: 20px;
      color: rgba(0, 55, 135, 0.3);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1px;
      z-index: 1;
      pointer-events: none;
    }
  `;

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
        theme: 'tomorrow-night'
      },
    },
    customCss: premiumCss,
    customSiteTitle: 'Créditos del Sur API - Premium',
    customfavIcon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>',
  });

  await app.listen(process.env.PORT ?? 3001);
  
  console.log(`\n✨  Aplicación ejecutándose en: ${await app.getUrl()}`);
  console.log(`📚  Documentación Swagger disponible en: ${await app.getUrl()}/api-credisur`);
  console.log(`🎨  Tema ultra premium activado\n`);
  console.log(`   ┌─────────────────────────────────────────────┐`);
  console.log(`   │  Paleta de colores premium activada:        │`);
  console.log(`   │  • Azul corporativo: #003787                │`);
  console.log(`   │  • Naranja acento: #ff7300                  │`);
  console.log(`   │  • Blanco puro: #ffffff                     │`);
  console.log(`   └─────────────────────────────────────────────┘\n`);
}

void bootstrap();
