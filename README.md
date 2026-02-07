# ⏱️ TimeVault — Personal Edition

**TimeVault** è una web app sviluppata in **React + Vite** per la gestione delle ore lavorative, straordinari, ferie, malattia e riposi.  
Include autenticazione con **Firebase**, salvataggio dati su **Firestore**, report mensili stampabili in PDF e personalizzazione grafica (tema e colore principale).

---

## 🚀 Funzionalità principali

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
- 🖨️ **Esportazione report in PDF** tramite stampa
- 🌗 **Tema chiaro / scuro**
- 🎨 **Personalizzazione colore principale dell’app**
- 📱 **Installabile come PWA** (aggiunta alla Home su iOS / Android)
- 🤖 **Automazione weekend**: inserisce automaticamente “Riposo” per sabato e domenica se mancanti

---

## 🧱 Stack tecnologico

- **Frontend:** React + Vite
- **UI & Icone:** Tailwind CSS + lucide-react
- **Backend / Auth / DB:** Firebase
  - Firebase Authentication
  - Firestore
- **Build & Deploy:** Vite, Vercel (o simili)

---

## 📂 Struttura dati (Firestore)

I dati vengono salvati con questa struttura logica:

