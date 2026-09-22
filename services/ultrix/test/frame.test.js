import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACK_FRAME, Deframer, NAK_FRAME, checksum, encode } from '../src/swp08/frame.js';

const hex = (buf) => Buffer.from(buf).toString('hex');

test('encode matches the reference framing (payload, BTC, two\'s complement checksum)', () => {
  // Same payload the Companion SW-P-08 module tests use: connect src 5 -> dst 3, level 2.
  const frame = encode([0x02, 0x01, 0x00, 0x02, 0x04]);
  assert.equal(hex(frame), '1002' + '0201000204' + '05' + 'f2' + '1003');
  assert.equal((0x02 + 0x01 + 0x00 + 0x02 + 0x04 + 0x05 + 0xf2) & 0xff, 0, 'bytes sum to zero mod 256');
});

test('DLE bytes in the body are doubled', () => {
  const frame = encode([0x02, 0x10, 0x03]);
  assert.deepEqual([...frame.subarray(2, 6)], [0x02, 0x10, 0x10, 0x03]);
});

test('a checksum that happens to be 0x10 is stuffed and still round-trips', () => {
  let payload;
  for (let x = 0; x < 256 && !payload; x++) if (checksum([0x02, 0x01, 0x00, x, 0x04]) === 0x10) payload = [0x02, 0x01, 0x00, x, 0x04];
  assert.ok(payload, 'found a payload whose checksum is DLE');
  const events = new Deframer().push(encode(payload));
  assert.deepEqual(events.map((e) => e.type), ['msg']);
  assert.deepEqual([...events[0].payload], payload);
});

test('round-trips random payloads, including DLE-heavy ones, byte by byte', () => {
  const d = new Deframer();
  for (let i = 0; i < 300; i++) {
    const len = 1 + (i % 40);
    const payload = Array.from({ length: len }, (_, j) => (i % 3 === 0 && j % 4 === 0 ? 0x10 : (i * 31 + j * 17) & 0xff));
    const events = [];
    for (const b of encode(payload)) events.push(...d.push(Buffer.from([b])));
    assert.equal(events.length, 1, `payload ${i}`);
    assert.deepEqual([...events[0].payload], payload);
  }
});

test('decodes back-to-back frames, ACK/NAK and skips line noise', () => {
  const d = new Deframer();
  const stream = Buffer.concat([Buffer.from([0x00, 0xff]), ACK_FRAME, encode([1, 2, 3]), NAK_FRAME, encode([4, 5])]);
  const types = d.push(stream).map((e) => e.type);
  assert.deepEqual(types, ['ack', 'msg', 'nak', 'msg']);
});

test('reports a bad checksum and a bad length instead of a message', () => {
  const good = encode([0x03, 0x00, 0x00, 0x01, 0x02]);
  const badChk = Buffer.from(good);
  badChk[badChk.length - 3] ^= 0x01;
  assert.deepEqual(new Deframer().push(badChk).map((e) => [e.type, e.reason]), [['bad', 'checksum']]);

  const badLen = Buffer.from(good);
  badLen[badLen.length - 4] += 1;
  assert.equal(new Deframer().push(badLen)[0].type, 'bad');
});

test('recovers on the next frame after a truncated one', () => {
  const d = new Deframer();
  const whole = encode([9, 9, 9]);
  const events = d.push(Buffer.concat([whole.subarray(0, 5), encode([7, 7])]));
  assert.deepEqual(events.map((e) => e.type), ['msg']);
  assert.deepEqual([...events[0].payload], [7, 7]);
});
