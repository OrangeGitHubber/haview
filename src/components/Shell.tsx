import { settings } from '../lib/settings';
import { currentRoute } from '../lib/router';
import { haBase } from '../lib/config';
import { minuteTick } from '../lib/clock';
import { useIdle } from '../lib/useIdle';
import { settingsLoader } from '../views/registry';
import { Nav } from './Nav';
import { StatusBanner } from './StatusBanner';
import { AsyncView } from './AsyncView';
import { Screensaver } from './Screensaver';
import { IdleDebugOverlay } from './IdleDebugOverlay';
import { ToastHost } from './Toast';

const gridPageLoader = () => import('../grid/GridPage');

function backgroundUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  // HA-served paths (/local/…) go through the reverse proxy
  if (raw.startsWith('/')) return haBase() + raw;
  return raw;
}

export function Shell() {
  const route = currentRoute.value;
  const pages = settings.value.pages;

  let content;
  let bg: string | null = null;
  let aurora = false;
  let glass = 50;
  if (route === 'settings') {
    content = <AsyncView key="settings" load={settingsLoader} />;
  } else {
    const page = pages.find((p) => p.id === route) ?? pages[0];
    // 'aurora' is the reserved value for the animated gradient background
    aurora = page.background === 'aurora';
    bg = aurora ? null : backgroundUrl(page.background);
    glass = page.backgroundGlass ?? 50;
    content = <AsyncView key={page.id} load={gridPageLoader} props={{ pageId: page.id }} />;
  }

  const s = settings.value;
  const d = new Date(minuteTick.value);
  const cur = d.getHours() * 60 + d.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h % 24) * 60 + (m || 0);
  };
  const start = toMin(s.nightDimStart);
  const end = toMin(s.nightDimEnd);
  // window may wrap past midnight (22:00 → 07:00)
  const inWindow = start <= end ? cur >= start && cur < end : cur >= start || cur < end;
  // user activity lifts both night features; they return after the idle time
  const idle = useIdle(s.nightDimResume * 60_000);
  const nightIdle = inWindow && idle;
  const nightDim = s.nightDim && nightIdle;
  // the screensaver shares the night window + idle trigger but toggles on its
  // own; when active it fully covers the dashboard (its own opaque base), so
  // it supersedes the partial dim overlay above it
  const showSaver = s.screensaver && nightIdle;

  return (
    <div class="shell">
      {bg && (
        <div
          class="page-bg"
          style={{
            backgroundImage: `url(${bg})`,
            '--bg-blur': `${Math.round((glass / 100) * 28)}px`,
          }}
        />
      )}
      {aurora && <div class="page-aurora" aria-hidden="true" />}
      <StatusBanner />
      <Nav />
      <main class="shell-main">{content}</main>
      {nightDim && (
        <div
          class="night-overlay"
          style={{ background: `rgba(0, 0, 0, ${s.nightDimAmount / 100})` }}
          aria-hidden="true"
        />
      )}
      {showSaver && (
        <Screensaver
          brightness={s.screensaverBrightness}
          speed={s.screensaverSpeed}
          intensity={s.screensaverIntensity}
        />
      )}
      {s.idleDebug && <IdleDebugOverlay nightActive={nightDim || showSaver} />}
      <ToastHost />
    </div>
  );
}
