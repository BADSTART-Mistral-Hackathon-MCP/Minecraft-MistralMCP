import net from 'net';

export async function waitForPort(
  host: string,
  port: number,
  retries: number,
  intervalMs: number
): Promise<boolean> {
  const tryOnce = (): Promise<boolean> =>
    new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;

      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        try { socket.destroy(); } catch {}
        resolve(ok);
      };

      socket.setTimeout(Math.max(1000, Math.min(intervalMs, 10000)));
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(port, host);
    });

  for (let i = 0; i < retries; i++) {
    const ok = await tryOnce();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

