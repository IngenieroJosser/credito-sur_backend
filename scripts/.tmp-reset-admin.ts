import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';

(async () => {
  const prisma = new PrismaService(new EventEmitter2());
  const objetivos: Array<[string, string]> = [
    ['superadmin@credisur.com', 'SuperAdmin123!'],
    ['admin@credisur.com', 'Admin123!'],
  ];
  for (const [correo, clave] of objetivos) {
    const u = await prisma.usuario.findUnique({ where: { correo } });
    if (!u) {
      console.log('no existe:', correo);
      continue;
    }
    await prisma.usuario.update({
      where: { correo },
      data: { hashContrasena: await argon2.hash(clave), estado: 'ACTIVO' },
    });
    console.log('restablecida:', correo, '| rol:', u.rol);
  }
  const todos = await prisma.usuario.findMany({
    select: { correo: true, rol: true, estado: true },
    orderBy: { rol: 'asc' },
  });
  for (const u of todos) console.log(' ', u.rol, u.correo, 'estado:', u.estado);
  process.exit(0);
})();
