'use strict';

const fields = {
  minutes: 'Displayed minutes, zero padded (includes overtime minus sign)',
  seconds: 'Displayed seconds within minute, zero padded',
  time: 'Displayed time (MM:SS; minutes may exceed 59)',
  sign: 'Overtime minus sign, otherwise empty',
  total_seconds: 'Signed displayed time in seconds',
  running: 'Timer running',
  signal: 'Signal light: green, yellow or red',
};
const prefixes = ['', 'program_1_', 'program_2_', 'program_3_', 'program_4_'];
const definitions = {
  connected: { name: 'Fresh Limitimer data available' },
  status: { name: 'Timer connection status' },
  selected_program: { name: 'Selected Limitimer program (1–4)' },
  countdown: { name: 'Countdown mode' },
};
for (const prefix of prefixes) for (const [key, name] of Object.entries(fields)) {
  definitions[prefix + key] = { name: (prefix ? prefix.replaceAll('_', ' ').trim() : 'Active program') + ': ' + name };
}
function unavailable(status) {
  const values = { connected: false, status, selected_program: '', countdown: false };
  for (const prefix of prefixes) Object.assign(values, {
    [prefix + 'minutes']: '--', [prefix + 'seconds']: '--', [prefix + 'time']: '--:--',
    [prefix + 'sign']: '', [prefix + 'total_seconds']: '', [prefix + 'running']: false, [prefix + 'signal']: '',
  });
  return values;
}
function timerValues(timer, stopAtZero) {
  if (!timer || !Number.isSafeInteger(timer.remaining_seconds) || typeof timer.running !== 'boolean' ||
      !['green', 'yellow', 'red'].includes(timer.signal)) throw Error('Invalid Limitimer timer data');
  const raw = timer.remaining_seconds;
  const value = stopAtZero ? Math.max(0, raw) : raw;
  const sign = value < 0 ? '-' : '';
  const minutes = sign + String(Math.floor(Math.abs(value) / 60)).padStart(2, '0');
  const seconds = String(Math.abs(value) % 60).padStart(2, '0');
  return {minutes, seconds, time: minutes + ':' + seconds, sign, total_seconds: value,
    running: timer.running, signal: timer.signal};
}
function mapState(state) {
  const data = state?.limitimer?.data;
  if (!state?.config?.limitimer || typeof state.limitimer.status !== 'string') throw Error('Not a Tech Hub D’san state response');
  if (state.config.limitimer.enabled === false) return unavailable('disabled');
  if (state.limitimer.status !== 'connected') return unavailable(state.limitimer.status);
  if (!data) return unavailable('waiting');
  if (!Array.isArray(data.timers) || data.timers.length !== 4 ||
      !Number.isInteger(data.selected_program) || data.selected_program < 1 || data.selected_program > 4 ||
      typeof data.countdown !== 'boolean') throw Error('Invalid Limitimer program data');
  const stop = state.config.display?.overtime === 'stop';
  const timers = data.timers.map(timer => timerValues(timer, stop));
  const values = {connected: true, status: 'connected', selected_program: data.selected_program, countdown: data.countdown};
  for (let i = 0; i < 4; i++) for (const [key, value] of Object.entries(timers[i])) values['program_' + (i + 1) + '_' + key] = value;
  Object.assign(values, timers[data.selected_program - 1]);
  return values;
}

// Measure freshness on this machine, so different computer clocks do not cause false alarms.
class Freshness {
  constructor() { this.signature = null; this.changedAt = 0; }
  check(state, now, timeout) {
    const signature = JSON.stringify([state.limitimer.packet_count, state.limitimer.heartbeat_count, state.limitimer.updated_at]);
    if (signature !== this.signature) { this.signature = signature; this.changedAt = now; }
    return now - this.changedAt < timeout;
  }
}
module.exports = {definitions, unavailable, mapState, Freshness};
