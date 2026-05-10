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
  const correo = 'superadmin@creditosur.com';

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { correo },
  });

  if (usuarioExistente) {
    console.log(`[SEED] Superadministrador ya existe`);
    return usuarioExistente;
  }

  const hashContrasena = await argon2.hash('SuperAdmin123!');
  const superadministrador = await prisma.usuario.create({
    data: {
      correo,
      hashContrasena,
      nombres: 'Super',
      apellidos: 'Administrador',
      rol: RolUsuario.SUPER_ADMINISTRADOR,
      estado: EstadoUsuario.ACTIVO,
    },
  });
  console.log(
    `[SEED] Superadministrador creado con id: ${superadministrador.id}`,
  );

  return superadministrador;
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

  if (existente) {
    console.log(`[SEED] Usuario ${rol} ya existe (${correo})`);
    const usuarioActualizado = await prisma.usuario.update({
      where: { correo },
      data: {
        nombres,
        apellidos,
        rol,
        estado: EstadoUsuario.ACTIVO,
        hashContrasena,
      },
    });
    console.log(`[SEED] Usuario ${rol} actualizado (${correo})`);

    return usuarioActualizado;
  }

  const usuario = await prisma.usuario.create({
    data: {
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

async function crearCatalogoContable() {
  console.log('[SEED] Iniciando seed del cat\u00e1logo contable...');

  // Usamos literales directos en lugar de enums importados
  // para evitar problemas de cach\u00e9 de tipos de Prisma en ts-node
  const accounts = [
    // 1. ACTIVOS
    { code: '1',     name: 'ACTIVOS',                   type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Cuentas de activo general' },
    { code: '1.1',   name: 'Caja Principal',            type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Dinero en oficina y bancos' },
    { code: '1.1.1', name: 'Caja Oficina Central',      type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Efectivo f\u00edsico en oficina' },
    { code: '1.1.2', name: 'Cuentas Bancarias',         type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Dinero en bancos (Nequi, Bancolombia, etc.)' },
    { code: '1.2',   name: 'Cajas de Ruta',             type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Efectivo en poder de cobradores' },
    { code: '1.2.1', name: 'Caja Ruta General',         type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Cuenta control para billeteras de cobradores' },
    { code: '1.3',   name: 'Cartera de Pr\u00e9stamos',      type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Derechos de cobro sobre clientes' },
    { code: '1.3.1', name: 'Cartera Vigente',           type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Pr\u00e9stamos en estado activo' },
    { code: '1.3.2', name: 'Cartera en Mora',           type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Pr\u00e9stamos con cuotas vencidas' },
    { code: '1.4',   name: 'Cuentas Cobrar Cobradores', type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Deudas de empleados por descuadres o adelantos' },
    { code: '1.4.1', name: 'Deuda Cobrador General',    type: 'ACTIVO',     nature: 'DEBITORA',   description: 'Subcuenta de control de deudas' },
    // 2. PATRIMONIO / PASIVO
    { code: '2',     name: 'PATRIMONIO Y PASIVOS',      type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Obligaciones y capital' },
    { code: '2.1',   name: 'Capital del Propietario',   type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Inversi\u00f3n inicial del due\u00f1o' },
    { code: '2.2',   name: 'Utilidades Retenidas',      type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Ganancias de ejercicios anteriores' },
    { code: '2.3',   name: 'Utilidad del Periodo',      type: 'PATRIMONIO', nature: 'ACREEDORA',  description: 'Ganancia neta calculada' },
    { code: '2.4',   name: 'Ajustes Pendientes',        type: 'PASIVO',     nature: 'ACREEDORA',  description: 'Sobrantes de arqueo por identificar' },
    // 3. INGRESOS
    { code: '3',     name: 'INGRESOS',                  type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Aumentos en el patrimonio por actividad' },
    { code: '3.1',   name: 'Ingresos por Intereses',    type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Inter\u00e9s corriente de pr\u00e9stamos' },
    { code: '3.2',   name: 'Ingresos por Mora',         type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Inter\u00e9s por mora y penalidades' },
    { code: '3.3',   name: 'Otros Ingresos Oper.',      type: 'INGRESOS',   nature: 'ACREEDORA',  description: 'Margen de art\u00edculos u otros conceptos' },
    // 4. GASTOS
    { code: '4',     name: 'GASTOS',                    type: 'GASTOS',     nature: 'DEBITORA',   description: 'Disminuciones en el patrimonio por operaci\u00f3n' },
    { code: '4.1',   name: 'Gastos de Ruta',            type: 'GASTOS',     nature: 'DEBITORA',   description: 'Gasolina, papeler\u00eda, vi\u00e1ticos' },
    { code: '4.2',   name: 'Gastos Administrativos',    type: 'GASTOS',     nature: 'DEBITORA',   description: 'N\u00f3mina, servicios, arriendos' },
    { code: '4.3',   name: 'P\u00e9rdidas Incobrables',      type: 'GASTOS',     nature: 'DEBITORA',   description: 'Condonaciones o pr\u00e9stamos perdidos' },
  ] as const;

  for (const acc of accounts) {
    await (prisma as any).account.upsert({
      where:  { code: acc.code },
      update: { name: acc.name, type: acc.type, nature: acc.nature, description: acc.description, isActive: true },
      create: acc,
    });
  }

  console.log('[SEED] Cat\u00e1logo contable poblado exitosamente.');
}

//  SEED PRINCIPAL
//  SEED PRINCIPAL
async function main() {
  console.log('Iniciando seed de usuarios...');

  await crearSuperadministradorInicial();

  await crearUsuarioPorRol(
    'coordinador@credisur.com',
    'Coordinador',
    'General',
    RolUsuario.COORDINADOR,
  );

  // Eliminar admin previo para asegurar limpieza
  try {
    await prisma.usuario.delete({ where: { correo: 'admin@credisur.com' } });
    console.log('[SEED] Usuario admin limpiado para recreación');
  } catch (e) { }

  await crearUsuarioPorRol(
    'admin@credisur.com',
    'Admin',
    'General',
    RolUsuario.SUPER_ADMINISTRADOR,
    'Admin123!',
  );

  // Eliminar supervisor previo para asegurar limpieza
  try {
    await prisma.usuario.delete({ where: { correo: 'supervisor@credisur.com' } });
    console.log('[SEED] Usuario supervisor limpiado para recreación');
  } catch (e) { }

  await crearUsuarioPorRol(
    'supervisor@credisur.com',
    'Supervisor', // Nombres EXACTOS
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
    'contador@credisur.com',
    'Contador',
    'General',
    RolUsuario.CONTADOR,
  );

  await crearCatalogoContable();

  console.log('Seed de usuarios y contabilidad finalizado correctamente');
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
