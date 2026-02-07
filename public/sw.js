/**
 * Service Worker per TimeVault Pro
 * Gestisce i promemoria nativi in background tramite PWA
 * Versione 0.9.6 - Background Sync Attivo
 */

let reminderTime = null;
let reminderEnabled = false;

// Al momento dell'installazione del Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Ascolto messaggi dall'App principale React
self.addEventListener('message', (event) => {
  if (event.data.type === 'SET_REMINDER') {
    reminderTime = event.data.time;
    reminderEnabled = event.data.enabled;
    console.log('SW: Promemoria configurato per le ore', reminderTime);
  }
});

// Ciclo di controllo del Service Worker (60 secondi)
setInterval(() => {
  if (!reminderEnabled || !reminderTime) return;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (currentTime === reminderTime) {
    self.registration.showNotification('TimeVault: Registro Ore', {
      body: 'Hai inserito le ore lavorative di oggi? Apri il Vault per archiviare il diario!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'daily-reminder', // Evita spam se il minuto scatta due volte
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      data: { url: '/' }
    });
  }
}, 60000);

// Gestione click sulla notifica per riaprire l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Se l'app è già aperta, mettila a fuoco
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      // Altrimenti aprine una nuova finestra
      return clients.openWindow(event.notification.data.url);
    })
  );
});