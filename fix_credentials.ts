import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DIAGNÓSTICO DE CREDENCIALES ---');

    // 1. Verificar Supervisor
    await verificarUsuario('Supervisor', 'Supervisor123!');

    console.log('\n-----------------------------------\n');

    // 2. Verificar Admin
    await verificarUsuario('Admin', 'Admin123!');
}

async function verificarUsuario(nombre: string, pass: string) {
    console.log(`Buscando usuario: '${nombre}'...`);

    // Simular búsqueda exacta del servicio
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
        } else {
            console.error(`❌ CONTRASEÑA INCORRECTA ('${pass}' NO coincide con el hash)`);

            // Intentar arreglarlo
            console.log(`   🛠  Intentando reparar contraseña...`);
            const newHash = await argon2.hash(pass);
            await prisma.usuario.update({
                where: { id: user.id },
                data: { hashContrasena: newHash }
            });
            console.log(`   ✅ Contraseña actualizada a nuevo hash.`);

            // Verificar de nuevo
            const reVerify = await argon2.verify(newHash, pass);
            console.log(`   🔄 Re-verificación inmediata: ${reVerify ? 'OK' : 'FALLÓ'}`);
        }
    } catch (error) {
        console.error(`❌ Error verificando hash:`, error);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
