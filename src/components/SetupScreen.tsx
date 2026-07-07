import { useState } from 'preact/hooks';
import { serverConfig, saveConnection } from '../lib/config';

export function SetupScreen({
  authFailed,
  onCancel,
}: {
  authFailed?: boolean;
  onCancel?: () => void;
}) {
  const [url, setUrl] = useState(serverConfig.value.hassUrl ?? '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    authFailed
      ? 'Home Assistant rejected the saved access token (it may have been revoked). Enter a new one.'
      : null,
  );

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // the dashboard container validates against HA and stores the token
    const result = await saveConnection(url, token);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    location.reload();
  }

  return (
    <div class="setup">
      <form class="setup-card" onSubmit={submit}>
        <h1>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 6 L27 15 H24 V25 H19 V18 H13 V25 H8 V15 H5 Z" fill="var(--accent)" />
          </svg>
          Oranjehuis
        </h1>
        <p class="setup-hint">
          Connect the dashboard to your Home Assistant. This is stored once in the container and
          shared by every screen — the token stays on the server and is never sent to browsers.
        </p>
        <label>
          Home Assistant URL
          <input
            type="text"
            value={url}
            onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
            placeholder="http://192.168.1.10:8123"
            required
            autocomplete="url"
            inputMode="url"
          />
        </label>
        <label>
          Long-lived access token
          <input
            type="password"
            value={token}
            onInput={(e) => setToken((e.target as HTMLInputElement).value)}
            placeholder="Paste token"
            required
          />
        </label>
        {error && <div class="setup-error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? 'Testing connection…' : 'Test & save'}
        </button>
        {onCancel && (
          <button type="button" class="setup-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <p class="setup-hint">
          Create a token in HA: <strong>Profile → Security → Long-lived access tokens</strong>. The
          dashboard container must be able to reach the HA URL (it connects on your behalf, so no
          browser CORS setup is needed).
        </p>
      </form>
    </div>
  );
}
