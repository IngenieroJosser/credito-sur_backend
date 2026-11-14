import { RateLimitGuard } from './rate-limit.guard';

/**
 * Un ingreso que sale bien no gasta cupo.
 *
 * ── Lo que pasaba, medido contra el servidor ────────────────────────────────
 *
 * El perfil `auth` permite 10 peticiones por minuto y se cuenta POR IP. Tiene
 * que ser por IP: en el login quien llama todavia no es nadie, asi que contar
 * por usuario no protegeria de un ataque por fuerza bruta.
 *
 * Pero aqui la oficina trabaja en LAN y todos salen por la misma IP. Con los
 * siete roles, entrar por la mañana gasta 7 de los 10; dos contraseñas mal
 * tecleadas y la oficina entera queda fuera hasta un minuto. Pedido once veces
 * seguidas, el servidor contesta:
 *
 *     429  {"message":"Demasiadas solicitudes...","retryAfterSeconds":7}
 *     x-ratelimit-limit: 10   x-ratelimit-remaining: 0
 *
 * ── Que cambia ──────────────────────────────────────────────────────────────
 *
 * El cupo se devuelve cuando la respuesta sale bien. Los intentos FALLIDOS
 * siguen contando enteros, que es justo lo que frena la fuerza bruta: quien
 * adivina contraseñas falla.
 */

/** Alcanza el metodo privado por su nombre, sin apagar el tipado con `as any`. */
type GuardConInternos = {
  devolverCupo(key: string): Promise<void>;
  contarEnMemoria(key: string, windowMs: number): { count: number };
  buckets: Map<string, { count: number; resetAt: number }>;
};

const comoInternos = (guard: RateLimitGuard) =>
  guard as unknown as GuardConInternos;

describe('devolverCupo', () => {
  it('resta una peticion del conteo en memoria', async () => {
    const guard = comoInternos(new RateLimitGuard());

    guard.contarEnMemoria('k', 60_000);
    guard.contarEnMemoria('k', 60_000);
    expect(guard.buckets.get('k')?.count).toBe(2);

    await guard.devolverCupo('k');

    expect(guard.buckets.get('k')?.count).toBe(1);
  });

  it('nunca deja el conteo por debajo de cero', async () => {
    // Si bajara de cero, una racha de ingresos correctos regalaria cupo
    // para los intentos fallidos que vinieran despues.
    const guard = comoInternos(new RateLimitGuard());

    guard.contarEnMemoria('k', 60_000);
    await guard.devolverCupo('k');
    await guard.devolverCupo('k');
    await guard.devolverCupo('k');

    expect(guard.buckets.get('k')?.count).toBe(0);
  });

  it('no resucita una ventana ya vencida', async () => {
    /*
     * Importa: si devolver cupo creara o reviviera la clave, la ventana se
     * alargaria sola y el limite dejaria de aplicarse cuando toca.
     */
    const guard = comoInternos(new RateLimitGuard());

    guard.contarEnMemoria('k', 60_000);
    const bucket = guard.buckets.get('k')!;
    bucket.resetAt = Date.now() - 1; // vencida

    await guard.devolverCupo('k');

    expect(guard.buckets.get('k')?.count).toBe(1);
  });

  it('con una clave que no existe no hace nada ni revienta', async () => {
    const guard = comoInternos(new RateLimitGuard());

    await expect(guard.devolverCupo('no-existe')).resolves.toBeUndefined();
    expect(guard.buckets.has('no-existe')).toBe(false);
  });
});

describe('el ciclo completo: entrar bien no acerca al limite', () => {
  /**
   * Siete personas entrando bien, una detras de otra, desde la misma IP.
   * Antes el conteo quedaba en 7 de 10 y los tres que sobran se los comia
   * cualquier reintento. Ahora vuelve a cero.
   */
  it('siete ingresos correctos dejan el cupo como estaba', async () => {
    const guard = comoInternos(new RateLimitGuard());
    const clave = 'ratelimit:auth:10.0.0.5';

    for (let i = 0; i < 7; i++) {
      guard.contarEnMemoria(clave, 60_000);
      await guard.devolverCupo(clave); // la respuesta salio 200
    }

    expect(guard.buckets.get(clave)?.count).toBe(0);
  });

  it('pero siete intentos FALLIDOS si llegan al limite', async () => {
    // Es lo que no puede cambiar: el que adivina contraseñas falla, y ahi el
    // cupo tiene que gastarse.
    const guard = comoInternos(new RateLimitGuard());
    const clave = 'ratelimit:auth:10.0.0.5';

    for (let i = 0; i < 7; i++) {
      guard.contarEnMemoria(clave, 60_000); // sin devolver: la respuesta fue 401
    }

    expect(guard.buckets.get(clave)?.count).toBe(7);
  });
});
