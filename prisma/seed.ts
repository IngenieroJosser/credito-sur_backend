import 'dotenv/config';
import { PrismaClient, RolUsuario, EstadoUsuario } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

//  CONFIGURACIÓN PRISMA
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined');
}

const pool = new Pool({
  connectionString,
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
    console.log('[SEED] Superadministrador ya existe');
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
    '[SEED] Superadministrador creado con id:',
    superadministrador.id,
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

  if (existente) {
    console.log(
      `[SEED] Usuario ${rol} ya existe (${correo})`,
    );
    return existente;
  }

  const hashContrasena = await argon2.hash(
    password ?? `${rol}_1234`,
  );

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

  console.log(
    `[SEED] Usuario ${rol} creado (${correo})`,
  );

  return usuario;
}

//  SEED PRINCIPAL
async function main() {
  console.log('Iniciando seed de usuarios...');

  await crearSuperadministradorInicial();

  await crearUsuarioPorRol(
    'coordinador@creditosur.com',
    'Coordinador',
    'General',
    RolUsuario.COORDINADOR,
  );

  await crearUsuarioPorRol(
    'supervisor@creditosur.com',
    'Supervisor',
    'Operativo',
    RolUsuario.SUPERVISOR,
  );

  await crearUsuarioPorRol(
    'cobrador@creditosur.com',
    'Cobrador',
    'Principal',
    RolUsuario.COBRADOR,
  );

  await crearUsuarioPorRol(
    'contador@creditosur.com',
    'Contador',
    'General',
    RolUsuario.CONTADOR,
  );

  console.log('Seed de usuarios finalizado correctamente');
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
