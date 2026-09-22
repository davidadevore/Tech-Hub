// SW-P-08 data-link framing: DLE STX | payload | BTC | CHK | DLE ETX
// - BTC is the payload length; CHK is the two's complement of (payload sum + BTC), 8 bit.
// - Both are computed on the *unstuffed* bytes. Any DLE (0x10) in the body is sent doubled.
// - Each valid message is answered with DLE ACK, a bad one with DLE NAK.

export const DLE = 0x10;
export const STX = 0x02;
export const ETX = 0x03;
export const ACK = 0x06;
export const NAK = 0x15;

export const ACK_FRAME = Buffer.from([DLE, ACK]);
export const NAK_FRAME = Buffer.from([DLE, NAK]);

export function checksum(payload, btc = payload.length) {
  let sum = btc;
  for (const b of payload) sum += b;
  return ~sum + 1 & 0xff;
}

export function encode(payload) {
  if (payload.length === 0 || payload.length > 255) throw new RangeError('payload must be 1..255 bytes');
  const btc = payload.length;
  const out = [DLE, STX];
  for (const b of [...payload, btc, checksum(payload, btc)]) {
    out.push(b);
    if (b === DLE) out.push(DLE);
  }
  out.push(DLE, ETX);
  return Buffer.from(out);
}

const IDLE = 0, GOT_DLE = 1, IN_MSG = 2, IN_MSG_DLE = 3;

/**
 * Incremental stream decoder. push(chunk) returns events:
 *   { type: 'ack' } | { type: 'nak' } | { type: 'msg', payload: Buffer } | { type: 'bad', reason: string }
 * Tolerates garbage between frames and frames split across TCP chunks.
 */
export class Deframer {
  #state = IDLE;
  #body = [];

  push(chunk) {
    const events = [];
    for (const b of chunk) {
      switch (this.#state) {
        case IDLE:
          if (b === DLE) this.#state = GOT_DLE;
          break;
        case GOT_DLE:
          if (b === STX) { this.#body = []; this.#state = IN_MSG; }
          else if (b === ACK) { events.push({ type: 'ack' }); this.#state = IDLE; }
          else if (b === NAK) { events.push({ type: 'nak' }); this.#state = IDLE; }
          else if (b !== DLE) this.#state = IDLE;
          break;
        case IN_MSG:
          if (b === DLE) this.#state = IN_MSG_DLE;
          else this.#body.push(b);
          break;
        case IN_MSG_DLE:
          if (b === DLE) { this.#body.push(DLE); this.#state = IN_MSG; }
          else if (b === ETX) { events.push(this.#finish()); this.#state = IDLE; }
          else if (b === STX) { this.#body = []; this.#state = IN_MSG; } // lost EOM: resync on new SOM
          else { events.push({ type: 'bad', reason: 'unexpected byte after DLE' }); this.#state = IDLE; }
          break;
      }
    }
    return events;
  }

  #finish() {
    const body = this.#body;
    this.#body = [];
    if (body.length < 3) return { type: 'bad', reason: 'short frame' };
    const payload = body.slice(0, -2);
    const btc = body.at(-2);
    const chk = body.at(-1);
    if (btc !== payload.length) return { type: 'bad', reason: `length ${btc} != ${payload.length}` };
    if (chk !== checksum(payload, btc)) return { type: 'bad', reason: 'checksum' };
    return { type: 'msg', payload: Buffer.from(payload) };
  }
}
