// TimeVault Service Worker - Versione IBRIDA (Locale + Firebase)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDdxN05Yj1CtPOY69x3JJjuFuhEUelXWsc",
  authDomain: "work-time-vault.firebaseapp.com",
  projectId: "work-time-vault",
  storageBucket: "work-time-vault.firebasestorage.app",
  messagingSenderId: "957496336579",
  appId: "1:957496336579:web:f82df8f2d580b92ec58276"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

let reminderTime = "18:00";
let reminderEnabled = false;

// 1. GESTIONE NOTIFICHE PUSH (DA FIREBASE CONSOLE)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Push ricevuto:', payload);
  const notificationTitle = payload.notification.title || 'TimeVault';
  const notificationOptions = {
    body: payload.notification.body || 'Ricordati di registrare le ore!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: 'vault-push',
    data: { url: '/' }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. GESTIONE REMINDER LOCALE (TIMER INTERNO)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_REMINDER') {
    reminderTime = event.data.time;
    reminderEnabled = event.data.enabled;
    console.log(`[SW] Timer locale sincronizzato: ${reminderTime}`);
  }
});

setInterval(() => {
  if (!reminderEnabled) return;
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  if (currentTime === reminderTime) {
    self.registration.showNotification('TimeVault: Reminder Locale', {
      body: 'È l’orario impostato! Registra la tua giornata.',
      icon: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'vault-local-reminder'
    });
  }
}, 30000);

// GESTIONE CLICK
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});