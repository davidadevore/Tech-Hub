import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connect, interrogate, nameRequests, needsExtended, parse, tallyDumpRequest } from '../src/swp08/commands.js';

test('standard connect / interrogate match the reference client', () => {
  assert.deepEqual(connect({ matrix: 1, level: 2, dest: 3, src: 5 }, false), [0x02, 0x01, 0x00, 0x02, 0x04]);
  assert.deepEqual(interrogate({ matrix: 1, level: 2, dest: 3 }, false), [0x01, 0x01, 0x00, 0x02]);
});

test('standard connect uses the DIV 128 multiplier for high port numbers', () => {
  // dest 200 (wire 199 = 1*128+71), src 1000 (wire 999 = 7*128+103)
  assert.deepEqual(connect({ matrix: 1, level: 1, dest: 200, src: 1000 }, false), [0x02, 0x00, 0x17, 71, 103]);
  assert.deepEqual(parse(Buffer.from([0x03, 0x00, 0x17, 71, 103])), { type: 'route', matrix: 1, level: 1, dest: 200, src: 1000 });
});

test('extended connect carries 16-bit ports and 8-bit levels', () => {
  assert.deepEqual(connect({ matrix: 1, level: 20, dest: 1, src: 1 }, true), [0x82, 0, 19, 0, 0, 0, 0]);
  assert.deepEqual(connect({ matrix: 2, level: 4, dest: 300, src: 500 }, true), [0x82, 1, 3, 1, 43, 1, 243]);
});

test('standard commands refuse values they cannot encode', () => {
  assert.throws(() => connect({ matrix: 1, level: 17, dest: 1, src: 1 }, false), RangeError);
  assert.throws(() => connect({ matrix: 1, level: 1, dest: 1025, src: 1 }, false), RangeError);
  assert.throws(() => connect({ matrix: 1, level: 1, dest: 0, src: 1 }, false), RangeError);
  assert.equal(needsExtended({ dest: 1025 }), true);
  assert.equal(needsExtended({ level: 16, dest: 1024, src: 1 }), false);
});

test('tally dump and name requests', () => {
  assert.deepEqual(tallyDumpRequest({ matrix: 1, level: 3 }, false), [0x15, 0x02]);
  assert.deepEqual(tallyDumpRequest({ matrix: 1, level: 3 }, true), [0x95, 0, 2]);
  assert.deepEqual(nameRequests({ matrix: 1, chars: 12 }, false), { source: [0x64, 0x00, 2], dest: [0x66, 0x00, 2] });
  assert.deepEqual(nameRequests({ matrix: 1, chars: 8 }, true), { source: [0xe4, 0, 0, 1], dest: [0xe6, 0, 1] });
  assert.throws(() => nameRequests({ matrix: 1, chars: 10 }, false), RangeError);
});

test('parses tally / connected in standard and extended form', () => {
  assert.deepEqual(parse(Buffer.from([0x04, 0x01, 0x00, 0x02, 0x04])), { type: 'route', matrix: 1, level: 2, dest: 3, src: 5 });
  assert.deepEqual(parse(Buffer.from([0x84, 0, 3, 1, 43, 1, 243])), { type: 'route', matrix: 1, level: 4, dest: 300, src: 500 });
});

test('parses byte and word tally dumps (vectors from the Companion module tests)', () => {
  assert.deepEqual(parse(Buffer.from([0x16, 0x00, 3, 9, 19, 20, 21])), { type: 'dump', matrix: 1, level: 1, firstDest: 10, sources: [20, 21, 22] });
  assert.deepEqual(parse(Buffer.from([0x17, 0x00, 2, 0x01, 0x00, 0x00, 0x05, 0x01, 0x00])), { type: 'dump', matrix: 1, level: 1, firstDest: 257, sources: [6, 257] });
  assert.deepEqual(parse(Buffer.from([0x97, 0, 1, 2, 0, 8, 0, 4, 0, 5])), { type: 'dump', matrix: 1, level: 2, firstDest: 9, sources: [5, 6] });
});

test('parses source and destination name packets', () => {
  const pad = (s, n) => [...Buffer.from(s.padEnd(n, '\0'))];
  const src = parse(Buffer.from([0x6a, 0x00, 1, 0, 4, 2, ...pad('CAM 5', 8), ...pad('CAM 6', 8)]));
  assert.deepEqual(src, { type: 'names', kind: 'source', matrix: 1, first: 5, names: ['CAM 5', 'CAM 6'] });
  const dst = parse(Buffer.from([0xeb, 0, 2, 0, 0, 1, ...pad('MON 1', 12)]));
  assert.deepEqual(dst, { type: 'names', kind: 'dest', matrix: 1, first: 1, names: ['MON 1'] });
  const extSrc = parse(Buffer.from([0xea, 0, 0, 0, 0, 9, 1, ...pad('SAT A', 4).slice(0, 4)]));
  assert.equal(extSrc.first, 10);
});

test('truncated packets parse to null instead of throwing', () => {
  for (const p of [[0x04, 1], [0x84, 0, 0], [0x16, 0, 5, 1, 2], [0x6a, 0, 2, 0, 0, 3, 65], [0x97, 0, 0, 9, 0, 1]]) {
    assert.equal(parse(Buffer.from(p)), null, `0x${p[0].toString(16)}`);
  }
});

test('0xFFFF in 16-bit fields means "no source" and parses to 0', () => {
  assert.deepEqual(parse(Buffer.from([0x84, 0, 1, 0, 9, 0xff, 0xff])), { type: 'route', matrix: 1, level: 2, dest: 10, src: 0 });
  assert.deepEqual(parse(Buffer.from([0x97, 0, 0, 2, 0, 0, 0xff, 0xff, 0, 4])).sources, [0, 5]);
  assert.deepEqual(parse(Buffer.from([0x17, 0, 1, 0, 0, 0xff, 0xff])).sources, [0]);
});
