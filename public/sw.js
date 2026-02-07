// Importa gli script di Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configurazione (Sostituisci con i tuoi dati se diversi, ma questi sono quelli del tuo App.jsx)
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

// Gestione notifiche quando l'app è in background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Notifica ricevuta in background:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Listener per il click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});