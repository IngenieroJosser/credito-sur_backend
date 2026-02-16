<p align="center">
  <img src="android-chrome-512x512.png" alt="Créditos del Sur - Logo oficial" width="140">
</p>

# Créditos del Sur — Backend API REST

El backend de **Créditos del Sur** es una API REST desarrollada con **NestJS**, diseñada para soportar la gestión integral de créditos, préstamos y cobranzas de electrodomésticos en entornos empresariales de alta exigencia operativa.

Esta API constituye el núcleo transaccional del sistema, centralizando la lógica de negocio, la seguridad, la persistencia de datos y los flujos críticos relacionados con clientes, créditos, pagos, rutas de cobranza, aprobaciones y reportes financieros.

---

## Responsabilidades del Backend

- Exponer una **API REST segura y documentada** para consumo del frontend (PWA).
- Implementar **lógica de negocio financiera** con validaciones estrictas.
- Implementar algoritmos de **cálculo de riesgo** y scoring crediticio en tiempo real.
- Gestionar **autenticación y autorización** basada en JWT, roles y permisos.
- Garantizar **integridad transaccional** en operaciones críticas (pagos, cuotas, mora).
- Registrar **auditoría inmutable** de acciones y cambios relevantes.
- Administrar **respaldos locales** y sincronización hacia infraestructura en la nube.
- Operar de forma eficiente en **entornos LAN** con posibilidad de acceso remoto.
- Gestionar **notificaciones push** en tiempo real para eventos críticos del sistema.

---

## Arquitectura

- **Framework:** NestJS (Node.js + TypeScript)
- **Estilo:** API-first, arquitectura modular
- **Base de datos:** PostgreSQL (Prisma ORM)
- **Autenticación:** JWT + Argon2
- **Documentación:** Swagger / OpenAPI
- **Logs:** Winston
- **Escalabilidad:** Preparado para operación distribuida y sincronización futura

La arquitectura está diseñada para crecer de forma progresiva sin comprometer estabilidad, permitiendo incorporar funcionalidades avanzadas como operación offline, colas de sincronización y replicación controlada de datos.

---

## Seguridad

- Hashing de credenciales con **Argon2**
- Autenticación basada en **JWT**
- Control de acceso por **roles y permisos**
- Protección de endpoints críticos
- Registro de eventos y trazabilidad de acciones

---

## Estructura del Proyecto

```txt
├── src/
│   ├── app.module.ts
│   ├── main.ts
│
│   ├── config/                # Configuración global
│   │   ├── env.config.ts
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│
│   ├── common/                # Reutilizable y transversal
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── pipes/
│   │   └── constants/
│
│   ├── auth/                  # Autenticación y autorización
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── strategies/
│   │   └── dto/
│
│   ├── users/
│   ├── roles/
│   ├── permissions/
│
│   ├── clients/               # Clientes
│   ├── loans/                 # Préstamos / créditos
│   ├── payments/              # Pagos y cuotas
│   ├── routes/                # Rutas de cobradores
│   ├── approvals/             # Bandeja de aprobaciones
│   ├── inventory/             # Artículos / precios
│   ├── accounting/            # Caja, gastos, contabilidad
│   ├── reports/               # Reportes financieros
│   ├── audit/                 # Auditoría inmutable
│   ├── backup/                # Backups locales y VPS
│
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│
│   └── shared/
│       ├── enums/
│       ├── interfaces/
│       └── utils/
│
├── test/
├── prisma/
├── .env
├── package.json
└── tsconfig.json

```

---

## Notificaciones Push

El backend implementa un sistema completo de notificaciones push para alertar a los usuarios sobre eventos críticos en tiempo real.

### Endpoints Disponibles

#### `POST /api-credisur/push/subscribe`
Registrar una nueva suscripción push del usuario autenticado.

**Request:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BKxN...",
    "auth": "5I2T..."
  }
}
```

#### `DELETE /api-credisur/push/unsubscribe`
Eliminar una suscripción push existente.

#### `GET /api-credisur/push/subscriptions`
Obtener todas las suscripciones activas del usuario.

#### `POST /api-credisur/push/test`
Enviar una notificación de prueba al usuario autenticado.

### Tipos de Notificaciones

- **PAGO:** Notificaciones de pagos recibidos
- **MORA:** Alertas de cuentas en mora
- **CLIENTE:** Eventos relacionados con clientes
- **PRESTAMO:** Actualizaciones de préstamos
- **SOLICITUD:** Solicitudes pendientes de aprobación
- **SISTEMA:** Notificaciones generales del sistema

### Configuración Requerida

```env
# Variables de entorno (.env)
VAPID_PUBLIC_KEY=BKxN...
VAPID_PRIVATE_KEY=5I2T...
VAPID_SUBJECT=mailto:admin@creditosur.com
```

### Modelo de Datos

```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([endpoint])
  @@map("push_subscriptions")
}
```

### Integración con Eventos

El sistema permite enviar notificaciones automáticamente cuando ocurren eventos importantes:

```typescript
// Ejemplo: Notificar al recibir un pago
await pushService.sendNotification(userId, {
  tipo: 'PAGO',
  title: 'Pago Recibido',
  body: `Se registró un pago de ${formatCurrency(monto)}`,
  url: '/pagos/historial',
  data: { pagoId, monto }
});
```

### Documentación Completa

Para implementación detallada, ver documentación en el repositorio del frontend:
`credito-sur_frontend/docs/PUSH_NOTIFICATIONS_BACKEND.md`

---
