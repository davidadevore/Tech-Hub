'use strict';
// Record Monitor: polls HyperDecks (TCP 9993 + optional REST) and AJA Ki Pro units (HTTP REST)
// and serves a status dashboard. Zero dependencies; needs Node 18+.

const net = require('net');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VERSION = 'build 7 (format token fix 2)';
const PUBLIC_DIR = path.join(__dirname, 'public');
// Tech Hub adaptation: keep mutable data outside the installed application.
const BASELINE_FILE = path.join(process.env.TECH_HUB_DATA_DIR || path.join(__dirname, 'data'), 'baselines.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => {
  const n = parseFloat(String(v).replace('%', ''));
  return Number.isFinite(n) ? n : null;
};
const clampPct = (n) => Math.max(0, Math.min(100, n));

// Format target: macOS (HFS+) unless configured as exFAT. Per device, or top-level in config.json.
const fsOf = (cfg) => (/exfat/i.test(cfg.formatFilesystem || '') ? 'exFAT' : 'HFS+');

// Real HyperDeck (protocol 1.18) reply to "format: ... prepare:" is  "216 format ready:\r\n<token>\r\n\r\n"  with the token as a
// bare line. Also accepts "token: <value>" in case other firmware labels it.
function parseFormatToken(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const i = lines.findIndex((l) => /^216\b/.test(l));
  if (i < 0) return null;
  for (const l of lines.slice(i + 1)) {
    const t = l.trim();
    if (!t) continue;
    const m = /^[^:]+:\s*(\S+)$/.exec(t) || /^(\S+)$/.exec(t);
    return m ? m[1] : null;
  }
  return null;
}

class ControlError extends Error {
  constructor(message, status) { super(message); this.status = status || 400; }
}
// Sleep that a controller can cut short so the UI reflects a command within ~a second.
function makeWaiter(ms) {
  let wake = null, stopped = false;
  return {
    wait: () => stopped ? Promise.resolve() : new Promise((r) => { const t = setTimeout(r, typeof ms === 'function' ? ms() : ms); wake = () => { clearTimeout(t); r(); }; }),
    nudge: () => setTimeout(() => wake && wake(), 300),
    cancel: () => { stopped = true; wake?.(); },
  };
}

