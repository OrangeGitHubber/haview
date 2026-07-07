import { render } from 'preact';
import { App } from './app';
import { fetchServerConfig } from './lib/config';
import { getConnection } from './lib/ha/connection';
import './styles/theme.css';
import './styles/base.css';

// ask the container whether it's configured, then connect through the proxy
fetchServerConfig().then((cfg) => {
  if (cfg.configured) {
    getConnection().catch(() => {
      /* auth-failed is reflected in connectionStatus; App routes to setup */
    });
  }
});

render(<App />, document.getElementById('app')!);
