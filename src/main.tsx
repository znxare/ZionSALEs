import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Someone opening the public estate map (#/map) only needs the map, not the whole CRM behind a login, so the
// map loads on its own and the CRM code is fetched only when something else is opened. That makes the first
// visit to the shared link much lighter and quicker on a phone.

const root = createRoot(document.getElementById('root')!);
const isPublicMap = () => /^#\/map(\?|$)/.test(window.location.hash);

function destination(): string | undefined {
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get('to') ?? undefined;
}

if (isPublicMap()) {
  void import('./components/PublicMap').then(({ default: PublicMap }) => {
    const show = () => {
      const to = destination();
      root.render(
        <StrictMode>
          <PublicMap key={to ?? ''} toId={to} />
        </StrictMode>,
      );
    };
    show();
    // A new map link pasted into the same tab updates the map; any other address loads the full app.
    window.addEventListener('hashchange', () => (isPublicMap() ? show() : window.location.reload()));
  });
} else {
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
