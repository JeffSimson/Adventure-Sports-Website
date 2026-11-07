const WORKER_VERSION='9300';

try {
  importScripts('https://cdn.jsdelivr.net/npm/firebase@10.12.5/firebase-app-compat.js');
} catch (error) {
  importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
}
try {
  importScripts('https://cdn.jsdelivr.net/npm/firebase@10.12.5/firebase-messaging-compat.js');
} catch (error) {
  importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
}
firebase.initializeApp({
  apiKey:'AIzaSyCJ2bzP2XdpSvbqdr4eg5ALHcQUBAFXQ1E',
  authDomain:'adventure-sports-operations.firebaseapp.com',
  projectId:'adventure-sports-operations',
  storageBucket:'adventure-sports-operations.firebasestorage.app',
  messagingSenderId:'366845908808',
  appId:'1:366845908808:web:bc9cbeeb1fafd67a64857d'
});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{},d=payload.data||{};
  self.registration.showNotification(n.title||'Adventure Sports',{
    body:n.body||'Open the Operations Hub for details.',
    icon:'/uploads/branding/icon-192.png',
    badge:'/uploads/branding/icon-192.png',
    tag:d.notificationId||'ase-notification',
    requireInteraction:d.priority==='emergency',
    data:{url:d.url||'/ops/'}
  });
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification.data?.url||'/ops/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c){c.navigate(url);return c.focus()}}
    return clients.openWindow?clients.openWindow(url):null;
  }));
});
