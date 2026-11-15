/**
 * Privacy-friendly usage counting with GoatCounter (no cookies, no personal data).
 *
 * Off by default. Enable by building with VITE_GOATCOUNTER=<your code>, e.g. the
 * repository variable GOATCOUNTER_CODE in GitHub Actions (see README).
 * Respects "Do Not Track". Only route names and event names are sent — never
 * images, measurements, names, or the contents of invite links.
 */
type GC = { count: (o: { path: string; title?: string; event?: boolean }) => void };
declare global { interface Window { goatcounter?: GC & { no_onload?: boolean } } }

const CODE = (import.meta.env.VITE_GOATCOUNTER as string | undefined)?.trim();
const queue: { path: string; title?: string; event?: boolean }[] = [];
let loaded = false;

export const analyticsEnabled = () => !!CODE && navigator.doNotTrack !== '1';

export function initAnalytics() {
  if (!analyticsEnabled() || !/^[a-z0-9-]+$/i.test(CODE!)) return;
  window.goatcounter = { no_onload: true } as Window['goatcounter'];
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${CODE}.goatcounter.com/count`;
  s.onload = () => {
    loaded = true;
    queue.splice(0).forEach(send);
  };
  document.head.append(s);
}

function send(o: { path: string; title?: string; event?: boolean }) {
  try { window.goatcounter?.count?.(o); } catch { /* never break the app for analytics */ }
}

function push(o: { path: string; title?: string; event?: boolean }) {
  if (!analyticsEnabled()) return;
  if (loaded) send(o);
  else if (queue.length < 50) queue.push(o);
}

/** Page view for an app screen (hash routes are reduced to their name only). */
export function pageview(screen: string) {
  push({ path: `/palmlens/${screen}`, title: screen });
}

/** Funnel events, e.g. track('analysis_done', 'single-camera'). */
export function track(name: string, detail?: string | number) {
  const path = detail === undefined ? name : `${name}/${detail}`;
  push({ path, title: name, event: true });
}
