import 'dotenv/config';
import { PrismaClient, RolUsuario, EstadoUsuario } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

//  FUNCIONES DE CREACIÓN
async function crearSuperadministradorInicial() {
  const correo = 'erickmanuel238@gmail.com';

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { correo },
  });

  if (usuarioExistente) {
    console.log(`[SEED] Superadministrador ya existe - manteniendo contraseña actual`);
    await prisma.usuario.update({
      where: { correo },
      data: {
        nombres: 'Super',
        apellidos: 'Administrador',
        // NO actualizar hashContrasena para mantener la contraseña existente
        rol: RolUsuario.SUPER_ADMINISTRADOR,
        estado: EstadoUsuario.ACTIVO,
        nombreUsuario: 'superadmin',
      },
    });
    console.log(`[SEED] Superadministrador actualizado - contraseña sin cambios`);
    return usuarioExistente;
  }

  const hashContrasena = await argon2.hash('SuperAdmin123!');
  const superadministrador = await prisma.usuario.create({
    data: {
      nombreUsuario: 'superadmin',
      correo,
      hashContrasena,
      nombres: 'Super',
      apellidos: 'Administrador',
      rol: RolUsuario.SUPER_ADMINISTRADOR,
      estado: EstadoUsuario.ACTIVO,
    },
  });
  console.log(`[SEED] Superadministrador creado con id: ${superadministrador.id}`);

  return superadministrador;
}

async function crearAdministradorInicial() {
  const correo = 'admin.erick@gmail.com';

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { correo },
  });

  if (usuarioExistente) {
    console.log(`[SEED] Administrador ya existe - manteniendo contraseña actual`);
    const administradorActualizado = await prisma.usuario.update({
      where: { correo },
      data: {
        nombres: 'Admin',
        apellidos: 'General',
        // NO actualizar hashContrasena para mantener la contraseña existente
        rol: RolUsuario.ADMIN,
        estado: EstadoUsuario.ACTIVO,
        nombreUsuario: 'admin',
      },
    });
    console.log(`[SEED] Administrador actualizado - contraseña sin cambios`);
    return administradorActualizado;
  }

  const hashContrasena = await argon2.hash('Admin123!');
  const administrador = await prisma.usuario.create({
    data: {
      nombreUsuario: 'admin',
      correo,
      hashContrasena,
      nombres: 'Admin',
      apellidos: 'General',
      rol: RolUsuario.ADMIN,
      estado: EstadoUsuario.ACTIVO,
    },
  });
  console.log(`[SEED] Administrador creado con id: ${administrador.id}`);

  return administrador;
}

async function crearUsuarioPorRol(
  correo: string,
  nombres: string,
  apellidos: string,
  rol: RolUsuario,
  password?: string,
) {
  const existente = await prisma.usuario.findUnique({
    where: { correo },
  });

  const hashContrasena = await argon2.hash(password ?? `${rol}_1234`);
  
  // Generar nombreUsuario: primera letra nombre + primera letra segundo nombre (si existe) + primer apellido
  const nombresParts = nombres.split(' ');
  const apellidosParts = apellidos.split(' ');
  const nombreUsuario = (
    nombresParts[0].charAt(0) +
    (nombresParts[1] ? nombresParts[1].charAt(0) : '') +
    apellidosParts[0]
  ).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (existente) {
    console.log(`[SEED] Usuario ${rol} ya existe (${correo}) - manteniendo contraseña actual`);
    const usuarioActualizado = await prisma.usuario.update({
      where: { correo },
      data: {
        nombreUsuario,
        nombres,
        apellidos,
        rol,
        estado: EstadoUsuario.ACTIVO,
        // NO actualizar hashContrasena para mantener la contraseña existente
      },
    });
    console.log(`[SEED] Usuario ${rol} actualizado (${correo}) - contraseña sin cambios`);

    return usuarioActualizado;
  }

  const usuario = await prisma.usuario.create({
    data: {
      nombreUsuario,
      correo,
      hashContrasena,
      nombres,
      apellidos,
      rol,
      estado: EstadoUsuario.ACTIVO,
    },
  });
  console.log(`[SEED] Usuario ${rol} creado (${correo})`);

  return usuario;
}

