import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { parkingService, BusinessError } from '../../../application/parking-service';
import { readCommand, RequestInputError } from '../../../application/http-input.mjs';
export const dynamic = 'force-dynamic';
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
async function service() {
  const user = await getChatGPTUser();
  if (!user) throw new BusinessError('Inicia sesión para operar el parqueadero.', 401);
  if (!env.DB) throw new BusinessError('Base de datos no disponible.', 503);
  return parkingService(env.DB, user.userId);
}
async function handle(run: () => Promise<unknown>) {
  try {
    return json(await run());
  } catch (e) {
    if (e instanceof BusinessError || e instanceof RequestInputError)
      return json(
        {
          error: e.message,
          code:
            e.status === 401 ? 'AUTH_REQUIRED' : e.status === 409 ? 'CONFLICT' : 'INVALID_REQUEST',
        },
        e.status,
      );
    console.error('parking_error', e instanceof Error ? e.message : 'unknown');
    return json(
      {
        error: 'No se pudo completar la operación. Actualiza la pantalla y vuelve a intentar.',
        code: 'INTERNAL_ERROR',
      },
      500,
    );
  }
}
export async function GET(request: Request) {
  return handle(async () => {
    const svc = await service();
    const p = new URL(request.url).searchParams;
    if (p.get('action') === 'report') return svc.report(p.get('from') ?? '', p.get('to') ?? '');
    if (p.get('action') === 'receipt') return svc.receipt(p.get('id') ?? '');
    if (!p.has('action') || p.get('action') === 'state') return svc.state();
    throw new BusinessError('Operación desconocida.');
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    if (
      request.headers.get('x-parking-request') !== '1' ||
      request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json'
    )
      throw new BusinessError('Solicitud inválida.', 403);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new BusinessError('Origen no permitido.', 403);
    const svc = await service();
    const body = await readCommand(request);
    switch (body.action) {
      case 'enter':
        return svc.enter(body);
      case 'quote':
        return svc.quote(body.stayId);
      case 'pay':
        return svc.pay(body);
      case 'settings':
        return svc.saveSettings(body.config);
      case 'openShift':
        return svc.openShift(body);
      case 'move':
        return svc.move(body);
      case 'closeShift':
        return svc.closeShift(body);
      default:
        throw new BusinessError('Operación desconocida.');
    }
  });
}
