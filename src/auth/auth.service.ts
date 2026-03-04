import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginAuthDto } from './dto/login-auth.dto';
import { CreateAuthDto } from './dto/create-auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { ForgotPasswordDto, VerifyResetCodeDto } from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validarUsuario(nombreUsuario: string, contrasena: string) {
    // Buscar por correo o nombres (case insensitive)
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        OR: [
          { correo: { equals: nombreUsuario, mode: 'insensitive' } },
          { nombres: { equals: nombreUsuario, mode: 'insensitive' } },
        ],
      },
    });

    if (!usuario) return null;

    try {
      const matches = await argon2.verify(usuario.hashContrasena, contrasena);
      if (matches) {
        const { hashContrasena: _hashContrasena, ...resultado } = usuario;
        return resultado;
      }
    } catch {
      // Error al verificar contrasena
    }

    return null;
  }

  async login(loginAuthDto: LoginAuthDto) {
    const usuario = await this.validarUsuario(
      loginAuthDto.nombres,
      loginAuthDto.contrasena,
    );

    if (!usuario) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoIngreso: new Date() },
    });

    // Obtener permisos dinámicos del usuario
    const asignaciones = await this.prisma.asignacionRolUsuario.findMany({
      where: { usuarioId: usuario.id },
      include: {
        rol: true,
      },
    });

    // Obtener rutaDefault del primer rol asignado
    const rolDinamico = asignaciones[0]?.rol;
    const rutaDefault = rolDinamico?.rutaDefault || '/admin';

    // Permisos personalizados del usuario (si existen, tienen precedencia)
    const permisosPersonalizados = await this.prisma.asignacionPermisoUsuario.findMany({
      where: { usuarioId: usuario.id },
      include: { permiso: true },
    });

    // Obtener permisos completos con metadata de sidebar
    const rolPermisos = await this.prisma.rolPermiso.findMany({
      where: {
        rolId: { in: asignaciones.map((a) => a.rolId) },
      },
      include: {
        permiso: true,
      },
    });

    const permisosEfectivos =
      permisosPersonalizados.length > 0
        ? permisosPersonalizados.map((p) => p.permiso)
        : rolPermisos.map((rp) => rp.permiso);

    // Aplanar permisos (solo acciones para JWT)
    const uniquePermisos = [...new Set(permisosEfectivos.map((p) => p.accion))];

    // Construir sidebar agrupado por módulo
    const permisosConMeta = permisosEfectivos;
    const permisosUnicos = permisosConMeta.filter(
      (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
    );

    // Agrupar por módulo para el sidebar
    const modulosMap = new Map<
      string,
      { nombre: string; permisos: typeof permisosUnicos }
    >();
    for (const p of permisosUnicos) {
      if (!p.esNavegable) continue;
      const grupo = modulosMap.get(p.modulo) || {
        nombre: p.modulo,
        permisos: [],
      };
      grupo.permisos.push(p);
      modulosMap.set(p.modulo, grupo);
    }

    const sidebar = Array.from(modulosMap.entries()).map(
      ([modulo, grupo]) => ({
        modulo,
        items: grupo.permisos
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({
            id: p.accion,
            nombre: p.nombre,
            icono: p.icono,
            ruta: p.ruta,
            orden: p.orden,
          })),
      }),
    );

    const payload = {
      sub: usuario.id,
      nombres: usuario.nombres,
      rol: usuario.rol,
      permisos: uniquePermisos,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
        permisos: uniquePermisos,
        rutaDefault,
        sidebar,
      },
    };
  }

  async registrarUsuario(dto: CreateAuthDto) {
    const usuario = await this.usersService.crear({
      nombres: dto.nombres,
      apellidos: dto.apellidos,
      correo: dto.correo,
      password: dto.password,
      rol: dto.rol,
    });

    const payload = {
      sub: usuario.id,
      nombres: usuario.nombres,
      rol: usuario.rol,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario,
    };
  }

  async obtenerTodosLosUsuarios() {
    const mostrarUsuarios = await this.prisma.usuario.findMany();
    return mostrarUsuarios;
  }

  // ============================================================
  // RECUPERACION DE CONTRASENA — Flujo por correo electronico
  // ============================================================

  async solicitarRecuperacion(dto: ForgotPasswordDto) {
    // Buscar el usuario por correo
    const usuario = await this.prisma.usuario.findFirst({
      where: { correo: { equals: dto.correo, mode: 'insensitive' } },
    });

    // Por seguridad, no revelamos si el correo existe o no
    if (!usuario || usuario.estado !== 'ACTIVO') {
      return { mensaje: 'Si el correo existe y la cuenta está activa, recibirás un código en breve.' };
    }

    // Solo superadmin puede usar este flujo (otros roles lo gestionan a traves del admin)
    if (usuario.rol !== 'SUPER_ADMINISTRADOR') {
      return { mensaje: 'Si el correo existe y la cuenta está activa, recibirás un código en breve.' };
    }

    // Generar código OTP de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    const codigoHash = await argon2.hash(codigo);

    // Guardar el código hasheado en la base de datos
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        resetPasswordToken: codigoHash,
        resetPasswordExpires: expiracion,
      } as any,
    });

    // Enviar el correo con el código
    await this.enviarCorreoRecuperacion(usuario.correo, usuario.nombres, codigo);

    return { mensaje: 'Si el correo existe y la cuenta está activa, recibirás un código en breve.' };
  }

  async verificarCodigoRecuperacion(dto: VerifyResetCodeDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { correo: { equals: dto.correo, mode: 'insensitive' } },
    });

    if (!usuario) {
      throw new BadRequestException('Código inválido o expirado');
    }

    // Verificar expiración
    const expires = (usuario as any).resetPasswordExpires;
    if (!expires || new Date() > new Date(expires)) {
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo.');
    }

    // Verificar el código
    const token = (usuario as any).resetPasswordToken;
    if (!token) {
      throw new BadRequestException('Código inválido o expirado');
    }

    let codigoValido = false;
    try {
      codigoValido = await argon2.verify(token, dto.codigo);
    } catch {
      throw new BadRequestException('Código inválido o expirado');
    }

    if (!codigoValido) {
      throw new BadRequestException('El código ingresado no es correcto');
    }

    // Cambiar la contraseña
    const nuevoHash = await argon2.hash(dto.nuevaContrasena);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        hashContrasena: nuevoHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      } as any,
    });

    return { mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  }

  private async enviarCorreoRecuperacion(correo: string, nombre: string, codigo: string) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      // En desarrollo o sin SMTP configurado, solo loguear el código
      console.warn(`[RECOVERY] Codigo de recuperacion para ${correo}: ${codigo} (SMTP no configurado)`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Créditos del Sur" <${smtpFrom}>`,
      to: correo,
      subject: 'Código de recuperación de contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 12px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Recuperación de contraseña</h2>
          <p style="color: #64748b;">Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>
          <div style="background: #fff; border: 2px solid #e2e8f0; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">Tu código de verificación es:</p>
            <div style="font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #0f172a; font-family: monospace;">${codigo}</div>
          </div>
          <p style="color: #64748b; font-size: 13px;">Este código expira en <strong>15 minutos</strong>. Si no solicitaste este cambio, ignora este correo.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Créditos del Sur — Sistema de Gestión</p>
        </div>
      `,
    });
  }
}
