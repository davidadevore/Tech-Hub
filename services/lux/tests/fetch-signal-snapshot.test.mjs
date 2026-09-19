import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSignalSnapshot } from '../lib/fetch-signal-snapshot.ts';
test('signal snapshots reject failed HTTP responses and invalid/unavailable receivers', async () => {
 const signal = new AbortController().signal;
 for (const [status, body] of [[401, {}], [503, {}], [200, {available:false, signals:[]}], [200, null], [200, {available:true}]]) {
  await assert.rejects(fetchSignalSnapshot(signal, async () => new Response(JSON.stringify(body), {status})));
 }
 const snapshot = {available:true,signals:[]};
 assert.deepEqual(await fetchSignalSnapshot(signal,async (_url, options)=>{
  assert(options.signal instanceof AbortSignal);assert.equal(options.cache,'no-store');return new Response(JSON.stringify(snapshot));
 }),snapshot);
});
