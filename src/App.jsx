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
  setDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { 
  Clock, Plus, Trash2, Calendar as CalendarIcon, LogOut, TrendingUp, 
  Briefcase, Sun, Moon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft, CheckCircle2,
  Menu, Home, FileText, Settings, X, Zap, Palmtree, Thermometer, AlertTriangle, Download, Eye, ShieldAlert, Lock, LogIn, UserPlus, Key, Copy, AlertOctagon, ShieldCheck, Unlock, RefreshCw, Users, CheckSquare, Square, User, Palette, Smartphone, Share, Search, ShieldX, Coffee
} from 'lucide-react';

// -----------------------------------------------------------------------------
// ISTRUZIONI PER L'USO DEL FILE JSON ESTERNO
import externalTeamLeaders from './capisquadra.json';
// -----------------------------------------------------------------------------
const fallbackForPreview = []; 
// -----------------------------------------------------------------------------

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

const STANDARD_HOURS_VALUE = 8; 

const FALLBACK_TEAM_LEADERS = [
  'Caposquadra 1',
  'Caposquadra 2'
];

const ACCENT_COLORS = {
  blue: { hex: '#2563eb', label: 'Blu Reale', class: 'blue' },
  violet: { hex: '#7c3aed', label: 'Viola Ultra', class: 'violet' },
  emerald: { hex: '#059669', label: 'Smeraldo', class: 'emerald' },
  rose: { hex: '#e11d48', label: 'Rosa Vivo', class: 'rose' },
  amber: { hex: '#d97706', label: 'Ambra', class: 'amber' },
  cyan: { hex: '#0891b2', label: 'Ciano', class: 'cyan' },
};

const getLeadersList = () => {
  try {
    let data = null;
    if (typeof externalTeamLeaders !== 'undefined') {
       data = (externalTeamLeaders && externalTeamLeaders.default) ? externalTeamLeaders.default : externalTeamLeaders;
    } else {
       data = fallbackForPreview;
    }
    if (Array.isArray(data) && data.length > 0) return data;
  } catch (e) {
    console.warn("Nessun file JSON caricato o array vuoto. Uso fallback.");
  }
  return FALLBACK_TEAM_LEADERS;
};

const ACTIVE_TEAM_LEADERS = getLeadersList();

const formatDateAsLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateIT = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const generateRecoveryCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function App() {
  const [showIntro, setShowIntro] = useState(true); 
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [view, setView] = useState('calendar'); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [availableLeaders] = useState(ACTIVE_TEAM_LEADERS); 
  const [selectedLeaders, setSelectedLeaders] = useState([]); 
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false); 
  const leaderDropdownRef = useRef(null);

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  const [formError, setFormError] = useState('');
  const [logToDelete, setLogToDelete] = useState(null); 
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false); 
  const [showGuideModal, setShowGuideModal] = useState(false); 

  const [showDeleteRecoveryModal, setShowDeleteRecoveryModal] = useState(false); 
  const [showDeleteFinalConfirm, setShowDeleteFinalConfirm] = useState(false); 
  const [deleteRecoveryInput, setDeleteRecoveryInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState(''); 
  const [showRecoveryModal, setShowRecoveryModal] = useState(false); 
  
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); 
  const [newResetPassword, setNewResetPassword] = useState('');

  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') || 'light';
    return 'light';
  });
  
  const [accentColor, setAccentColor] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('accentColor') || 'blue';
    return 'blue';
  });

  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [formData, setFormData] = useState({
    standardHours: 0, overtimeHours: '', notes: '', type: 'work' 
  });
  const [showOvertimeInput, setShowOvertimeInput] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false); 

  const isWeekend = useMemo(() => {
    const day = selectedDate.getDay();
    return day === 0 || day === 6; 
  }, [selectedDate]);

  // Gestione Intro Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 3200); 
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    function handleClickOutsideDropdown(event) {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target)) setIsLeaderDropdownOpen(false);
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) setIsProfileDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutsideDropdown);
    return () => document.removeEventListener("mousedown", handleClickOutsideDropdown);
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadUserTheme = async () => {
      try {
        const themeDocRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme');
        const themeSnap = await getDoc(themeDocRef);
        if (themeSnap.exists()) {
          const data = themeSnap.data();
          if (data.mode) setTheme(data.mode);
          if (data.accent && ACCENT_COLORS[data.accent]) setAccentColor(data.accent);
        }
      } catch (error) { console.error("Errore tema:", error); }
    };
    loadUserTheme();
  }, [user]);

  useEffect(() => {
    const setDynamicFavicon = () => {
      const hexColor = ACCENT_COLORS[accentColor]?.hex || '#2563eb';
      const encodedColor = hexColor.replace('#', '%23');
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/svg+xml';
      link.rel = 'shortcut icon';
      link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22${encodedColor}%22/><path d=%22M50 25V50L65 65%22 stroke=%22white%22 stroke-width=%228%22 stroke-linecap=%22round%22 fill=%22none%22/></svg>`;
      document.getElementsByTagName('head')[0].appendChild(link);
    };
    setDynamicFavicon();
  }, [accentColor]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    saveThemeSettings(newTheme, accentColor);
  };

  const changeAccentColor = async (newColor) => {
    setAccentColor(newColor);
    localStorage.setItem('accentColor', newColor);
    saveThemeSettings(theme, newColor);
  };

  const saveThemeSettings = async (currentTheme, currentAccent) => {
    if (user) {
      try {
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), {
          mode: currentTheme, accent: currentAccent, updatedAt: serverTimestamp()
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
      if (!showRecoveryModal) setUser(currentUser);
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

  // --- LOGICA AUTOMAZIONE RIPOSO WEEKEND ---
  useEffect(() => {
    if (!user || loading) return;

    const checkWeekendAutomation = async () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0: Dom, 1: Lun, ...
      
      // Eseguiamo il controllo se oggi è lunedì (o dopo)
      // Cerchiamo il sabato e la domenica appena passati
      if (dayOfWeek >= 1) { 
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - dayOfWeek);
        const lastSaturday = new Date(lastSunday);
        lastSaturday.setDate(lastSunday.getDate() - 1);

        const datesToCheck = [formatDateAsLocal(lastSaturday), formatDateAsLocal(lastSunday)];
        
        for (const dateStr of datesToCheck) {
          // Controlliamo localmente se esiste già un log per quella data
          const exists = logs.some(l => l.date === dateStr);
          if (!exists) {
            try {
              const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
              await addDoc(logsCollection, {
                standardHours: 0,
                overtimeHours: 0,
                notes: 'Riposo',
                type: 'riposo',
                date: dateStr,
                userId: user.uid,
                userName: user.displayName,
                createdAt: serverTimestamp()
              });
              console.log(`Automazione: inserito Riposo per il ${dateStr}`);
            } catch (e) {
              console.error("Errore automazione weekend:", e);
            }
          }
        }
      }
    };

    // Ritardiamo leggermente per essere sicuri che i log siano caricati
    if (logs.length > 0) {
      const timer = setTimeout(() => {
        checkWeekendAutomation();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, logs, loading]);

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
           recoveryCode: recoveryCode, createdAt: serverTimestamp()
        });
        setShowAuthModal(false); 
        setShowRecoveryModal(true); 
      }
    } catch (error) {
      if (authMode === 'login') {
         const newAttempts = failedAttempts + 1;
         setFailedAttempts(newAttempts);
         if (newAttempts >= 3) {
            setIsLocked(true); setRecoveryStep(1); setAuthError("Troppi tentativi falliti. Account bloccato.");
         } else setAuthError(`Password errata. Tentativi rimasti: ${3 - newAttempts}`);
      } else {
         if (error.code === 'auth/email-already-in-use') setAuthError("Utente già registrato.");
         else setAuthError("Errore durante la registrazione.");
      }
    } finally { setIsSubmitting(false); }
  };

  const handleRecoveryCodeSaved = () => { setShowRecoveryModal(false); setUser(auth.currentUser); };
  const handleVerifyCode = () => {
     if (unlockCodeInput.length < 16) { setAuthError("Codice non valido."); return; }
     setAuthError(""); setRecoveryStep(2);
  };
  const handleFinalPasswordReset = () => {
    if (newResetPassword.length < 6) { setAuthError("La password deve essere di almeno 6 caratteri."); return; }
    setIsLocked(false); setFailedAttempts(0); setAuthError(""); setUnlockCodeInput(''); setNewResetPassword(''); setRecoveryStep(1);
    alert("Password reimpostata con successo! Ora puoi accedere.");
  };

  const handleLogout = () => { signOut(auth); setView('calendar'); setFailedAttempts(0); setIsLocked(false); setIsProfileDropdownOpen(false); };
  const toggleLeaderSelection = (leaderName) => {
    setSelectedLeaders(prev => prev.includes(leaderName) ? prev.filter(n => n !== leaderName) : [...prev, leaderName]);
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');
    const dateString = formatDateAsLocal(selectedDate);
    if (logs.some(l => l.date === dateString)) {
      setFormError("Attenzione: Esiste già una voce per questa data! Cancella quella esistente se vuoi modificarla.");
      return;
    }
    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      await addDoc(logsCollection, {
        ...formData, standardHours: Number(formData.standardHours) || 0, overtimeHours: Number(formData.overtimeHours) || 0,
        teamLeader: selectedLeaders.join(', '), date: dateString, userId: user.uid, userName: user.displayName, createdAt: serverTimestamp()
      });
      setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
      setSelectedLeaders([]); setShowOvertimeInput(false); setShowNotesInput(false); setIsLeaderDropdownOpen(false);
    } catch (e) { console.error(e); }
  };

  const requestDeleteLog = (id) => setLogToDelete(id);
  const confirmDelete = async () => {
    if (!logToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', logToDelete));
      setLogToDelete(null); 
    } catch (e) { console.error(e); }
  };

  const verifyRecoveryCodeForDeletion = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteRecoveryInput.length < 16) { setDeleteError("Il codice deve essere di 16 caratteri."); return; }
    setIsDeleting(true);
    try {
       const securityDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'security'));
       if (securityDoc.exists() && securityDoc.data().recoveryCode === deleteRecoveryInput) {
          setIsDeleting(false);
          setShowDeleteRecoveryModal(false);
          setShowDeleteFinalConfirm(true);
       } else {
          setIsDeleting(false);
          setDeleteError("Codice di recupero non corretto.");
       }
    } catch (e) {
       setIsDeleting(false);
       setDeleteError("Errore durante la verifica.");
    }
  };

  const confirmFinalAccountDeletion = async () => {
    setIsDeleting(true);
    try {
      await deleteUser(user);
    } catch (error) {
      setIsDeleting(false);
      alert("Per motivi di sicurezza, rieffettua l'accesso prima di eliminare l'account definitivamente.");
    }
  };

  const handleDownloadRequest = () => setShowDownloadConfirm(true);
  const confirmDownload = () => { 
    setShowDownloadConfirm(false); 
    setTimeout(() => {
      window.print();
    }, 500); 
  };

  const handleSetStandard = () => { setFormError(''); setFormData(prev => ({ ...prev, standardHours: STANDARD_HOURS_VALUE, type: 'work', notes: '' })); };
  const handleSetFerie = () => { setFormError(''); setFormData({ standardHours: 0, overtimeHours: '', notes: 'Ferie', type: 'ferie' }); setSelectedLeaders([]); setShowOvertimeInput(false); };
  const handleSetMalattia = () => { setFormError(''); setFormData({ standardHours: 0, overtimeHours: '', notes: 'Malattia', type: 'malattia' }); setSelectedLeaders([]); setShowOvertimeInput(false); };
  const handleSetRiposoCompensativo = () => { setFormError(''); setFormData({ standardHours: 0, overtimeHours: '', notes: 'Riposo Compensativo', type: 'riposo_compensativo' }); setSelectedLeaders([]); setShowOvertimeInput(false); };
  const toggleOvertime = () => { setFormError(''); setShowOvertimeInput(!showOvertimeInput); };

  const currentMonthLogs = useMemo(() => {
    const targetMonth = currentMonth.getMonth(); 
    const targetYear = currentMonth.getFullYear();
    return logs.filter(log => {
      const [year, month, day] = log.date.split('-').map(Number);
      return (month - 1) === targetMonth && year === targetYear;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); 
  }, [logs, currentMonth]);

  const filteredMonthLogs = useMemo(() => {
    if (!reportSearchQuery) return currentMonthLogs;
    const query = reportSearchQuery.toLowerCase();
    return currentMonthLogs.filter(log => log.notes?.toLowerCase().includes(query) || log.teamLeader?.toLowerCase().includes(query));
  }, [currentMonthLogs, reportSearchQuery]);

  const monthlyStats = useMemo(() => {
    const uniqueDays = new Set();
    let totalOvertime = 0;
    currentMonthLogs.forEach(log => {
        if (!['ferie', 'malattia', 'riposo', 'riposo_compensativo'].includes(log.type)) uniqueDays.add(log.date);
        totalOvertime += Number(log.overtimeHours || 0);
    });
    return { daysWorked: uniqueDays.size, ext: totalOvertime };
  }, [currentMonthLogs]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1; 
    return { days, offset };
  };

  const changeMonth = (increment) => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + increment, 1));
  const selectDay = (day) => {
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
    setSelectedLeaders([]); setShowOvertimeInput(false); setShowNotesInput(false); setFormError(''); setView('day');
  };

  const dailyLogs = useMemo(() => logs.filter(l => l.date === formatDateAsLocal(selectedDate)), [logs, selectedDate]);
  const hasData = (day) => logs.some(l => l.date === formatDateAsLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)));
  const handleMenuNavigation = (targetView) => { setView(targetView); setIsMenuOpen(false); };
  const openAuthModal = (mode) => { setAuthMode(mode); setAuthError(''); setAuthData({ username: '', password: '' }); setShowAuthModal(true); };
  const copyToClipboard = () => { navigator.clipboard.writeText(generatedRecoveryCode); alert("Codice copiato negli appunti!"); };

  // --- RENDERING INTRO ---
  if (showIntro) {
    return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
         <div className={`p-8 bg-${accentColor}-600 rounded-[2.5rem] text-white shadow-2xl shadow-${accentColor}-500/30 animate-pulse duration-[2000ms] mb-10`}>
            <Clock size={80} />
         </div>
         <div className="text-center overflow-hidden">
            <h1 className="text-6xl font-black italic tracking-tighter text-white animate-in slide-in-from-bottom-8 duration-1000">TIMEVAULT</h1>
            <p className="text-slate-500 text-sm font-black uppercase tracking-[0.5em] mt-4 opacity-0 animate-in fade-in fill-mode-forwards delay-700 duration-1000">Personal Edition</p>
         </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-blue-500 font-bold animate-pulse uppercase tracking-widest italic">Caricamento Vault...</div>;

  if (!user || showRecoveryModal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative z-10 animate-in fade-in zoom-in duration-500">
          <div className="flex justify-end mb-4 absolute top-6 right-6">
             <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
               {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
          </div>
          <div className="mb-12 mt-6">
             <div className={`inline-flex p-6 bg-${accentColor}-600 rounded-[2rem] text-white mb-6 shadow-2xl shadow-${accentColor}-500/40 animate-bounce-slow transition-colors duration-300`}>
               <Clock size={48} />
             </div>
             <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none mb-2">TIMEVAULT</h1>
             <p className="text-slate-400 dark:text-slate-500 text-xs font-black uppercase tracking-[0.4em]">Personal Edition</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => openAuthModal('login')} className={`w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3`}>
              <LogIn size={20} /> Accedi al Vault
            </button>
            <button onClick={() => openAuthModal('register')} className="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center gap-3">
              <UserPlus size={20} /> Nuovo Account
            </button>
          </div>
          <p className="mt-8 text-[10px] text-slate-400 font-medium">Gestisci il tuo tempo, monitora gli straordinari.</p>
        </div>

        {showRecoveryModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border-2 border-red-500 relative animate-in zoom-in-95 duration-300 text-center">
                 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <ShieldCheck size={36} />
                 </div>
                 <h2 className="text-2xl font-black italic text-red-600 uppercase tracking-tight mb-2">Sicurezza</h2>
                 <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-6">Salva questo codice di recupero.</p>
                 <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 relative group">
                    <p className="font-mono text-lg font-black text-slate-800 dark:text-white tracking-widest break-all">{generatedRecoveryCode}</p>
                    <button onClick={copyToClipboard} className="absolute right-2 top-2 p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500 shadow-sm"><Copy size={16} /></button>
                 </div>
                 <button onClick={handleRecoveryCodeSaved} className="w-full bg-red-600 hover:bg-red-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"><CheckCircle2 size={20} /> Sì, ho salvato</button>
              </div>
           </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border relative animate-in zoom-in-95 duration-300 ${isLocked ? 'border-red-500' : (authMode === 'login' ? 'border-slate-100 dark:border-slate-800' : 'border-purple-100 dark:border-purple-900/30')}`}>
                <button onClick={() => { setShowAuthModal(false); setIsLocked(false); setFailedAttempts(0); setRecoveryStep(1); }} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={20} /></button>
                {isLocked ? (
                   <div className="text-center">
                      <div className="inline-flex p-4 rounded-2xl bg-red-600 text-white mb-4 shadow-lg animate-bounce"><AlertOctagon size={28} /></div>
                      <h2 className="text-2xl font-black italic text-red-600 uppercase tracking-tight">Account Bloccato</h2>
                      {recoveryStep === 1 && (
                         <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300 mt-6">
                             <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full p-4.5 bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-900/30 rounded-2xl font-mono text-center font-bold outline-none" value={unlockCodeInput} onChange={e => setUnlockCodeInput(e.target.value.toUpperCase())} />
                             <button onClick={handleVerifyCode} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest">Verifica Codice</button>
                         </div>
                      )}
                      {recoveryStep === 2 && (
                         <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300 mt-6">
                             <input type="password" placeholder="Nuova Password" className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none" value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} />
                             <button onClick={handleFinalPasswordReset} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest">Resetta Password</button>
                         </div>
                      )}
                   </div>
                ) : (
                   <>
                   <div className="text-center mb-8">
                     <div className={`inline-flex p-4 rounded-2xl text-white mb-4 shadow-lg ${authMode === 'login' ? `bg-${accentColor}-600 shadow-${accentColor}-500/30` : 'bg-purple-600 shadow-purple-500/30'} transition-colors duration-300`}>
                       {authMode === 'login' ? <LogIn size={28} /> : <UserPlus size={28} />}
                     </div>
                     <h2 className="text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">{authMode === 'login' ? 'Bentornato' : 'Nuovo Utente'}</h2>
                   </div>
                   <form onSubmit={handleAuth} className="space-y-4">
                     <input type="text" placeholder="nome.cognome" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none" value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} />
                     <input type="password" placeholder="••••••••" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none" value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
                     {authError && <div className="text-red-600 text-[11px] font-black">{authError}</div>}
                     <button type="submit" disabled={isSubmitting} className={`w-full text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-colors duration-300 ${authMode === 'login' ? `bg-${accentColor}-600 hover:bg-${accentColor}-700` : 'bg-purple-600'}`}>{isSubmitting ? '...' : authMode === 'login' ? 'Entra' : 'Registra'}</button>
                   </form>
                   <div className="mt-6 text-center"><button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-slate-400 font-bold text-[10px] uppercase">{authMode === 'login' ? "Crea account" : "Accedi"}</button></div>
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
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 print:hidden">
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-y-auto max-h-[80vh]">
            <button onClick={() => setShowGuideModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={20} /></button>
            <div className="text-center mb-8">
                <div className={`inline-flex p-4 rounded-2xl bg-${accentColor}-100 dark:bg-${accentColor}-900/30 text-${accentColor}-600 dark:text-${accentColor}-400 mb-4 shadow-lg`}>
                  <Smartphone size={32} />
                </div>
                <h2 className="text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">Installa App</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">Aggiungi TimeVault alla tua Home</p>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3"><span className="text-xl"></span> iOS (iPhone/iPad)</h3>
                 <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-3 list-decimal list-inside font-medium marker:text-slate-400 marker:font-bold">
                    <li>Apri <strong>Safari</strong>.</li>
                    <li>Tocca l'icona <strong>Condividi</strong> nella barra in basso.</li>
                    <li>Scorri e seleziona <strong>"Aggiungi alla schermata Home"</strong>.</li>
                 </ol>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3"><span className="text-lg">🤖</span> Android (Chrome)</h3>
                 <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-3 list-decimal list-inside font-medium marker:text-slate-400 marker:font-bold">
                    <li>Apri <strong>Chrome</strong>.</li>
                    <li>Tocca il menu <strong>(tre puntini)</strong> in alto a destra.</li>
                    <li>Seleziona <strong>"Aggiungi a schermata Home"</strong> o <strong>"Installa App"</strong>.</li>
                 </ol>
              </div>
            </div>
            <button onClick={() => setShowGuideModal(false)} className={`w-full mt-8 bg-slate-900 dark:bg-${accentColor}-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all`}>Capito</button>
          </div>
        </div>
      )}

      {logToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-center mb-4">Confermi cancellazione?</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLogToDelete(null)} className="p-4 rounded-xl font-black text-xs uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">No</button>
              <button onClick={confirmDelete} className="p-4 rounded-xl font-black text-xs uppercase bg-red-500 text-white">Sì, Cancella</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DOWNLOAD */}
      {showDownloadConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center">
            <h3 className="text-lg font-black mb-2">Generare Report?</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Si aprirà la finestra di stampa per il mese di <span className="capitalize">{monthName}</span>.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowDownloadConfirm(false)} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-xs uppercase text-slate-500 transition-colors">Annulla</button>
              <button onClick={confirmDownload} className={`p-4 bg-${accentColor}-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-${accentColor}-500/30 transition-all active:scale-95`}>Genera</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 sticky top-0 z-30 px-4 md:px-8 h-20 flex items-center justify-between shadow-sm">
        <div className="relative flex items-center z-20" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-3 cursor-pointer group p-2 -ml-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <Menu size={24} className="text-slate-600 dark:text-slate-300" />
            <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-950 shadow-lg group-hover:scale-95 transition-transform"><Clock size={20} /></div>
          </button>
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-2">
               <button onClick={() => handleMenuNavigation('calendar')} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><Home size={18} /> Home</button>
               <button onClick={() => handleMenuNavigation('report')} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><FileText size={18} /> Resoconto</button>
               <button onClick={() => handleMenuNavigation('settings')} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"><Settings size={18} /> Impostazioni</button>
            </div>
          )}
        </div>
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"><h1 className="text-2xl font-black tracking-tighter italic leading-none text-slate-900 dark:text-white">TIMEVAULT</h1></div>
        <div className="relative z-20" ref={profileDropdownRef}>
            <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-2 group focus:outline-none">
              <div className={`bg-${accentColor}-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-${accentColor}-100 dark:border-slate-700 hidden sm:block transition-transform group-hover:scale-95`}>
                <p className={`text-[9px] text-${accentColor}-400 dark:text-${accentColor}-300 font-black uppercase mb-0.5 leading-none text-right`}>Ciao</p>
                <p className={`text-sm font-black text-${accentColor}-700 dark:text-${accentColor}-400 uppercase italic leading-none`}>{user?.displayName}</p>
              </div>
              <div className={`w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 group-hover:bg-${accentColor}-100 dark:group-hover:bg-slate-700 transition-colors`}>
                 <User size={20} />
              </div>
            </button>
            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 animate-in fade-in slide-in-from-top-2">
                 <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><LogOut size={18} /> Disconnetti</button>
              </div>
            )}
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
                  <span className="text-xs font-bold text-slate-300 dark:text-slate-600 uppercase">Giorni</span>
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
              <div className="grid grid-cols-7 mb-4">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (<div key={day} className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest py-2">{day}</div>))}</div>
              <div className="grid grid-cols-7 gap-2 md:gap-4">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth.getMonth() && new Date().getFullYear() === currentMonth.getFullYear();
                  const active = hasData(day);
                  return (
                    <button key={day} onClick={() => selectDay(day)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-200 ${isToday ? `bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg scale-105` : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-95'}`}>
                      <span className="text-sm md:text-lg font-bold">{day}</span>
                      {active && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isToday ? `bg-${accentColor}-400` : `bg-${accentColor}-600 dark:bg-${accentColor}-400`}`}></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'day' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold uppercase text-xs tracking-widest mb-4"><ArrowLeft size={16} /> Torna al calendario</button>
            <h2 className="text-3xl font-black italic text-slate-800 dark:text-white capitalize">{selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}{isWeekend && <span className="block text-xs font-bold text-orange-500 not-italic mt-1 uppercase tracking-widest">Weekend • Straordinario</span>}</h2>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black mb-6 uppercase text-slate-400 tracking-widest">Aggiungi Ore</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                 {!isWeekend && (
                   <>
                     <button type="button" onClick={handleSetStandard} className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'work' && formData.standardHours === STANDARD_HOURS_VALUE ? `bg-${accentColor}-600 text-white shadow-xl shadow-${accentColor}-500/30` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><Briefcase size={20} />Standard ({STANDARD_HOURS_VALUE}h)</button>
                     <button type="button" onClick={handleSetFerie} className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'ferie' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><Palmtree size={20} />Ferie</button>
                   </>
                 )}
                 <button type="button" onClick={handleSetMalattia} className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'malattia' ? 'bg-pink-500 text-white shadow-xl shadow-pink-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><Thermometer size={20} />Malattia</button>
                 <button type="button" onClick={handleSetRiposoCompensativo} className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${formData.type === 'riposo_compensativo' ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><Coffee size={20} />Riposo Comp.</button>
                 <button type="button" onClick={toggleOvertime} className={`p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2 transition-all ${showOvertimeInput ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}><Zap size={20} />Straordinario</button>
              </div>
              <form onSubmit={handleSubmitLog} className="space-y-6">
                {showOvertimeInput && (
                   <div className="animate-in slide-in-from-top-2 fade-in">
                     <label className="block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1">Ore Extra</label>
                     <input type="number" step="0.5" autoFocus className="w-full p-4.5 bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/20 rounded-[1.25rem] font-black outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-orange-300" placeholder="0.0" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})} />
                   </div>
                )}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <button type="button" onClick={() => setShowNotesInput(!showNotesInput)} className="w-full flex items-center justify-center group p-2">
                    <div className={`p-2 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-${accentColor}-500 transition-colors ${showNotesInput ? `bg-${accentColor}-50 dark:bg-${accentColor}-900/20 text-${accentColor}-500` : ''}`}>{showNotesInput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                  </button>
                  {showNotesInput && (
                      <div className="mt-4 animate-in slide-in-from-top-2 fade-in space-y-3">
                        <div ref={leaderDropdownRef} className="relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Capisquadra (Multipla)</label>
                            <div onClick={() => setIsLeaderDropdownOpen(!isLeaderDropdownOpen)} className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-medium cursor-pointer flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                               <span className={selectedLeaders.length === 0 ? "text-slate-300 dark:text-slate-600" : "text-slate-900 dark:text-white"}>{selectedLeaders.length === 0 ? "Seleziona Capisquadra..." : selectedLeaders.join(', ')}</span>
                               <ChevronDown size={16} className={`text-slate-400 transition-transform ${isLeaderDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                            {isLeaderDropdownOpen && (
                               <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[1.25rem] shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-2 max-h-60 overflow-y-auto">
                                 {availableLeaders.map(leader => (
                                     <div key={leader} onClick={() => toggleLeaderSelection(leader)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedLeaders.includes(leader) ? `bg-${accentColor}-50 dark:bg-${accentColor}-900/20` : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                       <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${selectedLeaders.includes(leader) ? `bg-${accentColor}-600 border-${accentColor}-600 text-white` : 'bg-transparent border-slate-300 dark:border-slate-600'}`}>{selectedLeaders.includes(leader) && <CheckSquare size={14} />}</div>
                                       <span className={`text-sm font-bold ${selectedLeaders.includes(leader) ? `text-${accentColor}-700 dark:text-${accentColor}-300` : 'text-slate-600 dark:text-slate-300'}`}>{leader}</span>
                                     </div>
                                 ))}
                               </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Note (Opzionale)</label>
                            <textarea placeholder="Dettagli attività..." className={`w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-medium outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-${accentColor}-500 focus:ring-2 focus:ring-${accentColor}-100 dark:focus:ring-${accentColor}-900/20`} rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                        </div>
                      </div>
                  )}
                </div>
                <button disabled={!!formError} className={`w-full p-4 rounded-[1.25rem] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-colors ${formError ? 'bg-slate-200 dark:bg-slate-800 text-slate-400' : `bg-slate-900 dark:bg-${accentColor}-600 hover:bg-black dark:hover:bg-${accentColor}-700 text-white`}`}><CheckCircle2 size={18} /> Salva Voce</button>
              </form>
            </div>
            <div className="space-y-4">
              {dailyLogs.map(log => (
                <div key={log.id} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-${accentColor}-200 dark:hover:border-${accentColor}-800 transition-colors`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {log.type === 'ferie' && <span className="text-xs font-black bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg uppercase">Ferie</span>}
                      {log.type === 'malattia' && <span className="text-xs font-black bg-pink-100 text-pink-600 px-2 py-1 rounded-lg uppercase">Malattia</span>}
                      {log.type === 'riposo' && <span className="text-xs font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-lg uppercase">Riposo</span>}
                      {log.type === 'riposo_compensativo' && <span className="text-xs font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg uppercase">Riposo Comp.</span>}
                      {log.type === 'work' && log.standardHours > 0 && <span className="text-xl font-black text-slate-800 dark:text-white">{log.standardHours}h</span>}
                      {log.overtimeHours > 0 && <span className="text-sm font-black text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg">+{log.overtimeHours}h Extra</span>}
                    </div>
                    <div>
                      {log.teamLeader && <p className={`text-[10px] font-black text-${accentColor}-500 uppercase tracking-widest mb-1 flex items-center gap-1`}><Users size={12} /> {log.teamLeader}</p>}
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{log.notes || "Nessuna nota"}</p>
                    </div>
                  </div>
                  <button onClick={() => requestDeleteLog(log.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
             <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black italic text-slate-800 dark:text-white uppercase tracking-tight leading-none">Resoconto Mese</h2>
                 <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"><ChevronLeft size={20} /></button>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize min-w-[120px] text-center">{monthName}</p>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"><ChevronRight size={20} /></button>
                 </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 text-center">
                 <div className="grid grid-cols-2 gap-8 mt-4 mb-10">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giornate Lavorate</p>
                        <p className="text-5xl font-black text-slate-800 dark:text-white">{monthlyStats.daysWorked}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Straordinari Totali</p>
                        <p className="text-5xl font-black text-orange-600 dark:text-orange-500">{monthlyStats.ext}<span className="text-lg">h</span></p>
                    </div>
                 </div>

                 <div className="relative mb-6">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Cerca per note o caposquadra..." className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-slate-200 transition-all text-slate-900 dark:text-white" value={reportSearchQuery} onChange={(e) => setReportSearchQuery(e.target.value)} />
                 </div>

                 <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar text-left">
                    {filteredMonthLogs.map(log => (
                         <div key={log.id} className={`bg-slate-50/50 dark:bg-slate-800/20 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/40 overflow-hidden transition-all duration-300 ${expandedLogId === log.id ? `ring-2 ring-${accentColor}-500/30 bg-slate-100/50 dark:bg-slate-800/50` : ''}`}>
                            <div onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="p-5 cursor-pointer flex items-center justify-between">
                               <div className="flex items-center gap-5">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black bg-white dark:bg-slate-700 border-2 transition-colors ${expandedLogId === log.id ? `border-${accentColor}-500 text-${accentColor}-600` : 'border-slate-200 dark:border-slate-600 text-slate-500'}`}>{new Date(log.date).getDate()}</div>
                                  <div>
                                     <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5 tracking-widest">
                                        {log.type === 'work' ? 'Lavoro' : (log.type === 'ferie' ? 'Ferie' : (log.type === 'malattia' ? 'Malattia' : (log.type === 'riposo_compensativo' ? 'Riposo Comp.' : 'Riposo')))}
                                     </p>
                                     <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Registro Giornaliero</h3>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    {log.overtimeHours > 0 ? (
                                      <p className="text-sm font-black text-orange-500 leading-tight">+{log.overtimeHours}h Extra</p>
                                    ) : (
                                      <p className="text-sm font-black text-slate-300 dark:text-slate-600 leading-tight">- Extra</p>
                                    )}
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{log.standardHours > 0 ? 'std' : ''}</p>
                                  </div>
                                  <div className={`text-slate-300 dark:text-slate-600 transition-transform duration-300 ${expandedLogId === log.id ? 'rotate-180' : ''}`}><ChevronDown size={18} /></div>
                               </div>
                            </div>
                            
                            {expandedLogId === log.id && (
                               <div className="px-5 pb-5 pt-0 animate-in slide-in-from-top-2 duration-300">
                                  <div className="border-t border-slate-200/50 dark:border-slate-700/50 mt-2 pt-4">
                                     <p className={`text-[10px] font-black text-${accentColor}-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2`}><Users size={14} /> Capisquadra</p>
                                     <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed pl-6">{log.teamLeader || "Nessun caposquadra indicato"}</p>
                                  </div>
                               </div>
                            )}
                         </div>
                    ))}
                    {filteredMonthLogs.length === 0 && (
                      <div className="py-20 text-center">
                        <p className="text-slate-300 dark:text-slate-700 font-black uppercase text-xs tracking-widest">Nessuna voce trovata</p>
                      </div>
                    )}
                 </div>

                 <button onClick={handleDownloadRequest} className={`mt-8 w-full p-5 bg-slate-900 dark:bg-${accentColor}-600/10 text-white dark:text-${accentColor}-400 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95`}><Download size={18} /> Scarica PDF Report</button>
             </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-black italic text-slate-800 dark:text-white uppercase tracking-tight">Impostazioni</h2>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 space-y-8">
               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div><h3 className="font-bold text-slate-900 dark:text-white mb-1">Aspetto Applicazione</h3><p className="text-xs text-slate-500 dark:text-slate-400">Scegli tra modalità chiara e scura</p></div>
                  <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 transition-colors">
                    {theme === 'light' ? <><Moon size={16}/> Dark Mode</> : <><Sun size={16}/> Light Mode</>}
                  </button>
               </div>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div><h3 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2"><Palette size={18}/> Stile Colore</h3><p className="text-xs text-slate-500 dark:text-slate-400">Personalizza lo stile grafico</p></div>
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 sm:pb-0">
                    {Object.entries(ACCENT_COLORS).map(([key, { label, hex }]) => (
                      <button key={key} onClick={() => changeAccentColor(key)} title={label} style={{ backgroundColor: hex }} className={`w-10 h-10 rounded-full border-2 transition-all ${accentColor === key ? 'border-slate-900 dark:border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'}`}>
                         {accentColor === key && <CheckCircle2 size={16} className="text-white mx-auto" />}
                      </button>
                    ))}
                  </div>
               </div>
               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div><h3 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2"><Smartphone size={18}/> App Mobile</h3><p className="text-xs text-slate-500 dark:text-slate-400">Come installare TimeVault sulla Home</p></div>
                  <button onClick={() => setShowGuideModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Apri Guida</button>
               </div>
               
               <div className="pt-4">
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-6 rounded-[2rem]">
                    <h3 className="font-black text-red-600 dark:text-red-500 mb-1 flex items-center gap-2 uppercase text-xs tracking-widest"><AlertTriangle size={16}/> Zona Pericolosa</h3>
                    <p className="text-xs text-red-400 mb-4 font-medium">L'eliminazione dell'account è permanente e irreversibile.</p>
                    <button onClick={() => { setShowDeleteRecoveryModal(true); setDeleteRecoveryInput(''); setDeleteError(''); }} className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"><ShieldX size={16}/> Elimina Account</button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
      <footer className="max-w-6xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.5em]">TimeVault v0.8.5</footer>
    </div>

    {/* MODAL ELIMINAZIONE 1: CODICE RECUPERO */}
    {showDeleteRecoveryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border-2 border-red-500 relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setShowDeleteRecoveryModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Key size={32}/></div>
                 <h2 className="text-xl font-black text-red-600 uppercase tracking-tight italic">Sicurezza Account</h2>
                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2">Inserisci il codice di recupero a 16 cifre per procedere all'eliminazione.</p>
              </div>
              <form onSubmit={verifyRecoveryCodeForDeletion} className="space-y-4">
                 <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" required className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-center font-black outline-none uppercase" value={deleteRecoveryInput} onChange={e => setDeleteRecoveryInput(e.target.value.toUpperCase())} maxLength={19} />
                 {deleteError && <p className="text-red-500 text-[10px] font-black text-center italic">{deleteError}</p>}
                 <button type="submit" disabled={isDeleting} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all">{isDeleting ? "Verifica..." : "Verifica Codice"}</button>
              </form>
           </div>
        </div>
    )}

    {/* MODAL ELIMINAZIONE 2: CONFERMA FINALE */}
    {showDeleteFinalConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse"><ShieldAlert size={48}/></div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic mb-4">Sei Veramente Sicuro?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">Tutti i tuoi registri, impostazioni e credenziali verranno cancellati istantaneamente e non potranno essere recuperati in alcun modo.</p>
              <div className="space-y-3">
                 <button onClick={confirmFinalAccountDeletion} disabled={isDeleting} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all">{isDeleting ? "Eliminazione..." : "Sì, Elimina per Sempre"}</button>
                 <button onClick={() => setShowDeleteFinalConfirm(false)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-5 rounded-2xl font-black uppercase tracking-widest">Annulla</button>
              </div>
           </div>
        </div>
    )}
    
    {/* AREA DI STAMPA NASCOSTA - PDF TEMPLATE */}
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 font-sans text-black overflow-visible">
        <div className="flex justify-between items-end border-b-4 border-slate-900 pb-4 mb-6">
           <div>
              <h1 className="text-4xl font-black italic tracking-tighter mb-1">TIMEVAULT REPORT</h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Resoconto Personale Ore Lavorative</p>
           </div>
           <div className="text-right">
              <p className="text-2xl font-black uppercase italic capitalize">{monthName}</p>
              <p className="text-sm font-bold text-slate-600">Dipendente: {user?.displayName}</p>
           </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-8">
           <div className="p-6 border-2 border-slate-200 rounded-3xl bg-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giorni Lavorati</p>
              <p className="text-4xl font-black">{monthlyStats.daysWorked}</p>
           </div>
           <div className="p-6 border-2 border-slate-200 rounded-3xl bg-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Straordinari Totali</p>
              <p className="text-4xl font-black text-orange-600">+{monthlyStats.ext}h</p>
           </div>
        </div>

        <table className="w-full text-left border-collapse">
           <thead>
              <tr className="border-b-2 border-slate-900">
                 <th className="py-2 px-2 font-black uppercase text-xs">Data</th>
                 <th className="py-2 px-2 font-black uppercase text-xs">Tipo</th>
                 <th className="py-2 px-2 font-black uppercase text-xs">Caposquadra</th>
                 <th className="py-2 px-2 font-black uppercase text-xs text-right">Extra</th>
              </tr>
           </thead>
           <tbody>
              {currentMonthLogs.map(log => (
                 <tr key={log.id} className="border-b border-slate-100">
                    <td className="py-3 px-2 font-bold text-xs">{formatDateIT(log.date)}</td>
                    <td className="py-3 px-2">
                       <span className="uppercase font-black tracking-wider text-[10px]">
                          {log.type === 'work' ? "LAVORO" : (log.type === 'ferie' ? "FERIE" : (log.type === 'malattia' ? "MALATTIA" : (log.type === 'riposo_compensativo' ? "RIPOSO COMP." : "RIPOSO")))}
                       </span>
                    </td>
                    <td className="py-3 px-2">
                       {log.teamLeader ? <p className="text-[9px] font-black text-slate-600 uppercase">{log.teamLeader}</p> : <p className="text-[9px] text-slate-300">-</p>}
                    </td>
                    <td className="py-3 px-2 font-black text-xs text-right">
                       {log.overtimeHours > 0 ? `+${log.overtimeHours}h` : "-"}
                    </td>
                 </tr>
              ))}
           </tbody>
        </table>

        <div className="fixed bottom-8 left-8 right-8 text-center border-t-2 border-slate-100 pt-4">
           <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">Documento generato da TimeVault App • {new Date().toLocaleDateString('it-IT')} • Riservato</p>
        </div>
    </div>
    </>
  );
}