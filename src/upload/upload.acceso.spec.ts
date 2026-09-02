import { RolUsuario } from '@prisma/client';
import { UploadController } from './upload.controller';

/**
 * Control de acceso a los archivos servidos por nombre.
 *
 * Antes, cualquier usuario autenticado podía pedir cualquier fichero de
 * ./uploads con solo saber (o adivinar) su nombre: un IDOR sobre documentos de
 * clientes. Estas pruebas fijan las reglas que lo impiden.
 */
describe('UploadController.serveFile: quién puede ver un archivo', () => {
  const hacerRes = () => {
    const res: any = {
      code: 0,
      body: null as any,
      enviado: null as string | null,
      status(c: number) {
        this.code = c;
        return this;
      },
      json(b: any) {
        this.body = b;
        return this;
      },
      sendFile(nombre: string) {
        this.enviado = nombre;
      },
    };
    return res;
  };

  const controlador = (media: any, clienteVisible: any = null) => {
    const prisma: any = {
      multimedia: { findFirst: jest.fn().mockResolvedValue(media) },
      cliente: { findFirst: jest.fn().mockResolvedValue(clienteVisible) },
    };
    return { ctrl: new UploadController({} as any, prisma), prisma };
  };

  it('rechaza nombres con recorrido de directorios', async () => {
    const { ctrl, prisma } = controlador(null);
    const res = hacerRes();
    await ctrl.serveFile('../../.env', { user: {} }, res);
    expect(res.code).toBe(400);
    // Ni siquiera consulta la base: se corta antes.
    expect(prisma.multimedia.findFirst).not.toHaveBeenCalled();
  });

  it('un archivo que no está registrado devuelve 404 (no se puede enumerar la carpeta)', async () => {
    const { ctrl } = controlador(null);
    const res = hacerRes();
    await ctrl.serveFile('cualquiera.pdf', { user: { rol: RolUsuario.ADMIN } }, res);
    expect(res.code).toBe(404);
    expect(res.enviado).toBeNull();
  });

  it('sirve un archivo público a cualquiera', async () => {
    const { ctrl } = controlador({ esPublico: true, clienteId: null, usuarioId: null });
    const res = hacerRes();
    await ctrl.serveFile('logo.png', { user: { rol: RolUsuario.COBRADOR, id: 'u1' } }, res);
    expect(res.enviado).toBe('logo.png');
  });

  it('sirve el archivo a su propio dueño', async () => {
    const { ctrl } = controlador({ esPublico: false, clienteId: null, usuarioId: 'u1' });
    const res = hacerRes();
    await ctrl.serveFile('mi-foto.png', { user: { rol: RolUsuario.COBRADOR, id: 'u1' } }, res);
    expect(res.enviado).toBe('mi-foto.png');
  });

  it('un cobrador NO ve el documento de un cliente que no es de su ruta', async () => {
    // El cliente no aparece dentro de su alcance: cliente.findFirst devuelve null
    const { ctrl } = controlador({ esPublico: false, clienteId: 'c9', usuarioId: null }, null);
    const res = hacerRes();
    await ctrl.serveFile('cedula-c9.jpg', { user: { rol: RolUsuario.COBRADOR, id: 'u1' } }, res);
    expect(res.code).toBe(404);
    expect(res.enviado).toBeNull();
  });

  it('un cobrador SÍ ve el documento de un cliente de su ruta', async () => {
    const { ctrl } = controlador({ esPublico: false, clienteId: 'c1', usuarioId: null }, { id: 'c1' });
    const res = hacerRes();
    await ctrl.serveFile('cedula-c1.jpg', { user: { rol: RolUsuario.COBRADOR, id: 'u1' } }, res);
    expect(res.enviado).toBe('cedula-c1.jpg');
  });

  it('los roles de alcance amplio ven documentos de cliente', async () => {
    for (const rol of [
      RolUsuario.SUPER_ADMINISTRADOR,
      RolUsuario.ADMIN,
      RolUsuario.COORDINADOR,
      RolUsuario.CONTADOR,
    ]) {
      const { ctrl } = controlador({ esPublico: false, clienteId: 'c1', usuarioId: null });
      const res = hacerRes();
      await ctrl.serveFile('doc.pdf', { user: { rol, id: 'x' } }, res);
      expect({ rol, enviado: res.enviado }).toEqual({ rol, enviado: 'doc.pdf' });
    }
  });
});
