import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { dirname } from 'node:path';

// ─── Constantes ───────────────────────────────────────────────────────────────
const AZUL='FF004F7B', NARANJA='FFF37920', GRIS_OSC='FF1E293B';
const AZUL_CLR='FFF0F9FF', BLANCO='FFFFFFFF', GRIS_TXT='FF475569';
const BH: ExcelJS.Border={style:'hair',color:{argb:'FFE2E8F0'}};
const BT: ExcelJS.Border={style:'thin',color:{argb:BLANCO}};
const BM: ExcelJS.Border={style:'medium',color:{argb:BLANCO}};

// ─── Helpers ──────────────────────────────────────────────────────────────────
type ExportResult={filePath:string;fileSize:number;sheets:Record<string,number>};
const pad=(n:number)=>String(n).padStart(2,'0');
const nom=(u:any)=>u?`${u.nombres||''} ${u.apellidos||''}`.trim():'';
const fmtDT=(v:any):string=>{
  if(!v)return'';const d=v instanceof Date?v:new Date(v);
  if(isNaN(d.getTime()))return String(v);
  return`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const fmtD=(v:any):string=>{
  if(!v)return'';const d=v instanceof Date?v:new Date(v);
  if(isNaN(d.getTime()))return String(v);
  return`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
};
const fmtE=(v:any)=>v?String(v).replace(/_/g,' '):'';
const n2=(v:any):number=>{const x=Number(v);return isNaN(x)?0:x;};
const $=(n:number)=>n; // valor numérico para celdas con numFmt

function hdrCell(cell:ExcelJS.Cell):void{
  cell.font={bold:true,color:{argb:BLANCO},size:9};
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}};
  cell.alignment={horizontal:'center',vertical:'middle'};
  cell.border={bottom:BM,right:BT};
}

function mkSheet(wb:ExcelJS.Workbook,name:string,tab:string,cols:any[],LC:string,title:string,sub:string):ExcelJS.Worksheet{
  const ws=wb.addWorksheet(name,{
    views:[{state:'frozen',ySplit:5,showGridLines:false}],
    pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1},
    properties:{tabColor:{argb:tab}},
  });
  ws.columns=cols;
  ws.mergeCells(`A1:${LC}1`);
  const c1=ws.getCell('A1');
  c1.value=`CRÉDITOS DEL SUR — ${title}`;
  c1.font={bold:true,size:14,color:{argb:BLANCO}};
  c1.fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}};
  c1.alignment={horizontal:'center',vertical:'middle'};
  ws.getRow(1).height=28;
  ws.mergeCells(`A2:${LC}2`);
  const c2=ws.getCell('A2');
  c2.value=sub;
  c2.font={bold:true,size:11,color:{argb:BLANCO}};
  c2.fill={type:'pattern',pattern:'solid',fgColor:{argb:NARANJA}};
  c2.alignment={horizontal:'center',vertical:'middle'};
  ws.getRow(2).height=20;
  return ws;
}

function addMeta(ws:ExcelJS.Worksheet,total:number,LC:string):void{
  ws.mergeCells(`A3:${LC}3`);
  const c=ws.getCell('A3');
  c.value=`Generado: ${fmtDT(new Date())}   |   Total registros: ${total}`;
  c.font={italic:true,size:8,color:{argb:GRIS_TXT}};
  ws.getRow(3).height=13;
}

function addHdr(ws:ExcelJS.Worksheet,headers:string[],LC:string):void{
  ws.addRow([]);
  const row=ws.getRow(5);row.height=22;
  headers.forEach((h,i)=>{const cell=row.getCell(i+1);cell.value=h;hdrCell(cell);});
  ws.autoFilter={from:'A5',to:`${LC}5`};
}

function rowStyle(row:ExcelJS.Row,idx:number):void{
  if(idx%2===1){
    row.eachCell({includeEmpty:false},c=>{
      if(!(c.fill as any)?.fgColor?.argb||(c.fill as any)?.fgColor?.argb===BLANCO)
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL_CLR}};
    });
  }
  row.eachCell({includeEmpty:false},c=>{
    c.border={bottom:BH,right:BH};
    c.alignment={...c.alignment,vertical:'middle'};
  });
  row.height=17;
}

function numCol(row:ExcelJS.Row,...cols:number[]):void{
  cols.forEach(c=>{row.getCell(c).numFmt='"$"#,##0';row.getCell(c).alignment={horizontal:'right',vertical:'middle'};});
}

