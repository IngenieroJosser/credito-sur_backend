"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const argon2 = require("argon2");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- DIAGNÓSTICO DE CREDENCIALES ---');
    await verificarUsuario('Supervisor', 'Supervisor123!');
    console.log('\n-----------------------------------\n');
    await verificarUsuario('Admin', 'Admin123!');
}
async function verificarUsuario(nombre, pass) {
    console.log(`Buscando usuario: '${nombre}'...`);
    const user = await prisma.usuario.findFirst({
        where: {
            nombres: {
                equals: nombre,
                mode: 'insensitive'
            }
        }
    });
    if (!user) {
        console.error(`❌ USUARIO NO ENCONTRADO.`);
        return;
    }
    console.log(`✅ Usuario encontrado: ID=${user.id}, Correo=${user.correo}, Estado=${user.estado}`);
    console.log(`   Hash actual: ${user.hashContrasena.substring(0, 15)}...`);
    try {
        const isMatch = await argon2.verify(user.hashContrasena, pass);
        if (isMatch) {
            console.log(`✅ CONTRASEÑA CORRECTA ('${pass}' coincide con el hash)`);
        }
        else {
            console.error(`❌ CONTRASEÑA INCORRECTA ('${pass}' NO coincide con el hash)`);
            console.log(`   🛠  Intentando reparar contraseña...`);
            const newHash = await argon2.hash(pass);
            await prisma.usuario.update({
                where: { id: user.id },
                data: { hashContrasena: newHash }
            });
            console.log(`   ✅ Contraseña actualizada a nuevo hash.`);
            const reVerify = await argon2.verify(newHash, pass);
            console.log(`   🔄 Re-verificación inmediata: ${reVerify ? 'OK' : 'FALLÓ'}`);
        }
    }
    catch (error) {
        console.error(`❌ Error verificando hash:`, error);
    }
}
main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
//# sourceMappingURL=fix_credentials.js.map