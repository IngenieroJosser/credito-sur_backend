
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNÓSTICO DE USUARIOS ---');

    // Buscar todos los usuarios que coincidan con "Supervisor" (insensible a mayúsculas)
    const users = await prisma.usuario.findMany({
        where: {
            nombres: {
                equals: 'Supervisor',
                mode: 'insensitive'
            }
        }
    });

    console.log(`Encontrados ${users.length} usuarios con nombre 'Supervisor':`);

    for (const u of users) {
        console.log(`ID: ${u.id}`);
        console.log(`Correo: ${u.correo}`);
        console.log(`Nombres: '${u.nombres}'`);
        console.log(`Rol: ${u.rol}`);
        console.log(`Estado: ${u.estado}`);

        // Verificar contraseña manualmente
        const isMatch = await argon2.verify(u.hashContrasena, 'Supervisor123!');
        console.log(`¿Contraseña es 'Supervisor123!'?: ${isMatch ? 'SÍ' : 'NO'}`);
        console.log('-------------------');

        // Si la contraseña no coincide, actualizarla forzosamente
        if (!isMatch) {
            console.log(`ACTUALIZANDO contraseña para ${u.correo}...`);
            const newHash = await argon2.hash('Supervisor123!');
            await prisma.usuario.update({
                where: { id: u.id },
                data: { hashContrasena: newHash }
            });
            console.log('Contraseña actualizada correctamente.');
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