// ---------------------------------------------------------------- baselines
// HyperDecks over TCP only report *remaining record time*, not capacity. When the REST API
// can't give exact bytes, capacity is estimated as the largest remaining time ever seen for
// that volume + video format (or a fixed fullCapacityMinutes from config).
let baselines = {};
let baselinesDirty = false;
try { baselines = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch { /* first run */ }
function saveBaselines() {
  if (!baselinesDirty) return;
  baselinesDirty = false;
  fs.writeFile(BASELINE_FILE, JSON.stringify(baselines, null, 2), () => {});
}

function estimateFree(cfg, slotId, volume, format, remainingSec) {
  const fixed = typeof cfg.fullCapacityMinutes === 'object'
    ? cfg.fullCapacityMinutes[slotId]
    : cfg.fullCapacityMinutes;
  if (fixed > 0) return clampPct((remainingSec / (fixed * 60)) * 100);
  const key = `${cfg.id}|${slotId}|${volume}|${format}`;
  if (!(baselines[key] >= remainingSec)) {
    baselines[key] = remainingSec;
    baselinesDirty = true;
  }
  return baselines[key] > 0 ? clampPct((remainingSec / baselines[key]) * 100) : null;
}

// ---------------------------------------------------------------- device state
function newState(cfg) {
  return {
    id: cfg.id, name: cfg.name, type: cfg.type, host: cfg.host,
    online: false, error: null, model: null,
    status: 'offline', statusRaw: null, statusSince: Date.now(),
    timecode: null, format: null, activeSlot: null,
    slots: [], note: null, lastSeen: null, formatting: null, formatFs: fsOf(cfg),
  };
}
function setStatus(st, status, raw) {
  if (st.status !== status) st.statusSince = Date.now();
  st.status = status;
  st.statusRaw = raw || null;
}
// A format can take a minute or more and units may stop answering meanwhile, so polling pauses and the card says so.
const isFormatting = (st) => !!(st.formatting && st.formatting.until > Date.now());

function markOffline(st, why) {
  st.online = false;
  st.error = why || st.error;
  setStatus(st, 'offline');
}

// ---------------------------------------------------------------- HyperDeck
// Blackmagic HyperDeck Ethernet Protocol: line based over TCP 9993. Responses are either one
// line ("200 ok") or "NNN title:" + "key: value" lines + blank line. 5xx codes are async
// notifications; everything <500 answers our commands in order.
function startHyperDeck(cfg, st, opts) {
  let disposed = false, reconnect;
  const abort = new AbortController();
  const port = cfg.port || 9993;
  const restPort = cfg.restPort || 80;
  const nSlots = cfg.slots || 2;
  let sock = null, buf = '', pending = [], connected = false, tap = null; // tap: raw-text listener used to read format tokens
  let restEntries = null, restFails = 0, restNext = 0, restBusy = false;

  function parseBlocks() {
    for (;;) {
      const eol = buf.indexOf('\n');
      if (eol < 0) return;
      const m = /^(\d{3}) (.*)$/.exec(buf.slice(0, eol));
      if (!m) { buf = buf.slice(eol + 1); continue; }
      let raw, rest;
      if (m[2].endsWith(':')) {
        const end = buf.indexOf('\n\n');
        if (end < 0) return;
        raw = buf.slice(0, end); rest = buf.slice(end + 2);
      } else {
        raw = buf.slice(0, eol); rest = buf.slice(eol + 1);
      }
      buf = rest;
      const fields = {};
      for (const line of raw.split('\n').slice(1)) {
        const i = line.indexOf(': ');
        if (i > 0) fields[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 2).trim();
      }
      const block = { code: +m[1], title: m[2].replace(/:$/, ''), fields };
      if (block.code >= 500) {
        if (block.code === 500 && fields.model) st.model = fields.model;
      } else if (pending.length) {
        pending.shift().res(block);
      }
    }
  }

  function send(cmd, timeoutMs = 3000) {
    if(disposed)return Promise.reject(new Error('Monitor disconnected'));
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('command timeout')), timeoutMs);
      pending.push({ res: (b) => { clearTimeout(t); res(b); }, rej: (e) => { clearTimeout(t); rej(e); } });
      sock.write(cmd + '\r\n');
    });
  }

  function connect() {
    if(disposed)return;
    buf = ''; pending = [];
    sock = net.createConnection({ host: cfg.host, port });
    sock.setEncoding('utf8');
    sock.setNoDelay(true);
    sock.setTimeout(6000, () => sock.destroy(new Error('no data (timeout)')));
    sock.on('connect', () => { connected = true; });
    sock.on('data', (d) => { if (tap) tap(d); buf += d.replace(/\r\n/g, '\n'); parseBlocks(); });
    sock.on('error', (e) => { st.error = e.code || e.message; });
    sock.on('close', () => {
      connected = false;
      pending.forEach((p) => p.rej(new Error('closed')));
      markOffline(st);
      if(!disposed)reconnect=setTimeout(connect, 3000);
    });
  }

  async function refreshRest() {
    if (cfg.useRest === false || restBusy || Date.now() < restNext) return;
    restBusy = true;
    try {
      const r = await fetch(`http://${cfg.host}:${restPort}/control/api/v1/media/workingset`,
        { signal: AbortSignal.any([abort.signal,AbortSignal.timeout(2500)]) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      restEntries = Array.isArray(j.workingset) ? j.workingset : [];
      restFails = 0; restNext = Date.now() + 5000;
    } catch {
      restEntries = null;
      restFails++;
      // Older firmware has no REST API: back off hard, but keep retrying occasionally.
      restNext = Date.now() + (restFails >= 3 ? 60000 : 5000);
    } finally { restBusy = false; }
  }

  function matchRest(slotId, volume) {
    if (!restEntries) return null;
    const same = restEntries.filter((w) => w && w.volume === volume); // empty slots come back as null
    if (same.length === 1) return same[0];
    return same.find((w) => w.index === slotId - 1) || null;
  }

  async function poll() {
    const t = await send('transport info');
    if (t.code >= 100 && t.code < 200) throw new Error(t.title);
    const status = (t.fields.status || '').toLowerCase();
    const activeSlot = num(t.fields['slot id']);

    const slotInfo = [];
    for (let s = 1; s <= nSlots; s++) {
      const r = await send(`slot info: slot id: ${s}`);
      if (r.code >= 200 && r.code < 300) slotInfo.push({ id: s, ...r.fields });
    }
    if (slotInfo.some((f) => f.status === 'mounted' && !f['total size'])) refreshRest(); // only older firmware needs REST

    st.slots = slotInfo.map((f) => {
      const mounted = (f.status || '') === 'mounted';
      const remainingSec = num(f['recording time']);
      const slot = {
        id: f.id, label: `Slot ${f.id}`,
        state: f.status || 'unknown', mounted,
        volume: f['volume name'] || null, format: f['video format'] || null,
        remainingSec: mounted ? remainingSec : null,
        freePercent: null, percentSource: null,
      };
      if (!mounted) return slot;
      const total = num(f['total size']), left = num(f['remaining size']);
      if (total > 0 && left != null) { // protocol 1.18+ reports sizes directly: exact, no REST needed
        slot.freePercent = clampPct((left / total) * 100);
        slot.percentSource = 'exact';
        slot.totalBytes = total; slot.freeBytes = left;
        return slot;
      }
      const rest = matchRest(slot.id, slot.volume);
      if (rest && rest.totalSpace > 0) {
        slot.freePercent = clampPct((rest.remainingSpace / rest.totalSpace) * 100);
        slot.percentSource = 'exact';
        slot.totalBytes = rest.totalSpace;
        slot.freeBytes = rest.remainingSpace;
        if (rest.remainingRecordTime >= 0) slot.remainingSec = rest.remainingRecordTime;
      } else if (remainingSec != null) {
        slot.freePercent = estimateFree(cfg, slot.id, slot.volume, slot.format, remainingSec);
        slot.percentSource = 'estimated';
      }
      return slot;
    });

    const active = st.slots.find((s) => s.id === activeSlot);
    st.activeSlot = activeSlot;
    st.format = (active && active.format) || t.fields['video format'] || null;
    st.timecode = t.fields['display timecode'] || t.fields.timecode || null;
    const map = { record: 'recording', stopped: 'stopped', preview: 'stopped',
      play: 'playing', forward: 'playing', rewind: 'playing', jog: 'playing', shuttle: 'playing' };
    setStatus(st, map[status] || 'unknown', status);
    st.online = true; st.error = null; st.lastSeen = Date.now();
  }

  const waiter = makeWaiter(()=>opts.pollIntervalMs);
  connect();
  (async () => {
    while (!disposed) {
      if (connected && !isFormatting(st)) {
        try { await poll(); } catch (e) { st.error = e.message; sock.destroy(); }
      }
      if(!disposed)await waiter.wait();
    }
  })();

  async function cmd(c) {
    if (!connected || !st.online) throw new ControlError('not connected', 503);
    const r = await send(c);
    if (!(r.code >= 200 && r.code < 300)) throw new ControlError(`deck refused: ${r.code} ${r.title}`, 502);
    waiter.nudge();
  }
  // Controller: every method is a no-op with an explanation when the command doesn't apply.
  return {
    dispose(){disposed=true;clearTimeout(reconnect);abort.abort();waiter.cancel();sock?.destroy();},
    refreshSettings(){st.name=cfg.name;st.formatFs=fsOf(cfg);waiter.nudge();},
    async record() {
      if (st.status === 'recording') return 'already recording';
      if (st.status === 'playing') throw new ControlError('deck is in playback; stop playback first', 409);
      await cmd('record');
      return 'record started';
    },
    async stop() {
      if (st.status !== 'recording') return 'not recording';
      await cmd('stop');
      return 'stopped';
    },
    // Two-step protocol: "prepare" returns a token and erases nothing; "confirm" with that token erases.
    async format(n, expectVolume) {
      if (!opts.allowFormat) throw new ControlError('formatting is disabled in config', 403);
      if (st.status === 'recording') throw new ControlError('cannot format while recording', 409);
      if (st.status !== 'stopped') throw new ControlError(`deck is ${st.status}; not formatting`, 409);
      if (isFormatting(st)) throw new ControlError('a format is already in progress', 409);
      const slot = st.slots.find((x) => x.id === n);
      if (!slot || !slot.mounted) throw new ControlError('no media in that slot', 409);
      // The dialog showed a specific drive; if the card was swapped since, refuse rather than erase something else.
      if (expectVolume != null && slot.volume !== expectVolume) throw new ControlError('the drive in that slot changed since the dialog opened; nothing was formatted', 409);
      if (!connected || !st.online) throw new ControlError('not connected', 503);
      const fsType = fsOf(cfg);
      // The token is a bare line after the header, which block parsing can't represent, so read the raw text
      // for a moment after the reply.
      let raw = '', p;
      tap = (d) => { raw += d; };
      try { p = await send(`format: slot id: ${n} prepare: ${fsType}`, 10000); await sleep(500); } finally { tap = null; }
      const token = p.code === 216 ? parseFormatToken(raw) : null;
      if (!token) throw new ControlError(`deck did not accept the format request (${p.code} ${p.title}); nothing was formatted. Deck said: ${JSON.stringify(raw.trim())}`, 502);
      st.formatting = { slot: n, until: Date.now() + 150000 };
      sock.setTimeout(0); // no idle timeout while the deck is busy erasing
      try {
        const c = await send(`format: confirm: ${token}`, 120000);
        if (!(c.code >= 200 && c.code < 300)) throw new ControlError(`deck refused: ${c.code} ${c.title}`, 502);
      } catch (e) {
        st.formatting = null;
        throw e instanceof ControlError ? e : new ControlError('no confirmation from deck: ' + e.message, 504);
      } finally { sock.setTimeout(6000); }
      st.formatting = { slot: n, until: Date.now() + 4000 }; // short settle, then polling resumes
      waiter.nudge();
      return `slot ${n} formatted (${fsType})`;
    },
    async selectSlot(n) {
      if (st.status === 'recording') throw new ControlError('cannot switch slots while recording', 409);
      const slot = st.slots.find((x) => x.id === n);
      if (!slot || !slot.mounted) throw new ControlError('no media in that slot', 409);
      if (st.activeSlot === n) return `slot ${n} already active`;
      await cmd(`slot select: slot id: ${n}`);
      return `slot ${n} selected`;
    },
  };
}

// ---------------------------------------------------------------- Ki Pro
// AJA REST: GET /config?action=get&paramid=eParamID_X  ->  {"paramid","name","value","value_name"}
// AJA documents transport commands but not media-space params, so media params are configured
// per unit (find them with probe.js).
function startKiPro(cfg, st, opts) {
  let disposed=false;
  const abort=new AbortController();
  const port = cfg.port || 80;
  const paramId = (cfg.params && cfg.params.transport) || 'eParamID_TransportState';
  const media = cfg.media || [];
  let fails = 0;

  async function get(id) {
    const r = await fetch(`http://${cfg.host}:${port}/config?action=get&paramid=${encodeURIComponent(id)}`,
      { signal: AbortSignal.any([abort.signal,AbortSignal.timeout(2500)]) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return JSON.parse(await r.text());
  }
  function mapTransport(j) {
    const name = String(j.value_name || '').toLowerCase();
    if (/rec/.test(name)) return 'recording';
    if (/idle|stop/.test(name)) return 'stopped';
    if (/pause/.test(name)) return 'paused';
    if (/play|fwd|forward|rew|shuttle|jog|var/.test(name)) return 'playing';
    if (!name && String(j.value) === '1') return 'stopped';
    return 'unknown';
  }

  async function poll() {
    const t = await get(paramId);
    const status = mapTransport(t);
    const slots = [];
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      const slot = { id: i + 1, label: m.label || `Media ${i + 1}`, state: 'unknown', mounted: false,
        volume: null, format: null, remainingSec: null, freePercent: null, percentSource: null };
      try {
        let free = null;
        if (m.freePercent) free = num((await get(m.freePercent)).value);
        else if (m.usedPercent) { const u = num((await get(m.usedPercent)).value); free = u == null ? null : 100 - u; }
        if (free != null) { slot.freePercent = clampPct(free); slot.percentSource = 'exact'; slot.mounted = true; slot.state = 'mounted'; }
        const rem = m.remainingSeconds ? num((await get(m.remainingSeconds)).value)
          : m.remainingMinutes ? (num((await get(m.remainingMinutes)).value) ?? NaN) * 60 : null;
        if (rem != null && Number.isFinite(rem)) slot.remainingSec = rem;
      } catch { /* leave slot unknown; unit itself is still online */ }
      slots.push(slot);
    }
    st.slots = slots;
    st.note = media.length ? null : 'Media parameters not configured. Run probe.bat to find them.';
    st.activeSlot = null;
    setStatus(st, status, t.value_name || String(t.value));
    st.online = true; st.error = null; st.lastSeen = Date.now(); fails = 0;
  }

  const waiter = makeWaiter(()=>opts.pollIntervalMs);
  (async () => {
    while (!disposed) {
      try { await poll(); } catch (e) {
        if (++fails >= 2 && !isFormatting(st)) markOffline(st, e.name === 'TimeoutError' ? 'timeout' : (e.cause && e.cause.code) || e.message);
      }
      if(!disposed)await waiter.wait();
    }
  })();

  // AJA TransportCommand values (from AJA's REST docs): 3 = Record, 4 = Stop.
  const cmdParam = (cfg.params && cfg.params.transportCommand) || 'eParamID_TransportCommand';
  async function setParam(param, value) {
    if(disposed)throw new ControlError('Monitor disconnected',503);
    if (!st.online) throw new ControlError('not connected', 503);
    let r;
    try {
      r = await fetch(`http://${cfg.host}:${port}/config?action=set&paramid=${param}&value=${value}`,
        { signal: AbortSignal.any([abort.signal,AbortSignal.timeout(3000)]) });
    } catch (e) { throw new ControlError('no response from unit', 504); }
    if (!r.ok) throw new ControlError('unit refused: HTTP ' + r.status, 502);
    waiter.nudge();
  }
  const command = (value) => setParam(cmdParam, value);
  return {
    dispose(){disposed=true;abort.abort();waiter.cancel();},
    refreshSettings(){st.name=cfg.name;st.formatFs=fsOf(cfg);waiter.nudge();},
    async record() {
      if (st.status === 'recording') return 'already recording';
      if (st.status !== 'stopped') throw new ControlError(`unit is ${st.status}; not starting record`, 409);
      await command(3);
      return 'record started';
    },
    async stop() {
      if (st.status !== 'recording') return 'not recording';
      await command(4);
      return 'stop sent';
    },
    // AJA: eParamID_StorageCommand 4 = Erase (erase and format the current media) using eParamID_FileSystemFormat
    // (0 = HFS+, 1 = ExFAT), which we set explicitly first. That setting persists on the unit.
    async format() {
      if (!opts.allowFormat) throw new ControlError('formatting is disabled in config', 403);
      if (st.status === 'recording') throw new ControlError('cannot format while recording', 409);
      if (st.status !== 'stopped') throw new ControlError(`unit is ${st.status}; not formatting`, 409);
      if (isFormatting(st)) throw new ControlError('a format is already in progress', 409);
      if (!st.slots.some((x) => x.mounted)) throw new ControlError('no media detected', 409);
      await setParam('eParamID_FileSystemFormat', fsOf(cfg) === 'HFS+' ? 0 : 1);
      await setParam('eParamID_StorageCommand', 4);
      st.formatting = { slot: 1, until: Date.now() + 20000 };
      waiter.nudge();
      return 'format started';
    },
  };
}

// ---------------------------------------------------------------- http
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

function start(configPath, {controllerFactory}={}) {
  let cfg={},states=[],entries=new Map(),nextId=1,busy=0;
  const opts={},ctls=new Map();
  const factory=controllerFactory||((dev,st,options)=>(dev.type==='kipro'?startKiPro:startHyperDeck)(dev,st,options));
  const identity=d=>JSON.stringify([d.type,d.host,d.port||(d.type==='kipro'?80:9993)]);
  const connection=d=>{const {name,...rest}=d;return rest;};
  function applyConfig(next){
    if(busy||states.some(isFormatting))throw new ControlError('Wait for the current recorder command or format operation to finish before saving.',409);
    if(!next||!Array.isArray(next.devices)||next.devices.some(d=>!d||!['hyperdeck','kipro'].includes(d.type)||typeof d.host!=='string'||!d.host.trim()))throw new ControlError('Invalid recorder configuration',400);
    const ids=new Set(),used=new Set(),reserved=new Set(next.devices.filter(d=>d.id).map(d=>d.id));
    const plan=next.devices.map(d=>{
      const previous=d.id?entries.get(d.id):[...entries.values()].find(e=>!used.has(e.dev.id)&&identity(e.dev)===identity(d)&&!reserved.has(e.dev.id));
      let id=d.id||previous?.dev.id;
      if(!id){do{id=`dev${nextId++}`;}while(entries.has(id)||ids.has(id)||reserved.has(id));}
      if(typeof id!=='string'||ids.has(id))throw new ControlError('Recorder IDs must be unique strings',400);
      ids.add(id);if(previous)used.add(previous.dev.id);
      const dev={formatFilesystem:next.formatFilesystem,...d,id};
      return {dev,previous,reuse:previous&&require('node:util').isDeepStrictEqual(connection(dev),connection(previous.dev))};
    });
    Object.assign(opts,{pollIntervalMs:next.pollIntervalMs||2000,warnFreePercent:next.warnFreePercent??20,criticalFreePercent:next.criticalFreePercent??10,allowFormat:next.allowFormat!==false});
    for(const e of entries.values())if(!plan.some(p=>p.reuse&&p.previous===e))e.ctl.dispose();
    const replacement=new Map();ctls.clear();states=[];
    for(const p of plan){let e=p.previous;if(p.reuse){Object.assign(e.dev,p.dev);e.ctl.refreshSettings();}else{const st=newState(p.dev);e={dev:p.dev,st,ctl:factory(p.dev,st,opts)};}replacement.set(e.dev.id,e);ctls.set(e.dev.id,e.ctl);states.push(e.st);}
    entries=replacement;cfg=next;
  }
  applyConfig(JSON.parse(fs.readFileSync(configPath,'utf8')));

  const isLoopback = (req) => process.env.TECH_HUB_MANAGED === '1' ? req.headers['x-techhub-local-client'] === '1' : ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const canControl = (req) => cfg.controlEnabled !== false && (!cfg.controlLocalOnly || isLoopback(req));

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 2048) { reject(new ControlError('body too large', 413)); req.destroy(); } });
      req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new ControlError('bad JSON', 400)); } });
      req.on('error', reject);
    });
  }
  // Browsers let any web page fire POSTs at a LAN address, so require JSON (forces a CORS preflight
  // we never approve) and a same-origin Origin header. Both are cheap and block drive-by requests.
  function guardControl(req) {
    if (req.method !== 'POST') throw new ControlError('POST only', 405);
    if (!canControl(req)) throw new ControlError('control is disabled for this client', 403);
    if (!/^application\/json/i.test(req.headers['content-type'] || '')) throw new ControlError('JSON required', 415);
    const o = req.headers.origin;
    if (o) { let host; try { host = new URL(o).host; } catch { host = null; } if (host !== req.headers.host) throw new ControlError('cross-origin request refused', 403); }
  }
  async function run(st, action, slot, who, expectVolume) {
    busy++;
    const ctl = ctls.get(st.id);
    let msg;
    try {
      if (action === 'record') msg = await ctl.record();
      else if (action === 'stop') msg = await ctl.stop();
      else if (action === 'slot' && ctl.selectSlot) msg = await ctl.selectSlot(Number(slot));
      else if (action === 'format') msg = await ctl.format(Number(slot), expectVolume == null ? null : String(expectVolume));
      else throw new ControlError('unsupported action', 400);
      console.log(`[control] ${new Date().toLocaleTimeString()} ${who} -> ${st.name}: ${action === 'format' ? 'FORMAT slot ' + slot + ' (volume ' + (expectVolume ?? 'n/a') + ')' : action}${action === 'slot' ? ' ' + slot : ''} = ${msg}`);
      return { id: st.id, name: st.name, ok: true, message: msg };
    } catch (e) {
      console.log(`[control] ${new Date().toLocaleTimeString()} ${who} -> ${st.name}: ${action}${action === 'format' ? ' slot ' + slot : ''} FAILED: ${e.message}`);
      return { id: st.id, name: st.name, ok: false, message: e.message };
    } finally { busy--; }
  }
  async function handleControl(req, res, url) {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
    try {
      guardControl(req);
      const body = await readJson(req);
      const who = (req.socket.remoteAddress || '?').replace('::ffff:', '');
      if (url.pathname === '/api/control') {
        const st = states.find((x) => x.id === body.id);
        if (!st) throw new ControlError('unknown device', 404);
        return send(200, await run(st, body.action, body.slot, who, body.expectVolume));
      }
      // /api/control-all: only touch units where the command applies; report the rest as skipped.
      if (body.action !== 'record' && body.action !== 'stop') throw new ControlError('unsupported action', 400);
      const want = body.action === 'record' ? 'stopped' : 'recording';
      const targets = states.filter((x) => x.online && x.status === want);
      const skipped = states.filter((x) => !targets.includes(x) && x.status !== (body.action === 'record' ? 'recording' : 'stopped'))
        .map((x) => ({ id: x.id, name: x.name, ok: false, skipped: true, message: x.online ? `is ${x.status}` : 'offline' }));
      const results = await Promise.all(targets.map((x) => run(x, body.action, null, who)));
      return send(200, { results: results.concat(skipped) });
    } catch (e) {
      return send(e.status || 500, { error: e.message });
    }
  }
  const baselineTimer=setInterval(saveBaselines, 10000);baselineTimer.unref();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if(url.pathname==='/api/reload-config'){
      try{
        if(process.env.TECH_HUB_MANAGED!=='1'||!isLoopback(req)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))throw new ControlError('Local Tech Hub access required',403);
        if(req.method!=='POST'||!/^application\/json/i.test(req.headers['content-type']||'')||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`))throw new ControlError('Local JSON POST required',403);
        applyConfig(JSON.parse(fs.readFileSync(configPath,'utf8')));
        res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true}));
      }catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:e.message}));}
    }
    if (url.pathname === '/api/control' || url.pathname === '/api/control-all') return handleControl(req, res, url);
    if (url.pathname === '/api/status') {
      const now = Date.now();
      const body = {
        title: cfg.title || 'Record Monitor',
        version: VERSION,
        control: { enabled: canControl(req), confirmStop: cfg.confirmStop !== false, allowFormat: opts.allowFormat },
        thresholds: { warn: opts.warnFreePercent, critical: opts.criticalFreePercent },
        pollIntervalMs: opts.pollIntervalMs,
        devices: states.map((s) => ({
          ...s,
          statusForMs: now - s.statusSince,
          lastSeenAgoMs: s.lastSeen ? now - s.lastSeen : null,
          formatting: isFormatting(s) ? { slot: s.formatting.slot } : null,
          statusSince: undefined, lastSeen: undefined,
        })),
      };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(body));
    }
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });

  const port = Number(process.env.TECH_HUB_BACKEND_PORT || cfg.port || 8080);
  server.on('error', (e) => { console.error(`Cannot listen on port ${port}: ${e.message}`); process.exit(1); });
  server.listen(port, process.env.TECH_HUB_BACKEND_HOST || cfg.bind || '0.0.0.0', () => {
    console.log(`Record Monitor ${VERSION}: running with ${states.length} devices.`);
    console.log(`  This PC:  http://localhost:${port}`);
    for (const list of Object.values(os.networkInterfaces()))
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  Network:  http://${a.address}:${port}`);
  });
  server.on('close',()=>{clearInterval(baselineTimer);for(const e of entries.values())e.ctl.dispose();});
  return server;
}

module.exports = { start, parseFormatToken };

if (require.main === module) {
  const i = process.argv.indexOf('--config');
  start(path.resolve(i > 0 ? process.argv[i + 1] : path.join(__dirname, 'config.json')));
}
