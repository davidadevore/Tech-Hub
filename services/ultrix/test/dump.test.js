import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDump, suggestCategories, toJson } from '../src/dump.js';
import { smallNames, startPair, until } from './helpers.js';

test('suggestCategories groups by leading letters, needs 3+ ports, keeps first-seen order', () => {
  const names = new Map([[1, 'CAM 01'], [2, 'CAM 02'], [3, 'CAM 03'], [4, 'SAT 1'], [5, 'SAT 2'], [6, 'GFX-1'], [7, 'GFX-2'], [8, 'GFX-3'], [9, '12 odd']]);
  assert.deepEqual(suggestCategories(names).map((g) => [g.name, g.count, g.first, g.last]), [['CAM', 3, 1, 3], ['GFX', 3, 6, 8]]);
});

test('buildDump reports unnamed ports, routed-but-unnamed sources, and quotes awkward names', () => {
  const sourceNames = new Map([[1, 'CAM 1'], [2, 'CAM, "wide"'], [3, 'CAM 3'], [5, 'SAT 1']]);
  const destNames = new Map([[1, 'MON 1'], [2, 'MON 2']]);
  const routes = new Map([[1, new Map([[1, 2], [2, 2]])], [2, new Map([[1, 4], [2, 1]])], [3, new Map([[1, 1]])]]);
  const d = buildDump({ sourceNames, destNames, routes, levels: 2 });
  assert.deepEqual(d.stats.unnamedSources, [4]);
  assert.deepEqual(d.stats.routedButUnnamed, [4]);
  assert.equal(d.stats.destPorts, 3, 'destination count also comes from the tally dump');
  assert.deepEqual(d.stats.unnamedDests, [3]);
  const lines = d.sourcesCsv.trim().split('\n');
  assert.equal(lines[2], '2,"CAM, ""wide""",1');
  assert.equal(lines[1], '1,CAM 1,1');
  const dst = d.destinationsCsv.trim().split('\n');
  assert.equal(dst[2], '2,MON 2,4,,yes', 'breakaway flagged; unnamed source 4 has an empty name');
  assert.match(d.summary, /Routed from sources that have no name: 4/);
  assert.match(d.summary, /"match": "\^CAM"/);
  assert.deepEqual(Object.keys(toJson({ sourceNames, destNames, routes }, { levels: 2 })), ['levels', 'sources', 'destinations', 'routes']);
});

test('dumping a real (mock) router end to end', async () => {
  const { client, stop } = await startPair({ mock: { sources: [...smallNames('CAM', 6), '', ...smallNames('SAT', 3)], dests: smallNames('MON', 8) } });
  try {
    await until(() => client.sourceNames.size >= 9 && client.destNames.size >= 8, 3000, 'names');
    const d = buildDump({ sourceNames: client.sourceNames, destNames: client.destNames, routes: client.routes, levels: 3 });
    assert.equal(d.stats.sourcePorts, 10);
    assert.deepEqual(d.stats.unnamedSources, [7]);
    assert.equal(d.stats.destPorts, 8);
    assert.deepEqual(d.suggestions.sources.map((g) => [g.name, g.count]), [['CAM', 6], ['SAT', 3]]);
  } finally { await stop(); }
});
