import tempfile
import unittest
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
with patch('socket.getaddrinfo', return_value=[]):
    import app

class ReliabilityTests(unittest.TestCase):
    def setUp(self):
        network = patch('app.local_ipv4_addresses', return_value=['127.0.0.1'])
        network.start()
        self.addCleanup(network.stop)

    def test_display_changes_do_not_reconnect_and_device_changes_are_isolated(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(app, 'CONFIG_PATH', Path(directory) / 'config.json'):
            state = app.SharedState()
            state.connection('perfectcue', 'connected')
            config = deepcopy(state.config)
            config['perfectcue']['display_time_seconds'] = 5
            state.set_config(config)
            self.assertEqual(state.device_versions, {'limitimer': 0, 'perfectcue': 0})
            self.assertEqual(state.data['perfectcue']['status'], 'connected')
            config['limitimer']['port'] += 1
            state.set_config(config)
            self.assertEqual(state.device_versions, {'limitimer': 1, 'perfectcue': 0})

    def test_timer_freshness_uses_valid_frames_and_heartbeats(self):
        state = app.SharedState()
        with patch.object(app.time, 'monotonic', return_value=100):
            state.limitimer_frame({'updated_at': 'now', 'active': {}})
        with patch.object(app.time, 'monotonic', return_value=111):
            self.assertTrue(state.snapshot()['limitimer']['stale'])
            self.assertEqual(state.snapshot()['limitimer']['status'], 'disconnected')
            state.heartbeat()
            self.assertFalse(state.snapshot()['limitimer']['stale'])
            self.assertEqual(state.snapshot()['limitimer']['status'], 'connected')

    def test_cue_events_have_unique_sequences_with_bounded_history(self):
        state = app.SharedState()
        for _ in range(260): state.perfectcue_event(0x0f)
        cue = state.snapshot()['perfectcue']
        self.assertEqual(len(cue['history']), 256)
        self.assertEqual(cue['last_event']['sequence'], 260)
        self.assertEqual(cue['history'][-1]['sequence'], 5)
        self.assertNotEqual(cue['stream_id'], app.SharedState().data['perfectcue']['stream_id'])
