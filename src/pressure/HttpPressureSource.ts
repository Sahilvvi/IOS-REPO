/**
 * The socket board by way of the Python bridge — adapt/backend/App.py.
 *
 * That process already owns a working bleak BLE loop, so this source
 * inherits every fix already made against the hardware, including the
 * Windows COM-apartment workaround without which scanning silently finds
 * nothing.
 *
 * Unlike native BLE this works everywhere the app runs — the iOS simulator,
 * web, a physical phone on the same network — because it's an ordinary HTTP
 * request, not a BLE connection. Useful both as a real fallback path and for
 * developing/testing without a paired device at hand.
 *
 * Requires CORS on the backend; see BLE-CONNECTION.md.
 */
import { BRIDGE_POLL_MS, BRIDGE_URL } from './deviceConfig';
import { toLogical } from './channels';
import { PressureFrame, PressureSource, SENSOR_COUNT } from './types';

export interface BridgeStatus {
  /** Is the bridge itself reachable? */
  reachable: boolean;
  /** Is the bridge connected to the socket, or falling back to its own emulator? */
  connected: boolean;
  /** 'hardware' | 'emulator' */
  source: string;
  device: string;
  error: string | null;
}

interface PressureResponse {
  nodes?: unknown;
  connected?: boolean;
  source?: string;
  device?: string;
}

export class HttpPressureSource implements PressureSource {
  readonly id = 'bridge';

  private statusListeners = new Set<(s: BridgeStatus) => void>();
  private status: BridgeStatus = {
    reachable: false,
    connected: false,
    source: 'unknown',
    device: '',
    error: null,
  };

  constructor(
    private readonly baseUrl: string = BRIDGE_URL,
    private readonly pollMs: number = BRIDGE_POLL_MS,
  ) {}

  /** One request, to check the bridge is up before switching the app onto it. */
  async probe(): Promise<BridgeStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/pressure`);
      if (!res.ok) throw new Error(`bridge returned ${res.status}`);
      const body = (await res.json()) as PressureResponse;
      return this.publish({
        reachable: true,
        connected: !!body.connected,
        source: body.source ?? 'unknown',
        device: body.device ?? '',
        error: null,
      });
    } catch (err) {
      return this.publish({
        reachable: false,
        connected: false,
        source: 'unknown',
        device: '',
        error: describe(err, this.baseUrl),
      });
    }
  }

  subscribe(onFrame: (frame: PressureFrame) => void): () => void {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`${this.baseUrl}/pressure`);
        if (!res.ok) throw new Error(`bridge returned ${res.status}`);
        const body = (await res.json()) as PressureResponse;

        if (Array.isArray(body.nodes) && body.nodes.length >= SENSOR_COUNT) {
          onFrame(toLogical(body.nodes as number[]));
        }
        this.publish({
          reachable: true,
          connected: !!body.connected,
          source: body.source ?? 'unknown',
          device: body.device ?? '',
          error: null,
        });
      } catch (err) {
        // Keep polling — the bridge restarting shouldn't kill the stream.
        this.publish({ ...this.status, reachable: false, error: describe(err, this.baseUrl) });
      }

      if (alive) timer = setTimeout(tick, this.pollMs);
    };

    tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }

  onStatus(fn: (s: BridgeStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  private publish(next: BridgeStatus): BridgeStatus {
    const changed =
      next.reachable !== this.status.reachable ||
      next.connected !== this.status.connected ||
      next.source !== this.status.source ||
      next.device !== this.status.device ||
      next.error !== this.status.error;

    this.status = next;
    if (changed) this.statusListeners.forEach(fn => fn(next));
    return next;
  }
}

function describe(err: unknown, url: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  // A browser/RN reports a blocked cross-origin or unreachable request as a
  // bare network failure, which reads identically to the server being down.
  // Name both possibilities so "can't connect" isn't a dead end.
  if (/failed to fetch|network request failed/i.test(msg)) {
    return `Cannot reach ${url}. Is the bridge running, and is CORS enabled on it?`;
  }
  return msg;
}
