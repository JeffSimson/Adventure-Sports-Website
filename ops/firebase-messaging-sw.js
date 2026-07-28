/* Adventure Sports Operations Hub push service worker — native Web Push handler */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(event){event.waitUntil(self.clients.claim())});
self.addEventListener('push',function(event){
  let payload={};
  try{payload=event.data?event.data.json():{}}catch(e){payload={data:{body:event.data?event.data.text():''}}}
  const n=payload.notification||payload.webpush?.notification||{};
  const d=payload.data||{};
  const title=n.title||d.title||'Adventure Sports';
  const options={
    body:n.body||d.body||'Open the Operations Hub for details.',
    icon:n.icon||'/uploads/branding/adventure-logo.png',
    badge:n.badge||'/uploads/branding/adventure-logo.png',
    tag:n.tag||d.notificationId||'ase-notification',
    requireInteraction:n.requireInteraction===true||d.priority==='emergency',
    data:{url:n.data?.url||d.url||'/ops/'}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',function(event){
  event.notification.close();
  const targetUrl=event.notification?.data?.url||'/ops/';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(const client of list){if('focus' in client){if('navigate' in client)client.navigate(targetUrl);return client.focus()}}
    return self.clients.openWindow?self.clients.openWindow(targetUrl):null;
  }));
});
