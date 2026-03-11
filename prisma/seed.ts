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
