import { render } from 'preact';
import { App } from './app';
import { fetchServerConfig } from './lib/config';
import { getConnection } from './lib/ha/connection';
import { initProfiles } from './lib/settings';
import { startVersionWatch } from './lib/version';
import './styles/fonts.css';
import './styles/theme.css';
import './styles/base.css';

// ask the container whether it's configured, then load the shared profile and
// connect to HA through the proxy
fetchServerConfig().then((cfg) => {
  initProfiles().catch(() => {
    /* offline — the localStorage cache in the settings signal is used */
  });
  if (cfg.configured) {
    getConnection().catch(() => {
      /* auth-failed is reflected in connectionStatus; App routes to setup */
    });
  }
});

startVersionWatch();

render(<App />, document.getElementById('app')!);
