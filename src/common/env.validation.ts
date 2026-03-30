/**
 * ============================================================
 * VALIDACION DE VARIABLES DE ENTORNO — Arranque Seguro
 * ============================================================
 *
 * Este módulo valida que todas las variables de entorno críticas
 * existan y tengan un formato válido ANTES de que la aplicación
 * intente usarlas.
 *
 * Si alguna variable falta, el servidor falla inmediatamente con
 * un mensaje claro, en lugar de fallar silenciosamente en runtime.
 *
 * Uso: llamar `validateEnv()` al inicio de `main.ts`.
 */

import { Logger } from '@nestjs/common';

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  validatorMessage?: string;
}

const logger = new Logger('EnvValidation');

const ENV_VARS: EnvVar[] = [
  // --- Críticas: sin estas el sistema no funciona ---
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'URL de conexión a la base de datos PostgreSQL',
    validator: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    validatorMessage: 'Debe comenzar con postgresql:// o postgres://',
  },
  {
    key: 'JWT_SECRET',
    required: true,
    description: 'Clave secreta para firmar tokens JWT',
    validator: (v) => v.length >= 32,
    validatorMessage: 'Debe tener al menos 32 caracteres para ser segura',
  },

  // --- Importantes: funcionalidades degradadas sin ellas ---
  {
    key: 'SMTP_HOST',
    required: false,
    description: 'Host del servidor SMTP (requerido para recuperación de contraseña)',
  },
  {
    key: 'SMTP_USER',
    required: false,
    description: 'Usuario SMTP para autenticación',
  },
  {
    key: 'SMTP_PASS',
    required: false,
    description: 'Contraseña SMTP para autenticación',
  },

  // --- Configuración: tienen defaults razonables ---
  {
    key: 'PORT',
    required: false,
    description: 'Puerto del servidor HTTP (default: 3001)',
    validator: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
    validatorMessage: 'Debe ser un número de puerto válido',
  },
  {
    key: 'REDIS_PORT',
    required: false,
    description: 'Puerto de Redis (default: 6379)',
    validator: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
    validatorMessage: 'Debe ser un número de puerto válido',
  },
];

export function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    const redisHost = process.env.REDIS_HOST;
    const redisPassword = process.env.REDIS_PASSWORD;

    if (!redisHost || redisHost.trim() === '') {
      errors.push(
        '❌ FALTA VARIABLE CRÍTICA: REDIS_HOST\n   → Host de Redis requerido en producción (BullMQ/colas)'
      );
    }

    if (!redisPassword || redisPassword.trim() === '') {
      errors.push(
        '❌ FALTA VARIABLE CRÍTICA: REDIS_PASSWORD\n   → Password/Token de Redis requerido en producción (BullMQ/colas)'
      );
    }
  }

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];

    if (!value || value.trim() === '') {
      if (envVar.required) {
        errors.push(
          `❌ FALTA VARIABLE CRÍTICA: ${envVar.key}\n   → ${envVar.description}`,
        );
      } else {
        warnings.push(
          `⚠️  Variable opcional no configurada: ${envVar.key} — ${envVar.description}`,
        );
      }
      continue;
    }

    // Ejecutar validador de formato si existe
    if (envVar.validator && !envVar.validator(value)) {
      const msg = `❌ VARIABLE INVÁLIDA: ${envVar.key} — ${envVar.validatorMessage}`;
      if (envVar.required) {
        errors.push(msg);
      } else {
        warnings.push(msg.replace('❌', '⚠️'));
      }
    }
  }

  // Mostrar advertencias de variables opcionales
  if (warnings.length > 0) {
    logger.warn('─────────────────────────────────────────────');
    logger.warn('Variables opcionales no configuradas:');
    warnings.forEach((w) => logger.warn(w));
    logger.warn('─────────────────────────────────────────────');
  }

  // Si hay errores en variables críticas, terminar el proceso
  if (errors.length > 0) {
    logger.error('═════════════════════════════════════════════');
    logger.error('FALLO EN VALIDACIÓN DE VARIABLES DE ENTORNO');
    logger.error('El servidor no puede iniciar con la configuración actual.');
    logger.error('─────────────────────────────────────────────');
    errors.forEach((e) => logger.error(e));
    logger.error('═════════════════════════════════════════════');
    logger.error('Agrega las variables faltantes en Render → Environment y reinicia el servicio.');
    process.exit(1);
  }

  logger.log('✅ Variables de entorno validadas correctamente');
}
