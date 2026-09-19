import type { SignalSnapshot } from './port-signal-status';

export async function fetchSignalSnapshot(signal: AbortSignal, request: typeof fetch = fetch): Promise<SignalSnapshot> {
  const response = await request('/api/signals', {
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
  });
  if (!response.ok) throw new Error('Receiver unavailable');
  const snapshot = await response.json() as SignalSnapshot;
  if (!snapshot?.available || !Array.isArray(snapshot.signals)) throw new Error('Invalid receiver data');
  return snapshot;
}
