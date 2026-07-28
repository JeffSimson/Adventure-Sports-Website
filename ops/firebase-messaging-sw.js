/* Adventure Sports Operations Hub push service worker */
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

var messaging = firebase.messaging();

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

messaging.setBackgroundMessageHandler(function (payload) {
  var notification = payload && payload.notification ? payload.notification : {};
  var data = payload && payload.data ? payload.data : {};
  var title = notification.title || data.title || 'Adventure Sports';
  var options = {
    body: notification.body || data.body || 'Open the Operations Hub for details.',
    icon: '/uploads/branding/adventure-logo.png',
    badge: '/uploads/branding/adventure-logo.png',
    tag: data.notificationId || 'ase-notification',
    requireInteraction: data.priority === 'emergency',
    data: { url: data.url || '/ops/' }
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var data = event.notification && event.notification.data ? event.notification.data : {};
  var targetUrl = data.url || '/ops/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i];
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    })
  );
});
