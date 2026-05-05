import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginAuthDto } from './dto/login-auth.dto';
import { CreateAuthDto } from './dto/create-auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { ForgotPasswordDto, VerifyResetCodeDto } from './dto/forgot-password.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private async buildSessionForUser(usuario: {
    id: string;
    nombres: string;
    apellidos?: string | null;
    correo?: string | null;
    rol: any;
  }) {
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
    const permisosUnicos = permisosEfectivos.filter(
      (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
    );

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
        apellidos: usuario.apellidos ?? undefined,
        correo: usuario.correo ?? undefined,
        rol: usuario.rol,
        permisos: uniquePermisos,
        rutaDefault,
        sidebar,
      },
    };
  }

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

    return this.buildSessionForUser(usuario as any);
  }

  async refreshSession(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.buildSessionForUser(usuario as any);
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

    const brandBlue = '#08557f';
    const brandOrange = '#fb851b';

    const getLogoDataUri = (): string => {
      try {
        const prod = path.join(process.cwd(), 'dist/assets/logo.png');
        const dev = path.join(process.cwd(), 'src/assets/logo.png');
        const p = fs.existsSync(prod) ? prod : fs.existsSync(dev) ? dev : '';
        if (!p) return '';
        const buf = fs.readFileSync(p);
        return `data:image/png;base64,${buf.toString('base64')}`;
      } catch {
        return '';
      }
    };

    const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const logoUrlFallback = baseUrl ? `${baseUrl}/logo.png` : '';
    const logoSrc = getLogoDataUri() || logoUrlFallback;

    await transporter.sendMail({
      from: `"Créditos del Sur" <${smtpFrom}>`,
      to: correo,
      subject: 'Código de recuperación de contraseña',

      html: `
        <div style="background:#f6f8fb; padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; margin:0 auto; border-collapse:collapse;">
            <tr>
              <td style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; overflow:hidden; border-radius:18px;">
                  <tr>
                    <td style="padding:18px 20px; background:${brandBlue};">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                        <tr>
                          <td style="vertical-align:middle;">
                            ${logoSrc ? `<img src="${logoSrc}" alt="Créditos del Sur" width="56" height="56" style="display:block; border-radius:12px; background:#ffffff; padding:8px;" />` : ''}
                          </td>
                          <td style="vertical-align:middle; padding-left:12px;">
                            <div style="font-family:Arial, sans-serif; font-size:16px; font-weight:800; color:#ffffff; line-height:1.2;">Créditos del Sur</div>
                            <div style="font-family:Arial, sans-serif; font-size:12px; font-weight:700; color:rgba(255,255,255,0.85); letter-spacing:0.3px;">Recuperación de contraseña</div>
                          </td>

                          <td style="vertical-align:middle; text-align:right;">
                            <span style="display:inline-block; background:${brandOrange}; color:#111827; font-family:Arial, sans-serif; font-size:11px; font-weight:900; padding:8px 10px; border-radius:999px;">CÓDIGO OTP</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#ffffff; padding:22px 20px 12px 20px;">
                      <div style="font-family:Arial, sans-serif; font-size:14px; color:#0f172a; line-height:1.6;">
                        Hola <strong>${nombre}</strong>,
                        <br />
                        recibimos una solicitud para restablecer tu contraseña.
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#ffffff; padding:0 20px 18px 20px;">
                      <div style="border:1px solid #e5e7eb; border-radius:16px; padding:18px; background:#f8fafc; text-align:center;">
                        <div style="font-family:Arial, sans-serif; font-size:12px; font-weight:800; color:#475569; letter-spacing:0.6px; text-transform:uppercase; margin-bottom:10px;">Tu código de verificación</div>
                        <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:44px; font-weight:900; letter-spacing:10px; color:#0f172a;">${codigo}</div>
                        <div style="font-family:Arial, sans-serif; font-size:12px; color:#64748b; margin-top:12px;">Este código expira en <strong>15 minutos</strong>.</div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#ffffff; padding:0 20px 18px 20px;">
                      <div style="font-family:Arial, sans-serif; font-size:12px; color:#64748b; line-height:1.6;">
                        Si no solicitaste este cambio, puedes ignorar este correo.
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#ffffff; padding:16px 20px; border-top:1px solid #eef2f7;">
                      <div style="font-family:Arial, sans-serif; font-size:11px; color:#94a3b8; line-height:1.4; text-align:center;">
                        Créditos del Sur — Sistema de Gestión
                        <br />
                        <span style="color:#cbd5e1;">No respondas a este correo.</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      `,
    });
  }
}