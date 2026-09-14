const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function viewer(settings) {
  const elements = new Map(), timers = new Map();
  let now = 1000, timerId = 0, count = 0;
  function $(id) {
    if (!elements.has(id)) {
      const el = {dataset: {}, className: ''};
      el.classList = {
        add(...names) {el.className = [...new Set([...el.className.split(' '), ...names])].join(' ');},
        remove(...names) {el.className = el.className.split(' ').filter(n => !names.includes(n)).join(' ');},
        contains(name) {return el.className.split(' ').includes(name);}
      };
      elements.set(id, el);
    }
    return elements.get(id);
  }
  const html = fs.readFileSync(require.resolve('../services/dsan/index.html'), 'utf8');
  const render = html.slice(html.indexOf('    function renderCue(device)'), html.indexOf('    function renderNetworkInfo'));
  const ctx = vm.createContext({$, latestState: {config: {perfectcue: settings}}, setStatus() {},
    arrows: {next: 'right', previous: 'left'}, Date: {now: () => now},
    setTimeout(fn, delay) {timers.set(++timerId, {fn, at: now + delay}); return timerId;},
    clearTimeout(id) {timers.delete(id);}});
  vm.runInContext('let cueTimer, cueFlashTimer, lastCueDirection, cueVisibleUntil = 0;'+render, ctx);
  return {
    $,
    click(kind = 'next') {
      ctx.device = {event_count: ++count, last_event: {kind, at: 'same-timestamp', code: kind, label: kind, detail: ''}};
      vm.runInContext('renderCue(device)', ctx);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of timers) if (timer.at <= now) {timers.delete(id); timer.fn();}
    }
  };
}
test('configured duration applies to desktop, mobile and fullscreen; each click restarts it', () => {
  const v = viewer({display_time_seconds: 3.5, flash_on_multiple_clicks: false});
  v.click(); v.advance(3000); v.click(); v.advance(1000);
  for (const id of ['cue-display','mobile-next','fullscreen-next']) {
    assert(v.$(id).classList.contains('active'));
    assert(!v.$(id).classList.contains('flash'));
  }
  v.advance(2500);
  for (const id of ['cue-display','mobile-next','fullscreen-next']) assert(!v.$(id).classList.contains('active'));
});
test('enabled repeated clicks flash, direction changes do not, expired arrows do not', () => {
  const v = viewer({display_time_seconds: 1, flash_on_multiple_clicks: true});
  v.click(); v.advance(100); v.click();
  for (const id of ['cue-display','mobile-next','fullscreen-next']) assert(v.$(id).classList.contains('flash'));
  v.advance(500);
  assert(!v.$('fullscreen-next').classList.contains('flash'));
  v.click('previous');
  assert(!v.$('fullscreen-previous').classList.contains('flash'));
  assert(!v.$('fullscreen-next').classList.contains('active'));
  v.advance(1000); v.click('previous');
  assert(!v.$('fullscreen-previous').classList.contains('flash'));
});
test('legacy settings retain two seconds and repeat flashing', () => {
  const v = viewer({});
  v.click(); v.advance(100); v.click();
  assert(v.$('cue-display').classList.contains('flash'));
  v.advance(1999); assert(v.$('cue-display').classList.contains('active'));
  v.advance(1); assert(!v.$('cue-display').classList.contains('active'));
});
