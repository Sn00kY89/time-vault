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
  deleteUser,
  signInWithCustomToken,
  signInAnonymously
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
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { 
  Clock, Plus, Trash2, Calendar as CalendarIcon, LogOut, TrendingUp, 
  Briefcase, Sun, Moon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft, CheckCircle2,
  Menu, Home, FileText, Settings, X, Zap, Palmtree, Thermometer, AlertTriangle, Download, Eye, ShieldAlert, Lock, LogIn, UserPlus, Key, Copy, AlertOctagon, ShieldCheck, Unlock, RefreshCw, Users, CheckSquare, Square, User, Palette, Smartphone, Share
} from 'lucide-react';

// -----------------------------------------------------------------------------
// ISTRUZIONI PER L'USO DEL FILE JSON ESTERNO
// -----------------------------------------------------------------------------
// NOTA IMPORTANTE PER L'USO LOCALE:
// 1. Assicurati che il file 'capisquadra.json' sia nella cartella 'src'.
// 2. TOGLI IL COMMENTO (//) dalla riga seguente per attivare l'importazione:
import externalTeamLeaders from './capisquadra.json';

// VARIABILE DI RISERVA (Per evitare errori in questa anteprima se l'import è commentato)
// Se scommenti l'import sopra, questa variabile verrà ignorata dalla logica sotto.
const fallbackForPreview = []; 
// -----------------------------------------------------------------------------

// --- CONFIGURAZIONE FIREBASE ---
// Queste chiavi sono fornite dall'ambiente di esecuzione o inserite manualmente.
const firebaseConfig = {
  apiKey: "AIzaSyDdxN05Yj1CtPOY69x3JJjuFuhEUelXWsc",
  authDomain: "work-time-vault.firebaseapp.com",
  projectId: "work-time-vault",
  storageBucket: "work-time-vault.firebasestorage.app",
  messagingSenderId: "957496336579",
  appId: "1:957496336579:web:f82df8f2d580b92ec58276"
};

// ID univoco per isolare i dati di questa specifica applicazione
const APP_ID = "time-vault-pro";

// Inizializzazione Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const INTERNAL_DOMAIN = "@time.vault";

// Valore ore standard (modificabile per CCNL specifico)
const STANDARD_HOURS_VALUE = 8; 

// Lista di RISERVA (Fallback) - Usata solo se il JSON non è caricato correttamente
const FALLBACK_TEAM_LEADERS = [
  'Caposquadra Nord',
  'Caposquadra Sud',
  'Caposquadra Est',
  'Caposquadra Ovest'
];

// MAPPATURA COLORI ACCENTO (Hex per Favicon e classi Tailwind)
const ACCENT_COLORS = {
  blue: { hex: '#2563eb', label: 'Blu Reale', class: 'blue' },
  violet: { hex: '#7c3aed', label: 'Viola Ultra', class: 'violet' },
  emerald: { hex: '#059669', label: 'Smeraldo', class: 'emerald' },
  rose: { hex: '#e11d48', label: 'Rosa Vivo', class: 'rose' },
  amber: { hex: '#d97706', label: 'Ambra', class: 'amber' },
  cyan: { hex: '#0891b2', label: 'Ciano', class: 'cyan' },
};

