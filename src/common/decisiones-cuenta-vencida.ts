/**
 * Cómo se llama cada decisión sobre una cuenta vencida en los textos que lee
 * una persona: notificaciones, avisos push y mensajes de error.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * La misma decisión se llamaba de seis formas distintas entre el backend y el
 * frontend. Lo que leía una persona que pedía una gestión y luego iba a
 * aprobarla:
 *
 *   enum            esta ruta        notificación        pantalla (3 sitios)
 *   ─────────────────────────────────────────────────────────────────────────
 *   PRORROGAR       Prórroga         «una prórroga»      Prorrogar Plan /
 *                                                        Prórroga de Plazo /
 *                                                        Prorroga
 *   DEJAR_QUIETO    Dejar quieto     «dejar quieto»      Dejar Quieto /
 *                                                        Sin Mora por Ahora /
 *                                                        Sin mora por ahora
 *   CASTIGAR        Baja por pérdida «dar de baja…»      Reportar Pérdida /
 *                                                        Baja por Pérdida /
 *                                                        Baja por perdida
 *
 * Nadie puede saber que se está hablando de lo mismo. Y en el aviso que llega
 * al teléfono es peor: es el único texto que la persona va a leer antes de
 * decidir si entra a aprobarlo.
 *
 * ── Sobre «dejar quieto» ────────────────────────────────────────────────────
 *
 * Se cambió por «Dejar en seguimiento». «Dejar quieto» es del habla de la
 * oficina: quien lo dice sabe qué significa, pero quien entra nuevo tiene que
 * preguntarlo, y es una de tres opciones que deciden qué se hace con la deuda
 * de alguien.
 *
 * ── Lo que NO se cambia ─────────────────────────────────────────────────────
 *
 * El valor del enum (`DEJAR_QUIETO`) se queda como está: está guardado en la
 * base, en las aprobaciones ya creadas y en la cola de operaciones sin
 * conexión. Lo que cambia es solo cómo se escribe cuando se le muestra a
 * alguien.
 *
 * El frontend tiene su copia en `lib/display-labels.ts`, con los mismos
 * textos. Son dos repositorios distintos y no comparten código; lo que hay es
 * un sitio por lado, en vez de seis repartidos.
 */

export const DECISIONES_CUENTA_VENCIDA = {
  PRORROGAR: {
    label: 'Prorrogar el plan',
    /** En tercera persona, para armar «X solicitó …». */
    accion: 'prorrogar el plan',
  },
  DEJAR_QUIETO: {
    label: 'Dejar en seguimiento',
    accion: 'dejar en seguimiento',
  },
  CASTIGAR: {
    label: 'Dar de baja por pérdida',
    accion: 'dar de baja por pérdida',
  },
  JURIDICO: {
    label: 'Pasar a cobro jurídico',
    accion: 'pasar a cobro jurídico',
  },
} as const;

export type DecisionCuentaVencida = keyof typeof DECISIONES_CUENTA_VENCIDA;

/**
 * El nombre de una decisión, o el enum legible si llega una que no está.
 *
 * El respaldo evita que un enum nuevo deje el título de una notificación en
 * blanco: antes, `LABEL_DECISION[decision]` devolvía `undefined` para
 * `JURIDICO` —que sí existe en el DTO de reportes— y el aviso salía como
 * «undefined — Juan Pérez (PRES-000012)».
 */
export function etiquetaDecision(decision?: string | null): string {
  const clave = String(decision || '')
    .trim()
    .toUpperCase() as DecisionCuentaVencida;
  const conocida = DECISIONES_CUENTA_VENCIDA[clave];
  if (conocida) return conocida.label;
  if (!clave) return 'Sin decisión';
  return clave
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((parte, i) =>
      i === 0 ? parte.charAt(0).toUpperCase() + parte.slice(1) : parte,
    )
    .join(' ');
}

/** La acción en infinitivo, para armar frases como «X solicitó …». */
export function accionDecision(decision?: string | null): string {
  const clave = String(decision || '')
    .trim()
    .toUpperCase() as DecisionCuentaVencida;
  const conocida = DECISIONES_CUENTA_VENCIDA[clave];
  return conocida ? conocida.accion : etiquetaDecision(decision).toLowerCase();
}
