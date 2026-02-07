🔒 TimeVault Enterprise - Registro Ore Team

TimeVault è un'applicazione web moderna progettata per la registrazione collaborativa delle ore lavorative (standard e straordinari). Utilizza React per l'interfaccia e Firebase per la gestione dei dati in tempo reale.

🚀 Caratteristiche

Autenticazione Aziendale: Accesso tramite formato nome.cognome (ID interno @time.vault).

- 🔐 **Autenticazione utenti** (login / registrazione) con Firebase Auth  
- 🛡️ **Sistema di sicurezza con codice di recupero** per:
  - Sblocco account dopo tentativi falliti
  - Eliminazione definitiva dell’account
- 📅 **Calendario mensile** con:
  - Inserimento ore standard
  - Inserimento straordinari
  - Ferie, malattia, riposo, riposo compensativo
- 👥 **Selezione multipla capisquadra** (da file JSON esterno)
- 📝 **Note opzionali** per ogni giornata
- 📊 **Resoconto mensile**:
  - Giorni lavorati
  - Totale ore extra
  - Ricerca per note o caposquadra
- 🖨️ **Esportazione report in PDF** tramite download
- 🌗 **Tema chiaro / scuro**
- 🎨 **Personalizzazione colore principale dell’app**
- 📱 **Installabile come PWA** (aggiunta alla Home su iOS / Android)
- 🤖 **Automazione weekend**: inserisce automaticamente “Riposo” per sabato e domenica se mancanti

Privacy: Ogni utente può eliminare solo i propri record.

Statistiche: Calcolo automatico dei totali (Standard vs Extra) per il singolo e per il team.

🛠️ Requisiti Premilinari

Node.js installato sul PC.

Un progetto attivo su Firebase Console.

📦 Installazione Locale

Clona la repository o scarica i file in una cartella.

Apri il terminale nella cartella del progetto ed esegui:

npm install


Configura le tue chiavi Firebase nel file src/App.jsx all'interno dell'oggetto firebaseConfig.

⚙️ Configurazione Firebase (Obbligatoria)

Per far funzionare l'autenticazione e il database, segui questi passaggi nella console di Firebase:

1. Authentication

Vai su Authentication > Sign-in method.

Abilita il provider Email/Password.

2. Firestore Database

Crea un database Firestore in modalità produzione.

Nella scheda Rules, incolla queste regole per permettere l'uso del percorso richiesto:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/time-vault-pro/public/data/work_logs/{document} {
      allow read, write: if request.auth != null;
    }
  }
}


💻 Sviluppo e Produzione

Per avviare l'app in locale:

npm run dev


Per creare la versione ottimizzata per la pubblicazione:

npm run build


👥 Guida per i Colleghi

Quando condividi l'app, comunica ai tuoi colleghi di:

Usare il formato nome.cognome come username.

Creare un account tramite il tasto "Registrati ora" al primo accesso.

Segnalare le ore standard (default 8) e gli eventuali straordinari separatamente.

Sviluppato con React + Vite + Tailwind CSS