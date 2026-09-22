'use strict';
// Demo mode: fake HyperDecks (TCP 9993 protocol + REST) and fake Ki Pros on localhost, then the
// real dashboard server pointed at them. Exercises the same parsing code as real hardware.

const net = require('net');
const http = require('http');
const path = require('path');

const FULL_SEC = 4 * 3600; // record time of an empty drive
const tick = 1; // seconds per real second
const pad = (n) => String(n).padStart(2, '0');

// free = fraction of drive free, drain = fraction per second while recording
const DECKS = [
  { port: 19101, rest: 19151, rec: true,  slots: [{ v: 'CAM1_A', free: 0.78, drain: 0.00004 }, { v: 'CAM1_B', free: 0.95, drain: 0 }] },
  { port: 19102, rest: 19152, rec: true,  slots: [{ v: 'CAM2', free: 0.41, drain: 0.00004 }, null] },
  { port: 19103, rest: 19153, rec: false, slots: [{ v: 'PGM_ISO3', free: 0.13, drain: 0.00004 }, { v: 'PGM_ISO3_B', free: 0.88, drain: 0.00004 }] },
  { port: 19104, rest: 0,     rec: true,  slots: [{ v: 'ISO4', free: 0.062, drain: 0.00003 }, null] },
  { port: 19105, rest: 0,     rec: true,  slots: [{ v: 'ISO5', free: 1.0, drain: 0.0006 }, null] },
];

function startDeck(d, i) {
  const state = { rec: d.rec, tc: 3600 * (10 + i) + 61, slot: 1 };
  setInterval(() => {
    state.tc += state.rec ? tick : 0;
    if (state.rec) { const s = d.slots[state.slot - 1]; if (s) s.free = Math.max(0, s.free - s.drain * tick); }
  }, 1000).unref();
  const tc = () => { const t = state.tc; return `${pad(Math.floor(t / 3600) % 24)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}:00`; };

  net.createServer((sock) => {
    sock.write('500 connection info:\r\nprotocol version: 1.11\r\nmodel: HyperDeck Studio (demo)\r\n\r\n');
    let buf = '';
    sock.on('data', (b) => {
      buf += b;
      let n;
      while ((n = buf.indexOf('\r\n')) >= 0) {
        const cmd = buf.slice(0, n).trim(); buf = buf.slice(n + 2);
        if (cmd === 'transport info') {
          sock.write(`208 transport info:\r\nstatus: ${state.rec ? 'record' : 'stopped'}\r\nspeed: 0\r\nslot id: ${state.slot}\r\n` +
            `display timecode: ${tc()}\r\ntimecode: ${tc()}\r\nvideo format: 1080p2997\r\nloop: false\r\n\r\n`);
        } else if (cmd.startsWith('slot info: slot id: ')) {
          const id = +cmd.slice(20), s = d.slots[id - 1];
          sock.write(s
            ? `202 slot info:\r\nslot id: ${id}\r\nstatus: mounted\r\nvolume name: ${s.v}\r\nrecording time: ${Math.round(s.free * FULL_SEC)}\r\nvideo format: 1080p2997\r\n\r\n`
            : `202 slot info:\r\nslot id: ${id}\r\nstatus: empty\r\nvolume name: \r\nrecording time: 0\r\nvideo format: none\r\n\r\n`);
        } else if (cmd === 'record') {
          state.rec = true; sock.write('200 ok\r\n');
        } else if (cmd === 'stop') {
          state.rec = false; sock.write('200 ok\r\n');
        } else if (cmd.startsWith('slot select: slot id: ')) {
          const id = +cmd.slice(22);
          if (state.rec || !d.slots[id - 1]) sock.write('105 invalid state\r\n');
          else { state.slot = id; sock.write('200 ok\r\n'); }
        } else if (cmd.startsWith('format: slot id: ')) {
          const m = /^format: slot id: (\d+) prepare: (\S+)$/.exec(cmd);
          if (!m || !d.slots[+m[1] - 1] || state.rec) sock.write('105 invalid state\r\n');
          else { state.token = 'TKN' + Math.floor(Math.random() * 1e6); state.fmtSlot = +m[1]; state.fs = m[2]; state.style = !state.style; sock.write(state.style ? `216 format ready:\r\n${state.token}\r\n\r\n` : `216 format ready:\r\ntoken: ${state.token}\r\n\r\n`); }
        } else if (cmd.startsWith('format: confirm: ')) {
          if (cmd.slice(17) !== state.token) return sock.write('105 bad token\r\n');
          const slot = d.slots[state.fmtSlot - 1]; state.token = null;
          console.log(`[demo deck :${d.port}] FORMATTING slot ${state.fmtSlot} (${slot.v}) as ${state.fs} ... takes 4s`);
          setTimeout(() => { slot.free = 1.0; sock.write('200 ok\r\n'); }, 4000); // slow on purpose, like a real erase
        } else sock.write('100 syntax error\r\n');
      }
    });
    sock.on('error', () => {});
  }).listen(d.port, '127.0.0.1');

  if (d.rest) {
    http.createServer((req, res) => {
      if (req.url !== '/control/api/v1/media/workingset') { res.writeHead(404); return res.end(); }
      const TOTAL = 500e9;
      const workingset = d.slots.map((s, idx) => s && ({
        index: idx, activeDisk: idx === 0, volume: s.v, deviceName: `ssd${idx + 1}`,
        remainingRecordTime: Math.round(s.free * FULL_SEC), totalSpace: TOTAL, remainingSpace: Math.round(s.free * TOTAL), clipCount: 3,
      })).filter(Boolean);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ size: workingset.length, workingset }));
    }).listen(d.rest, '127.0.0.1');
  }
}

