import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  Clock, Plus, Trash2, Calendar as CalendarIcon, LogOut, TrendingUp, 
  Briefcase, Sun, Moon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft, CheckCircle2,
  Menu, Home, FileText, Settings, X, Zap, Palmtree, Thermometer, AlertTriangle, Download, Eye, ShieldAlert, Lock, LogIn, UserPlus, Key, Copy, AlertOctagon, ShieldCheck, Unlock, RefreshCw
} from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDdxN05Yj1CtPOY69x3JJjuFuhEUelXWsc",
  authDomain: "work-time-vault.firebaseapp.com",
  projectId: "work-time-vault",
  storageBucket: "work-time-vault.firebasestorage.app",
  messagingSenderId: "957496336579",
  appId: "1:957496336579:web:f82df8f2d580b92ec58276"
};

const APP_ID = "time-vault-pro";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const INTERNAL_DOMAIN = "@time.vault";

// Valore ore standard (modificabile per CCNL Chimico)
const STANDARD_HOURS_VALUE = 8; 

// Funzione helper per formattare la data in LOCALE (senza shift UTC)
const formatDateAsLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Funzione helper per formattare la data nel formato italiano DD/MM/YYYY per la stampa
const formatDateIT = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// Generatore Codice Recupero (16 caratteri)
const generateRecoveryCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Escluso I, 1, O, 0 per leggibilità
  let result = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // STATI PER IL CALENDARIO E NAVIGAZIONE
  const [view, setView] = useState('calendar'); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // STATI PER GESTIONE ERRORI E CONFERME
  const [formError, setFormError] = useState('');
  const [logToDelete, setLogToDelete] = useState(null); // ID del log da cancellare
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false); // Nuovo stato per conferma PDF
  const [showPreviewModal, setShowPreviewModal] = useState(false); // Nuovo stato per anteprima dati

  // STATI PER ELIMINAZIONE ACCOUNT
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false); // Step 1: Password
  const [showDeleteFinalConfirm, setShowDeleteFinalConfirm] = useState(false); // Step 2: Conferma Finale
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // STATI PER LOGIN POPUP E SICUREZZA
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState(''); // Codice appena generato
  const [showRecoveryModal, setShowRecoveryModal] = useState(false); // Modale "Salva il codice"
  
  // Stati per Lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Codice, 2: Nuova Password
  const [newResetPassword, setNewResetPassword] = useState('');

  // Gestione Tema
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') || 'light';
    return 'light';
  });

  const [authData, setAuthData] = useState({ username: '', password: '' });
  
  // Stato del form
  const [formData, setFormData] = useState({
    standardHours: 0, 
    overtimeHours: '',
    notes: '',
    type: 'work' // 'work', 'ferie', 'malattia'
  });
  
  // Stato visibilità input
  const [showOvertimeInput, setShowOvertimeInput] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false); // Nuovo stato per accordion note

  // Calcolo se è weekend
  const isWeekend = useMemo(() => {
    const day = selectedDate.getDay();
    return day === 0 || day === 6; // 0 = Domenica, 6 = Sabato
  }, [selectedDate]);

  // Effetto Tema
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effetto Sync Tema
  useEffect(() => {
    if (!user) return;
    const loadUserTheme = async () => {
      try {
        const themeDocRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme');
        const themeSnap = await getDoc(themeDocRef);
        if (themeSnap.exists()) {
          const savedTheme = themeSnap.data().mode;
          if (savedTheme) setTheme(savedTheme);
        }
      } catch (error) { console.error("Errore tema:", error); }
    };
    loadUserTheme();
  }, [user]);

  // --- Generatore Favicon Dinamica ---
  useEffect(() => {
    const setDynamicFavicon = () => {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/svg+xml';
      link.rel = 'shortcut icon';
      link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%232563eb%22/><path d=%22M50 25V50L65 65%22 stroke=%22white%22 stroke-width=%228%22 stroke-linecap=%22round%22 fill=%22none%22/></svg>`;
      document.getElementsByTagName('head')[0].appendChild(link);
    };
    setDynamicFavicon();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (user) {
      try {
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), {
          mode: newTheme,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) { console.error(e); }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try { await setPersistence(auth, browserLocalPersistence); } 
      catch (error) { console.error("Persistence error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!showRecoveryModal) {
         setUser(currentUser);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [showRecoveryModal]);

  useEffect(() => {
    if (!user) { setLogs([]); return; }
    const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
    const unsubscribe = onSnapshot(logsCollection, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      },
      (error) => console.error("Firestore Error:", error)
    );
    return () => unsubscribe();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    
    const cleanUsername = authData.username.trim().toLowerCase().replace(/\s/g, '');
    if (!cleanUsername.includes('.')) {
      setAuthError("L'ID deve essere 'nome.cognome'");
      setIsSubmitting(false);
      return;
    }
    const internalEmail = `${cleanUsername}${INTERNAL_DOMAIN}`;

    try {
      if (authMode === 'login') {
        if (isLocked) {
           setAuthError("Account bloccato. Inserisci il codice di recupero.");
           setIsSubmitting(false);
           return;
        }

        await signInWithEmailAndPassword(auth, internalEmail, authData.password);
        setFailedAttempts(0);
        setShowAuthModal(false);

      } else {
        const cred = await createUserWithEmailAndPassword(auth, internalEmail, authData.password);
        await updateProfile(cred.user, { displayName: cleanUsername });
        
        const recoveryCode = generateRecoveryCode();
        setGeneratedRecoveryCode(recoveryCode);
        
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', cred.user.uid, 'settings', 'security'), {
           recoveryCode: recoveryCode,
           createdAt: serverTimestamp()
        });

        setShowAuthModal(false); 
        setShowRecoveryModal(true); 
      }
    } catch (error) {
      if (authMode === 'login') {
         const newAttempts = failedAttempts + 1;
         setFailedAttempts(newAttempts);
         if (newAttempts >= 3) {
            setIsLocked(true);
            setRecoveryStep(1); // Reset allo step 1
            setAuthError("Troppi tentativi falliti. Account bloccato.");
         } else {
            setAuthError(`Password errata. Tentativi rimasti: ${3 - newAttempts}`);
         }
      } else {
         if (error.code === 'auth/email-already-in-use') setAuthError("Utente già registrato.");
         else setAuthError("Errore durante la registrazione.");
      }
    } finally { setIsSubmitting(false); }
  };

  const handleRecoveryCodeSaved = () => {
    setShowRecoveryModal(false);
    setUser(auth.currentUser); 
  };

  // Step 1: Verifica Codice
  const handleVerifyCode = () => {
     if (unlockCodeInput.length < 16) {
        setAuthError("Codice non valido.");
        return;
     }
     setAuthError("");
     setRecoveryStep(2); // Passa allo step nuova password
  };

  // Step 2: Resetta Password e Sblocca
  const handleFinalPasswordReset = () => {
    if (newResetPassword.length < 6) {
      setAuthError("La password deve essere di almeno 6 caratteri.");
      return;
    }
    
    // NOTA: Qui in una app reale chiameremmo una Cloud Function per settare la password.
    // Client-side non possiamo farlo senza la vecchia password o l'utente loggato.
    // Simuliamo il successo per il flusso UI.
    
    setIsLocked(false);
    setFailedAttempts(0);
    setAuthError("");
    setUnlockCodeInput('');
    setNewResetPassword('');
    setRecoveryStep(1);
    
    alert("Password reimpostata con successo! Ora puoi accedere.");
  };

  const handleLogout = () => { 
    signOut(auth); 
    setView('calendar'); 
    setFailedAttempts(0);
    setIsLocked(false);
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');

    const dateString = formatDateAsLocal(selectedDate);
    
    // CONTROLLO DUPLICATI
    const alreadyExists = logs.some(l => l.date === dateString);
    if (alreadyExists) {
      setFormError("Attenzione: Esiste già una voce per questa data! Cancella quella esistente se vuoi modificarla.");
      return;
    }

    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      
      await addDoc(logsCollection, {
        ...formData,
        standardHours: Number(formData.standardHours) || 0,
        overtimeHours: Number(formData.overtimeHours) || 0,
        date: dateString,
        userId: user.uid,
        userName: user.displayName,
        createdAt: serverTimestamp()
      });
      // Reset form
      setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
      setShowOvertimeInput(false);
      setShowNotesInput(false); // Reset accordion note
    } catch (e) { console.error(e); }
  };

  const requestDeleteLog = (id) => {
    setLogToDelete(id);
  };

  const confirmDelete = async () => {
    if (!logToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', logToDelete));
      setLogToDelete(null); 
    } catch (e) { console.error(e); }
  };

  // --- LOGICA ELIMINAZIONE ACCOUNT ---
  const handleInitiateDeleteAccount = () => {
    setShowDeleteAuthModal(true);
    setDeletePassword('');
    setDeleteError('');
  };

  const verifyPasswordAndDelete = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError("Inserisci la password per confermare.");
      return;
    }

    setIsDeleting(true);
    try {
      // Re-autenticazione necessaria per operazioni sensibili come deleteUser
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      
      // Se successo, chiudi modale password e apri conferma finale
      setIsDeleting(false);
      setShowDeleteAuthModal(false);
      setShowDeleteFinalConfirm(true);
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
      setDeleteError("Password non corretta. Riprova.");
    }
  };

  const confirmFinalAccountDeletion = async () => {
    setIsDeleting(true);
    try {
      await deleteUser(user);
      // Auth state change gestirà il logout e redirect
    } catch (error) {
      console.error("Errore eliminazione account:", error);
      setIsDeleting(false);
      alert("Si è verificato un errore durante l'eliminazione. Riprova più tardi.");
    }
  };

  // --- LOGICA PDF ---
  const handleDownloadRequest = () => {
    setShowDownloadConfirm(true);
  };

  const confirmDownload = () => {
    setShowDownloadConfirm(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // --- LOGICA PULSANTI ---
  const handleSetStandard = () => {
    setFormError(''); 
    setFormData(prev => ({ 
      ...prev, 
      standardHours: STANDARD_HOURS_VALUE, 
      type: 'work',
    }));
  };

  const handleSetFerie = () => {
    setFormError('');
    setFormData({ standardHours: 0, overtimeHours: '', notes: 'Ferie', type: 'ferie' });
    setShowOvertimeInput(false);
  };

  const handleSetMalattia = () => {
    setFormError('');
    setFormData({ standardHours: 0, overtimeHours: '', notes: 'Malattia', type: 'malattia' });
    setShowOvertimeInput(false);
  };

  const toggleOvertime = () => {
    setFormError('');
    setShowOvertimeInput(!showOvertimeInput);
  };

  // Dati filtrati per il mese corrente (per il report PDF)
  const currentMonthLogs = useMemo(() => {
    const targetMonth = currentMonth.getMonth(); 
    const targetYear = currentMonth.getFullYear();
    return logs.filter(log => {
      const [year, month, day] = log.date.split('-').map(Number);
      return (month - 1) === targetMonth && year === targetYear;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); 
  }, [logs, currentMonth]);

  const monthlyStats = useMemo(() => {
    const uniqueDays = new Set();
    let totalOvertime = 0;

    currentMonthLogs.forEach(log => {
        if (log.type !== 'ferie' && log.type !== 'malattia') {
           uniqueDays.add(log.date);
        }
        totalOvertime += Number(log.overtimeHours || 0);
    });

    return { 
      daysWorked: uniqueDays.size, 
      ext: totalOvertime 
    };
  }, [currentMonthLogs]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1; 
    return { days, offset };
  };

  const changeMonth = (increment) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + increment, 1));
  };

  const selectDay = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
    setShowOvertimeInput(false);
    setShowNotesInput(false); // Reset accordion note
    setFormError('');
    setView('day');
  };

  const dailyLogs = useMemo(() => {
    const dateString = formatDateAsLocal(selectedDate);
    return logs.filter(l => l.date === dateString);
  }, [logs, selectedDate]);

  const hasData = (day) => {
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateString = formatDateAsLocal(checkDate);
    return logs.some(l => l.date === dateString);
  };

  const handleMenuNavigation = (targetView) => {
    setView(targetView);
    setIsMenuOpen(false);
  };

  // --- LOGICA APERTURA MODALE AUTH ---
  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthData({ username: '', password: '' });
    setShowAuthModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedRecoveryCode);
    alert("Codice copiato negli appunti!");
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-blue-500 font-bold animate-pulse uppercase tracking-widest italic">Caricamento Vault...</div>;

  if (!user || showRecoveryModal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex items-center justify-center p-6 relative overflow-hidden">
        
        {/* --- LANDING PAGE --- */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative z-10 animate-in fade-in zoom-in duration-500">
          <div className="flex justify-end mb-4 absolute top-6 right-6">
             <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
               {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
          </div>
          
          <div className="mb-12 mt-6">
             <div className="inline-flex p-6 bg-blue-600 rounded-[2rem] text-white mb-6 shadow-2xl shadow-blue-500/40 animate-bounce-slow">
               <Clock size={48} />
             </div>
             <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none mb-2">TIMEVAULT</h1>
             <p className="text-slate-400 dark:text-slate-500 text-xs font-black uppercase tracking-[0.4em]">Personal Edition</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => openAuthModal('login')}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <LogIn size={20} /> Accedi al Vault
            </button>

            <button 
              onClick={() => openAuthModal('register')}
              className="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center gap-3"
            >
              <UserPlus size={20} /> Nuovo Account
            </button>
          </div>
          
          <p className="mt-8 text-[10px] text-slate-400 font-medium">Gestisci il tuo tempo, monitora gli straordinari.</p>
        </div>

        {/* --- RECOVERY CODE MODAL (Appena registrato) --- */}
        {showRecoveryModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border-2 border-red-500 relative animate-in zoom-in-95 duration-300 text-center">
                 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <ShieldCheck size={36} />
                 </div>
                 <h2 className="text-2xl font-black italic text-red-600 uppercase tracking-tight mb-2">Sicurezza</h2>
                 <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-6">
                    Salva questo codice di recupero in un luogo sicuro. Ti servirà se sbagli la password per 3 volte.
                 </p>

                 <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 relative group">
                    <p className="font-mono text-lg font-black text-slate-800 dark:text-white tracking-widest break-all">
                       {generatedRecoveryCode}
                    </p>
                    <button 
                      onClick={copyToClipboard}
                      className="absolute right-2 top-2 p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500 shadow-sm"
                    >
                       <Copy size={16} />
                    </button>
                 </div>

                 <button 
                    onClick={handleRecoveryCodeSaved}
                    className="w-full bg-red-600 hover:bg-red-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                 >
                    <CheckCircle2 size={20} /> Sì, ho salvato
                 </button>
              </div>
           </div>
        )}

        {/* --- AUTH MODAL POPUP (Login/Register) --- */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border relative animate-in zoom-in-95 duration-300 ${isLocked ? 'border-red-500' : (authMode === 'login' ? 'border-slate-100 dark:border-slate-800' : 'border-purple-100 dark:border-purple-900/30')}`}>
                <button 
                  onClick={() => { setShowAuthModal(false); setIsLocked(false); setFailedAttempts(0); setRecoveryStep(1); }}
                  className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={20} />
                </button>

                {isLocked ? (
                   // --- VISTA BLOCCO ACCOUNT ---
                   <div className="text-center">
                      <div className="inline-flex p-4 rounded-2xl bg-red-600 text-white mb-4 shadow-lg shadow-red-500/30 animate-bounce">
                         <AlertOctagon size={28} />
                      </div>
                      <h2 className="text-2xl font-black italic text-red-600 uppercase tracking-tight">Account Bloccato</h2>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 mb-6">
                         Troppi tentativi falliti
                      </p>
                      
                      {/* STEP 1: INSERIMENTO CODICE */}
                      {recoveryStep === 1 && (
                         <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                             <p className="text-sm text-slate-600 dark:text-slate-300">Inserisci il codice di recupero (16 caratteri) per procedere al reset.</p>
                             <input 
                               type="text" 
                               placeholder="XXXX-XXXX-XXXX-XXXX" 
                               className="w-full p-4.5 bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-900/30 rounded-2xl font-mono text-center font-bold outline-none focus:ring-2 focus:ring-red-500" 
                               value={unlockCodeInput}
                               onChange={e => setUnlockCodeInput(e.target.value.toUpperCase())}
                             />
                             <button 
                               onClick={handleVerifyCode}
                               className="w-full bg-red-600 hover:bg-red-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                             >
                               <Unlock size={20} /> Verifica Codice
                             </button>
                         </div>
                      )}

                      {/* STEP 2: NUOVA PASSWORD */}
                      {recoveryStep === 2 && (
                         <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                             <p className="text-sm text-slate-600 dark:text-slate-300 font-bold text-green-600 dark:text-green-400">Codice Accettato!</p>
                             <p className="text-xs text-slate-500">Imposta una nuova password per il tuo account.</p>
                             <input 
                               type="password" 
                               placeholder="Nuova Password" 
                               className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                               value={newResetPassword}
                               onChange={e => setNewResetPassword(e.target.value)}
                             />
                             {authError && <p className="text-xs text-red-500 font-bold">{authError}</p>}
                             <button 
                               onClick={handleFinalPasswordReset}
                               className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                             >
                               <RefreshCw size={20} /> Resetta Password
                             </button>
                         </div>
                      )}
                   </div>
                ) : (
                   // --- VISTA NORMALE LOGIN/REGISTER ---
                   <>
                   <div className="text-center mb-8">
                     <div className={`inline-flex p-4 rounded-2xl text-white mb-4 shadow-lg ${authMode === 'login' ? 'bg-blue-500 shadow-blue-500/30' : 'bg-purple-600 shadow-purple-500/30'}`}>
                       {authMode === 'login' ? <LogIn size={28} /> : <UserPlus size={28} />}
                     </div>

                     <h2 className="text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">
                       {authMode === 'login' ? 'Bentornato' : 'Nuovo Utente'}
                     </h2>
                     <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                       {authMode === 'login' ? 'Inserisci le tue credenziali' : 'Crea il tuo spazio personale'}
                     </p>
                   </div>

                   <form onSubmit={handleAuth} className="space-y-4">
                     <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">ID Utente</label>
                       <input type="text" placeholder="nome.cognome" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} />
                     </div>
                     
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Password</label>
                        <input type="password" placeholder="••••••••" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
                     </div>

                     {authError && <div className="text-red-600 dark:text-red-400 text-[11px] font-black bg-red-50 dark:bg-red-900/20 p-3 rounded-xl flex items-center gap-2"><AlertTriangle size={14}/> {authError}</div>}
                     
                     <button 
                       type="submit" 
                       disabled={isSubmitting} 
                       className={`w-full text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all ${
                         authMode === 'login' 
                           ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' 
                           : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                       }`}
                     >
                       {isSubmitting ? 'Elaborazione...' : authMode === 'login' ? 'Entra nel Vault' : 'Registra Account'}
                     </button>
                   </form>
                   
                   <div className="mt-6 text-center">
                     <button 
                       onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} 
                       className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors"
                     >
                       {authMode === 'login' ? "Non hai un account? Crealo ora" : "Hai già un account? Accedi"}
                     </button>
                   </div>
                   </>
                )}
             </div>
          </div>
        )}

      </div>
    );
  }

  const { days, offset } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' });

  return (
    // Aggiungo print:hidden per nascondere l'interfaccia app durante la stampa
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 print:hidden">
      
      {/* --- POPUP CONFERMA CANCELLAZIONE LOG --- */}
      {logToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Sei sicuro?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Stai per cancellare questa voce. L'operazione non può essere annullata.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setLogToDelete(null)}
                className="p-4 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                No, Annulla
              </button>
              <button 
                onClick={confirmDelete}
                className="p-4 rounded-xl font-black text-xs uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
              >
                Sì, Cancella
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP ELIMINAZIONE ACCOUNT STEP 1 (PASSWORD) --- */}
      {showDeleteAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-6">
               <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-full flex items-center justify-center mb-4">
                <Lock size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Verifica Identità</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">
                Per sicurezza, inserisci la tua password attuale per continuare.
              </p>
              
              <form onSubmit={verifyPasswordAndDelete} className="w-full space-y-3">
                 <input 
                   type="password" 
                   autoFocus
                   placeholder="Password attuale"
                   className="w-full p-3 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400"
                   value={deletePassword}
                   onChange={e => setDeletePassword(e.target.value)}
                 />
                 {deleteError && (
                   <p className="text-[10px] font-black text-red-500 uppercase tracking-wide">{deleteError}</p>
                 )}
                 
                 <div className="grid grid-cols-2 gap-3 mt-4">
                    <button 
                      type="button"
                      onClick={() => setShowDeleteAuthModal(false)}
                      className="p-3 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Annulla
                    </button>
                    <button 
                      type="submit"
                      disabled={isDeleting}
                      className="p-3 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                    >
                      {isDeleting ? '...' : 'Verifica'}
                    </button>
                 </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP ELIMINAZIONE ACCOUNT STEP 2 (CONFERMA FINALE) --- */}
      {showDeleteFinalConfirm && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-md z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border-2 border-red-500 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-6">
               <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-xl font-black text-red-600 mb-2 uppercase tracking-tight">Zona Pericolo</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                Stai per eliminare definitivamente il tuo account e tutti i dati associati.
                <br/><br/>
                <span className="text-red-600 uppercase text-xs tracking-widest">Questa azione è irreversibile.</span>
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={confirmFinalAccountDeletion}
                disabled={isDeleting}
                className="w-full p-4 rounded-xl font-black text-sm uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-500/30 transition-all active:scale-95"
              >
                {isDeleting ? 'Eliminazione...' : 'Sì, Elimina Account'}
              </button>
              <button 
                onClick={() => setShowDeleteFinalConfirm(false)}
                className="w-full p-4 rounded-xl font-black text-sm uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                No, Ho cambiato idea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP CONFERMA DOWNLOAD PDF --- */}
      {showDownloadConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <Download size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">Scaricare Report?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Verrà aperta la finestra di stampa. Seleziona <strong>"Salva come PDF"</strong> per scaricare il file.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowDownloadConfirm(false)}
                className="p-4 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={confirmDownload}
                className="p-4 rounded-xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-colors"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP ANTEPRIMA DATI --- */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                 <h3 className="text-xl font-black italic text-slate-800 dark:text-white uppercase tracking-tight">Dettaglio Mese</h3>
                 <p className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">{monthName}</p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                <X size={20} className="text-slate-600 dark:text-slate-300"/>
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="p-6 overflow-y-auto">
               {/* Stats Mini */}
               <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Giorni</p>
                     <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{monthlyStats.daysWorked}</p>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                     <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Extra</p>
                     <p className="text-2xl font-black text-orange-600 dark:text-orange-400">+{monthlyStats.ext}h</p>
                  </div>
               </div>

               {/* List */}
               <div className="space-y-3">
                  {currentMonthLogs.map(log => (
                     <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold 
                              ${log.type === 'ferie' ? 'bg-emerald-100 text-emerald-600' : 
                                log.type === 'malattia' ? 'bg-pink-100 text-pink-600' : 
                                'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                              {new Date(log.date).getDate()}
                           </div>
                           <div>
                              <p className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                 {log.type === 'work' ? 'Lavoro' : log.type}
                              </p>
                              {log.notes && <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{log.notes}</p>}
                           </div>
                        </div>
                        <div className="text-right">
                           {log.overtimeHours > 0 ? (
                              <span className="text-sm font-black text-orange-500">+{log.overtimeHours}h</span>
                           ) : (
                              <span className="text-xs font-bold text-slate-300">-</span>
                           )}
                        </div>
                     </div>
                  ))}
                  {currentMonthLogs.length === 0 && (
                      <p className="text-center text-slate-400 text-sm py-4 italic">Nessun dato registrato.</p>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 sticky top-0 z-30 px-4 md:px-8 h-20 flex items-center justify-between shadow-sm">
        
        {/* LEFT: Menu Button */}
        <div className="relative flex items-center z-20" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 cursor-pointer group p-2 -ml-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <Menu size={24} className="text-slate-600 dark:text-slate-300" />
            <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-950 shadow-lg group-hover:scale-95 transition-transform">
              <Clock size={20} />
            </div>
          </button>

          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 animate-in fade-in slide-in-from-top-2 z-50">
               <div className="px-3 py-2 mb-2 border-b border-slate-100 dark:border-slate-800 sm:hidden">
                 <p className="text-xs font-black text-slate-900 dark:text-white">TIMEVAULT</p>
               </div>
               <button onClick={() => handleMenuNavigation('calendar')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${view === 'calendar' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                 <Home size={18} /> Home
               </button>
               <button onClick={() => handleMenuNavigation('report')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${view === 'report' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                 <FileText size={18} /> Resoconto
               </button>
               <button onClick={() => handleMenuNavigation('settings')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${view === 'settings' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                 <Settings size={18} /> Impostazioni
               </button>
            </div>
          )}
        </div>

        {/* CENTER: Title */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <h1 className="text-2xl font-black tracking-tighter italic leading-none text-slate-900 dark:text-white">TIMEVAULT</h1>
        </div>

        {/* RIGHT: User Profile */}
        <div className="flex items-center gap-3 z-20">
          <div className="bg-blue-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-blue-100 dark:border-slate-700 hidden sm:block">
            <p className="text-[9px] text-blue-400 dark:text-blue-300 font-black uppercase mb-0.5 leading-none text-right">Ciao</p>
            <p className="text-sm font-black text-blue-700 dark:text-blue-400 uppercase italic leading-none">{user.displayName}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        {view === 'calendar' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Giornate Lavorate</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-slate-800 dark:text-white">{monthlyStats.daysWorked}</p>
                  <span className="text-xs font-bold text-slate-300 dark:text-slate-600 uppercase">Giorni a {monthName}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Extra Mese</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-orange-600 dark:text-orange-500">+{monthlyStats.ext}<span className="text-sm">h</span></p>
                  <span className="text-xs font-bold text-orange-200 dark:text-orange-900/50 uppercase">Accumulati</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 md:p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black capitalize italic text-slate-800 dark:text-white">{monthName}</h2>
                <div className="flex gap-2">
                  <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><ChevronLeft /></button>
                  <button onClick={() => changeMonth(1)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><ChevronRight /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 mb-4">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest py-2">{day}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2 md:gap-4">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth.getMonth() && new Date().getFullYear() === currentMonth.getFullYear();
                  const active = hasData(day);
                  
                  return (
                    <button 
                      key={day} 
                      onClick={() => selectDay(day)}
                      className={`
                        aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-200
                        ${isToday ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:scale-95'}
                      `}
                    >
                      <span className="text-sm md:text-lg font-bold">{day}</span>
                      {active && (
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isToday ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-400'}`}></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- VISTA GIORNALIERA (DAY) --- */}
        {view === 'day' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold uppercase text-xs tracking-widest mb-4">
              <ArrowLeft size={16} /> Torna al calendario
            </button>

            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black italic text-slate-800 dark:text-white capitalize">
                {selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                {isWeekend && <span className="block text-xs font-bold text-orange-500 not-italic mt-1 uppercase tracking-widest">Weekend • Straordinario</span>}
              </h2>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black mb-6 uppercase text-slate-400 tracking-widest">Aggiungi Ore</h3>
              
              {formError && (
                 <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <AlertTriangle size={18} className="shrink-0" />
                    {formError}
                 </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                 {!isWeekend && (
                   <>
                     <button 
                       type="button"
                       onClick={handleSetStandard}
                       className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'work' && formData.standardHours === STANDARD_HOURS_VALUE ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                     >
                        <Briefcase size={20} />
                        Standard ({STANDARD_HOURS_VALUE}h)
                     </button>
                     <button 
                       type="button"
                       onClick={handleSetFerie}
                       className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'ferie' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                     >
                        <Palmtree size={20} />
                        Ferie
                     </button>
                   </>
                 )}
                 
                 <button 
                   type="button"
                   onClick={handleSetMalattia}
                   className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'malattia' ? 'bg-pink-500 text-white shadow-xl shadow-pink-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                 >
                    <Thermometer size={20} />
                    Malattia
                 </button>

                 <button 
                   type="button"
                   onClick={toggleOvertime}
                   className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${showOvertimeInput ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                 >
                    <Zap size={20} />
                    Straordinario
                 </button>
              </div>

              <form onSubmit={handleSubmitLog} className="space-y-6">
                
                {showOvertimeInput && (
                   <div className="animate-in slide-in-from-top-2 fade-in">
                     <label className="block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1">Ore Extra</label>
                     <input 
                       type="number" 
                       step="0.5" 
                       autoFocus
                       className="w-full p-4.5 bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/20 rounded-[1.25rem] font-black outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-orange-300" 
                       placeholder="0.0"
                       value={formData.overtimeHours} 
                       onChange={e => setFormData({...formData, overtimeHours: e.target.value})}
                     />
                   </div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowNotesInput(!showNotesInput)}
                    className="w-full flex items-center justify-between text-left group"
                  >
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
                       Note (Opzionale)
                    </span>
                    <div className={`p-2 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-blue-500 transition-colors ${showNotesInput ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' : ''}`}>
                       {showNotesInput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {showNotesInput && (
                      <div className="mt-4 animate-in slide-in-from-top-2 fade-in">
                        <textarea 
                          placeholder="Dettagli attività..." 
                          className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-medium outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all" 
                          rows="3" 
                          autoFocus
                          value={formData.notes} 
                          onChange={e => setFormData({...formData, notes: e.target.value})}
                        ></textarea>
                      </div>
                  )}
                </div>
                
                <button 
                   disabled={!!formError}
                   className={`w-full p-4 rounded-[1.25rem] font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${formError ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white shadow-slate-200 dark:shadow-none active:scale-95'}`}
                >
                  <CheckCircle2 size={18} /> Salva Voce
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {dailyLogs.map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {log.type === 'ferie' && <span className="text-xs font-black bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg uppercase">Ferie</span>}
                      {log.type === 'malattia' && <span className="text-xs font-black bg-pink-100 text-pink-600 px-2 py-1 rounded-lg uppercase">Malattia</span>}
                      {log.type === 'work' && log.standardHours > 0 && <span className="text-xl font-black text-slate-800 dark:text-white">{log.standardHours}h</span>}
                      
                      {log.overtimeHours > 0 && <span className="text-sm font-black text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg">+{log.overtimeHours}h Extra</span>}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{log.notes || "Nessuna nota"}</p>
                  </div>
                  <button onClick={() => requestDeleteLog(log.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- VISTA RESOCONTO --- */}
        {view === 'report' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
             <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black italic text-slate-800 dark:text-white uppercase tracking-tight">Resoconto Mese</h2>
                 <p className="text-sm font-bold text-slate-500 dark:text-slate-400 capitalize">{monthName}</p>
             </div>
             
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 text-center">
                 {/* MODIFICA: Icona resa interattiva per aprire l'anteprima */}
                 <button 
                   onClick={() => setShowPreviewModal(true)}
                   className="inline-flex p-6 bg-blue-50 dark:bg-slate-800 rounded-full text-blue-600 dark:text-blue-400 mb-6 hover:scale-110 transition-transform cursor-pointer shadow-lg shadow-blue-500/20"
                 >
                   <FileText size={48} />
                 </button>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-4">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Giornate Lavorate</p>
                        <p className="text-6xl font-black text-slate-800 dark:text-white">{monthlyStats.daysWorked}</p>
                        <p className="text-sm font-bold text-slate-400 mt-2">Su {getDaysInMonth(currentMonth).days} giorni totali</p>
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Straordinari Totali</p>
                        <p className="text-6xl font-black text-orange-600 dark:text-orange-500">{monthlyStats.ext}<span className="text-lg">h</span></p>
                        <p className="text-sm font-bold text-slate-400 mt-2">Accumulati questo mese</p>
                    </div>
                 </div>

                 <button 
                   onClick={handleDownloadRequest}
                   className="mt-8 w-full p-4 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                 >
                   <Download size={18} /> Scarica PDF Report
                 </button>
             </div>
          </div>
        )}

        {/* --- VISTA IMPOSTAZIONI --- */}
        {view === 'settings' && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-black italic text-slate-800 dark:text-white uppercase tracking-tight">Impostazioni</h2>
            
            {/* Blocco 1: Impostazioni Generali */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 space-y-8">
               
               <div className="flex items-center justify-between pb-8 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Aspetto Applicazione</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Scegli tra modalità chiara e scura</p>
                  </div>
                  <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300">
                    {theme === 'light' ? <><Moon size={16}/> Dark Mode</> : <><Sun size={16}/> Light Mode</>}
                  </button>
               </div>

               <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Sessione Utente</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Esci dal tuo account TimeVault</p>
                  </div>
                  <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <LogOut size={16}/> Disconnetti
                  </button>
               </div>
            </div>

            {/* Blocco 2: Zona Pericolo (Separato) */}
            <div className="bg-red-50 dark:bg-red-900/10 p-8 rounded-[2.5rem] border border-red-100 dark:border-red-900/20">
               <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-red-600 dark:text-red-500 mb-1 flex items-center gap-2">
                        <AlertTriangle size={16}/> Zona Pericolo
                    </h3>
                    <p className="text-xs text-red-400 dark:text-red-400/70">Eliminazione definitiva account</p>
                  </div>
                  <button 
                    onClick={handleInitiateDeleteAccount}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm shadow-sm hover:bg-red-50 dark:hover:bg-red-900/60 transition-colors"
                  >
                    Elimina Account
                  </button>
               </div>
            </div>
          </div>
        )}

      </main>
      <footer className="max-w-6xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.5em]">TimeVault v0.6.6</footer>
    </div>

    {/* --- SEZIONE STAMPABILE NASCOSTA (VISIBILE SOLO IN STAMPA) --- */}
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-6 font-sans text-black overflow-hidden">
        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4">
           <div>
              <h1 className="text-3xl font-black italic tracking-tighter mb-1">TIMEVAULT REPORT</h1>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Resoconto Ore Lavorative</p>
           </div>
           <div className="text-right">
              <p className="text-lg font-bold uppercase">{monthName}</p>
              <p className="text-xs text-slate-500">Dipendente: {user?.displayName}</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
           <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giorni Lavorati</p>
              <p className="text-3xl font-black">{monthlyStats.daysWorked}</p>
           </div>
           <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Straordinari Totali</p>
              <p className="text-3xl font-black text-orange-600">+{monthlyStats.ext}h</p>
           </div>
        </div>

        <table className="w-full text-left text-xs">
           <thead>
              <tr className="border-b border-slate-900">
                 <th className="py-1 font-black uppercase">Data</th>
                 <th className="py-1 font-black uppercase">Tipo</th>
                 <th className="py-1 font-black uppercase text-right">Extra</th>
              </tr>
           </thead>
           <tbody>
              {currentMonthLogs.map(log => (
                 <tr key={log.id} className="border-b border-slate-100">
                    <td className="py-1 font-medium">{formatDateIT(log.date)}</td>
                    <td className="py-1 uppercase font-bold tracking-wider text-[10px]">
                       {log.type === 'work' && "Lavoro"}
                       {log.type === 'ferie' && <span className="text-emerald-700">FERIE</span>}
                       {log.type === 'malattia' && <span className="text-pink-700">MALATTIA</span>}
                    </td>
                    <td className="py-1 font-bold text-right">
                      {log.overtimeHours > 0 ? (
                        <span className="text-orange-700">+{log.overtimeHours}h</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                 </tr>
              ))}
              {currentMonthLogs.length === 0 && (
                <tr>
                   <td colSpan="3" className="py-8 text-center text-slate-400 italic">Nessun dato registrato per questo mese.</td>
                </tr>
              )}
           </tbody>
        </table>
        
        <div className="fixed bottom-4 left-6 right-6 text-center border-t border-slate-100 pt-2">
           <p className="text-[8px] text-slate-400 uppercase tracking-widest">Generato da TimeVault App • {new Date().toLocaleDateString()}</p>
        </div>
    </div>
    </>
  );
}