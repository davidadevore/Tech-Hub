'use strict';
const http = require('node:http');
const { isIP } = require('node:net');

function validateConfig(config) {
  const host = String(config.host || '').trim();
  if (!host || (!isIP(host) && !/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host))) {
    throw Error('Enter the Tech Hub computer IP address or hostname, without a URL or port');
  }
  const port = Number(config.port ?? 8701);
  const interval = Number(config.interval ?? 250);
  const staleSeconds = Number(config.staleSeconds ?? 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Port must be 1–65535');
  if (!Number.isInteger(interval) || interval < 100 || interval > 5000) throw Error('Poll interval must be 100–5000 ms');
  if (!Number.isFinite(staleSeconds) || staleSeconds < 2 || staleSeconds > 120) throw Error('Stale timeout must be 2–120 seconds');
  const cueDuration = Number(config.cueDisplaySeconds ?? 0);
  if (!Number.isFinite(cueDuration) || cueDuration < 0 || cueDuration > 60) throw Error('Arrow display time must be 0–60 seconds');
  return {host, port, interval, staleSeconds, password: String(config.password || '')};
}
class HubClient {
  constructor(config) { this.config = validateConfig(config); this.cookie = ''; }
  request(path, signal, body) {
    return new Promise((resolve, reject) => {
      const headers = {Accept: 'application/json'};
      if (this.cookie) headers.Cookie = this.cookie;
      if (body !== undefined) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(body);
      }
      const req = http.request({hostname: this.config.host, port: this.config.port, path,
        method: body === undefined ? 'GET' : 'POST', headers, signal}, res => {
        let size = 0; const chunks = [];
        res.on('data', chunk => {
          size += chunk.length;
          if (size > 262144) {res.destroy(); req.destroy(Error('Tech Hub response is too large')); return;}
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
      });
      const timeout = setTimeout(() => req.destroy(Error('Tech Hub request timed out')), 2000);
      req.on('close', () => clearTimeout(timeout));
      req.on('error', reject);
      req.end(body);
    });
  }
  async read(signal) {
    let response = await this.request('/api/state', signal);
    if (response.status === 401) {
      this.cookie = '';
      if (!this.config.password) throw Error('D’san service password required');
      const login = await this.request('/__hub/login', signal, new URLSearchParams({password: this.config.password}).toString());
      if (login.status === 401 || login.status === 429) {
        const error = Error(login.status === 429 ? 'Login rate limited; retrying in one minute' : 'Incorrect D’san service password');
        error.retryMs = 60000;
        throw error;
      }
      const cookie = login.headers['set-cookie']?.find(value => value.startsWith('techhub_dsan='));
      if (login.status !== 303 || !cookie) throw Error('Unable to sign in to the Tech Hub D’san service');
      this.cookie = cookie.split(';')[0];
      response = await this.request('/api/state', signal);
    }
    if (response.status !== 200) throw Error('Tech Hub D’san service returned HTTP ' + response.status);
    try { return JSON.parse(response.body); } catch { throw Error('Tech Hub D’san service returned invalid JSON'); }
  }
}
module.exports = {HubClient, validateConfig};
