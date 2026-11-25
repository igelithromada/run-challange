import { chatState } from '../../../lib/chatAvailability';
import { authErrorResponse, requireUser } from '../../../lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { adminDb } = await requireUser(request);
    const meta = chatState(adminDb);
    if ((await meta.get()).data()?.enabled === false) return new Response(null, { status: 403 });
    const encoder = new TextEncoder();
    let dispose = () => {};
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        let unsubscribe: (() => void) | undefined;
        const timer = setTimeout(() => finish(), 45_000);
        const heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(': keep-alive\n\n'));
        }, 15_000);
        const abort = () => finish();
        function finish(close = true) {
          if (closed) return;
          closed = true;
          clearTimeout(timer);
          clearInterval(heartbeat);
          unsubscribe?.();
          request.signal.removeEventListener('abort', abort);
          if (close) controller.close();
        }
        dispose = () => finish(false);
        request.signal.addEventListener('abort', abort, { once: true });
        if (request.signal.aborted) {
          finish();
          return;
        }
        unsubscribe = meta.onSnapshot(snapshot => {
          if (closed) return;
          if (snapshot.data()?.enabled === false) { finish(); return; }
          const revision = String(snapshot.data()?.revision || 'empty');
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(revision) + '\n\n'));
        }, () => finish());
      },
      cancel() { dispose(); },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'private, no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    return new Response(null, { status: auth?.status ?? 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
