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
