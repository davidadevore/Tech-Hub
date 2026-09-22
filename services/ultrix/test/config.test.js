import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildView, parseRanges, profileInfo, profileNames } from '../src/config.js';

test('parseRanges', () => {
  const r = parseRanges('1-3, 7,10-*');
  assert.deepEqual([0, 1, 3, 4, 7, 9, 10, 500].map(r), [false, true, true, false, true, false, true, true]);
  assert.equal(parseRanges('')(1), false);
  assert.throws(() => parseRanges('3-1'), /backwards/);
  assert.throws(() => parseRanges('a'), /bad range/);
});

const names = (arr) => new Map(arr.map((n, i) => [i + 1, n]));
const routerNames = { sources: names(['CAM 1', 'CAM 2', 'SAT 1', '', 'GFX 1']), destinations: names(['MON 1', 'MON 2', 'REC 1', 'TX 1']) };

const cfg = {
  title: 'Base',
  levels: [{ name: 'Video', short: 'V' }, { name: 'Audio 1', short: 'A1' }],
  sources: {
    hidden: '5',
    labels: { 2: 'Studio cam' },
    categories: [{ name: 'Cameras', match: '^CAM|^Studio' }, { name: 'Sat', match: '^SAT' }],
  },
  destinations: { protected: '4', categories: [{ name: 'Monitors', range: '1-2' }] },
  profiles: {
    op: { sources: { include: '1-3' }, levels: [1] },
    ro: { readOnly: true },
    eng: { pin: '1234', destinations: { protected: '' } },
  },
};

test('applies labels, categories, hidden ranges and router names', () => {
  const v = buildView(cfg, 'ro', routerNames);
  assert.deepEqual(v.json.sources.map((s) => [s.n, s.name, s.cat]), [
    [1, 'CAM 1', 'Cameras'], [2, 'Studio cam', 'Cameras'], [3, 'SAT 1', 'Sat'], [4, 'SRC 4', 'Other'],
  ]);
  assert.deepEqual(v.json.categories.sources, ['Cameras', 'Sat', 'Other']);
  assert.equal(v.readOnly, true);
});

test('profile include/levels narrow what a take may use', () => {
  const v = buildView(cfg, 'op', routerNames);
  assert.deepEqual([...v.sourceSet], [1, 2, 3]);
  assert.deepEqual(v.json.levels.map((l) => l.n), [1]);
  assert.deepEqual([...v.lockedDests], [4]);
});

test('a profile can lift base protection', () => {
  assert.deepEqual([...buildView(cfg, 'eng', routerNames).lockedDests], []);
  assert.equal(buildView(cfg, 'eng', routerNames).json.destinations.find((d) => d.n === 4).locked, undefined);
});

test('hideUnnamed drops ports with no router name or label', () => {
  const v = buildView({ ...cfg, sources: { ...cfg.sources, hidden: '', hideUnnamed: true } }, 'ro', routerNames);
  assert.ok(!v.sourceSet.has(4));
});

test('profile helpers', () => {
  assert.deepEqual(profileNames({}), ['default']);
  assert.equal(profileInfo(cfg, 'eng').locked, true);
  assert.equal(profileInfo(cfg, 'default'), null, 'implicit "default" must not bypass configured profiles');
  assert.equal(profileInfo({}, 'default').locked, false);
});

test('level groups resolve ranges, respect the profile, and drop empty groups', () => {
  const levelCfg = {
    levels: Array.from({ length: 17 }, (_, i) => ({ name: i ? `Audio ${i}` : 'Video', short: i ? `A${i}` : 'V' })),
    levelGroups: [{ name: 'All', levels: '1-17' }, { name: 'Video', levels: [1] }, { name: 'Audio', levels: '2-17' }],
    profiles: { video: { levels: [1] }, full: {} },
  };
  const full = buildView(levelCfg, 'full', routerNames).json;
  assert.deepEqual(full.levelGroups.map((g) => [g.name, g.levels.length]), [['All', 17], ['Video', 1], ['Audio', 16]]);
  const video = buildView(levelCfg, 'video', routerNames).json;
  assert.deepEqual(video.levelGroups.map((g) => g.name), ['All', 'Video'], 'Audio group is empty for a video-only profile');
});

test('sourceNames labels every router source, including ones hidden from the profile', () => {
  const v = buildView(cfg, 'op', routerNames).json; // op only includes sources 1-3
  assert.equal(v.sources.length, 3);
  assert.equal(v.sourceNames[5], 'GFX 1', 'hidden source still has a display name');
  assert.equal(v.sourceNames[2], 'Studio cam', 'label overrides apply');
  assert.equal(v.sourceNames[4], undefined, 'blank router names are left out');
});