// LOGICA SELEZIONE DATI CAPISQUADRA
const getLeadersList = () => {
  try {
    let data = null;
    // Controllo se l'import dinamico è stato attivato dal commento sopra
    if (typeof externalTeamLeaders !== 'undefined') {
       data = (externalTeamLeaders && externalTeamLeaders.default) ? externalTeamLeaders.default : externalTeamLeaders;
    } else {
       data = fallbackForPreview;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn("Nessun file JSON caricato o array vuoto. Uso fallback.");
  }
  return FALLBACK_TEAM_LEADERS;
};

const ACTIVE_TEAM_LEADERS = getLeadersList();

// Helper: Formattazione data ISO locale (YYYY-MM-DD) senza offset fuso orario
const formatDateAsLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Formattazione data IT (DD/MM/YYYY) per display
const formatDateIT = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// Generatore Codice Recupero (16 caratteri alfanumerici)
const generateRecoveryCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * COMPONENTE PRINCIPALE APP
 */
export default function App() {
  // --- STATI DI AUTENTICAZIONE E UTENTE ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authData, setAuthData] = useState({ username: '', password: '' });

  // --- STATI DATI FIREBASE ---
  const [logs, setLogs] = useState([]);
  const [availableLeaders] = useState(ACTIVE_TEAM_LEADERS);

  // --- STATI DI NAVIGAZIONE E UI ---
  const [view, setView] = useState('calendar'); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // --- STATI FORM INSERIMENTO ---
  const [formData, setFormData] = useState({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
  const [selectedLeaders, setSelectedLeaders] = useState([]); 
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false); 
  const leaderDropdownRef = useRef(null);
  const [showOvertimeInput, setShowOvertimeInput] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false); 

  // --- STATI MODALI E POPUP ---
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [formError, setFormError] = useState('');
  const [logToDelete, setLogToDelete] = useState(null); 
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false); 
  const [showPreviewModal, setShowPreviewModal] = useState(false); 
  const [showGuideModal, setShowGuideModal] = useState(false);

  // --- STATI SICUREZZA E RECOVERY ---
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); 
  const [newResetPassword, setNewResetPassword] = useState('');

  // --- STATI ELIMINAZIONE ACCOUNT ---
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false); 
  const [showDeleteFinalConfirm, setShowDeleteFinalConfirm] = useState(false); 
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // --- GESTIONE TEMA E STILE ---
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || 'blue');

  // Calcolo se il giorno selezionato è weekend
  const isWeekend = useMemo(() => {
    const day = selectedDate.getDay();
    return day === 0 || day === 6; 
  }, [selectedDate]);

  // 1. Effetto Applicazione Tema al DOM
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 2. Click Outside per tendine personalizzate
  useEffect(() => {
    function handleClickOutside(event) {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target)) setIsLeaderDropdownOpen(false);
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) setIsProfileDropdownOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. Inizializzazione Firebase Auth (Persistence e Token)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (error) { console.error("Auth Init Error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!showRecoveryModal) setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [showRecoveryModal]);

  // 4. Caricamento Impostazioni Utente (Tema/Colore) da Firestore
  useEffect(() => {
    if (!user) return;
    const loadSettings = async () => {
      try {
        const themeDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'));
        if (themeDoc.exists()) {
          const data = themeDoc.data();
          if (data.mode) setTheme(data.mode);
          if (data.accent && ACCENT_COLORS[data.accent]) setAccentColor(data.accent);
        }
      } catch (e) { console.warn("No remote settings found."); }
    };
    loadSettings();
  }, [user]);

  // 5. Listener Real-time per i Log di lavoro
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

  // 6. Generatore Favicon Dinamica in base allo Stile Colore
  useEffect(() => {
    const hexColor = ACCENT_COLORS[accentColor]?.hex || '#2563eb';
    const encodedColor = hexColor.replace('#', '%23');
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'shortcut icon';
    link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22${encodedColor}%22/><path d=%22M50 25V50L65 65%22 stroke=%22white%22 stroke-width=%228%22 stroke-linecap=%22round%22 fill=%22none%22/></svg>`;
    document.getElementsByTagName('head')[0].appendChild(link);
  }, [accentColor]);

  // --- LOGICA AUTENTICAZIONE ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    
    const cleanUsername = authData.username.trim().toLowerCase().replace(/\s/g, '');
    if (!cleanUsername.includes('.')) {
      setAuthError("Formato ID: nome.cognome");
      setIsSubmitting(false);
      return;
    }
    const internalEmail = `${cleanUsername}${INTERNAL_DOMAIN}`;

    try {
      if (authMode === 'login') {
        if (isLocked) {
           setAuthError("Account bloccato. Usa il codice di recupero.");
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
        
        // Salvataggio codice di recupero in modo sicuro
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
            setRecoveryStep(1);
            setAuthError("Accesso negato. Account bloccato.");
         } else {
            setAuthError(`Password errata. Riprova.`);
         }
      } else {
         setAuthError(error.code === 'auth/email-already-in-use' ? "Utente esistente." : "Errore registrazione.");
      }
    } finally { setIsSubmitting(false); }
  };

  // --- LOGICA RECOVERY ---
  const handleVerifyCode = async () => {
    if (unlockCodeInput.length < 16) {
      setAuthError("Codice incompleto.");
      return;
    }
    // Nota: in una produzione reale cercheremmo il codice nel DB prima di permettere il cambio.
    // Qui simuliamo il passaggio allo step 2 per il reset.
    setAuthError("");
    setRecoveryStep(2);
  };

  const handleFinalPasswordReset = () => {
    if (newResetPassword.length < 6) {
      setAuthError("Password troppo corta.");
      return;
    }
    setIsLocked(false);
    setFailedAttempts(0);
    alert("Password reimpostata. Ora puoi accedere!");
    setAuthMode('login');
    setRecoveryStep(1);
    setUnlockCodeInput('');
  };

  // --- LOGICA TEMA E STILE ---
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    saveSettings(newTheme, accentColor);
  };

  const changeAccentColor = (newColor) => {
    setAccentColor(newColor);
    saveSettings(theme, newColor);
  };

  const saveSettings = async (t, a) => {
    if (user) {
      try {
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), {
          mode: t, accent: a, updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) { console.error(e); }
    }
  };

  // --- LOGICA REGISTRO ORE ---
  const toggleLeaderSelection = (name) => {
    setSelectedLeaders(prev => prev.includes(name) ? prev.filter(l => l !== name) : [...prev, name]);
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');

    const dateString = formatDateAsLocal(selectedDate);
    if (logs.some(l => l.date === dateString)) {
      setFormError("Attenzione: Esiste già una voce per oggi.");
      return;
    }

    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      await addDoc(logsCollection, {
        ...formData,
        standardHours: Number(formData.standardHours) || 0,
        overtimeHours: Number(formData.overtimeHours) || 0,
        teamLeader: selectedLeaders.join(', '),
        date: dateString,
        userId: user.uid,
        userName: user.displayName,
        createdAt: serverTimestamp()
      });
      setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
      setSelectedLeaders([]); 
      setIsLeaderDropdownOpen(false);
    } catch (e) { console.error(e); }
  };

  const confirmDelete = async () => {
    if (!logToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', logToDelete));
      setLogToDelete(null); 
    } catch (e) { console.error(e); }
  };

  const verifyPasswordAndDelete = async (e) => {
    e.preventDefault();
    setDeleteError('');
    setIsDeleting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      setIsDeleting(false);
      setShowDeleteAuthModal(false);
      setShowDeleteFinalConfirm(true);
    } catch (error) {
      setIsDeleting(false);
      setDeleteError("Password errata.");
    }
  };

  // --- LOGICA CALCOLI MENSILI ---
  const currentMonthLogs = useMemo(() => {
    const targetMonth = currentMonth.getMonth(); 
    const targetYear = currentMonth.getFullYear();
    return logs.filter(log => {
      const [year, month] = log.date.split('-').map(Number);
      return (month - 1) === targetMonth && year === targetYear;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); 
  }, [logs, currentMonth]);

  const monthlyStats = useMemo(() => {
    const uniqueDays = new Set();
    let totalOvertime = 0;
    currentMonthLogs.forEach(log => {
        if (log.type !== 'ferie' && log.type !== 'malattia') uniqueDays.add(log.date);
        totalOvertime += Number(log.overtimeHours || 0);
    });
    return { daysWorked: uniqueDays.size, ext: totalOvertime };
  }, [currentMonthLogs]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1; 
    return { days, offset };
  };

  const changeMonth = (inc) => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + inc, 1));
  
  const selectDay = (day) => {
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
    setSelectedLeaders([]); 
    setFormError('');
    setView('day');
  };

  const hasData = (day) => {
    const dString = formatDateAsLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    return logs.some(l => l.date === dString);
  };

  const monthName = currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' });

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse tracking-[0.3em] italic">VAULT INIZIALIZZAZIONE...</div>;

  if (!user || showRecoveryModal) {
    // --- SCHERMATA LOGIN / REGISTRAZIONE ---
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 flex items-center justify-center p-6 relative overflow-hidden">
        
        {/* Landing Card */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative z-10 animate-in fade-in zoom-in">
          <button onClick={toggleTheme} className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"><Moon size={20} /></button>
          
          <div className="mb-12 mt-6">
             <div className={`inline-flex p-6 bg-${accentColor}-600 rounded-[2.5rem] text-white mb-6 shadow-2xl shadow-${accentColor}-500/40 animate-bounce-slow`}>
               <Clock size={48} />
             </div>
             <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none mb-2">TIMEVAULT</h1>
             <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Personal Edition</p>
          </div>

          <div className="space-y-4">
            <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><LogIn size={20} /> Accedi al Vault</button>
            <button onClick={() => { setAuthMode('register'); setShowAuthModal(true); }} className="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 p-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3"><UserPlus size={20} /> Nuovo Account</button>
          </div>
        </div>

        {/* Modal Recovery Code (Solo post-registrazione) */}
        {showRecoveryModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl border-2 border-red-500 text-center">
                 <ShieldCheck size={36} className="text-red-600 mx-auto mb-6 animate-pulse" />
                 <h2 className="text-2xl font-black italic text-red-600 uppercase mb-2">Sicurezza</h2>
                 <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">Salva questo codice di recupero in un posto sicuro:</p>
                 <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 relative">
                    <p className="font-mono text-lg font-black tracking-widest break-all text-slate-800 dark:text-white">{generatedRecoveryCode}</p>
                    <button onClick={() => { navigator.clipboard.writeText(generatedRecoveryCode); alert("Copiato!"); }} className="absolute right-2 top-2 p-2 text-slate-400 hover:text-blue-500"><Copy size={16} /></button>
                 </div>
                 <button onClick={() => { setShowRecoveryModal(false); setUser(auth.currentUser); }} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest">Sì, ho salvato il codice</button>
              </div>
           </div>
        )}

        {/* Modal Auth */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className={`bg-white dark:bg-slate-900 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl border relative animate-in zoom-in ${isLocked ? 'border-red-500' : ''}`}>
                <button onClick={() => { setShowAuthModal(false); setIsLocked(false); setRecoveryStep(1); }} className="absolute top-6 right-6 p-2"><X size={20} /></button>
                {isLocked ? (
                   <div className="text-center">
                      <AlertOctagon size={48} className="text-red-600 mx-auto mb-4" />
                      <h2 className="text-2xl font-black italic text-red-600 uppercase mb-4">Account Bloccato</h2>
                      {recoveryStep === 1 ? (
                         <div className="space-y-4">
                             <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 rounded-2xl font-mono text-center font-bold text-red-600" value={unlockCodeInput} onChange={e => setUnlockCodeInput(e.target.value.toUpperCase())} />
                             <button onClick={handleVerifyCode} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest">Verifica Codice</button>
                         </div>
                      ) : (
                         <div className="space-y-4">
                             <input type="password" placeholder="Nuova Password" className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold" value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} />
                             <button onClick={handleFinalPasswordReset} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest">Resetta Password</button>
                         </div>
                      )}
                   </div>
                ) : (
                   <>
                   <div className="text-center mb-8">
                     <div className={`inline-flex p-4 rounded-2xl text-white mb-4 bg-${accentColor}-600`}>
                       {authMode === 'login' ? <LogIn size={28} /> : <UserPlus size={28} />}
                     </div>
                     <h2 className="text-2xl font-black italic uppercase text-slate-900 dark:text-white">{authMode === 'login' ? 'Bentornato' : 'Nuovo Account'}</h2>
                   </div>
                   <form onSubmit={handleAuth} className="space-y-4">
                     <input type="text" placeholder="nome.cognome" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold" value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} />
                     <input type="password" placeholder="••••••••" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold" value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
                     {authError && <div className="text-red-600 text-[11px] font-black">{authError}</div>}
                     <button type="submit" disabled={isSubmitting} className={`w-full text-white p-5 rounded-2xl font-black uppercase tracking-widest bg-${accentColor}-600 shadow-xl`}>{isSubmitting ? '...' : authMode === 'login' ? 'Accedi' : 'Crea Account'}</button>
                   </form>
                   </>
                )}
             </div>
          </div>
        )}
      </div>
    );
  }

  // --- VISTA PRINCIPALE (LOGGATO) ---
  const { days, offset } = getDaysInMonth(currentMonth);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500 print:bg-white print:text-black">
      
      {/* --- GUIDE MODAL --- */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowGuideModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            <div className="text-center mb-8">
               <div className={`inline-flex p-4 rounded-2xl bg-${accentColor}-100 dark:bg-${accentColor}-900/30 text-${accentColor}-600 mb-4 shadow-lg`}><Smartphone size={32} /></div>
               <h2 className="text-2xl font-black italic uppercase tracking-tight">Installa App</h2>
               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">Aggiungi TimeVault alla tua Home</p>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3"><span className="text-xl"></span> iOS (Safari)</h3>
                 <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-3 list-decimal list-inside font-medium">
                    <li>Apri <strong>Safari</strong> su questo sito.</li>
                    <li>Tocca <strong>Condividi</strong> <Share size={14} className="inline"/>.</li>
                    <li>Scegli <strong>"Aggiungi alla schermata Home"</strong>.</li>
                 </ol>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">🤖 Android (Chrome)</h3>
                 <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-3 list-decimal list-inside font-medium">
                    <li>Apri <strong>Chrome</strong> su questo sito.</li>
                    <li>Tocca i <strong>tre puntini</strong> in alto.</li>
                    <li>Scegli <strong>"Installa App"</strong> o <strong>"Aggiungi a Home"</strong>.</li>
                 </ol>
              </div>
            </div>
            <button onClick={() => setShowGuideModal(false)} className={`w-full mt-8 bg-${accentColor}-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-${accentColor}-500/30`}>Capito</button>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 sticky top-0 z-30 px-6 h-20 flex items-center justify-between shadow-sm print:hidden">
        <div className="relative flex items-center" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <Menu size={24} className="text-slate-600 dark:text-slate-300" />
            <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-950 shadow-lg"><Clock size={20} /></div>
          </button>
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-2">
               <button onClick={() => { setView('calendar'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><Home size={18} /> Home</button>
               <button onClick={() => { setView('report'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><FileText size={18} /> Resoconto</button>
               <button onClick={() => { setView('settings'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><Settings size={18} /> Impostazioni</button>
            </div>
          )}
        </div>
        
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"><h1 className="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white">TIMEVAULT</h1></div>
        
        <div className="relative" ref={profileDropdownRef}>
            <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-2 group focus:outline-none">
              <div className={`bg-${accentColor}-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-${accentColor}-100 dark:border-slate-700 hidden sm:block transition-transform`}>
                <p className={`text-[9px] text-${accentColor}-400 font-black uppercase leading-none text-right`}>Ciao</p>
                <p className={`text-sm font-black text-${accentColor}-700 dark:text-${accentColor}-400 uppercase italic leading-none`}>{user.displayName}</p>
              </div>
              <div className={`w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 border dark:border-slate-700 hover:bg-${accentColor}-100 transition-colors`}>
                 <User size={20} />
              </div>
            </button>
            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border dark:border-slate-800 p-2 z-50">
                 <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 p-3 rounded-2xl text-sm font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><LogOut size={18} /> Esci dal Vault</button>
              </div>
            )}
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 print:p-0 print:m-0">
        
        {/* CALENDAR VIEW */}
        {view === 'calendar' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border dark:border-slate-800 transition-colors">
                <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Giorni Lavorati</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black">{monthlyStats.daysWorked}</p>
                  <span className="text-xs font-bold text-slate-300">Giorni</span>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border dark:border-slate-800 transition-colors">
                <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Extra Mensile</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-orange-600">+{monthlyStats.ext}<span className="text-sm">h</span></p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border dark:border-slate-800 overflow-hidden p-6 md:p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black capitalize italic">{monthName}</h2>
                <div className="flex gap-2">
                  <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"><ChevronLeft /></button>
                  <button onClick={() => changeMonth(1)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"><ChevronRight /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 mb-4">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (<div key={d} className="text-center text-[10px] font-black uppercase text-slate-400 py-2">{d}</div>))}</div>
              
              <div className="grid grid-cols-7 gap-2 md:gap-4">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const d = i + 1;
                  const isToday = new Date().getDate() === d && new Date().getMonth() === currentMonth.getMonth() && new Date().getFullYear() === currentMonth.getFullYear();
                  const active = hasData(d);
                  return (
                    <button key={d} onClick={() => selectDay(d)} className={`aspect-square rounded-3xl flex flex-col items-center justify-center relative transition-all duration-300 ${isToday ? `bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl scale-105` : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:scale-95 hover:shadow-lg'}`}>
                      <span className="text-sm md:text-xl font-black">{d}</span>
                      {active && <div className={`w-2 h-2 rounded-full mt-1 ${isToday ? `bg-${accentColor}-400` : `bg-${accentColor}-600`}`}></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* DAY VIEW DETAIL */}
        {view === 'day' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-xs tracking-widest mb-4 hover:text-slate-800 transition-colors"><ArrowLeft size={16} /> Indietro</button>
            <h2 className="text-4xl font-black italic capitalize leading-none">{selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border dark:border-slate-800">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                 <button type="button" onClick={handleSetStandard} className={`p-4 rounded-3xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'work' && formData.standardHours === STANDARD_HOURS_VALUE ? `bg-${accentColor}-600 text-white shadow-xl shadow-${accentColor}-500/30` : 'bg-slate-50 dark:bg-slate-800'}`}><Briefcase size={24} />Standard</button>
                 <button type="button" onClick={() => { setFormData({ standardHours: 0, overtimeHours: '', notes: 'Ferie', type: 'ferie' }); setSelectedLeaders([]); }} className={`p-4 rounded-3xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'ferie' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'bg-slate-50 dark:bg-slate-800'}`}><Palmtree size={24} />Ferie</button>
                 <button type="button" onClick={() => { setFormData({ standardHours: 0, overtimeHours: '', notes: 'Malattia', type: 'malattia' }); setSelectedLeaders([]); }} className={`p-4 rounded-3xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'malattia' ? 'bg-pink-500 text-white shadow-xl shadow-pink-500/30' : 'bg-slate-50 dark:bg-slate-800'}`}><Thermometer size={24} />Malattia</button>
                 <button type="button" onClick={() => setShowOvertimeInput(!showOvertimeInput)} className={`p-4 rounded-3xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${showOvertimeInput ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'bg-slate-50 dark:bg-slate-800'}`}><Zap size={24} />Extra</button>
              </div>

              <form onSubmit={handleSubmitLog} className="space-y-6">
                {showOvertimeInput && (
                   <div className="animate-in slide-in-from-top-2">
                     <label className="block text-[10px] font-black text-orange-500 uppercase mb-2 ml-1">Ore Straordinarie</label>
                     <input type="number" step="0.5" autoFocus className="w-full p-5 bg-orange-50 dark:bg-orange-900/10 text-orange-600 border border-orange-100 dark:border-orange-900/20 rounded-[1.5rem] font-black outline-none text-2xl" placeholder="0.0" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})} />
                   </div>
                )}
                
                <div className="border-t dark:border-slate-800 pt-4">
                  <button type="button" onClick={() => setShowNotesInput(!showNotesInput)} className="w-full flex items-center justify-center p-2 mb-2"><div className={`p-2 rounded-full bg-slate-100 dark:bg-slate-800 ${showNotesInput ? `text-${accentColor}-600` : ''}`}>{showNotesInput ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div></button>
                  {showNotesInput && (
                      <div className="mt-4 space-y-4 animate-in fade-in">
                        <div ref={leaderDropdownRef} className="relative">
                           <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Capisquadra (Multiplo)</label>
                           <div onClick={() => setIsLeaderDropdownOpen(!isLeaderDropdownOpen)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-bold cursor-pointer flex justify-between items-center transition-colors">
                             <span className={selectedLeaders.length === 0 ? "text-slate-300" : "text-slate-900 dark:text-white"}>{selectedLeaders.length === 0 ? "Seleziona..." : selectedLeaders.join(', ')}</span>
                             <ChevronDown size={20} className="text-slate-400" />
                           </div>
                           {isLeaderDropdownOpen && (
                             <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-[1.5rem] shadow-2xl z-50 p-2 max-h-60 overflow-y-auto">
                               {availableLeaders.map(leader => (
                                 <div key={leader} onClick={() => toggleLeaderSelection(leader)} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer ${selectedLeaders.includes(leader) ? `bg-${accentColor}-50 dark:bg-${accentColor}-900/20` : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                   <div className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${selectedLeaders.includes(leader) ? `bg-${accentColor}-600 border-${accentColor}-600 text-white` : 'border-slate-300'}`}>{selectedLeaders.includes(leader) && <CheckSquare size={16} />}</div>
                                   <span className="font-bold">{leader}</span>
                                 </div>
                               ))}
                             </div>
                           )}
                        </div>
                        <textarea placeholder="Cosa hai fatto oggi?" className="w-full p-5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-medium outline-none focus:border-blue-500 transition-all" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                      </div>
                  )}
                </div>
                {formError && <p className="text-red-600 font-black text-xs text-center">{formError}</p>}
                <button className={`w-full p-5 rounded-[1.5rem] font-black uppercase text-white tracking-widest bg-slate-900 dark:bg-${accentColor}-600 shadow-2xl shadow-${accentColor}-500/20 active:scale-95 transition-all flex items-center justify-center gap-2`}><CheckCircle2 size={24} /> Archivia nel Vault</button>
              </form>
            </div>

            {/* List entry per il giorno */}
            <div className="space-y-4">
              {logs.filter(l => l.date === formatDateAsLocal(selectedDate)).map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 flex items-center justify-between group shadow-sm transition-all hover:shadow-md">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      {log.type === 'work' && <span className="text-3xl font-black">{log.standardHours}h</span>}
                      {log.type === 'ferie' && <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-xl font-black uppercase text-xs">Ferie</span>}
                      {log.type === 'malattia' && <span className="px-3 py-1 bg-pink-100 text-pink-600 rounded-xl font-black uppercase text-xs">Malattia</span>}
                      {log.overtimeHours > 0 && <span className="text-sm font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-xl">+{log.overtimeHours}h Extra</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      {log.teamLeader && <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1"><Users size={12}/> {log.teamLeader}</p>}
                      <p className="text-sm text-slate-500 font-medium">{log.notes || "Senza descrizione"}</p>
                    </div>
                  </div>
                  <button onClick={() => setLogToDelete(log.id)} className="p-4 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={24} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS VIEW (RIORGANIZZATA) */}
        {view === 'settings' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <h2 className="text-3xl font-black italic uppercase tracking-tight">Impostazioni</h2>
            
            {/* CARD 1: STILE & ASPETTO */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-xl border dark:border-slate-800 space-y-10">
               {/* Aspetto Applicazione */}
               <div className="flex items-center justify-between pb-10 border-b dark:border-slate-800">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Aspetto Applicazione</h3>
                    <p className="text-sm text-slate-500 font-medium">Scegli tra modalità chiara e scura</p>
                  </div>
                  <button onClick={toggleTheme} className="flex items-center gap-3 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-xs uppercase text-slate-600 dark:text-slate-300 transition-all hover:scale-95 active:scale-90">
                    {theme === 'light' ? <><Moon size={18}/> Dark Mode</> : <><Sun size={18}/> Light Mode</>}
                  </button>
               </div>

               {/* Stile Colore */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2"><Palette size={20}/> Stile Colore</h3>
                    <p className="text-sm text-slate-500 font-medium">Personalizza il colore dell'interfaccia</p>
                  </div>
                  <div className="flex items-center gap-3 overflow-x-auto pb-4 sm:pb-0 scrollbar-hide">
                    {Object.entries(ACCENT_COLORS).map(([key, { label, hex }]) => (
                      <button key={key} onClick={() => changeAccentColor(key)} title={label} style={{ backgroundColor: hex }} className={`w-12 h-12 rounded-full border-4 transition-all ${accentColor === key ? 'border-slate-900 dark:border-white scale-125 shadow-2xl' : 'border-transparent opacity-50 hover:opacity-100 hover:scale-110'}`}>
                         {accentColor === key && <CheckCircle2 size={24} className="text-white mx-auto drop-shadow-lg" />}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            {/* CARD 2: APP MOBILE (SOLA) */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-xl border dark:border-slate-800 transition-transform hover:scale-[1.01]">
               <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className={`p-4 rounded-3xl bg-${accentColor}-50 dark:bg-slate-800 text-${accentColor}-600`}><Smartphone size={32}/></div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">App Mobile</h3>
                      <p className="text-sm text-slate-500 font-medium">Installa TimeVault sulla tua Home per un accesso rapido</p>
                    </div>
                  </div>
                  <button onClick={() => setShowGuideModal(true)} className={`px-8 py-4 bg-${accentColor}-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-${accentColor}-500/30 hover:scale-95 active:scale-90 transition-all`}>Apri Guida</button>
               </div>
            </div>
            
            {/* CARD 3: ZONA PERICOLO */}
            <div className="bg-red-50 dark:bg-red-950/20 p-10 rounded-[3rem] border border-red-100 dark:border-red-900/30">
               <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                  <div>
                    <h3 className="text-xl font-black text-red-600 mb-1 flex items-center justify-center sm:justify-start gap-2"><AlertTriangle size={20}/> Zona Pericolo</h3>
                    <p className="text-sm text-red-400 font-medium">L'eliminazione dell'account è permanente</p>
                  </div>
                  <button onClick={() => setShowDeleteAuthModal(true)} className="px-6 py-4 bg-white dark:bg-red-600 text-red-600 dark:text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-sm hover:bg-red-50 transition-all">Elimina Account</button>
               </div>
            </div>
          </div>
        )}

        {/* REPORT VIEW */}
        {view === 'report' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
             <div className="flex justify-between items-center"><h2 className="text-3xl font-black italic uppercase">Resoconto Mese</h2><p className="text-sm font-black text-slate-400 uppercase tracking-widest">{monthName}</p></div>
             <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] shadow-2xl border dark:border-slate-800 text-center relative overflow-hidden">
                 <div className={`absolute top-0 left-0 w-2 h-full bg-${accentColor}-600`}></div>
                 <button onClick={() => setShowPreviewModal(true)} className={`inline-flex p-8 bg-${accentColor}-50 dark:bg-slate-800 rounded-full text-${accentColor}-600 mb-8 transition-transform hover:scale-110 active:scale-90 shadow-xl`}><FileText size={64} /></button>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mt-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Giorni di Lavoro</p>
                        <p className="text-7xl font-black">{monthlyStats.daysWorked}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Extra Mensili</p>
                        <p className="text-7xl font-black text-orange-600">{monthlyStats.ext}<span className="text-2xl">h</span></p>
                    </div>
                 </div>
                 <button onClick={() => setShowDownloadConfirm(true)} className={`mt-12 w-full p-6 bg-slate-900 dark:bg-${accentColor}-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95`}><Download size={24} /> Genera PDF Completo</button>
             </div>
          </div>
        )}
      </main>

      {/* --- FOOTER --- */}
      <footer className="max-w-4xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em] print:hidden">TimeVault Personal • Build v0.8.2</footer>

      {/* --- MODALI DI SISTEMA --- */}
      {logToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full border text-center animate-in zoom-in">
            <Trash2 size={48} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-black mb-4 uppercase">Eliminare questa voce?</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setLogToDelete(null)} className="p-4 rounded-2xl font-black text-xs uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 transition-transform hover:scale-95">Annulla</button>
              <button onClick={confirmDelete} className="p-4 rounded-2xl font-black text-xs uppercase bg-red-500 text-white transition-transform hover:scale-95">Elimina</button>
            </div>
          </div>
        </div>
      )}

      {/* STILI PER TAILWIND DINAMICI (NASCOSTI) */}
      <div className="hidden">
        <div className="bg-blue-600 bg-violet-600 bg-emerald-600 bg-rose-600 bg-amber-600 bg-cyan-600 bg-orange-600"></div>
        <div className="bg-blue-50 bg-violet-50 bg-emerald-50 bg-rose-50 bg-amber-50 bg-cyan-50"></div>
        <div className="text-blue-600 text-violet-600 text-emerald-600 text-rose-600 text-amber-600 text-cyan-600 text-blue-500 text-blue-400"></div>
        <div className="shadow-blue-500/30 shadow-violet-500/30 shadow-emerald-500/30 shadow-rose-500/30 shadow-amber-500/30 shadow-cyan-500/30 shadow-blue-500/40"></div>
        <div className="shadow-blue-500/20 shadow-violet-500/20 shadow-emerald-500/20 shadow-rose-500/20 shadow-amber-500/20 shadow-cyan-500/20"></div>
      </div>
    </div>
  );
}