//  SEED PRINCIPAL
async function main() {
  console.log('Iniciando seed de usuarios...');

  await crearSuperadministradorInicial();
  await crearAdministradorInicial();

  await crearUsuarioPorRol(
    'coordinador@credisur.com',
    'Coordinador',
    'General',
    RolUsuario.COORDINADOR,
  );

  await crearUsuarioPorRol(
    'supervisor@credisur.com',
    'Supervisor',
    'Operativo',
    RolUsuario.SUPERVISOR,
    'Supervisor123!',
  );

  await crearUsuarioPorRol(
    'cobrador@credisur.com',
    'Cobrador',
    'Principal',
    RolUsuario.COBRADOR,
    'Cobrador123!',
  );

  await crearUsuarioPorRol(
    'ventas@credisur.com',
    'Vendedor',
    'Principal',
    RolUsuario.PUNTO_DE_VENTA,
    'Ventas123!',
  );

  await crearUsuarioPorRol(
    'contador@credisur.com',
    'Contador',
    'General',
    RolUsuario.CONTADOR,
    'Contador123!',
  );

  console.log('Iniciando seed de Roles y Permisos...');
  await seedRolesYPermisos();

  console.log('Seed de usuarios finalizado correctamente');
}

async function seedRolesYPermisos() {
  // 1. Definir Permisos alineados con el Frontend (permisosPorRol)
  // La 'accion' debe coincidir con el ID del módulo en el frontend
  const permisos = [
    // General
    { modulo: 'General', accion: 'dashboard', nombre: 'Dashboard', descripcion: 'Panel Principal', icono: 'LayoutDashboard', ruta: '/admin', orden: 0, esNavegable: true },
    
    // Operaciones
    { modulo: 'Operaciones', accion: 'gestion-creditos', nombre: 'Cr\u00e9ditos', descripcion: 'Gesti\u00f3n de cr\u00e9ditos', icono: 'CreditCard', ruta: '/admin/creditos', orden: 10, esNavegable: true },
    { modulo: 'Operaciones', accion: 'rutas', nombre: 'Rutas', descripcion: 'Gesti\u00f3n de rutas', icono: 'Route', ruta: '/admin/rutas', orden: 11, esNavegable: true },

    // Gesti\u00f3n Clientes
    { modulo: 'Gesti\u00f3n Clientes', accion: 'clientes', nombre: 'Clientes', descripcion: 'Directorio de clientes', icono: 'Users', ruta: '/admin/clientes', orden: 20, esNavegable: true },
    { modulo: 'Gesti\u00f3n Clientes', accion: 'cuentas-mora', nombre: 'Cuentas en mora', descripcion: 'Gesti\u00f3n de mora', icono: 'AlertCircle', ruta: '/cuentas-mora', orden: 21, esNavegable: true },
    { modulo: 'Gesti\u00f3n Clientes', accion: 'cuentas-vencidas', nombre: 'Cuentas vencidas', descripcion: 'Cartera castigada', icono: 'Archive', ruta: '/cuentas-vencidas', orden: 22, esNavegable: true },
    { modulo: 'Gesti\u00f3n Clientes', accion: 'archivados', nombre: 'Archivados', descripcion: 'Hist\u00f3ricos', icono: 'Archive', ruta: '/admin/archivados', orden: 23, esNavegable: true },

    // Finanzas
    { modulo: 'Finanzas', accion: 'contable', nombre: 'Movimientos', descripcion: 'Contabilidad', icono: 'Calculator', ruta: '/contable', orden: 30, esNavegable: true },
    { modulo: 'Finanzas', accion: 'arqueo', nombre: 'Arqueo de Caja', descripcion: 'Cierre de caja', icono: 'Landmark', ruta: '/contable/cierre-caja', orden: 31, esNavegable: true },
    { modulo: 'Finanzas', accion: 'articulos', nombre: 'Art\u00edculos (Inventario)', descripcion: 'Inventario', icono: 'Package', ruta: '/articulos', orden: 32, esNavegable: true },
    { modulo: 'Finanzas', accion: 'reportes-financieros', nombre: 'Reportes Financieros', descripcion: 'Balances', icono: 'BarChart3', ruta: '/reportes/financieros', orden: 33, esNavegable: true },

    // Administraci\u00f3n
    { modulo: 'Administraci\u00f3n', accion: 'usuarios', nombre: 'Usuarios', descripcion: 'Gesti\u00f3n de usuarios', icono: 'User', ruta: '/admin/users', orden: 40, esNavegable: true },
    { modulo: 'Administraci\u00f3n', accion: 'auditoria', nombre: 'Auditor\u00eda', descripcion: 'Logs del sistema', icono: 'FileText', ruta: '/admin/auditoria', orden: 41, esNavegable: true },

    // Sistema
    { modulo: 'Sistema', accion: 'configuracion', nombre: 'Configuraci\u00f3n', descripcion: 'Ajustes globales', icono: 'Settings', ruta: '/admin/sistema/configuracion', orden: 50, esNavegable: true },
    { modulo: 'Sistema', accion: 'sincronizacion', nombre: 'Sincronizaci\u00f3n', descripcion: 'Estado de sync', icono: 'RefreshCw', ruta: '/admin/sistema/sincronizacion', orden: 51, esNavegable: true },
    { modulo: 'Sistema', accion: 'backups', nombre: 'Backups', descripcion: 'Copias de seguridad', icono: 'HardDrive', ruta: '/admin/sistema/backups', orden: 52, esNavegable: true },

    // Reportes
    { modulo: 'Reportes', accion: 'reportes-operativos', nombre: 'Reportes Operativos', descripcion: 'M\u00e9tricas', icono: 'ClipboardList', ruta: '/admin/reportes/operativos', orden: 60, esNavegable: true },
    
    // Cobranza (App/Frontend specific)
    { modulo: 'Cobranza', accion: 'prestamos-dinero', nombre: 'Solicitar Cr\u00e9dito', descripcion: 'Solicitudes', icono: 'CreditCard', ruta: '/cobranzas/prestamos/nuevo', orden: 70, esNavegable: true },
    { modulo: 'Cobranza', accion: 'notificaciones', nombre: 'Notificaciones', descripcion: 'Alertas', icono: 'Bell', ruta: '/cobranzas/notificaciones', orden: 71, esNavegable: true },

    // Cr\u00e9ditos Art\u00edculos
    { modulo: 'Supervisi\u00f3n', accion: 'creditos-articulos', nombre: 'Cr\u00e9ditos Art\u00edculos', descripcion: 'Cr\u00e9ditos de art\u00edculos', icono: 'ShoppingBag', ruta: '/creditos-articulos', orden: 15, esNavegable: true },

    // Solicitudes
    { modulo: 'Cobranza', accion: 'solicitudes', nombre: 'Solicitudes', descripcion: 'Solicitudes pendientes', icono: 'ClipboardList', ruta: '/cobranzas/solicitudes', orden: 72, esNavegable: true },
  ];

  // Upsert Permisos
  for (const p of permisos) {
    await prisma.permiso.upsert({
      where: { modulo_accion: { modulo: p.modulo, accion: p.accion } },
      update: p,
      create: p,
    });
  }
  console.log('Permisos sincronizados.');

  // 2. Definir Roles Base con permisos mapeados
  const roles = [
    {
      nombre: 'SUPER_ADMINISTRADOR',
      descripcion: 'Control total del sistema',
      esSistema: true,
      rutaDefault: '/admin',
      permisos: ['all'] 
    },
    {
      nombre: 'ADMIN',
      descripcion: 'Administrador General',
      esSistema: true,
      rutaDefault: '/admin',
      permisos: [
        'dashboard',
        'gestion-creditos', 'rutas',
        'clientes', 'cuentas-mora', 'cuentas-vencidas', 'archivados',
        'contable', 'arqueo', 'articulos', 'reportes-financieros',
        'auditoria',
        'reportes-operativos'
      ]
    },
    {
      nombre: 'COORDINADOR',
      descripcion: 'Gesti\u00f3n operativa',
      esSistema: true,
      rutaDefault: '/coordinador',
      permisos: [
        'dashboard',
        'gestion-creditos', 'rutas',
        'clientes', 'cuentas-mora', 'cuentas-vencidas',
        'articulos',
        'reportes-operativos'
      ]
    },
    {
      nombre: 'SUPERVISOR',
      descripcion: 'Supervisi\u00f3n de campo',
      esSistema: true,
      rutaDefault: '/supervisor',
      permisos: [
        'dashboard',
        'rutas',
        'clientes', 'cuentas-mora',
        'creditos-articulos',
        'reportes-operativos'
      ]
    },
    {
      nombre: 'COBRADOR',
      descripcion: 'Operaciones de campo',
      esSistema: true,
      rutaDefault: '/cobranzas',
      permisos: [
        'dashboard',
        'clientes',
        'prestamos-dinero', 'notificaciones', 'solicitudes'
      ]
    },
    {
      nombre: 'CONTADOR',
      descripcion: 'Gesti\u00f3n financiera',
      esSistema: true,
      rutaDefault: '/contable',
      permisos: [
        'dashboard',
        'cuentas-mora', 'cuentas-vencidas',
        'contable', 'arqueo', 'articulos', 'reportes-financieros'
      ]
    },
    {
      nombre: 'PUNTO_DE_VENTA',
      descripcion: 'Ventas de artículos (crédito y contado)',
      esSistema: true,
      rutaDefault: '/punto-de-venta',
      permisos: [
        'dashboard',
        'creditos-articulos',
        'articulos',
        'clientes'
      ]
    }
  ];

  // Upsert Roles y Asignar Permisos
  const allPermisos = await prisma.permiso.findMany();

  for (const r of roles) {
    const rol = await prisma.rol.upsert({
      where: { nombre: r.nombre },
      update: { descripcion: r.descripcion, esSistema: r.esSistema, rutaDefault: r.rutaDefault },
      create: { nombre: r.nombre, descripcion: r.descripcion, esSistema: r.esSistema, rutaDefault: r.rutaDefault },
    });

    let permisosIds: string[] = [];
    if (r.permisos.includes('all')) {
      permisosIds = allPermisos.map(p => p.id);
    } else {
      permisosIds = allPermisos
        .filter(p => r.permisos.includes(p.accion))
        .map(p => p.id);
    }

    // Limpiar permisos existentes
    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } });

    // Asignar nuevos
    if (permisosIds.length > 0) {
      await prisma.rolPermiso.createMany({
        data: permisosIds.map(pid => ({ rolId: rol.id, permisoId: pid }))
      });
    }

    // VINCULAR USUARIOS CON ROLES DINÁMICOS
    const usuariosConRol = await prisma.usuario.findMany({
      where: { rol: r.nombre as RolUsuario }
    });

    for (const usuario of usuariosConRol) {
      await prisma.asignacionRolUsuario.upsert({
        where: {
          usuarioId_rolId: {
            usuarioId: usuario.id,
            rolId: rol.id
          }
        },
        create: {
          usuarioId: usuario.id,
          rolId: rol.id
        },
        update: {}
      });
    }
  }
  console.log('Roles y permisos asignados y vinculados a usuarios.');
}

//  EJECUCIÓN

main()
  .catch((error) => {
    console.error('Error ejecutando el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });