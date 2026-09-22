import { readFileSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createMockRouter } from './mock-router.js';
import { createPanelServer } from './server.js';
import { Swp08Client } from './swp08/client.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const configPath = path.resolve(args.includes('--config') ? args[args.indexOf('--config') + 1] : path.join(root, 'config.json'));

/** Turns a `npm run dump` router-dump.json into simulator options, so the panel can be exercised with real names offline. */
function loadReplay(file) {
  const dump = JSON.parse(readFileSync(file, 'utf8'));
  const toList = (map) => {
    const max = Math.max(0, ...Object.keys(map).map(Number));
    return Array.from({ length: max }, (_, i) => map[i + 1] ?? '');
  };
  return { sources: toList(dump.sources), dests: toList(dump.destinations), initialRoutes: dump.routes };
}

let config = loadConfig(configPath);
const log = (level, msg) => console.log(`${new Date().toISOString().slice(11, 19)} ${level.padEnd(5)} ${msg}`);
const levelCount = () => (config.levels ?? [{}]).length;

let mock = null;
if (config.mock?.enabled) {
  const replay = config.mock.replay ? loadReplay(path.resolve(path.dirname(configPath), config.mock.replay)) : {};
  mock = createMockRouter({ levels: levelCount(), chaos: 0, ...replay, ...config.mock, log });
  const port = await mock.listen(config.router.port, '127.0.0.1');
  log('info', `mock SW-P-08 router listening on 127.0.0.1:${port} (${mock.sourceCount} sources, ${mock.destCount} destinations)`);
}

// Routing is on unless config.router.allowRouting is explicitly false (a read-only connection).
const allowRouting = config.router.allowRouting !== false;
const router = new Swp08Client({ ...config.router, allowRouting, levels: levelCount(), destinations: config.destinations?.count ?? 0 });
log('info', allowRouting ? 'routing enabled' : 'routing DISABLED (router.allowRouting is false): read-only, nothing will be sent to change a route');
router.on('log', log);
router.on('status', (s) => log('info', `router ${s}`));
if (config.router.host) router.start();
else log('info', 'Set the router host in Tech Hub service settings to connect.');

const panel = createPanelServer({ getConfig: () => config, router, publicDir: path.join(root, 'public') });
const port = await panel.listen(Number(process.env.TECH_HUB_BACKEND_PORT || config.server?.port || 8080), process.env.TECH_HUB_BACKEND_HOST || config.server?.host || '0.0.0.0');
log('info', `panel on http://localhost:${port}`);

// Reload visibility/categories/profiles when the config file is saved. Router and level settings need a restart.
let reloadTimer;
watch(configPath, () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    try {
      config = loadConfig(configPath);
      panel.invalidate();
      log('info', 'config reloaded');
    } catch (err) {
      log('error', `config reload failed, keeping previous config: ${err.message}`);
    }
  }, 200);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    router.stop();
    await panel.close();
    await mock?.close();
    process.exit(0);
  });
}
