import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { LedgerService } from './ledger.service';
import { RequestConUsuario } from '../common/types';

describe('AccountingController', () => {
  it('normaliza a numero el monto de un abono recibido como texto', async () => {
    const accountingService = {
      registrarAbonoDeuda: jest.fn().mockResolvedValue({ id: 'abono-1' }),
    };
    const controller = new AccountingController(
      accountingService as unknown as AccountingService,
      {} as LedgerService,
    );

    await controller.registrarAbonoDeuda(
      'cobrador-1',
      {
        monto: '125000' as unknown as number,
        nota: 'Abono recibido',
        cajaIdDestino: 'caja-1',
        idempotencyKey: 'abono-unico-1',
      },
      { user: { id: 'admin-1' } } as RequestConUsuario,
    );

    expect(accountingService.registrarAbonoDeuda).toHaveBeenCalledWith(
      'cobrador-1',
      125000,
      'Abono recibido',
      'admin-1',
      'caja-1',
      'abono-unico-1',
    );
  });
});
