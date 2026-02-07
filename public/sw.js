// TimeVault Service Worker - Versione Ottimizzata Mobile
const CACHE_NAME = 'time-vault-v1';

// Forza l'attivazione del Service Worker appena viene installato
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

let reminderTime = "18:00";
let reminderEnabled = false;

// Riceve i settaggi dall'App React
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_REMINDER') {
    reminderTime = event.data.time;
    reminderEnabled = event.data.enabled;
    console.log(`[SW] Sincronizzato per le: ${reminderTime}`);
  }
});

// Timer di controllo (Nota: su mobile potrebbe fermarsi se il sistema iberna il processo)
setInterval(() => {
  if (!reminderEnabled || !reminderTime) return;

  const now = new Date();
  const currentH = String(now.getHours()).padStart(2, '0');
  const currentM = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentH}:${currentM}`;

  if (currentTime === reminderTime) {
    self.registration.showNotification('TimeVault Reminder', {
      body: 'È ora di registrare la giornata lavorativa nel Vault!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'vault-reminder',
      renotify: true,
      requireInteraction: true // Mantiene la notifica visibile finché non viene toccata
    });
  }
}, 60000);

// Gestione click sulla notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/');
    })
  );
});

// Listener per messaggi Push (per future implementazioni server-side)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Notifica dal Vault',
    icon: '/favicon.ico',
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification('TimeVault', options));
});