const KIPROS = [
  { port: 19201, transport: [3, 'Recording'], p: { eParamID_DemoFree1: 66, eParamID_DemoMin1: 148, eParamID_DemoFree2: 88, eParamID_DemoMin2: 195 }, drain: 0.00005 },
  { port: 19202, transport: [1, 'Idle'],      p: { eParamID_DemoFree1: 34, eParamID_DemoMin1: 76 }, drain: 0 },
];
function startKiPro(k) {
  setInterval(() => { if (k.drain) k.p.eParamID_DemoFree1 = Math.max(0, k.p.eParamID_DemoFree1 - k.drain * 100); }, 1000).unref();
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const id = u.searchParams.get('paramid');
    if (u.pathname === '/desc.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([...['eParamID_TransportState', 'eParamID_VideoInSelect', ...Object.keys(k.p)]
        .map((param_id) => ({ param_id }))]));
    }
    if (u.searchParams.get('action') === 'set' && id === 'eParamID_FileSystemFormat') {
      console.log('[demo kipro] file system set to', u.searchParams.get('value') === '0' ? 'HFS+' : 'ExFAT');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ paramid: '1', name: id, value: u.searchParams.get('value'), value_name: '' }));
    }
    if (u.searchParams.get('action') === 'set' && id === 'eParamID_StorageCommand') {
      if (u.searchParams.get('value') === '4') { console.log('[demo kipro] ERASE requested'); k.p.eParamID_DemoFree1 = 100; k.p.eParamID_DemoFree2 = 100; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ paramid: '1', name: id, value: u.searchParams.get('value'), value_name: '' }));
    }
    if (u.searchParams.get('action') === 'set' && id === 'eParamID_TransportCommand') {
      const val = u.searchParams.get('value');
      if (val === '3') k.transport = [3, 'Recording'];
      if (val === '4') k.transport = [1, 'Idle'];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ paramid: '1', name: id, value: val, value_name: '' }));
    }
    let v;
    if (id === 'eParamID_TransportState') v = { value: String(k.transport[0]), value_name: k.transport[1] };
    else if (id in k.p) v = { value: String(k.p[id].toFixed ? +k.p[id].toFixed(1) : k.p[id]), value_name: '' };
    if (!v) { res.writeHead(404); return res.end('unknown param'); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ paramid: '1', name: id, ...v }));
  }).listen(k.port, '127.0.0.1');
}

DECKS.forEach(startDeck);
KIPROS.forEach(startKiPro);
console.log('DEMO MODE: simulated devices on localhost (HyperDeck 6 is deliberately offline).');
require('./server').start(path.join(__dirname, 'config.demo.json'));
