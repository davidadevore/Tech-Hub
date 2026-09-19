const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {mapState, Freshness} = require('../src/state');
const {CueDisplay} = require('../src/cues');
const {HubClient, validateConfig} = require('../src/client');
function state(seconds = 587) {
  return {config: {limitimer: {enabled: true}, perfectcue: {enabled: true, display_time_seconds: 3.5}, display: {overtime: 'continue'}},
    limitimer: {status: 'connected', packet_count: 1, heartbeat_count: 0, updated_at: 'unchanged',
      data: {selected_program: 1, countdown: true, timers: [seconds, 120, 3661, -1].map(remaining_seconds =>
        ({remaining_seconds, running: true, signal: remaining_seconds < 0 ? 'red' : 'green'}))}},
    perfectcue: {status: 'connected', event_count: 1, last_event: {kind: 'next', code: '0x0F', at: 'same-time'}}};
}
test('active program, all programs, long durations, overtime and stop-at-zero', () => {
  let s = state(); let v = mapState(s);
  assert.equal(v.minutes, '09'); assert.equal(v.seconds, '47'); assert.equal(v.time, '09:47');
  assert.equal(v.program_3_time, '61:01'); assert.equal(v.program_4_time, '-00:01');
  s.limitimer.data.selected_program = 4; v = mapState(s);
  assert.equal(v.total_seconds, -1); assert.equal(v.sign, '-');
  s.config.display.overtime = 'stop'; assert.equal(mapState(s).time, '00:00');
  s.limitimer.status = 'disconnected'; assert.equal(mapState(s).time, '--:--');
  assert.equal(mapState(s).program_3_time, '--:--');
});
test('invalid input rejected; heartbeat prevents stale stopped timers', () => {
  const s = state(), f = new Freshness();
  assert(f.check(s, 100, 10000));
  assert(!f.check(s, 10100, 10000));
  s.limitimer.heartbeat_count++; assert(f.check(s, 10200, 10000));
  s.limitimer.data.timers[0].remaining_seconds = NaN;
  assert.throws(() => mapState(s), /Invalid Limitimer/);
});
test('arrows ignore old cues, flash new clicks, restart duration and switch direction', () => {
  const c = new CueDisplay(), s = state(), config = {flashCues: true, cueDisplaySeconds: 0};
  c.accept(s, config, 0); assert(!c.values(0).cue_next_active);
  s.perfectcue.event_count++; c.accept(s, config, 100);
  assert(c.values(100).cue_next_lit); assert(!c.values(225).cue_next_lit);
  assert(c.values(350).cue_next_lit); assert(!c.values(475).cue_next_lit);
  assert(c.values(600).cue_next_lit);
  s.perfectcue.event_count++; c.accept(s, config, 700);
  assert(c.values(700).cue_next_lit); assert(!c.values(825).cue_next_lit);
  assert(c.values(4199).cue_next_active); assert(!c.values(4200).cue_next_active);
  s.perfectcue.event_count++; s.perfectcue.last_event.kind = 'previous'; c.accept(s, config, 4300);
  assert(c.values(4300).cue_previous_lit); assert(!c.values(4300).cue_next_lit);
});
test('arrows work without Limitimer, support steady override, clear on disconnect', () => {
  const c = new CueDisplay(), s = state(), config = {flashCues: false, cueDisplaySeconds: 1};
  s.config.limitimer.enabled = false;
  c.accept(s, config, 0); s.perfectcue.event_count++; c.accept(s, config, 100);
  assert(c.values(225).cue_next_lit); assert(c.values(1099).cue_next_lit); assert(!c.values(1100).cue_next_lit);
  s.perfectcue.status = 'disconnected'; c.accept(s, config, 300);
  assert(!c.values(300).cue_connected); assert(!c.values(300).cue_next_active);
  s.perfectcue.status = 'connected'; c.accept(s, config, 400);
  assert(!c.values(400).cue_next_active);
});
test('validate hosts and assigned service ports', () => {
  assert.equal(validateConfig({host: '127.0.0.1', port: 23456}).port, 23456);
  for (const config of [{host: 'http://localhost:8701'}, {host: 'localhost', port: 0}, {host: 'localhost', interval: 0}]) {
    assert.throws(() => validateConfig(config));
  }
});
test('login, cookie reuse, expiry, invalid credentials, invalid JSON and abort', async () => {
  let token = 'one', logins = 0, bad = false;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/__hub/login') {
      logins++; let body = ''; for await (const chunk of req) body += chunk;
      if (new URLSearchParams(body).get('password') !== 'test-only') {res.writeHead(401); res.end(); return;}
      res.writeHead(303, {'Set-Cookie': 'techhub_dsan=' + token + '; Path=/; HttpOnly'}); res.end(); return;
    }
    if (req.headers.cookie !== 'techhub_dsan=' + token) {res.writeHead(401); res.end(); return;}
    res.end(bad ? '<html>' : JSON.stringify(state()));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const config = {host: '127.0.0.1', port: server.address().port, password: 'test-only'};
  try {
    const client = new HubClient(config);
    assert.equal(mapState(await client.read()).time, '09:47');
    await client.read(); assert.equal(logins, 1);
    token = 'two'; await client.read(); assert.equal(logins, 2);
    await assert.rejects(new HubClient({...config, password: 'wrong'}).read(), error => error.retryMs === 60000);
    await assert.rejects(new HubClient({...config, password: ''}).read(), /password required/);
    bad = true; await assert.rejects(client.read(), /invalid JSON/);
    const ac = new AbortController(); ac.abort(); await assert.rejects(client.read(ac.signal));
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});

test('numbered cue history preserves rapid clicks and never replays duplicates or prior sessions', () => {
 const c=new CueDisplay(), s=state(), config={flashCues:true};
 s.perfectcue.stream_id='session-a';s.perfectcue.history=[];c.accept(s,config,0);
 const event=(sequence,kind)=>({sequence,kind,code:kind,at:'same-time'});
 s.perfectcue.event_count=4;s.perfectcue.last_event=event(4,'previous');
 s.perfectcue.history=[event(4,'previous'),event(3,'next'),event(2,'next')];
 c.accept(s,config,100);assert(c.values(100).cue_next_lit);assert(!c.values(225).cue_next_lit);
 c.accept(s,config,240);assert(c.values(350).cue_next_lit);assert(!c.values(475).cue_next_lit);
 assert(c.values(600).cue_previous_lit);assert.equal(c.pending.length,0);
 c.accept(s,config,700);assert.equal(c.pending.length,0);
 s.perfectcue.stream_id='session-b';c.accept(s,config,800);assert(!c.values(800).cue_previous_active);
 s.perfectcue.event_count=5;s.perfectcue.last_event=event(5,'next');s.perfectcue.history=[event(5,'next')];c.accept(s,config,900);assert(c.values(900).cue_next_lit);
 s.perfectcue.event_count=7;s.perfectcue.last_event=event(7,'previous');s.perfectcue.history=[event(7,'previous'),event(6,'next')];c.accept(s,config,950);
 c.values(4000);assert.equal(c.pending.length,0);
});
