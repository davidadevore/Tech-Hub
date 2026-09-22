// SW-P-08 message builders and parsers.
// Public API is 1-based everywhere (matrix, level, source, destination) to match how routers and
// Companion present numbers; conversion to the 0-based wire values happens only in this file.

export const CMD = {
  INTERROGATE: 0x01,
  CONNECT: 0x02,
  TALLY: 0x03,
  CONNECTED: 0x04,
  NAMES_UPDATED: 0x1e,
  TALLY_DUMP: 0x15,
  TALLY_DUMP_BYTE: 0x16,
  TALLY_DUMP_WORD: 0x17,
  PROTOCOL_REQUEST: 0x61,
  PROTOCOL_RESPONSE: 0x62,
  GET_SOURCE_NAMES: 0x64,
  GET_DEST_NAMES: 0x66,
  SOURCE_NAMES: 0x6a,
  DEST_NAMES: 0x6b,
  EXT_INTERROGATE: 0x81,
  EXT_CONNECT: 0x82,
  EXT_TALLY: 0x83,
  EXT_CONNECTED: 0x84,
  EXT_TALLY_DUMP: 0x95,
  EXT_TALLY_DUMP_WORD: 0x97,
  EXT_GET_SOURCE_NAMES: 0xe4,
  EXT_GET_DEST_NAMES: 0xe6,
  EXT_SOURCE_NAMES: 0xea,
  EXT_DEST_NAMES: 0xeb,
};

// Name length codes used in name requests/responses.
const NAME_LENGTHS = [4, 8, 12, 16, 32];

export const STANDARD_LIMITS = { matrices: 16, levels: 16, ports: 1024 };

export function needsExtended({ level = 1, matrix = 1, dest = 1, src = 1 }) {
  return level > STANDARD_LIMITS.levels || matrix > STANDARD_LIMITS.matrices
    || dest > STANDARD_LIMITS.ports || src > STANDARD_LIMITS.ports;
}

function check(name, value, max) {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new RangeError(`${name} ${value} out of range 1..${max}`);
  return value - 1;
}

export function protocolRequest() {
  return [CMD.PROTOCOL_REQUEST];
}

export function interrogate({ matrix, level, dest }, ext) {
  if (ext) {
    const d = check('dest', dest, 65536);
    return [CMD.EXT_INTERROGATE, check('matrix', matrix, 256), check('level', level, 256), d >> 8, d & 0xff];
  }
  const d = check('dest', dest, STANDARD_LIMITS.ports);
  const ml = (check('matrix', matrix, STANDARD_LIMITS.matrices) << 4) | check('level', level, STANDARD_LIMITS.levels);
  return [CMD.INTERROGATE, ml, (d >> 7) << 4, d & 0x7f];
}

export function connect({ matrix, level, dest, src }, ext) {
  if (ext) {
    const d = check('dest', dest, 65536);
    const s = check('src', src, 65536);
    return [CMD.EXT_CONNECT, check('matrix', matrix, 256), check('level', level, 256), d >> 8, d & 0xff, s >> 8, s & 0xff];
  }
  const d = check('dest', dest, STANDARD_LIMITS.ports);
  const s = check('src', src, STANDARD_LIMITS.ports);
  const ml = (check('matrix', matrix, STANDARD_LIMITS.matrices) << 4) | check('level', level, STANDARD_LIMITS.levels);
  return [CMD.CONNECT, ml, ((d >> 7) << 4) | (s >> 7), d & 0x7f, s & 0x7f];
}

export function tallyDumpRequest({ matrix, level }, ext) {
  if (ext) return [CMD.EXT_TALLY_DUMP, check('matrix', matrix, 256), check('level', level, 256)];
  const ml = (check('matrix', matrix, STANDARD_LIMITS.matrices) << 4) | check('level', level, STANDARD_LIMITS.levels);
  return [CMD.TALLY_DUMP, ml];
}

/** Returns { source: number[], dest: number[] } payloads asking for names of the given length (chars). */
export function nameRequests({ matrix, chars }, ext) {
  const code = NAME_LENGTHS.indexOf(chars);
  if (code < 0) throw new RangeError(`name length must be one of ${NAME_LENGTHS.join(', ')}`);
  if (ext) {
    const m = check('matrix', matrix, 256);
    return { source: [CMD.EXT_GET_SOURCE_NAMES, m, 0, code], dest: [CMD.EXT_GET_DEST_NAMES, m, code] };
  }
  const ml = check('matrix', matrix, STANDARD_LIMITS.matrices) << 4;
  return { source: [CMD.GET_SOURCE_NAMES, ml, code], dest: [CMD.GET_DEST_NAMES, ml, code] };
}

