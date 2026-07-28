/* Adventure Sports Operations Hub — Firebase Messaging service worker */
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCJ2bzP2XdpSvbqdr4eg5ALHcQUBAFXQ1E',
  authDomain: 'adventure-sports-operations.firebaseapp.com',
  projectId: 'adventure-sports-operations',
  storageBucket: 'adventure-sports-operations.firebasestorage.app',
  messagingSenderId: '366845908808',
  appId: '1:366845908808:web:bc9cbeeb1fafd67a64857d'
});

const messaging = firebase.messaging();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || 'Adventure Sports';
  const options = {
    body: n.body || d.body || 'Open the Operations Hub for details.',
    icon: 'https://adventurenj.com/uploads/branding/adventure-logo.png',
    badge: 'https://adventurenj.com/uploads/branding/adventure-logo.png',
    tag: d.notificationId || 'ase-notification',
    renotify: true,
    requireInteraction: d.priority === 'emergency',
    data: { url: d.url || '/ops/' }
  };
  return self.registration.showNotification(title, options);
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
