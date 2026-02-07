// --- NUOVA LOGICA CON TIMER LOCALE ---
let reminderTime = "18:00";
let reminderEnabled = false;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_REMINDER') {
    reminderTime = event.data.time;
    reminderEnabled = event.data.enabled;
    console.log(`[SW] Orario sincronizzato: ${reminderTime} (Attivo: ${reminderEnabled})`);
  }
});

// Controllo ogni minuto
setInterval(() => {
  if (!reminderEnabled || !reminderTime) return;

  const oraAttuale = new Date().toLocaleTimeString('it-IT', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });

  if (oraAttuale === reminderTime) {
    self.registration.showNotification('TimeVault: Registro Ore', {
      body: 'È il momento di archiviare la tua giornata nel Vault!',
      icon: '/clock.png',
      badge: '/clock.png',
      vibrate: [200, 100, 200],
      tag: 'reminder-tag', // Evita notifiche doppie
      renotify: true
    });
  }
}, 60000);

// --- RESTO DEL CODICE (PUSH E CLICK) ---
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Ricordati di archiviare la giornata nel Vault!',
    icon: '/clock.png',
    badge: '/clock.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now(), primaryKey: '1' },
    actions: [
      { action: 'explore', title: 'Apri Vault' },
      { action: 'close', title: 'Chiudi' }
    ]
  };
  event.waitUntil(self.registration.showNotification('TimeVault Reminder', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'explore') {
    event.waitUntil(clients.openWindow('/'));
  }
});