function addTotals(ws:ExcelJS.Worksheet,label:string,values:any[],numCols:number[]):void{
  ws.addRow([]);
  const row=ws.addRow([label,...values]);row.height=22;
  const c1=row.getCell(1);
  c1.font={bold:true,color:{argb:BLANCO}};
  c1.fill={type:'pattern',pattern:'solid',fgColor:{argb:NARANJA}};
  c1.alignment={horizontal:'right',vertical:'middle'};
  row.eachCell({includeEmpty:true},(c,cn)=>{
    if(cn===1)return;
    c.font={bold:true,color:{argb:BLANCO}};
    c.fill={type:'pattern',pattern:'solid',fgColor:{argb:GRIS_OSC}};
    if(numCols.includes(cn)){c.numFmt='"$"#,##0';c.alignment={horizontal:'right',vertical:'middle'};}
  });
}

// ─── Servicio ─────────────────────────────────────────────────────────────────
@Injectable()
export class BackupExcelService {
  constructor(private readonly prisma:PrismaService){}

  async exportSnapshotToXlsx(filePath:string):Promise<ExportResult>{
    const fs=await import('node:fs/promises');
    await fs.mkdir(dirname(filePath),{recursive:true});
    const wb=new ExcelJS.Workbook();
    wb.creator='Créditos del Sur';wb.created=new Date();
    const sheets:Record<string,number>={};

    // ══ 1. CLIENTES ══════════════════════════════════════════════════════════
    {
      const LC='Q';
      const ws=mkSheet(wb,'Clientes','FF0ea5e9',[
        {key:'codigo',width:12},{key:'nombres',width:22},{key:'apellidos',width:22},
        {key:'dni',width:14},{key:'telefono',width:14},{key:'correo',width:28},
        {key:'direccion',width:30},{key:'ref1',width:28},{key:'tel1',width:14},
        {key:'ref2',width:28},{key:'tel2',width:14},{key:'riesgo',width:12},
        {key:'estadoAprob',width:18},{key:'listaNegra',width:12},{key:'puntaje',width:10},
        {key:'categoria',width:16},{key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE CLIENTES','DIRECTORIO COMPLETO DE CLIENTES CON REFERENCIAS');
      const data:any[]=await(this.prisma as any).cliente.findMany({
        where:{eliminadoEn:null},orderBy:{creadoEn:'asc'},
        include:{
          creadoPor:{select:{nombres:true,apellidos:true}},
          aprobadoPor:{select:{nombres:true,apellidos:true}},
          categoria:{select:{nombre:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Código','Nombres','Apellidos','Documento','Teléfono','Correo','Dirección',
        'Referencia 1 - Nombre','Referencia 1 - Tel','Referencia 2 - Nombre','Referencia 2 - Tel',
        'Nivel Riesgo','Estado Aprobación','Lista Negra','Puntaje','Categoría','Creado En'],LC);
      const RF:Record<string,string>={ROJO:'FFFECACA',AMARILLO:'FFFEF9C3',VERDE:'FFDCFCE7',LISTA_NEGRA:'FFFFE4E6'};
      data.forEach((c:any,i:number)=>{
        const row=ws.addRow([c.codigo,c.nombres,c.apellidos,c.dni,c.telefono||'',c.correo||'',c.direccion||'',
          c.referencia1Nombre||'',c.referencia1Telefono||'',c.referencia2Nombre||'',c.referencia2Telefono||'',
          fmtE(c.nivelRiesgo),fmtE(c.estadoAprobacion),c.enListaNegra?'SÍ':'NO',
          c.puntaje,c.categoria?.nombre||'',fmtDT(c.creadoEn)]);
        rowStyle(row,i);
        const bg=RF[String(c.nivelRiesgo)];
        if(bg){row.getCell(12).fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};row.getCell(12).font={bold:true};}
        if(c.enListaNegra)row.getCell(14).font={bold:true,color:{argb:'FFDC2626'}};
      });
      sheets['Clientes']=data.length;
    }

    // ══ 2. CRÉDITOS ══════════════════════════════════════════════════════════
    {
      const LC='V';
      const ws=mkSheet(wb,'Créditos','FF004F7B',[
        {key:'num',width:20},{key:'cliente',width:28},{key:'dni',width:14},
        {key:'tipo',width:14},{key:'estado',width:18},{key:'estadoAprob',width:18},
        {key:'frec',width:12},{key:'monto',width:15},{key:'tasa',width:10},
        {key:'plazo',width:10},{key:'cuotas',width:10},{key:'interesTotal',width:15},
        {key:'saldo',width:15},{key:'pagado',width:15},{key:'inicio',width:14},
        {key:'primerCobro',width:14},{key:'fin',width:14},{key:'producto',width:24},
        {key:'creadoPor',width:24},{key:'aprobadoPor',width:24},{key:'notas',width:28},
        {key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE CRÉDITOS','CARTERA COMPLETA DE CRÉDITOS OTORGADOS');
      const data:any[]=await(this.prisma as any).prestamo.findMany({
        where:{eliminadoEn:null},orderBy:{creadoEn:'asc'},
        include:{
          cliente:{select:{nombres:true,apellidos:true,dni:true}},
          producto:{select:{nombre:true,codigo:true}},
          creadoPor:{select:{nombres:true,apellidos:true}},
          aprobadoPor:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['N° Crédito','Cliente','Documento','Tipo','Estado','Aprobación','Frecuencia',
        'Monto','Tasa %','Plazo(m)','Cuotas','Interés Total','Saldo Pendiente','Total Pagado',
        'Fecha Inicio','Primer Cobro','Fecha Fin','Producto','Creado Por','Aprobado Por','Notas','Creado En'],LC);
      const EF:Record<string,string>={ACTIVO:'FFDCFCE7',EN_MORA:'FFFECACA',PAGADO:'FFE0E7FF',BORRADOR:'FFF1F5F9',INCUMPLIDO:'FFFFE4E6',PERDIDA:'FFFFE4E6'};
      let sm=0,ss=0,sp=0;
      data.forEach((p:any,i:number)=>{
        const m=n2(p.monto),s=n2(p.saldoPendiente),tp=n2(p.totalPagado);
        const cli=`${p.cliente?.nombres||''} ${p.cliente?.apellidos||''}`.trim();
        const prod=p.producto?`${p.producto.codigo} - ${p.producto.nombre}`:'';
        const row=ws.addRow([p.numeroPrestamo,cli,p.cliente?.dni||'',fmtE(p.tipoPrestamo),
          fmtE(p.estado),fmtE(p.estadoAprobacion),fmtE(p.frecuenciaPago),
          m,n2(p.tasaInteres),p.plazoMeses,p.cantidadCuotas,n2(p.interesTotal),
          s,tp,fmtD(p.fechaInicio),fmtD(p.fechaPrimerCobro),fmtD(p.fechaFin),
          prod,nom(p.creadoPor),nom(p.aprobadoPor),p.notas||'',fmtDT(p.creadoEn)]);
        rowStyle(row,i);
        numCol(row,8,12,13,14);
        row.getCell(9).numFmt='0.00"%"';row.getCell(9).alignment={horizontal:'right'};
        const bg=EF[String(p.estado)];if(bg)row.getCell(5).fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
        sm+=m;ss+=s;sp+=tp;
      });
      addTotals(ws,`TOTALES — ${data.length} créditos`,[null,null,null,null,null,null,sm,null,null,null,null,ss,sp],[8,13,14]);
      sheets['Créditos']=data.length;
    }

    // ══ 3. CUOTAS ════════════════════════════════════════════════════════════
    {
      const LC='K';
      const ws=mkSheet(wb,'Cuotas','FF7c3aed',[
        {key:'numPrestamo',width:20},{key:'cliente',width:26},{key:'num',width:10},
        {key:'estado',width:14},{key:'monto',width:14},{key:'capital',width:14},
        {key:'interes',width:14},{key:'mora',width:14},{key:'pagado',width:14},
        {key:'vence',width:14},{key:'fechaPago',width:22},
      ] as any,LC,'RESPALDO DE CUOTAS','PLAN DE PAGOS COMPLETO POR CRÉDITO');
      const data:any[]=await(this.prisma as any).cuota.findMany({
        where:{prestamo:{eliminadoEn:null}},
        orderBy:[{prestamoId:'asc'},{numeroCuota:'asc'}],
        include:{prestamo:{select:{numeroPrestamo:true,cliente:{select:{nombres:true,apellidos:true}}}}},
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['N° Crédito','Cliente','N° Cuota','Estado','Monto Cuota','Capital','Interés','Mora','Pagado','Fecha Vencimiento','Fecha y Hora Pago'],LC);
      const EF:Record<string,string>={PENDIENTE:'FFF1F5F9',PAGADA:'FFDCFCE7',PARCIAL:'FFFEF9C3',VENCIDA:'FFFECACA',PRORROGADA:'FFE0E7FF'};
      data.forEach((q:any,i:number)=>{
        const cli=`${q.prestamo?.cliente?.nombres||''} ${q.prestamo?.cliente?.apellidos||''}`.trim();
        const row=ws.addRow([q.prestamo?.numeroPrestamo||'',cli,q.numeroCuota,
          fmtE(q.estado),n2(q.monto),n2(q.montoCapital),n2(q.montoInteres),
          n2(q.montoInteresMora),n2(q.montoPagado),fmtD(q.fechaVencimiento),
          q.fechaPago?fmtDT(q.fechaPago):'']);
        rowStyle(row,i);
        numCol(row,5,6,7,8,9);
        const bg=EF[String(q.estado)];if(bg)row.getCell(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
      });
      sheets['Cuotas']=data.length;
    }

    // ══ 4. PAGOS ═════════════════════════════════════════════════════════════
    {
      const LC='J';
      const ws=mkSheet(wb,'Pagos','FF059669',[
        {key:'numPago',width:18},{key:'numPrestamo',width:20},{key:'cliente',width:26},
        {key:'cobrador',width:24},{key:'monto',width:14},{key:'metodo',width:14},
        {key:'referencia',width:20},{key:'notas',width:28},
        {key:'fechaPago',width:22},{key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE PAGOS','HISTORIAL COMPLETO DE COBROS RECIBIDOS');
      const data:any[]=await(this.prisma as any).pago.findMany({
        orderBy:{fechaPago:'asc'},
        include:{
          cliente:{select:{nombres:true,apellidos:true}},
          prestamo:{select:{numeroPrestamo:true}},
          cobrador:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['N° Pago','N° Crédito','Cliente','Cobrador','Monto','Método Pago','N° Referencia','Notas','Fecha y Hora Pago','Registrado En'],LC);
      let total=0;
      data.forEach((p:any,i:number)=>{
        const row=ws.addRow([p.numeroPago,p.prestamo?.numeroPrestamo||'',nom(p.cliente),
          nom(p.cobrador),n2(p.montoTotal),fmtE(p.metodoPago),
          p.numeroReferencia||'',p.notas||'',fmtDT(p.fechaPago),fmtDT(p.creadoEn)]);
        rowStyle(row,i);numCol(row,5);
        total+=n2(p.montoTotal);
      });
      addTotals(ws,`TOTALES — ${data.length} pagos`,[null,null,null,total],[5]);
      sheets['Pagos']=data.length;
    }

    // ══ 5. DETALLE DE PAGOS ══════════════════════════════════════════════════
    {
      const LC='G';
      const ws=mkSheet(wb,'Detalle Pagos','FF0d9488',[
        {key:'numPago',width:18},{key:'cliente',width:26},{key:'numCuota',width:12},{key:'capital',width:16},
        {key:'interes',width:16},{key:'mora',width:16},{key:'total',width:16},
        {key:'fechaPago',width:22},
      ] as any,LC,'DETALLE DE PAGOS','DESGLOSE CAPITAL · INTERÉS · MORA POR CUOTA COBRADA');
      const data:any[]=await(this.prisma as any).detallePago.findMany({
        orderBy:{pagoId:'asc'},
        include:{
          pago:{select:{numeroPago:true,fechaPago:true,cliente:{select:{nombres:true,apellidos:true}}}},
          cuota:{select:{numeroCuota:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['N° Pago','Cliente','N° Cuota','Capital Pagado','Interés Pagado','Mora Pagada','Total Aplicado','Fecha y Hora Pago'],LC);
      let sK=0,sI=0,sM=0;
      data.forEach((d:any,i:number)=>{
        const k=n2(d.montoCapital),it=n2(d.montoInteres),mo=n2(d.montoInteresMora);
        const row=ws.addRow([d.pago?.numeroPago||'',nom(d.pago?.cliente),d.cuota?.numeroCuota||'',k,it,mo,k+it+mo,fmtDT(d.pago?.fechaPago)]);
        rowStyle(row,i);numCol(row,4,5,6,7);
        sK+=k;sI+=it;sM+=mo;
      });
      addTotals(ws,`TOTALES — ${data.length} detalles`,[null,null,sK,sI,sM,sK+sI+sM],[4,5,6,7]);
      sheets['Detalle Pagos']=data.length;
    }

    // ══ 6. RUTAS ═════════════════════════════════════════════════════════════
    {
      const LC='G';
      const ws=mkSheet(wb,'Rutas','FFf59e0b',[
        {key:'codigo',width:14},{key:'nombre',width:28},{key:'zona',width:20},
        {key:'cobrador',width:26},{key:'supervisor',width:26},
        {key:'activa',width:10},{key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE RUTAS','RUTAS DE COBRO Y PERSONAL ASIGNADO');
      const data:any[]=await(this.prisma as any).ruta.findMany({
        where:{eliminadoEn:null},orderBy:{creadoEn:'asc'},
        include:{
          cobrador:{select:{nombres:true,apellidos:true}},
          supervisor:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Código','Nombre Ruta','Zona','Cobrador Asignado','Supervisor Asignado','Activa','Creado En'],LC);
      data.forEach((r:any,i:number)=>{
        const row=ws.addRow([r.codigo,r.nombre,r.zona||'',nom(r.cobrador),nom(r.supervisor),r.activa?'SÍ':'NO',fmtDT(r.creadoEn)]);
        rowStyle(row,i);
        if(!r.activa)row.getCell(6).font={color:{argb:'FFDC2626'}};
      });
      sheets['Rutas']=data.length;
    }

    // ══ 7. CLIENTES POR RUTA ═════════════════════════════════════════════════
    {
      const DIAS=['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
      const LC='I';
      const ws=mkSheet(wb,'Clientes por Ruta','FFea580c',[
        {key:'ruta',width:26},{key:'zona',width:18},{key:'cobrador',width:26},
        {key:'cliente',width:26},{key:'dni',width:14},{key:'telefono',width:14},
        {key:'dia',width:14},{key:'orden',width:10},{key:'activa',width:10},
      ] as any,LC,'CLIENTES POR RUTA','ASIGNACIÓN Y ORDEN DE VISITA POR RUTA DE COBRO');
      const data:any[]=await(this.prisma as any).asignacionRuta.findMany({
        orderBy:[{rutaId:'asc'},{ordenVisita:'asc'}],
        include:{
          ruta:{select:{codigo:true,nombre:true,zona:true}},
          cliente:{select:{nombres:true,apellidos:true,dni:true,telefono:true}},
          cobrador:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Ruta','Zona','Cobrador','Cliente','Documento','Teléfono','Día Visita','Orden Visita','Activa'],LC);
      data.forEach((a:any,i:number)=>{
        const ruta=`${a.ruta?.codigo||''} - ${a.ruta?.nombre||''}`;
        const row=ws.addRow([ruta,a.ruta?.zona||'',nom(a.cobrador),nom(a.cliente),
          a.cliente?.dni||'',a.cliente?.telefono||'',
          a.diaSemana?DIAS[a.diaSemana]||String(a.diaSemana):'',
          a.ordenVisita,a.activa?'SÍ':'NO']);
        rowStyle(row,i);
        if(!a.activa)row.getCell(9).font={color:{argb:'FFDC2626'}};
      });
      sheets['Clientes por Ruta']=data.length;
    }

    // ══ 8. CAJAS ═════════════════════════════════════════════════════════════
    {
      const LC='J';
      const ws=mkSheet(wb,'Cajas','FF0891b2',[
        {key:'codigo',width:14},{key:'nombre',width:26},{key:'tipo',width:12},
        {key:'activa',width:10},{key:'responsable',width:26},{key:'ruta',width:26},
        {key:'saldoActual',width:16},{key:'saldoMinimo',width:16},{key:'saldoMaximo',width:16},
        {key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE CAJAS','CAJAS Y FONDOS — SALDOS ACTUALES');
      const data:any[]=await(this.prisma as any).caja.findMany({
        orderBy:{creadoEn:'asc'},
        include:{
          responsable:{select:{nombres:true,apellidos:true}},
          ruta:{select:{codigo:true,nombre:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Código','Nombre','Tipo','Activa','Responsable','Ruta Asignada','Saldo Actual','Saldo Mínimo','Saldo Máximo','Creado En'],LC);
      let total=0;
      data.forEach((c:any,i:number)=>{
        const s=n2(c.saldoActual);
        const ruta=c.ruta?`${c.ruta.codigo} - ${c.ruta.nombre}`:'Sin ruta';
        const row=ws.addRow([c.codigo,c.nombre,fmtE(c.tipo),c.activa?'SÍ':'NO',
          nom(c.responsable),ruta,s,n2(c.saldoMinimo),n2(c.saldoMaximo),fmtDT(c.creadoEn)]);
        rowStyle(row,i);numCol(row,7,8,9);
        if(!c.activa)row.getCell(4).font={color:{argb:'FFDC2626'}};
        total+=s;
      });
      addTotals(ws,`TOTALES — ${data.length} cajas`,[null,null,null,null,null,total],[7]);
      sheets['Cajas']=data.length;
    }

    // ══ 9. TRANSACCIONES ═════════════════════════════════════════════════════
    {
      const LC='J';
      const ws=mkSheet(wb,'Transacciones','FF6366f1',[
        {key:'num',width:20},{key:'caja',width:26},{key:'tipo',width:14},
        {key:'monto',width:16},{key:'descripcion',width:34},
        {key:'tipoRef',width:18},{key:'creadoPor',width:26},{key:'aprobadoPor',width:26},
        {key:'fechaTx',width:22},{key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE TRANSACCIONES','TODOS LOS MOVIMIENTOS DE CAJA');
      const data:any[]=await(this.prisma as any).transaccion.findMany({
        orderBy:{fechaTransaccion:'asc'},
        include:{
          caja:{select:{codigo:true,nombre:true}},
          creadoPor:{select:{nombres:true,apellidos:true}},
          aprobadoPor:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['N° Transacción','Caja','Tipo','Monto','Descripción','Tipo Referencia','Realizado Por','Aprobado Por','Fecha y Hora Transacción','Registrado En'],LC);
      const TF:Record<string,string>={INGRESO:'FFDCFCE7',EGRESO:'FFFECACA',TRANSFERENCIA:'FFE0E7FF'};
      data.forEach((t:any,i:number)=>{
        const caja=`${t.caja?.codigo||''} - ${t.caja?.nombre||''}`;
        const row=ws.addRow([t.numeroTransaccion,caja,fmtE(t.tipo),n2(t.monto),
          t.descripcion||'',t.tipoReferencia?fmtE(t.tipoReferencia):'',
          nom(t.creadoPor),nom(t.aprobadoPor),fmtDT(t.fechaTransaccion),fmtDT(t.creadoEn)]);
        rowStyle(row,i);numCol(row,4);
        const bg=TF[String(t.tipo)];if(bg)row.getCell(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
      });
      sheets['Transacciones']=data.length;
    }

    // ══ 10. GASTOS ═══════════════════════════════════════════════════════════
    {
      const LC='J';
      const ws=mkSheet(wb,'Gastos','FFdc2626',[
        {key:'num',width:18},{key:'ruta',width:26},{key:'cobrador',width:26},
        {key:'caja',width:24},{key:'tipo',width:14},{key:'monto',width:16},
        {key:'descripcion',width:34},{key:'estadoAprob',width:18},
        {key:'aprobadoPor',width:26},{key:'fechaGasto',width:22},
      ] as any,LC,'RESPALDO DE GASTOS','HISTORIAL COMPLETO DE EGRESOS Y GASTOS OPERATIVOS');
      const data:any[]=await(this.prisma as any).gasto.findMany({
        orderBy:{fechaGasto:'asc'},
        include:{
          ruta:{select:{codigo:true,nombre:true}},
          cobrador:{select:{nombres:true,apellidos:true}},
          caja:{select:{codigo:true,nombre:true}},
          aprobadoPor:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['N° Gasto','Ruta','Reportado Por','Caja','Tipo Gasto','Monto','Descripción','Estado Aprobación','Aprobado Por','Fecha y Hora Gasto'],LC);
      const EF:Record<string,string>={PENDIENTE:'FFFEF9C3',APROBADO:'FFDCFCE7',RECHAZADO:'FFFECACA'};
      let total=0;
      data.forEach((g:any,i:number)=>{
        const ruta=g.ruta?`${g.ruta.codigo} - ${g.ruta.nombre}`:'';
        const caja=g.caja?`${g.caja.codigo} - ${g.caja.nombre}`:'';
        const row=ws.addRow([g.numeroGasto,ruta,nom(g.cobrador),caja,
          fmtE(g.tipoGasto),n2(g.monto),g.descripcion||'',
          fmtE(g.estadoAprobacion),nom(g.aprobadoPor),fmtDT(g.fechaGasto)]);
        rowStyle(row,i);numCol(row,6);
        const bg=EF[String(g.estadoAprobacion)];if(bg)row.getCell(8).fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
        total+=n2(g.monto);
      });
      addTotals(ws,`TOTALES — ${data.length} gastos`,[null,null,null,null,total],[6]);
      sheets['Gastos']=data.length;
    }

    // ══ 11. INVENTARIO ═══════════════════════════════════════════════════════
    {
      const LC='J';
      const ws=mkSheet(wb,'Inventario','FF84cc16',[
        {key:'codigo',width:16},{key:'nombre',width:30},{key:'categoria',width:18},
        {key:'marca',width:18},{key:'modelo',width:18},{key:'costo',width:14},
        {key:'stock',width:10},{key:'stockMin',width:12},{key:'activo',width:10},
        {key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE INVENTARIO','CATÁLOGO COMPLETO DE ARTÍCULOS');
      const data:any[]=await(this.prisma as any).producto.findMany({
        where:{eliminadoEn:null},orderBy:{creadoEn:'asc'},
        select:{codigo:true,nombre:true,categoria:true,marca:true,modelo:true,
          costo:true,stock:true,stockMinimo:true,activo:true,creadoEn:true},
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Código','Nombre','Categoría','Marca','Modelo','Costo Unitario','Stock Actual','Stock Mínimo','Activo','Creado En'],LC);
      data.forEach((p:any,i:number)=>{
        const row=ws.addRow([p.codigo,p.nombre,p.categoria||'',p.marca||'',p.modelo||'',
          n2(p.costo),p.stock,p.stockMinimo,p.activo?'SÍ':'NO',fmtDT(p.creadoEn)]);
        rowStyle(row,i);numCol(row,6);
        if(!p.activo)row.getCell(9).font={color:{argb:'FFDC2626'}};
        if(p.stock<=p.stockMinimo)row.getCell(7).font={bold:true,color:{argb:'FFD97706'}};
      });
      sheets['Inventario']=data.length;
    }

    // ══ 12. PRECIOS DE PRODUCTOS ═════════════════════════════════════════════
    {
      const LC='E';
      const ws=mkSheet(wb,'Precios Artículos','FF65a30d',[
        {key:'producto',width:30},{key:'codigo',width:16},
        {key:'meses',width:14},{key:'precio',width:16},{key:'activo',width:10},
      ] as any,LC,'PRECIOS DE ARTÍCULOS','TARIFAS POR PLAZO DE FINANCIAMIENTO');
      const data:any[]=await(this.prisma as any).precioProducto.findMany({
        orderBy:[{productoId:'asc'},{meses:'asc'}],
        include:{producto:{select:{nombre:true,codigo:true}}},
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Producto / Artículo','Código Producto','Plazo (meses)','Precio por Cuota','Activo'],LC);
      data.forEach((p:any,i:number)=>{
        const row=ws.addRow([p.producto?.nombre||'',p.producto?.codigo||'',p.meses,n2(p.precio),p.activo?'SÍ':'NO']);
        rowStyle(row,i);numCol(row,4);
      });
      sheets['Precios Artículos']=data.length;
    }

    // ══ 13. APROBACIONES ═════════════════════════════════════════════════════
    {
      const LC='I';
      const ws=mkSheet(wb,'Aprobaciones','FFf59e0b',[
        {key:'tipo',width:26},{key:'tabla',width:18},{key:'estado',width:14},
        {key:'monto',width:16},{key:'solicitadoPor',width:26},{key:'aprobadoPor',width:26},
        {key:'comentarios',width:34},{key:'creadoEn',width:22},{key:'revisadoEn',width:22},
      ] as any,LC,'RESPALDO DE APROBACIONES','SOLICITUDES Y DECISIONES DEL SISTEMA');
      const data:any[]=await(this.prisma as any).aprobacion.findMany({
        orderBy:{creadoEn:'asc'},
        include:{
          solicitadoPor:{select:{nombres:true,apellidos:true}},
          aprobadoPor:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Tipo Aprobación','Tabla Referencia','Estado','Monto Solicitado','Solicitado Por','Aprobado / Rechazado Por','Comentarios','Fecha y Hora Solicitud','Fecha y Hora Revisión'],LC);
      const EF:Record<string,string>={PENDIENTE:'FFFEF9C3',APROBADO:'FFDCFCE7',RECHAZADO:'FFFECACA',CANCELADO:'FFF1F5F9'};
      data.forEach((a:any,i:number)=>{
        const row=ws.addRow([fmtE(a.tipoAprobacion),a.tablaReferencia||'',fmtE(a.estado),
          n2(a.montoSolicitud),nom(a.solicitadoPor),nom(a.aprobadoPor),
          a.comentarios||'',fmtDT(a.creadoEn),fmtDT(a.revisadoEn)]);
        rowStyle(row,i);numCol(row,4);
        const bg=EF[String(a.estado)];if(bg)row.getCell(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
      });
      sheets['Aprobaciones']=data.length;
    }

    // ══ 14. EXTENSIONES DE PAGO ══════════════════════════════════════════════
    {
      const LC='G';
      const ws=mkSheet(wb,'Extensiones Pago','FFa855f7',[
        {key:'numPrestamo',width:20},{key:'cliente',width:26},{key:'numCuota',width:12},
        {key:'vencOriginal',width:14},{key:'nuevaFechaVenc',width:14},
        {key:'razon',width:36},{key:'aprobadoPor',width:26},{key:'creadoEn',width:22},
      ] as any,'H','EXTENSIONES DE PAGO','PRÓRROGAS Y CAMBIOS DE FECHA EN CUOTAS');
      const data:any[]=await(this.prisma as any).extensionPago.findMany({
        orderBy:{creadoEn:'asc'},
        include:{
          prestamo:{select:{numeroPrestamo:true,cliente:{select:{nombres:true,apellidos:true}}}},
          cuota:{select:{numeroCuota:true}},
          aprobadoPor:{select:{nombres:true,apellidos:true}},
        },
      });
      addMeta(ws,data.length,'H');
      addHdr(ws,['N° Crédito','Cliente','N° Cuota','Venc. Original','Nueva Fecha Venc.','Razón / Motivo','Aprobado Por','Creado En'],'H');
      data.forEach((e:any,i:number)=>{
        const row=ws.addRow([e.prestamo?.numeroPrestamo||'',nom(e.prestamo?.cliente),e.cuota?.numeroCuota||'',
          fmtD(e.fechaVencimientoOriginal),fmtD(e.nuevaFechaVencimiento),
          e.razon||'',nom(e.aprobadoPor),fmtDT(e.creadoEn)]);
        rowStyle(row,i);
      });
      sheets['Extensiones Pago']=data.length;
    }

    // ══ 15. USUARIOS DEL SISTEMA ═════════════════════════════════════════════
    {
      const LC='J';
      const ws=mkSheet(wb,'Usuarios','FF8b5cf6',[
        {key:'nombres',width:24},{key:'apellidos',width:24},{key:'correo',width:30},
        {key:'telefono',width:16},{key:'rol',width:26},{key:'estado',width:14},
        {key:'principal',width:12},{key:'ultimoIngreso',width:22},
        {key:'creadoPor',width:26},{key:'creadoEn',width:22},
      ] as any,LC,'RESPALDO DE USUARIOS','EQUIPO Y PERSONAL — ACCESOS AL SISTEMA');
      const data:any[]=await(this.prisma as any).usuario.findMany({
        where:{eliminadoEn:null},orderBy:{creadoEn:'asc'},
        select:{nombres:true,apellidos:true,correo:true,telefono:true,rol:true,
          estado:true,esPrincipal:true,ultimoIngreso:true,creadoPorId:true,creadoEn:true},
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Nombres','Apellidos','Correo','Teléfono','Rol','Estado','Es Principal','Último Ingreso al Sistema','Creado Por ID','Creado En'],LC);
      const EF:Record<string,string>={ACTIVO:'FFDCFCE7',INACTIVO:'FFFECACA',SUSPENDIDO:'FFFEF9C3'};
      data.forEach((u:any,i:number)=>{
        const row=ws.addRow([u.nombres||'',u.apellidos||'',u.correo||'',u.telefono||'',
          fmtE(u.rol),fmtE(u.estado),u.esPrincipal?'SÍ':'NO',
          u.ultimoIngreso?fmtDT(u.ultimoIngreso):'Nunca',u.creadoPorId||'',fmtDT(u.creadoEn)]);
        rowStyle(row,i);
        const bg=EF[String(u.estado)];if(bg)row.getCell(6).fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}};
        if(u.esPrincipal){row.getCell(7).font={bold:true,color:{argb:'FF004F7B'}};row.getCell(7).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD6E9F5'}};}
      });
      sheets['Usuarios']=data.length;
    }

    // ══ 16. REGISTRO DE AUDITORÍA ════════════════════════════════════════════
    {
      const LC='G';
      const ws=mkSheet(wb,'Auditoría','FF0f172a',[
        {key:'usuario',width:26},{key:'rol',width:20},{key:'accion',width:24},
        {key:'entidad',width:18},{key:'ip',width:16},{key:'endpoint',width:38},
        {key:'creadoEn',width:22},
      ] as any,LC,'REGISTRO DE AUDITORÍA','HISTORIAL COMPLETO DE ACTIVIDAD EN EL SISTEMA');
      const data:any[]=await(this.prisma as any).registroAuditoria.findMany({
        orderBy:{creadoEn:'desc'},take:50000,
        include:{usuario:{select:{nombres:true,apellidos:true}}},
      });
      addMeta(ws,data.length,LC);
      addHdr(ws,['Usuario','Rol','Acción Realizada','Entidad Afectada','Dirección IP','Endpoint','Fecha y Hora'],LC);
      data.forEach((a:any,i:number)=>{
        const row=ws.addRow([nom(a.usuario)||'Sistema',fmtE(a.rolUsuario||''),
          a.accion||'',a.entidad||'',a.direccionIP||'',a.endpoint||'',fmtDT(a.creadoEn)]);
        rowStyle(row,i);
      });
      sheets['Auditoría']=data.length;
    }

    // ── Escritura ────────────────────────────────────────────────────────────
    const tmpPath=`${filePath}.tmp`;
    const buf=await wb.xlsx.writeBuffer();
    await fs.writeFile(tmpPath,Buffer.from(buf as ArrayBuffer));
    try{await fs.rm(filePath,{force:true});}catch{/**/}
    await fs.rename(tmpPath,filePath);
    const info=await fs.stat(filePath);
    return{filePath,fileSize:Number(info.size),sheets};
  }
}
