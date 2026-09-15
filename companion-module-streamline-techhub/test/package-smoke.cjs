const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const http = require('node:http');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {if (Date.now() > deadline) throw Error('Module update timed out'); await wait(20);}
}
(async () => {
  const {default: Module} = await import(pathToFileURL(path.resolve(__dirname, '../pkg/streamline-techhub/main.js')));
  assert.equal(typeof Module, 'function');
  let values = {}, presets, feedbacks, eventCount = 0, requests = 0, checked = 0;
  const context = {_isInstanceContext: true, id: 'test', label: 'renamed_hub',
    saveConfig() {}, setVariableDefinitions() {}, setVariableValues(v) {values = {...values, ...v};},
    setActionDefinitions() {}, setFeedbackDefinitions(v) {feedbacks = v;},
    setPresetDefinitions(_sections, v) {presets = v;}, updateStatus() {},
    checkAllFeedbacks() {checked++;},
  };
  const server = http.createServer((_req, res) => {
    requests++;
    res.end(JSON.stringify({
      config: {limitimer: {enabled: true}, perfectcue: {enabled: true, display_time_seconds: 0.8}},
      limitimer: {status: 'connected', packet_count: requests, data: {selected_program: 1, countdown: true,
        timers: [0,1,2,3].map(() => ({remaining_seconds: 125, running: true, signal: 'green'}))}},
      perfectcue: {status: 'connected', event_count: eventCount, last_event: {kind: 'next', at: 'same', code: '0x0F'}},
    }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const instance = new Module(context);
  try {
    const fields = instance.getConfigFields();
    assert(fields.some(f => f.id === 'host')); assert(fields.some(f => f.id === 'port'));
    await instance.init({host: '127.0.0.1', port: server.address().port, interval: 100, flashCues: true, nextText: 'GO', previousText: 'BACK', minutesText: 'M $(techhub:minutes)'});
    await until(() => values.connected);
    assert.equal(values.time, '02:05');
    assert.equal(presets.clock.style.text, '$(renamed_hub:time)');
    assert.equal(Object.keys(presets).length, 9);
    assert.equal(presets.minutes.style.text, 'M $(renamed_hub:minutes)');
    assert.equal(presets.cue_next.style.text, 'GO');
    assert.equal(presets.cue_previous.style.text, 'BACK');
    assert.equal(presets.cue_next.feedbacks[0].style.color, 0x35d07f);
    assert.equal(presets.cue_previous.feedbacks[0].style.color, 0xff5263);
    assert.equal(values.cue_next_active, false);
    eventCount++;
    await until(() => values.cue_next_lit);
    assert(feedbacks.cue_next.callback());
    await until(() => values.cue_next_active && !values.cue_next_lit);
    assert(!feedbacks.cue_next.callback());
    await until(() => !values.cue_next_active);
    assert(checked > 3);
    context.label = 'second_hub';
    await instance.configUpdated({host: '127.0.0.1', port: server.address().port, interval: 100, flashCues: false});
    assert.equal(presets.clock.style.text, '$(second_hub:time)');
    await until(() => values.connected);
    eventCount++; await until(() => values.cue_next_lit);
    await wait(180); assert(values.cue_next_lit);
    await instance.destroy();
    const count = requests;
    await wait(250); assert.equal(requests, count);
    console.log('Packaged module: lifecycle, IP/port, renamed presets, timer, flashing, steady arrows, cleanup passed');
  } finally {
    await instance.destroy();
    server.closeAllConnections(); await new Promise(r => server.close(r));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
