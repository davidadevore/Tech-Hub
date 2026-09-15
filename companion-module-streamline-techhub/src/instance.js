'use strict';
const { InstanceBase, InstanceStatus } = require('@companion-module/base');
const { HubClient } = require('./client');
const { definitions, unavailable, mapState, Freshness } = require('./state');
const { CueDisplay, cueDefinitions } = require('./cues');

class TechHubInstance extends InstanceBase {
  async init(config) {
    this.setVariableDefinitions({...definitions, ...cueDefinitions});
    this.values = unavailable('connecting');
    this.setVariableValues(this.values);
    this.setActionDefinitions({});
    this.setFeedbackDefinitions({
      cue_next: {type: 'boolean', name: 'PerfectCue next arrow lit', defaultStyle: {bgcolor: 0x071015, color: 0x35d07f},
        options: [], callback: () => !!this.values.cue_next_lit},
      cue_previous: {type: 'boolean', name: 'PerfectCue previous arrow lit', defaultStyle: {bgcolor: 0x071015, color: 0xff5263},
        options: [], callback: () => !!this.values.cue_previous_lit},
      cue_unavailable: {type: 'boolean', name: 'PerfectCue unavailable', defaultStyle: {bgcolor: 0x8c2020, color: 0xffffff},
        options: [], callback: () => !this.values.cue_connected},
      unavailable: {type: 'boolean', name: 'Timer data unavailable', defaultStyle: {bgcolor: 0x8c2020, color: 0xffffff},
        options: [], callback: () => !this.values.connected},
      running: {type: 'boolean', name: 'Active timer running', defaultStyle: {bgcolor: 0x206035, color: 0xffffff},
        options: [], callback: () => this.values.connected && this.values.running},
      overtime: {type: 'boolean', name: 'Active timer overtime', defaultStyle: {bgcolor: 0x8c2020, color: 0xffffff},
        options: [], callback: () => this.values.connected && this.values.total_seconds < 0},
    });
    await this.configUpdated(config);
  }
  updatePresets() {
    const presets = {};
    for (const [id, name, text] of [
      ['clock', 'Active minutes and seconds', this.config?.clockText ?? '$(techhub:time)'],
      ['minutes', 'Active minutes', this.config?.minutesText ?? 'MIN\n$(techhub:minutes)'],
      ['seconds', 'Active seconds', this.config?.secondsText ?? 'SEC\n$(techhub:seconds)'],
      ...[1, 2, 3, 4].map(n => ['program_' + n, 'Program ' + n + ' clock', 'P' + n + '\n$(techhub:program_' + n + '_time)']),
    ]) {
      presets[id] = {type: 'simple', name, style: {text: text.replaceAll('$(techhub:', '$(' + this.label + ':'), size: 'auto', color: 0xff8a1f, bgcolor: 0x071015},
        steps: [{down: [], up: []}], feedbacks: [{feedbackId: 'unavailable', options: {}, style: {bgcolor: 0x8c2020, color: 0xffffff}}]};
    }
    const timerIds = Object.keys(presets);
    for (const [direction, arrow] of [['previous', '←'], ['next', '→']]) {
      presets['cue_' + direction] = {type: 'simple', name: 'PerfectCue ' + direction + ' arrow',
        style: {text: this.config?.[direction + 'Text'] ?? arrow, size: 'auto', color: 0x59636a, bgcolor: 0x071015}, steps: [{down: [], up: []}],
        feedbacks: [
          {feedbackId: 'cue_' + direction, options: {}, style: {bgcolor: 0x071015, color: direction === 'next' ? 0x35d07f : 0xff5263}},
          {feedbackId: 'cue_unavailable', options: {}, style: {bgcolor: 0x8c2020, color: 0xffffff}},
        ]};
    }
    this.setPresetDefinitions([
      {id: 'timers', name: 'Limitimer displays', definitions: timerIds},
      {id: 'cues', name: 'PerfectCue arrows', definitions: ['cue_previous', 'cue_next']},
    ], presets);
  }
  getConfigFields() {
    return [
      {type: 'static-text', id: 'info', label: 'Connection', width: 12,
        value: 'Use the Tech Hub computer address and D’san public port shown on the master page. This module reads timer data; buttons do not control the timer.'},
      {type: 'textinput', id: 'host', label: 'Tech Hub IP address or hostname', width: 8, default: '127.0.0.1'},
      {type: 'number', id: 'port', label: 'D’san service port', width: 4, default: 8701, min: 1, max: 65535},
      {type: 'textinput', id: 'password', label: 'D’san service password (if set in Tech Hub)', width: 12, default: '', isPassword: true},
      {type: 'number', id: 'interval', label: 'Poll interval (milliseconds)', width: 6, default: 250, min: 100, max: 5000},
      {type: 'checkbox', id: 'flashCues', label: 'Flash arrow buttons on every received cue', width: 12, default: true},
      {type: 'number', id: 'cueDisplaySeconds', label: 'Arrow display time (seconds; 0 follows Tech Hub)', width: 12, default: 0, min: 0, max: 60},
      {type: 'static-text', id: 'presetInfo', label: 'Preset text', width: 12,
        value: 'Choose text for new presets below. Keep timer variables where you want live values. Edit existing placed buttons in Companion’s button editor, including text size and colors.'},
      {type: 'textinput', id: 'clockText', label: 'Active clock preset text', width: 12, default: '$(techhub:time)'},
      {type: 'textinput', id: 'minutesText', label: 'Minutes preset text', width: 6, default: 'MIN\n$(techhub:minutes)', multiline: true},
      {type: 'textinput', id: 'secondsText', label: 'Seconds preset text', width: 6, default: 'SEC\n$(techhub:seconds)', multiline: true},
      {type: 'textinput', id: 'previousText', label: 'Previous arrow preset text', width: 6, default: '←'},
      {type: 'textinput', id: 'nextText', label: 'Next arrow preset text', width: 6, default: '→'},
      {type: 'number', id: 'staleSeconds', label: 'No new timer packets or heartbeat timeout (seconds)', width: 6, default: 10, min: 2, max: 120},
    ];
  }
  async configUpdated(config) {
    this.stop();
    const defaults = {host: '127.0.0.1', port: 8701, password: '', interval: 250, staleSeconds: 10,
      flashCues: true, cueDisplaySeconds: 0, clockText: '$(techhub:time)',
      minutesText: 'MIN\n$(techhub:minutes)', secondsText: 'SEC\n$(techhub:seconds)',
      previousText: '←', nextText: '→'};
    const needsDefaults = Object.keys(defaults).some(key => config[key] === undefined);
    config = {...defaults, ...config};
    this.config = config;
    if (needsDefaults) this.saveConfig(config);
    this.updatePresets();
    this.cues = new CueDisplay();
    this.timerValues = unavailable('connecting');
    this.lastPublished = '';
    this.publish();
    try {
      const client = new HubClient(config);
      const controller = new AbortController();
      this.controller = controller;
      const freshness = new Freshness();
      this.animation = setInterval(() => this.publish(), 50);
      this.updateStatus(InstanceStatus.Connecting);
      const poll = async () => {
        let delay = client.config.interval;
        try {
          const state = await client.read(controller.signal);
          if (controller.signal.aborted) return;
          this.cues.accept(state, config, performance.now());
          const values = mapState(state);
          this.timerValues = values.connected && !freshness.check(state, performance.now(), client.config.staleSeconds * 1000)
            ? unavailable('stale') : values;
          this.updateStatus(this.timerValues.connected || this.cues.connected ? InstanceStatus.Ok : InstanceStatus.UnknownWarning,
            this.timerValues.connected ? undefined : 'Limitimer ' + this.timerValues.status);
        } catch (error) {
          if (controller.signal.aborted) return;
          this.timerValues = unavailable('disconnected');
          this.cues.reset();
          this.updateStatus(InstanceStatus.ConnectionFailure, error.message);
          delay = error.retryMs || Math.max(1000, delay);
        }
        if (controller.signal.aborted) return;
        this.publish();
        this.timer = setTimeout(poll, delay);
      };
      void poll();
    } catch (error) {
      this.timerValues = unavailable('configuration error');
      this.publish();
      this.updateStatus(InstanceStatus.BadConfig, error.message);
    }
  }
  publish() {
    this.values = {...this.timerValues, ...this.cues.values(performance.now())};
    const encoded = JSON.stringify(this.values);
    if (encoded === this.lastPublished) return;
    this.lastPublished = encoded;
    this.setVariableValues(this.values);
    this.checkAllFeedbacks();
  }
  stop() { clearTimeout(this.timer); clearInterval(this.animation); this.controller?.abort(); }
  async destroy() { this.stop(); }
}
module.exports = { TechHubInstance };