/** 16-bit source values: 0xFFFF is the router's "no source / unrouted" marker, reported as 0. */
const wordSource = (w) => (w === 0xffff ? 0 : w + 1);

function decodeName(buf) {
  return buf.toString('latin1').replace(/\0/g, '').trim();
}

/**
 * Parse a received payload (Buffer, first byte = command). Returns one of
 *   { type: 'route', matrix, level, dest, src }           tally / connected (src 0 = no source)
 *   { type: 'dump', matrix, level, firstDest, sources[] } tally dump packet
 *   { type: 'names', kind: 'source'|'dest', matrix, first, names[] }
 *   { type: 'protocol', commands: number[] }
 *   { type: 'namesUpdated' }                                router says a name changed (payload not interpreted)
 *   { type: 'unknown', cmd }
 * or null if the payload is truncated.
 */
export function parse(p) {
  const cmd = p[0];
  switch (cmd) {
    case CMD.TALLY:
    case CMD.CONNECTED: {
      if (p.length < 5) return null;
      return {
        type: 'route',
        matrix: (p[1] >> 4) + 1,
        level: (p[1] & 0x0f) + 1,
        dest: ((p[2] & 0x70) << 3) + p[3] + 1,
        src: ((p[2] & 0x07) << 7) + p[4] + 1,
      };
    }
    case CMD.EXT_TALLY:
    case CMD.EXT_CONNECTED: {
      if (p.length < 7) return null;
      return {
        type: 'route',
        matrix: p[1] + 1,
        level: p[2] + 1,
        dest: ((p[3] << 8) | p[4]) + 1,
        src: wordSource((p[5] << 8) | p[6]),
      };
    }
    case CMD.TALLY_DUMP_BYTE:
    case CMD.TALLY_DUMP_WORD: {
      if (p.length < 4) return null;
      const word = cmd === CMD.TALLY_DUMP_WORD;
      const count = p[2];
      const need = 3 + (word ? 2 + count * 2 : 1 + count);
      if (p.length < need) return null;
      let i = 3;
      const firstDest = word ? p.readUInt16BE(i) : p[i];
      i += word ? 2 : 1;
      const sources = [];
      for (let n = 0; n < count; n++, i += word ? 2 : 1) sources.push(word ? wordSource(p.readUInt16BE(i)) : p[i] + 1);
      return { type: 'dump', matrix: (p[1] >> 4) + 1, level: (p[1] & 0x0f) + 1, firstDest: firstDest + 1, sources };
    }
    case CMD.EXT_TALLY_DUMP_WORD: {
      if (p.length < 6) return null;
      const count = p[3];
      if (p.length < 6 + count * 2) return null;
      const sources = [];
      for (let n = 0, i = 6; n < count; n++, i += 2) sources.push(wordSource(p.readUInt16BE(i)));
      return { type: 'dump', matrix: p[1] + 1, level: p[2] + 1, firstDest: p.readUInt16BE(4) + 1, sources };
    }
    case CMD.SOURCE_NAMES:
    case CMD.DEST_NAMES:
    case CMD.EXT_SOURCE_NAMES:
    case CMD.EXT_DEST_NAMES: {
      const ext = cmd === CMD.EXT_SOURCE_NAMES || cmd === CMD.EXT_DEST_NAMES;
      const kind = cmd === CMD.SOURCE_NAMES || cmd === CMD.EXT_SOURCE_NAMES ? 'source' : 'dest';
      // standard: matrix/level, len  |  extended: matrix, [level for sources], len
      let i = 1;
      const matrix = ext ? p[i++] + 1 : (p[i++] >> 4) + 1;
      if (ext && kind === 'source') i++; // level byte
      const chars = NAME_LENGTHS[p[i++]];
      if (!chars || p.length < i + 3) return null;
      const first = ((p[i] << 8) | p[i + 1]) + 1;
      const count = p[i + 2];
      i += 3;
      if (p.length < i + count * chars) return null;
      const names = [];
      for (let n = 0; n < count; n++) names.push(decodeName(p.subarray(i + n * chars, i + (n + 1) * chars)));
      return { type: 'names', kind, matrix, first, names };
    }
    case CMD.PROTOCOL_RESPONSE:
      return { type: 'protocol', commands: [...p.subarray(3)] };
    case CMD.NAMES_UPDATED:
      return { type: 'namesUpdated' };
    default:
      return { type: 'unknown', cmd };
  }
}
