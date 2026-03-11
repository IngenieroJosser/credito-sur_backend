"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const argon2 = require("argon2");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({
    adapter,
});
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
            rol: client_1.RolUsuario.SUPER_ADMINISTRADOR,
            estado: client_1.EstadoUsuario.ACTIVO,
        },
    });
    console.log(`[SEED] Superadministrador creado con id: ${superadministrador.id}`);
    return superadministrador;
}
async function crearUsuarioPorRol(correo, nombres, apellidos, rol, password) {
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
                estado: client_1.EstadoUsuario.ACTIVO,
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
            estado: client_1.EstadoUsuario.ACTIVO,
        },
    });
    console.log(`[SEED] Usuario ${rol} creado (${correo})`);
    return usuario;
}
async function main() {
    console.log('Iniciando seed de usuarios...');
    await crearSuperadministradorInicial();
    await crearUsuarioPorRol('coordinador@credisur.com', 'Coordinador', 'General', client_1.RolUsuario.COORDINADOR);
    try {
        await prisma.usuario.delete({ where: { correo: 'admin@credisur.com' } });
        console.log('[SEED] Usuario admin limpiado para recreación');
    }
    catch (e) { }
    await crearUsuarioPorRol('admin@credisur.com', 'Admin', 'General', client_1.RolUsuario.SUPER_ADMINISTRADOR, 'Admin123!');
    try {
        await prisma.usuario.delete({ where: { correo: 'supervisor@credisur.com' } });
        console.log('[SEED] Usuario supervisor limpiado para recreación');
    }
    catch (e) { }
    await crearUsuarioPorRol('supervisor@credisur.com', 'Supervisor', 'Operativo', client_1.RolUsuario.SUPERVISOR, 'Supervisor123!');
    await crearUsuarioPorRol('cobrador@credisur.com', 'Cobrador', 'Principal', client_1.RolUsuario.COBRADOR, 'Cobrador123!');
    await crearUsuarioPorRol('contador@credisur.com', 'Contador', 'General', client_1.RolUsuario.CONTADOR);
    console.log('Seed de usuarios finalizado correctamente');
}
main()
    .catch((error) => {
    console.error('Error ejecutando el seed:', error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
//# sourceMappingURL=seed.js.map