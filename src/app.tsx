import { connectionStatus } from './lib/ha/connection';
import { serverConfig, setupRequested } from './lib/config';
import { SetupScreen } from './components/SetupScreen';
import { Shell } from './components/Shell';
import { Spinner } from './components/Spinner';

export function App() {
  const cfg = serverConfig.value;
  const status = connectionStatus.value;

  // brief wait while we ask the container whether it's configured
  if (!cfg.loaded) {
    return (
      <div class="view-loading">
        <Spinner />
      </div>
    );
  }

  if (!cfg.configured || status === 'auth-failed' || setupRequested.value) {
    return (
      <SetupScreen
        authFailed={status === 'auth-failed'}
        onCancel={setupRequested.value ? () => (setupRequested.value = false) : undefined}
      />
    );
  }
  return <Shell />;
}
