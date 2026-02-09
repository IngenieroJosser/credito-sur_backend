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
  console.log(`[SEED] Superadministrador creado con id: ${superadministrador.id}`);

  return superadministrador;
}

async function crearAdministradorInicial() {
  const correo = 'admin@creditosur.com';

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { correo },
  });

  if (usuarioExistente) {
    console.log(`[SEED] Administrador ya existe, actualizando...`);
    const hashContrasena = await argon2.hash('Admin123!');
    const administradorActualizado = await prisma.usuario.update({
      where: { correo },
      data: {
        nombres: 'Admin',
        apellidos: 'General',
        hashContrasena,
        rol: RolUsuario.ADMIN,
        estado: EstadoUsuario.ACTIVO,
      },
    });
    console.log(`[SEED] Administrador actualizado con username: Admin`);
    return administradorActualizado;
  }

  const hashContrasena = await argon2.hash('Admin123!');
  const administrador = await prisma.usuario.create({
    data: {
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
    'contador@credisur.com',
    'Contador',
    'General',
    RolUsuario.CONTADOR,
    'Contador123!',
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