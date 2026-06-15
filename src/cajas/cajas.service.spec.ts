/**
 * ============================================================
 * TESTS UNITARIOS — CajasService
 * ============================================================
 *
 * Cubre el flujo más crítico del arqueo de caja.
 * Cada test es independiente.
 *
 * Para ejecutar: npx jest cajas.service --no-coverage
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CajasService } from './cajas.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../accounting/ledger.service';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TipoCaja, TipoDiferenciaArqueo, RutaJornadaEstado } from '@prisma/client';

// Mocks de los servicios de soporte
const mockLedgerService = {
  registrarAsiento: jest.fn().mockResolvedValue({ id: 'journal-1' }),
};

// Helper para validar asiento balanceado
function assertAsientoBalanceado(lines: any[]) {
  const debitos = lines.reduce((sum, l) => sum + Number(l.debitAmount || 0), 0);
  const creditos = lines.reduce((sum, l) => sum + Number(l.creditAmount || 0), 0);

  expect(debitos).toBe(creditos);
}

// Datos de prueba reutilizables
const CAJA_RUTA_ACTIVA = {
  id: 'caja-ruta-1',
  nombre: 'Caja Ruta Centro',
  saldoActual: 5000000,
  activa: true,
  tipo: TipoCaja.RUTA,
  responsableId: 'cobrador-1',
  responsable: {
    id: 'cobrador-1',
    nombres: 'Cobrador',
    apellidos: 'Prueba',
  },
  rutaId: 'ruta-1',
};

const CAJA_PRINCIPAL = {
  id: 'caja-principal-1',
  nombre: 'Caja Principal',
  saldoActual: 10000000,
  activa: true,
  tipo: TipoCaja.PRINCIPAL,
};

const RUTA_JORNADA_ABIERTA = {
  id: 'jornada-1',
  cajaId: 'caja-ruta-1',
  fechaOperativa: '2026-06-13',
  estado: RutaJornadaEstado.ABIERTA,
};

const USUARIO_ADMIN = {
  id: 'admin-1',
  nombres: 'Admin',
  apellidos: 'Prueba',
};

const ARQUEO_CREADO = {
  id: 'arqueo-1',
  cajaId: 'caja-ruta-1',
  fechaOperativa: '2026-06-13',
  responsableId: 'cobrador-1',
  creadoPorId: 'admin-1',
  recibidoPorId: 'admin-1',
  saldoEsperado: 5000000,
  efectivoContado: 5000000,
  diferencia: 0,
  tipoDiferencia: TipoDiferenciaArqueo.SIN_DIFERENCIA,
  numeroComprobanteTraslado: 'TRAS-20260613-8A7F3C9E',
  montoTransferido: 5000000,
  responsable: {
    id: 'cobrador-1',
    nombres: 'Cobrador',
    apellidos: 'Prueba',
  },
  creadoPor: {
    id: 'admin-1',
    nombres: 'Admin',
    apellidos: 'Prueba',
  },
  recibidoPor: {
    id: 'admin-1',
    nombres: 'Admin',
    apellidos: 'Prueba',
  },
};

// Mock de PrismaService
function buildMockPrisma(overrides: Record<string, unknown> = {}) {
  const txMock = {
    caja: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === CAJA_RUTA_ACTIVA.id) return CAJA_RUTA_ACTIVA;
        if (where.id === CAJA_PRINCIPAL.id) return CAJA_PRINCIPAL;
        return null;
      }),
      findUniqueOrThrow: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === CAJA_RUTA_ACTIVA.id) return CAJA_RUTA_ACTIVA;
        if (where.id === CAJA_PRINCIPAL.id) return { ...CAJA_PRINCIPAL, saldoActual: CAJA_PRINCIPAL.saldoActual + 5000000 };
        return null;
      }),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        if (where.tipo === TipoCaja.PRINCIPAL) return CAJA_PRINCIPAL;
        return null;
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    transaccion: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    arqueoCaja: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(ARQUEO_CREADO),
      update: jest.fn().mockResolvedValue(ARQUEO_CREADO),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...ARQUEO_CREADO,
        caja: CAJA_RUTA_ACTIVA,
        responsable: CAJA_RUTA_ACTIVA.responsable,
        creadoPor: USUARIO_ADMIN,
        recibidoPor: USUARIO_ADMIN,
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    rutaJornada: {
      findFirst: jest.fn().mockResolvedValue(RUTA_JORNADA_ABIERTA),
      update: jest.fn().mockResolvedValue({}),
    },
    usuario: {
      findUnique: jest.fn().mockResolvedValue(USUARIO_ADMIN),
    },
  };

  return {
    caja: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.id === CAJA_RUTA_ACTIVA.id) return CAJA_RUTA_ACTIVA;
        if (where.id === CAJA_PRINCIPAL.id) return CAJA_PRINCIPAL;
        return null;
      }),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        if (where.tipo === TipoCaja.PRINCIPAL) return CAJA_PRINCIPAL;
        return null;
      }),
    },
    transaccion: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    arqueoCaja: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    rutaJornada: {
      findFirst: jest.fn().mockResolvedValue(RUTA_JORNADA_ABIERTA),
    },
    $transaction: jest.fn().mockImplementation((cb: any) => cb(txMock)),
    _tx: txMock,
    ...overrides,
  };
}

describe('CajasService', () => {
  let service: CajasService;
  let prisma: any;
  let ledgerService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajasService,
        { provide: PrismaService, useValue: buildMockPrisma() },
        { provide: LedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    service = module.get<CajasService>(CajasService);
    prisma = module.get<PrismaService>(PrismaService) as any;
    ledgerService = module.get<LedgerService>(LedgerService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getArqueoPreview', () => {
    beforeEach(() => {
      // Limpiar mocks de transacciones antes de cada test de getArqueoPreview
      prisma.transaccion.findMany.mockClear();
      prisma.transaccion.findMany.mockResolvedValue([]);
    });

    it('devuelve preview correctamente cuando la caja existe', async () => {
      const result = await service.getArqueoPreview(CAJA_RUTA_ACTIVA.id, '2026-06-13');

      expect(result).toHaveProperty('cajaId', CAJA_RUTA_ACTIVA.id);
      expect(result).toHaveProperty('saldoEsperado');
      expect(result).toHaveProperty('cajaPrincipal');
      expect(result).toHaveProperty('arqueoExistente', false);
    });

    it('lanza error cuando la caja no existe', async () => {
      prisma.caja.findUnique.mockResolvedValueOnce(null);

      await expect(service.getArqueoPreview('caja-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('calcula saldo esperado desde transacciones', async () => {
      // Mock de transacciones para el cálculo de saldo esperado
      prisma.transaccion.findMany.mockResolvedValue([
        { tipo: 'INGRESO', monto: 1000000 },
        { tipo: 'INGRESO', monto: 500000 },
        { tipo: 'EGRESO', monto: 200000 },
      ]);

      const result = await service.getArqueoPreview(CAJA_RUTA_ACTIVA.id, '2026-06-13');

      // Saldo esperado = 1000000 + 500000 - 200000 = 1300000
      expect(result.desglose.saldoEsperadoCalculado).toBe(1300000);
      expect(result.desglose.diferenciaSistema).toBeDefined();
    });

    it('excluye ventas contado del cálculo de saldo esperado', async () => {
      // Configurar mock que simula el filtro tipoReferencia
      prisma.transaccion.findMany.mockImplementation(({ where }: any) => {
        if (where?.tipoReferencia?.notIn?.includes('VENTA_CONTADO')) {
          // Cuando se filtra por notIn VENTA_CONTADO, devolver transacciones sin VENTA_CONTADO
          return Promise.resolve([
            { tipo: 'INGRESO', monto: 1000000 },
            { tipo: 'EGRESO', monto: 200000 },
          ]);
        }
        // Sin filtro, devolver todas las transacciones
        return Promise.resolve([
          { tipo: 'INGRESO', monto: 1000000 },
          { tipo: 'INGRESO', monto: 500000, tipoReferencia: 'VENTA_CONTADO' },
          { tipo: 'EGRESO', monto: 200000 },
        ]);
      });

      const result = await service.getArqueoPreview(CAJA_RUTA_ACTIVA.id, '2026-06-13');

      // Saldo esperado = 1000000 - 200000 = 800000 (excluye VENTA_CONTADO)
      expect(result.desglose.saldoEsperadoCalculado).toBe(800000);
    });
  });

  describe('confirmarArqueo', () => {
    beforeEach(() => {
      // Configurar mock de transacciones por defecto para confirmarArqueo
      prisma.transaccion.findMany.mockResolvedValue([
        { tipo: 'INGRESO', monto: 5000000 },
      ]);
      prisma._tx.transaccion.findMany.mockResolvedValue([
        { tipo: 'INGRESO', monto: 5000000 },
      ]);
    });

    it('confirmar arqueo sin diferencia', async () => {
      const result = await service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
        undefined,
        undefined,
        undefined, // Sin observación porque no hay diferencia
      );

      expect(result).toHaveProperty('arqueoId', ARQUEO_CREADO.id);
      expect(result).toHaveProperty('diferencia', 0);
      expect(result).toHaveProperty('tipoDiferencia', TipoDiferenciaArqueo.SIN_DIFERENCIA);
      
      expect(ledgerService.registrarAsiento).toHaveBeenCalled();
      const call = ledgerService.registrarAsiento.mock.calls[0][0];
      assertAsientoBalanceado(call.lines);
      
      expect(call).toEqual(expect.objectContaining({
        referenceType: 'ARQUEO',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.1.1',
            debitAmount: 5000000,
            cajaId: CAJA_PRINCIPAL.id,
            cajaDelta: 5000000,
          }),
          expect.objectContaining({
            accountCode: '1.2.1',
            creditAmount: 5000000,
            cajaId: CAJA_RUTA_ACTIVA.id,
            cajaDelta: -5000000,
          }),
        ]),
      }));
    });

    it('confirmar arqueo con faltante registra línea débito por deuda cobrador', async () => {
      const result = await service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        4900000,
        USUARIO_ADMIN.id,
        undefined,
        undefined,
        'Faltante por error de conteo', // Observación requerida
      );

      expect(result).toHaveProperty('arqueoId');
      
      expect(ledgerService.registrarAsiento).toHaveBeenCalled();
      const call = ledgerService.registrarAsiento.mock.calls[0][0];
      assertAsientoBalanceado(call.lines);
      
      expect(call).toEqual(expect.objectContaining({
        referenceType: 'ARQUEO',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.1.1',
            debitAmount: 4900000,
            cajaId: CAJA_PRINCIPAL.id,
            cajaDelta: 4900000,
          }),
          expect.objectContaining({
            accountCode: '1.2.1',
            creditAmount: 5000000,
            cajaId: CAJA_RUTA_ACTIVA.id,
            cajaDelta: -5000000,
          }),
          expect.objectContaining({
            accountCode: '1.4.1',
            debitAmount: 100000,
          }),
        ]),
      }));
    });

    it('confirmar arqueo con sobrante registra línea crédito por ajuste pendiente', async () => {
      const result = await service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5100000,
        USUARIO_ADMIN.id,
        undefined,
        undefined,
        'Sobrante por error de conteo', // Observación requerida
      );

      expect(result).toHaveProperty('arqueoId');
      
      expect(ledgerService.registrarAsiento).toHaveBeenCalled();
      const call = ledgerService.registrarAsiento.mock.calls[0][0];
      assertAsientoBalanceado(call.lines);
      
      expect(call).toEqual(expect.objectContaining({
        referenceType: 'ARQUEO',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountCode: '1.1.1',
            debitAmount: 5100000,
            cajaId: CAJA_PRINCIPAL.id,
            cajaDelta: 5100000,
          }),
          expect.objectContaining({
            accountCode: '1.2.1',
            creditAmount: 5000000,
            cajaId: CAJA_RUTA_ACTIVA.id,
            cajaDelta: -5000000,
          }),
          expect.objectContaining({
            accountCode: '2.4',
            creditAmount: 100000,
          }),
        ]),
      }));
    });

    it('no permite efectivo negativo', async () => {
      await expect(service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        -100000,
        USUARIO_ADMIN.id,
      )).rejects.toThrow(BadRequestException);
    });

    it('no permite arquear Caja Principal', async () => {
      prisma.caja.findUnique.mockResolvedValueOnce(CAJA_PRINCIPAL);

      await expect(service.confirmarArqueo(
        CAJA_PRINCIPAL.id,
        '2026-06-13',
        1000000,
        USUARIO_ADMIN.id,
      )).rejects.toThrow(BadRequestException);
    });

    it('no permite arqueo duplicado', async () => {
      prisma._tx.arqueoCaja.findUnique.mockResolvedValueOnce(ARQUEO_CREADO);

      await expect(service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
      )).rejects.toThrow(BadRequestException);
    });

    it('permite recibidoPorId diferente de creadoPorId', async () => {
      const result = await service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
        'otro-usuario-1',
      );

      expect(prisma._tx.arqueoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recibidoPorId: 'otro-usuario-1',
          }),
        }),
      );
    });

    it('no permite caja principal no encontrada', async () => {
      prisma.$transaction.mockImplementationOnce((cb: any) => {
        prisma._tx.caja.findFirst.mockResolvedValueOnce(null);
        return cb(prisma._tx);
      });

      await expect(service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
      )).rejects.toThrow(NotFoundException);
    });

    it('no permite jornada inexistente', async () => {
      prisma.$transaction.mockImplementationOnce((cb: any) => {
        prisma._tx.rutaJornada.findFirst.mockResolvedValueOnce(null);
        return cb(prisma._tx);
      });

      await expect(service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
      )).rejects.toThrow(BadRequestException);
    });

    it('no permite jornada con estado CERRADA', async () => {
      prisma.$transaction.mockImplementationOnce((cb: any) => {
        prisma._tx.rutaJornada.findFirst.mockResolvedValueOnce({ ...RUTA_JORNADA_ABIERTA, estado: RutaJornadaEstado.CERRADA });
        return cb(prisma._tx);
      });

      await expect(service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
      )).rejects.toThrow(BadRequestException);
    });

    it('no permite usuario receptor inexistente', async () => {
      prisma.$transaction.mockImplementationOnce((cb: any) => {
        prisma._tx.usuario.findUnique.mockResolvedValueOnce(null);
        return cb(prisma._tx);
      });

      await expect(service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
        'usuario-inexistente',
      )).rejects.toThrow(NotFoundException);
    });

    it('no permite caja inactiva', async () => {
      prisma.$transaction.mockImplementationOnce((cb: any) => {
        prisma._tx.caja.findUnique.mockResolvedValueOnce({ ...CAJA_RUTA_ACTIVA, activa: false });
        return cb(prisma._tx);
      });

      await expect(service.confirmarArqueo(
        CAJA_RUTA_ACTIVA.id,
        '2026-06-13',
        5000000,
        USUARIO_ADMIN.id,
      )).rejects.toThrow(BadRequestException);
    });
  });
});
