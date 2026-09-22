'use strict';
// Lists AJA Ki Pro parameters (with current values) that look like transport/media/storage status,
// so you can put the right eParamID_* names into config.json.
//   node probe.js 192.168.1.111            (likely candidates only)
//   node probe.js 192.168.1.111 --all      (every parameter)
// Run it once while the unit has media loaded, and again while recording, to see which values change.

const host = process.argv[2];
const all = process.argv.includes('--all');
if (!host) { console.error('Usage: node probe.js <ki-pro-ip> [--all]'); process.exit(1); }

const LIKELY = /(transport|media|storage|slot|drive|disk|ssd|space|remain|avail|free|percent|record|time|min)/i;
const SKIP = /(command|requested|format|path|profile)/i;

async function getJson(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return JSON.parse(await r.text());
}
function collectIds(node, out) {
  if (Array.isArray(node)) node.forEach((n) => collectIds(n, out));
  else if (node && typeof node === 'object') {
    if (typeof node.param_id === 'string') out.add(node.param_id);
    Object.values(node).forEach((v) => collectIds(v, out));
  }
  return out;
}

(async () => {
  let ids;
  try {
    ids = [...collectIds(await getJson(`http://${host}/desc.json`, 15000), new Set())];
  } catch (e) {
    console.error(`Could not read http://${host}/desc.json (${e.message}).`);
    console.error(`Open http://${host}/descriptors.html in a browser to browse the parameter list manually.`);
    process.exit(1);
  }
  const picked = ids.filter((id) => all || (LIKELY.test(id) && !SKIP.test(id))).sort();
  console.log(`${ids.length} parameters on the unit; checking ${picked.length}.\n`);
  const rows = [];
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < picked.length) {
      const id = picked[next++];
      try {
        const j = await getJson(`http://${host}/config?action=get&paramid=${encodeURIComponent(id)}`, 4000);
        rows.push([id, String(j.value ?? '').slice(0, 40), String(j.value_name ?? '').slice(0, 40)]);
      } catch { rows.push([id, '(unreadable)', '']); }
    }
  }));
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  const w = Math.max(...rows.map((r) => r[0].length), 9);
  console.log('PARAM'.padEnd(w), ' VALUE'.padEnd(42), 'VALUE_NAME');
  for (const [id, v, n] of rows) console.log(id.padEnd(w), '', v.padEnd(40), n);
  console.log('\nLook for numeric parameters that read like % free / % used / minutes remaining per media slot.');
  console.log('Then in config.json, under this Ki Pro:');
  console.log('  "media": [ { "label": "SSD 1", "freePercent": "eParamID_...", "remainingMinutes": "eParamID_..." } ]');
  console.log('(use "usedPercent" instead of "freePercent", or "remainingSeconds" instead of "remainingMinutes", as needed)');
})();
