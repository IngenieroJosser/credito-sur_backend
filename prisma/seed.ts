import 'dotenv/config';
import { PrismaClient, RolUsuario, EstadoUsuario } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

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

async function crearSuperadministradorInicial() {
  const correo = 'superadmin@creditossur.com';

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { correo },
  });

  if (usuarioExistente) {
    console.log(
      'Ya existe un usuario con el correo configurado para el superadministrador',
    );
    return;
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
    'Usuario superadministrador creado con id:',
    superadministrador.id,
  );
}

async function main() {
  await crearSuperadministradorInicial();
}

main()
  .catch((error) => {
    console.error('Error al ejecutar el seed de superadministrador:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
