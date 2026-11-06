// The Zion Hills Map install worker. Deliberately empty: it has no fetch handler and keeps no cache, so every
// request (new Vercel deploys, the CRM and its login) goes straight to the network exactly as without it.
// Push lives in its own worker at /push/onesignal/, registered only after a visitor agrees to notifications.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
