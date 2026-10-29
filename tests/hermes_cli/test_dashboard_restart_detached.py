"""Regression: dashboard restart command must not become the live gateway."""
import subprocess
import unittest
from unittest.mock import MagicMock, patch

class DashboardRestartDetachTests(unittest.TestCase):
    def test_restart_without_interrupt_is_detached(self):
        self._check(False)

    def test_restart_with_interrupt_is_detached(self):
        self._check(True)

    def _check(self, interrupt):
        from hermes_cli import web_server
        from hermes_cli.web_server import _spawn_gateway_restart
        saved = web_server._LAST_GATEWAY_RESTART
        web_server._LAST_GATEWAY_RESTART = None
        proc = MagicMock(spec=subprocess.Popen)
        proc.pid = 4242
        proc.poll.return_value = 0
        try:
            with patch('hermes_cli.web_server_gateway._gateway_subcommand',
                       return_value=['-p','default','gateway','restart']), \
                 patch('hermes_cli.web_server_gateway._spawn_hermes_action',
                       return_value=proc) as spawn, \
                 patch('hermes_cli.web_server_gateway._ACTION_PROCS', {}), \
                 patch('hermes_cli.web_server_gateway._ACTION_COMMANDS', {}):
                got, reused = _spawn_gateway_restart(interrupt=interrupt)
            self.assertIs(got,proc)
            self.assertIs(reused,False)
            self.assertEqual(spawn.call_args.args[0],
                ['-p','default','gateway','restart',
                  *(['--interrupt'] if interrupt else []),'--detach'])
            self.assertEqual(spawn.call_args.args[1],'gateway-restart')
        finally:
            web_server._LAST_GATEWAY_RESTART=saved

if __name__=='__main__':
    unittest.main(verbosity=2)
