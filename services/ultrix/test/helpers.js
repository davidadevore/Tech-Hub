import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { createMockRouter } from '../src/mock-router.js';
import { Swp08Client } from '../src/swp08/client.js';

export async function until(fn, timeoutMs = 5000, what = 'condition') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await sleep(20);
  }
  throw new Error(`timed out waiting for ${what}`);
}

export const smallNames = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);

/** Start a mock router + connected client. Returns { mock, client, stop }. */
export async function startPair({ mock: mockOpts = {}, client: clientOpts = {} } = {}) {
  const mock = createMockRouter({ levels: 3, ...mockOpts });
  const port = await mock.listen(0, '127.0.0.1');
  const client = new Swp08Client({ host: '127.0.0.1', port, levels: mock.routes.length, allowRouting: true, ackTimeoutMs: 400, loadTimeoutMs: 4000, ...clientOpts });
  client.start();
  await until(() => client.ready, 10000, 'client ready');
  return {
    mock,
    client,
    async stop() { client.stop(); await mock.close(); },
  };
}

export { once };
