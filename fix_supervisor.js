"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = require("argon2");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- DIAGNÓSTICO DE USUARIOS ---');
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
        const isMatch = await argon2.verify(u.hashContrasena, 'Supervisor123!');
        console.log(`¿Contraseña es 'Supervisor123!'?: ${isMatch ? 'SÍ' : 'NO'}`);
        console.log('-------------------');
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
//# sourceMappingURL=fix_supervisor.js.map