importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Configurazione Firebase identica a quella dell'App
const firebaseConfig = {
  apiKey: "AIzaSyDdxN05Yj1CtPOY69x3JJjuFuhEUelXWsc",
  authDomain: "work-time-vault.firebaseapp.com",
  projectId: "work-time-vault",
  storageBucket: "work-time-vault.firebasestorage.app",
  messagingSenderId: "957496336579",
  appId: "1:957496336579:web:f82df8f2d580b92ec58276"
};

// Inizializza Firebase nel Service Worker
firebase.initializeApp(firebaseConfig);

// Recupera l'istanza di messaging
const messaging = firebase.messaging();

// Gestione dei messaggi in background (quando l'app è chiusa o in background)
messaging.onBackgroundMessage(function(payload) {
  console.log('[sw.js] Messaggio ricevuto in background:', payload);
  
  // Personalizza la notifica
  const notificationTitle = payload.notification.title || 'TimeVault';
  const notificationOptions = {
    body: payload.notification.body || 'Nuovo aggiornamento dal Vault.',
    icon: '/favicon.ico', // Assicurati di avere un'icona
    badge: '/favicon.ico',
    data: payload.data // Dati extra passati dal server
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestione del click sulla notifica
self.addEventListener('notificationclick', function(event) {
  console.log('[sw.js] Notifica cliccata.');
  event.notification.close();

  // Cerca di aprire o focalizzare la finestra dell'app
  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(clientList) {
      // Se c'è già una finestra aperta, focalizzala
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/') > -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Ascoltatore per messaggi interni dall'App (es. Impostazione Reminder locale)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_REMINDER') {
    console.log('[sw.js] Reminder configurato:', event.data);
    // Nota: I Service Worker moderni possono essere "terminati" dal browser per risparmiare risorse.
    // Per reminder locali affidabili, l'ideale è usare le Push Notifications dal server,
    // ma questo ascoltatore conferma che il canale di comunicazione è attivo.
  }
});