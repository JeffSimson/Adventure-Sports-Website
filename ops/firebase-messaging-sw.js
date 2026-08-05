const WORKER_VERSION='9200';
/* Adventure Sports Operations Hub — Firebase Messaging service worker */
try {
  importScripts('https://cdn.jsdelivr.net/npm/firebase@8.10.1/firebase-app.js');
} catch (error) {
  importScripts('https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-app.min.js');
}
try {
  importScripts('https://cdn.jsdelivr.net/npm/firebase@8.10.1/firebase-messaging.js');
} catch (error) {
  importScripts('https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-messaging.min.js');
}

firebase.initializeApp({
  apiKey: 'AIzaSyCJ2bzP2XdpSvbqdr4eg5ALHcQUBAFXQ1E',
  authDomain: 'adventure-sports-operations.firebaseapp.com',
  projectId: 'adventure-sports-operations',
  storageBucket: 'adventure-sports-operations.firebasestorage.app',
  messagingSenderId: '366845908808',
  appId: '1:366845908808:web:bc9cbeeb1fafd67a64857d'
});

if (!self.firebase || typeof self.firebase.messaging !== 'function') {
  throw new Error('Firebase Messaging SDK failed to load in the service worker.');
}
const messaging = firebase.messaging();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Notification messages sent by the backend include webpush.notification,
// so supported browsers (including iPhone Home Screen apps) display them
// directly. This handler is only a fallback for older/data-only messages.
messaging.onBackgroundMessage(payload => {
  if (payload && payload.notification) return;
  const d = (payload && payload.data) || {};
  const title = d.title || 'Adventure Sports';
  return self.registration.showNotification(title, {
    body: d.body || 'Open the Operations Hub for details.',
    icon: 'https://adventurenj.com/uploads/branding/adventure-logo.png',
    badge: 'https://adventurenj.com/uploads/branding/adventure-logo.png',
    tag: d.notificationId || 'ase-notification',
    renotify: true,
    requireInteraction: d.priority === 'emergency',
    data: { url: d.url || '/ops/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification?.data?.url || '/ops/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        if ('navigate' in client) client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : null;
  }));
});
