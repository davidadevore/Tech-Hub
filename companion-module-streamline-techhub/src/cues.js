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
    this.signature = null; this.direction = ''; this.connected = false;
    this.until = 0; this.started = 0; this.count = 0; this.flash = false;
  }
  accept(state, config, now) {
    const device = state?.perfectcue;
    this.connected = state?.config?.perfectcue?.enabled !== false && device?.status === 'connected';
    if (!this.connected) {this.reset(); return;}
    this.count = device.event_count || 0;
    const event = device.last_event;
    const signature = JSON.stringify([device.event_count, event?.at, event?.code]);
    // Establish a baseline on connect; never replay a stored cue from before connection.
    if (this.signature === null) {this.signature = signature; return;}
    if (signature === this.signature) return;
    this.signature = signature;
    this.direction = ['next', 'previous'].includes(event?.kind) ? event.kind : '';
    const seconds = Number(config.cueDisplaySeconds) || Number(state.config?.perfectcue?.display_time_seconds) || 2;
    this.started = now;
    this.until = now + Math.min(60, Math.max(0.1, seconds)) * 1000;
    this.flash = config.flashCues !== false;
  }
  values(now) {
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
