'use strict';
const cueDefinitions = {
  cue_connected: {name: 'PerfectCue connected'},
  cue_direction: {name: 'Current arrow: next, previous, or empty'},
  cue_next_active: {name: 'Next arrow within its display time'},
  cue_previous_active: {name: 'Previous arrow within its display time'},
  cue_next_lit: {name: 'Next arrow illuminated (includes flashing)'},
  cue_previous_lit: {name: 'Previous arrow illuminated (includes flashing)'},
  cue_count: {name: 'PerfectCue event count'},
};
class CueDisplay {
  constructor() {this.reset();}
  reset() {
    this.sequence = null; this.stream = null; this.pending = []; this.nextCueAt = 0; this.signature = null; this.direction = ''; this.connected = false;
    this.until = 0; this.started = 0; this.count = 0; this.flash = false;
  }
  accept(state, config, now) {
    const device = state?.perfectcue;
    this.connected = state?.config?.perfectcue?.enabled !== false && device?.status === 'connected';
    if (!this.connected) {this.reset(); return;}
    const previousCount = this.count;
    this.count = device.event_count || 0;
    if (this.stream !== (device.stream_id || null) || this.count < previousCount) {
      this.signature = null; this.sequence = null; this.pending = []; this.direction = ''; this.until = 0;
      this.stream = device.stream_id || null;
    }
    const event = device.last_event;
    const signature = JSON.stringify([device.event_count, event?.at, event?.code]);
    // Establish a baseline on connect; never replay a stored cue from before connection.
    if (this.signature === null) {this.signature = signature; this.sequence = this.count; return;}
    if (signature === this.signature) return;
    this.signature = signature;
    if (Number.isInteger(event?.sequence) && Array.isArray(device.history)) {
      const events = device.history.filter(e => Number.isInteger(e.sequence) && e.sequence > this.sequence && e.sequence <= this.count).sort((a,b) => a.sequence-b.sequence);
      this.sequence = this.count;
      // Bound delayed replay; a long interruption must not play an entire old show.
      this.pending.push(...events.map(event => ({event, config, settings: state.config, expires: now+2000})));
      this.pending = this.pending.slice(-8);
      this.advance(now);
      return;
    }
    this.show(event, config, state.config, now);
  }
  show(event, config, settings, now) {
    this.direction = ['next', 'previous'].includes(event?.kind) ? event.kind : '';
    const seconds = Number(config.cueDisplaySeconds) || Number(settings?.perfectcue?.display_time_seconds) || 2;
    this.started = now;
    this.until = now + Math.min(60, Math.max(0.1, seconds)) * 1000;
    this.flash = config.flashCues !== false;
  }
  advance(now) {
    this.pending = this.pending.filter(item => item.expires > now);
    if (this.pending.length && now >= this.nextCueAt) {
      const item = this.pending.shift();
      this.show(item.event, item.config, item.settings, now);
      this.nextCueAt = now + 250;
    }
  }
  values(now) {
    this.advance(now);
    const active = this.connected && now < this.until;
    const elapsed = now - this.started;
    // Start lit, then flash twice during the first half second, finally remain lit.
    const lit = active && (!this.flash || elapsed >= 500 || Math.floor(elapsed / 125) % 2 === 0);
    return {
      cue_connected: this.connected, cue_direction: active ? this.direction : '', cue_count: this.count,
      cue_next_active: active && this.direction === 'next',
      cue_previous_active: active && this.direction === 'previous',
      cue_next_lit: lit && this.direction === 'next',
      cue_previous_lit: lit && this.direction === 'previous',
    };
  }
}
module.exports = {CueDisplay, cueDefinitions};
