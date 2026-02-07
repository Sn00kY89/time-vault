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
import { getMessaging, getToken } from 'firebase/messaging';
import { 
  Clock, Plus, Trash2, Calendar as CalendarIcon, LogOut, TrendingUp, 
  Briefcase, Sun, Moon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowLeft, CheckCircle2,
  Menu, Home, FileText, Settings, X, Zap, Palmtree, Thermometer, AlertTriangle, Download, Eye, ShieldAlert, Lock, LogIn, UserPlus, Key, Copy, AlertOctagon, ShieldCheck, Unlock, RefreshCw, Users, CheckSquare, Square, User, Palette, Smartphone, Share, Search, ShieldX, Coffee, Loader2, Bell, BellOff, HelpCircle, Info, Send
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

const ACCENT_COLORS = {
  blue: { hex: '#2563eb', label: 'Blu Reale', class: 'blue' },
  violet: { hex: '#7c3aed', label: 'Viola Ultra', class: 'violet' },
  emerald: { hex: '#059669', label: 'Smeraldo', class: 'emerald' },
  rose: { hex: '#e11d48', label: 'Rosa Vivo', class: 'rose' },
  amber: { hex: '#d97706', label: 'Ambra', class: 'amber' },
  cyan: { hex: '#0891b2', label: 'Ciano', class: 'cyan' },
};

// --- UTILS ---
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
  // --- STATI UI & NAVIGATION ---
  const [showIntro, setShowIntro] = useState(true); 
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [view, setView] = useState('calendar'); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // --- STATI CAPISQUADRA ---
  const [availableLeaders] = useState(ACTIVE_TEAM_LEADERS); 
  const [selectedLeaders, setSelectedLeaders] = useState([]); 
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false); 
  const leaderDropdownRef = useRef(null);

  // --- STATI PROFILO & TEMA ---
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [theme, setTheme] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('theme') || 'light' : 'light'));
  const [accentColor, setAccentColor] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('accentColor') || 'blue' : 'blue'));

  // --- STATI MODALI ---
  const [formError, setFormError] = useState('');
  const [logToDelete, setLogToDelete] = useState(null); 
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false); 
  const [showGuideModal, setShowGuideModal] = useState(false); 
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false); 
  const [showDeleteRecoveryModal, setShowDeleteRecoveryModal] = useState(false); 
  const [showDeleteFinalConfirm, setShowDeleteFinalConfirm] = useState(false); 

  // --- STATI SICUREZZA ---
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState(''); 
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); 
  const [newResetPassword, setNewResetPassword] = useState('');
  const [deleteRecoveryInput, setDeleteRecoveryInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // --- STATI FILTRI & LOGS ---
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [formData, setFormData] = useState({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
  const [showOvertimeInput, setShowOvertimeInput] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false); 

  // --- STATI REMINDER ---
  const [reminderEnabled, setReminderEnabled] = useState(() => localStorage.getItem('reminder_enabled') === 'true');
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem('reminder_time') || "18:00");
  const [notificationStatus, setNotificationStatus] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [isSyncingPush, setIsSyncingPush] = useState(false);

  // 1. --- REGISTRAZIONE SERVICE WORKER ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
          console.log('TimeVault SW Registrato con successo');
        }).catch(err => {
          console.error('Errore registrazione SW:', err);
        });
      });
    }
  }, []);

  // 2. --- LOGICA NOTIFICHE PUSH (FCM) ---
  const setupFCM = async () => {
    // MODIFICA RIGA 123: Incolla qui la chiave VAPID reale
    const vapidKey = 'BJXBFxWqNvvIyffYPT1Z9pZCm2tqz-VNrfN5w3tU0baYLX2ilVcoD_phNZKLNZbfuS-v9KYFMS1Ls9-Ym0-QUE4'; 
    
    if (!user || vapidKey.includes('INCOLLA')) {
      console.warn("FCM: Chiave VAPID mancante.");
      return;
    }

    setIsSyncingPush(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration) throw new Error("Service Worker non pronto.");

      const messaging = getMessaging(app);
      console.log("FCM: Richiesta Token...");
      
      const token = await getToken(messaging, { 
        vapidKey: vapidKey,
        serviceWorkerRegistration: registration 
      });
      
      if (token) {
        // Percorso aggiornato per permessi Firestore
        const pushDocRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'push');
        await setDoc(pushDocRef, {
          fcmToken: token,
          updatedAt: serverTimestamp(),
          deviceInfo: navigator.userAgent,
          platform: 'mobile_ios_pwa'
        }, { merge: true });
        console.log("FCM: Token salvato.");
      }
    } catch (err) {
      console.error("FCM Error:", err);
      if (err.code === 'permission-denied') {
        alert("Errore permessi! Controlla le Firestore Rules nella console Firebase.");
      }
    } finally {
      setIsSyncingPush(false);
    }
  };

  useEffect(() => {
    if (user && notificationStatus === 'granted') {
      setupFCM();
    }
  }, [user, notificationStatus]);

  // --- ALTRI EFFETTI (INTRO, THEME, ECC.) ---
  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 3200); 
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- CLICK OUTSIDE HANDLERS ---
  useEffect(() => {
    function handleClickOutsideDropdown(event) {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target)) setIsLeaderDropdownOpen(false);
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) setIsProfileDropdownOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutsideDropdown);
    return () => document.removeEventListener("mousedown", handleClickOutsideDropdown);
  }, []);

  // --- AUTH & SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try { await setPersistence(auth, browserLocalPersistence); } catch (error) {}
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!showRecoveryModal) setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [showRecoveryModal]);

  useEffect(() => {
    if (!user) return;
    const loadUserPrefs = async () => {
      try {
        const themeDocRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme');
        const themeSnap = await getDoc(themeDocRef);
        if (themeSnap.exists()) {
          const data = themeSnap.data();
          if (data.mode) setTheme(data.mode);
          if (data.accent && ACCENT_COLORS[data.accent]) setAccentColor(data.accent);
        }
      } catch (e) { console.error("Errore preferenze:", e); }
    };
    loadUserPrefs();
  }, [user]);

  useEffect(() => {
    if (!user) { setLogs([]); return; }
    const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
    const unsubscribe = onSnapshot(logsCollection, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      },
      (error) => console.error("Firestore Error:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // --- HANDLERS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    const cleanUsername = authData.username.trim().toLowerCase().replace(/\s/g, '');
    const internalEmail = `${cleanUsername}${INTERNAL_DOMAIN}`;
    try {
      if (authMode === 'login') {
        if (isLocked) { setAuthError("Account bloccato."); setIsSubmitting(false); return; }
        await signInWithEmailAndPassword(auth, internalEmail, authData.password);
        setShowAuthModal(false);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, internalEmail, authData.password);
        await updateProfile(cred.user, { displayName: cleanUsername });
        const recoveryCode = generateRecoveryCode();
        setGeneratedRecoveryCode(recoveryCode);
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', cred.user.uid, 'settings', 'security'), { recoveryCode: recoveryCode, createdAt: serverTimestamp() });
        setShowAuthModal(false); 
        setShowRecoveryModal(true); 
      }
    } catch (error) { 
        if (authMode === 'login') {
           const newAttempts = failedAttempts + 1;
           setFailedAttempts(newAttempts);
           if (newAttempts >= 3) {
              setIsLocked(true); setRecoveryStep(1); setAuthError("Account bloccato.");
           } else setAuthError(`Password errata. Tentativi rimasti: ${3 - newAttempts}`);
        } else setAuthError("Errore autenticazione.");
    } finally { setIsSubmitting(false); }
  };

  const saveSettingsToCloud = async (m, a) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), {
        mode: m, accent: a, updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    saveSettingsToCloud(nextTheme, accentColor);
  };

  const toggleAccent = (colorKey) => {
    setAccentColor(colorKey);
    saveSettingsToCloud(theme, colorKey);
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');
    const dateString = formatDateAsLocal(selectedDate);
    if (logs.some(l => l.date === dateString)) { setFormError("Giorno già archiviato!"); return; }
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
      setSelectedLeaders([]); setShowOvertimeInput(false); setShowNotesInput(false);
    } catch (e) { console.error(e); }
  };

  const toggleLeaderSelection = (leaderName) => {
    setSelectedLeaders(prev => prev.includes(leaderName) ? prev.filter(n => n !== leaderName) : [...prev, leaderName]);
  };

  const confirmDelete = async () => {
    if (!logToDelete) return;
    try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', logToDelete)); setLogToDelete(null); } catch (e) { console.error(e); }
  };

  const confirmDownload = async () => {
    if (!window.html2canvas || !window.jspdf) { alert("Attendi caricamento..."); return; }
    setIsGeneratingPDF(true);
    const reportElement = document.getElementById('report-print-area');
    reportElement.style.display = 'block';
    try {
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Vault_Report_${monthName.replace(' ', '_')}.pdf`);
      setShowDownloadConfirm(false);
    } catch (err) { alert("Errore PDF."); } finally {
      reportElement.style.display = 'none';
      setIsGeneratingPDF(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === 'granted') {
      setReminderEnabled(true);
      localStorage.setItem('reminder_enabled', 'true');
      setupFCM();
    }
  };

  const sendTestNotification = () => {
    if (notificationStatus !== 'granted') {
       alert("Abilita prima le notifiche nel browser."); return;
    }
    new Notification("TimeVault Test", {
      body: "Il Vault comunica correttamente!",
      icon: "/favicon.ico"
    });
  };

  // --- STATS ---
  const currentMonthLogs = useMemo(() => {
    const targetMonth = currentMonth.getMonth(); 
    const targetYear = currentMonth.getFullYear();
    return logs.filter(log => {
      const [year, month] = log.date.split('-').map(Number);
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

  const monthName = currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
  const { days, offset } = { 
    days: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate(),
    offset: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() === 0 ? 6 : new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() - 1
  };
  const isWeekend = useMemo(() => {
    const d = selectedDate.getDay();
    return d === 0 || d === 6;
  }, [selectedDate]);

  if (showIntro) return (
    <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500 text-center">
      <Clock size={80} className={`text-${accentColor}-600 animate-pulse`} />
      <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase mt-10 leading-none">TIMEVAULT</h1>
      <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-4 animate-bounce duration-1000">Enterprise Grade Security</p>
    </div>
  );

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black tracking-widest animate-pulse italic">DECRYPTING VAULT...</div>;

  if (!user || showRecoveryModal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-500 relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 z-10"></div>
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative animate-in zoom-in duration-300 mx-auto">
          <div className="mb-12 mt-6">
             <div className={`inline-flex p-6 bg-${accentColor}-600 rounded-[2rem] text-white mb-6 shadow-xl shadow-${accentColor}-500/30 animate-in slide-in-from-top duration-500`}><Clock size={48} /></div>
             <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none mb-2 uppercase tracking-tight">TIMEVAULT</h1>
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] italic">Personal Workplace</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className={`w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95`}><LogIn size={20} /> Accedi</button>
            <button onClick={() => { setAuthMode('register'); setShowAuthModal(true); }} className="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 p-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"><UserPlus size={20} /> Registrati</button>
          </div>
        </div>

        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 text-left">
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border relative animate-in zoom-in-95 duration-200 border-slate-200 dark:border-slate-800 text-left">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
                <div className="text-center mb-8">
                  <div className={`inline-flex p-4 rounded-2xl text-white mb-4 bg-${accentColor}-600`}><LogIn size={28} /></div>
                  <h2 className="text-2xl font-black italic uppercase text-slate-900 dark:text-white leading-none">{authMode === 'login' ? 'Bentornato' : 'Nuovo Utente'}</h2>
                </div>
                <form onSubmit={handleAuth} className="space-y-4">
                  <input type="text" placeholder="nome.cognome" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none border border-slate-200 dark:border-slate-700 shadow-inner" value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} />
                  <input type="password" placeholder="••••••••" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none border border-slate-200 dark:border-slate-700 shadow-inner" value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
                  {authError && <div className="text-red-600 text-[11px] font-black italic mt-2 text-center">{authError}</div>}
                  <button type="submit" disabled={isSubmitting} className={`w-full text-white p-5 rounded-2xl font-black uppercase tracking-widest bg-${accentColor}-600 shadow-xl active:scale-95 transition-all shadow-${accentColor}-500/20`}>{isSubmitting ? '...' : 'Entra nel Vault'}</button>
                </form>
             </div>
          </div>
        )}

        {showRecoveryModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300 text-center">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm border-2 border-red-500 text-center shadow-2xl mx-auto">
                 <ShieldCheck size={48} className="mx-auto mb-6 text-red-600" />
                 <h2 className="text-2xl font-black italic text-red-600 uppercase mb-2">Chiave Privata</h2>
                 <p className="text-[10px] text-slate-500 font-black uppercase mb-6 leading-relaxed italic">Salva questo codice in un luogo sicuro.</p>
                 <div className="bg-slate-100 dark:bg-slate-950 p-5 rounded-2xl mb-6 font-mono text-lg font-black tracking-widest break-all dark:text-white">
                    {generatedRecoveryCode}
                 </div>
                 <button onClick={() => { setShowRecoveryModal(false); setUser(auth.currentUser); }} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase shadow-xl">Ho salvato la chiave</button>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b sticky top-0 z-40 px-6 h-20 flex items-center justify-between shadow-sm border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500"><Menu size={24} /></button>
          <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-900 shadow-lg"><Clock size={20} /></div>
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-3 z-50 animate-in slide-in-from-top-2">
               <button onClick={() => { setView('calendar'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase transition-all ${view === 'calendar' ? `bg-${accentColor}-600 text-white` : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'}`}><Home size={18} /> Diario</button>
               <button onClick={() => { setView('report'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase transition-all ${view === 'report' ? `bg-${accentColor}-600 text-white` : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'}`}><FileText size={18} /> Resoconto</button>
               <button onClick={() => { setView('settings'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase transition-all ${view === 'settings' ? `bg-${accentColor}-600 text-white` : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'}`}><Settings size={18} /> Impostazioni</button>
            </div>
          )}
        </div>
        <div className="relative" ref={profileDropdownRef}>
            <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-3 group">
              <div className="text-right hidden sm:block text-left">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5">Vault User</p>
                <p className={`text-sm font-black text-${accentColor}-600 uppercase italic leading-none transition-all group-hover:scale-105`}>{user?.displayName}</p>
              </div>
              <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 shadow-sm transition-all group-hover:border-blue-500"><User size={22} className="text-slate-500"/></div>
            </button>
            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-3">
                 <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><LogOut size={18} /> Chiudi Vault</button>
              </div>
            )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-12 pb-32">
        {view === 'calendar' && (
          <div className="space-y-10 animate-in fade-in zoom-in duration-300">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all overflow-hidden relative">
                <div className={`absolute top-0 right-0 p-6 opacity-5 text-${accentColor}-600`}><CalendarIcon size={80}/></div>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 italic leading-none">Giornate Lavorate</p>
                <p className="text-4xl font-black dark:text-white leading-none tracking-tighter">{monthlyStats.daysWorked}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-5 text-orange-600"><Zap size={80}/></div>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 italic leading-none">Extra del Mese</p>
                <p className="text-4xl font-black text-orange-600 leading-none tracking-tighter">+{monthlyStats.ext}<span className="text-lg font-bold ml-1 italic leading-none">h</span></p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 overflow-hidden relative">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-6 relative z-10 text-left">
                <h2 className="text-3xl font-black capitalize italic text-slate-900 dark:text-white tracking-tighter leading-none">{monthName}</h2>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl gap-1 border border-slate-200 dark:border-slate-700 shadow-inner">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-500 shadow-sm active:scale-90"><ChevronLeft size={22}/></button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 italic transition-colors leading-none text-center">Oggi</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-500 shadow-sm active:scale-90"><ChevronRight size={22}/></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 mb-6 relative z-10 text-left">
                 {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (<div key={day} className="text-center text-[10px] font-black uppercase text-slate-400 py-3 tracking-[0.3em] italic leading-none">{day}</div>))}
              </div>

              <div className="grid grid-cols-7 gap-4 md:gap-6 relative z-10 text-left">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDateAsLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
                  const logsForDay = logs.filter(l => l.date === dateStr);
                  const active = logsForDay.length > 0;
                  const isToday = formatDateAsLocal(new Date()) === dateStr;
                  
                  return (
                    <button key={day} onClick={() => { setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)); setView('day'); }} className={`aspect-square rounded-[1.5rem] md:rounded-[2rem] flex flex-col items-center justify-center relative transition-all group ${active ? `bg-${accentColor}-600 text-white shadow-xl shadow-${accentColor}-500/20 scale-100` : isToday ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-105 active:scale-95 shadow-inner'}`}>
                      <span className={`text-xl font-black tracking-tighter leading-none ${isToday && !active ? 'text-blue-600 dark:text-blue-400' : ''}`}>{day}</span>
                      {active && <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-white opacity-80 animate-pulse"></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'day' && (
          <div className="space-y-8 animate-in slide-in-from-right duration-300 text-left">
            <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] mb-4 hover:text-slate-900 dark:hover:text-white transition-colors italic leading-none"><ArrowLeft size={16} /> Torna al diario</button>
            <div className="flex items-center justify-between">
               <h2 className="text-4xl font-black italic capitalize text-slate-900 dark:text-white tracking-tighter leading-none">{selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
               {isWeekend && <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest italic leading-none">Weekend</div>}
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
              <div className={`absolute top-0 left-0 h-full w-2 bg-${accentColor}-600`}></div>
              <h3 className="text-[11px] font-black mb-10 uppercase text-slate-400 tracking-[0.3em] italic leading-none border-l-4 border-blue-500 pl-4 text-left">Registrazione Attività</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                 {!isWeekend && (
                   <>
                     <button type="button" onClick={() => setFormData(p => ({ ...p, standardHours: STANDARD_HOURS_VALUE, type: 'work' }))} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'work' && formData.standardHours === STANDARD_HOURS_VALUE ? `bg-${accentColor}-600 text-white shadow-xl scale-105` : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Briefcase size={24} />Standard</button>
                     <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Ferie', type: 'ferie' })} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'ferie' ? 'bg-emerald-500 text-white shadow-xl scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Palmtree size={24} />Ferie</button>
                   </>
                 )}
                 <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Malattia', type: 'malattia' })} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'malattia' ? 'bg-pink-500 text-white shadow-xl scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Thermometer size={24} />Malattia</button>
                 <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Riposo Compensativo', type: 'riposo_compensativo' })} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'riposo_compensativo' ? 'bg-indigo-500 text-white shadow-xl scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Coffee size={24} />Riposo Comp.</button>
                 <button type="button" onClick={() => setShowOvertimeInput(!showOvertimeInput)} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${showOvertimeInput ? 'bg-orange-500 text-white shadow-xl scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Zap size={24} />Straordinario</button>
              </div>

              <form onSubmit={handleSubmitLog} className="space-y-8 animate-in fade-in duration-300 relative z-10 text-left">
                {showOvertimeInput && (
                   <div className="animate-in slide-in-from-top-2 duration-300">
                     <label className="block text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-3 ml-1 italic leading-none">Ore Straordinario (es. 2.5)</label>
                     <input type="number" step="0.5" className="w-full p-5 bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 rounded-3xl font-black text-2xl outline-none border border-orange-100 dark:border-orange-900/30 shadow-inner" placeholder="0.0" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})} />
                   </div>
                )}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-8 text-center">
                  <button type="button" onClick={() => setShowNotesInput(!showNotesInput)} className="text-slate-300 dark:text-slate-600 hover:text-slate-600 p-2 flex items-center gap-2 mx-auto uppercase text-[10px] font-black tracking-[0.2em] italic leading-none">{showNotesInput ? <><ChevronUp size={16}/> Nascondi</> : <><ChevronDown size={16}/> Note e Capisquadra</>}</button>
                  {showNotesInput && (
                    <div className="mt-8 space-y-6 animate-in slide-in-from-top-2 duration-300 text-left">
                       <div ref={leaderDropdownRef} className="relative text-left">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic leading-none">Responsabile</label>
                          <div onClick={() => setIsLeaderDropdownOpen(!isLeaderDropdownOpen)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-[1.5rem] font-bold border border-slate-200 dark:border-slate-700 cursor-pointer flex justify-between items-center transition-all hover:border-blue-500 shadow-inner">
                              <span className="truncate uppercase text-xs tracking-tight">{selectedLeaders.length === 0 ? "Nessuno selezionato" : selectedLeaders.join(', ')}</span>
                              <ChevronDown size={18} className={`transition-transform duration-300 ${isLeaderDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>
                          {isLeaderDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-[2rem] shadow-2xl z-[60] p-3 max-h-60 overflow-y-auto animate-in zoom-in-95 text-left">
                                  {availableLeaders.map(l => (
                                      <div key={l} onClick={() => toggleLeaderSelection(l)} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all">
                                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedLeaders.includes(l) ? `bg-${accentColor}-600 text-white border-${accentColor}-600` : 'border-slate-300 dark:border-slate-600'}`}>{selectedLeaders.includes(l) && <CheckSquare size={16} />}</div>
                                          <span className={`text-sm font-black uppercase tracking-tight ${selectedLeaders.includes(l) ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{l}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                       </div>
                       <div className="text-left">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic leading-none">Note Attività</label>
                          <textarea placeholder="Dettagli..." className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-[1.5rem] font-medium outline-none border border-slate-200 dark:border-slate-700 shadow-inner min-h-[140px] italic text-sm" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                       </div>
                    </div>
                  )}
                </div>
                {formError && <p className="text-red-600 text-[10px] font-black italic mt-4 uppercase tracking-widest text-center">{formError}</p>}
                <button type="submit" className={`w-full p-6 rounded-[1.5rem] font-black uppercase tracking-[0.4em] text-white shadow-2xl bg-${accentColor}-600 flex items-center justify-center gap-4 text-xs italic`}><CheckCircle2 size={22} /> Archivia nel Vault</button>
              </form>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-10 animate-in zoom-in duration-300 pb-20 text-left">
            <h2 className="text-3xl font-black italic uppercase text-slate-900 dark:text-white tracking-tighter uppercase tracking-[0.3em]">Impostazioni Vault</h2>
            <div className="bg-white dark:bg-slate-900 p-8 md:p-14 rounded-[4rem] shadow-2xl border border-slate-200 dark:border-slate-800 space-y-14 relative overflow-hidden">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-12 gap-8 relative z-10 text-left">
                  <div className="space-y-2">
                    <h3 className="font-black text-slate-900 dark:text-white italic uppercase text-sm tracking-widest leading-none">Esperienza Visiva</h3>
                    <p className="text-[11px] text-slate-400 italic font-medium tracking-tight leading-none">Interfaccia adattiva e colori accento</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-8">
                    <div className="flex gap-2.5 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
                      {Object.entries(ACCENT_COLORS).map(([key, { hex }]) => (
                        <button key={key} onClick={() => toggleAccent(key)} className={`w-9 h-9 rounded-full border-4 transition-all ${accentColor === key ? 'border-slate-900 dark:border-white scale-125' : 'border-transparent opacity-60'}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                    <button onClick={toggleTheme} className="flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase shadow-xl italic leading-none">{theme === 'light' ? <><Moon size={18}/> Dark Mode</> : <><Sun size={18}/> Light Mode</>}</button>
                  </div>
               </div>

               <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-12 gap-8 relative z-10 text-left">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-[1.5rem] transition-all shadow-xl ${reminderEnabled ? `bg-${accentColor}-600 text-white` : 'bg-slate-200 text-slate-400 dark:bg-slate-800 border opacity-50'}`}>
                      {reminderEnabled ? <Bell size={28}/> : <BellOff size={28}/>}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-black uppercase text-sm tracking-widest italic leading-none text-slate-900 dark:text-white">Reminder PWA Vault</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase italic tracking-[0.2em] leading-none">{notificationStatus === 'granted' ? 'Notifiche Native Attive' : 'Status: Non Autorizzato'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                     {reminderEnabled && (
                        <div className="flex items-center gap-3 animate-in slide-in-from-right duration-500">
                           <input type="time" className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl font-black text-xs outline-none border border-slate-100 dark:border-slate-700 dark:text-white shadow-inner" value={reminderTime} onChange={(e) => { setReminderTime(e.target.value); localStorage.setItem('reminder_time', e.target.value); }} />
                           <div className="flex gap-2">
                              <button onClick={sendTestNotification} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 rounded-xl transition-all" title="Prova Notifica"><Send size={18}/></button>
                              <button onClick={setupFCM} disabled={isSyncingPush} className={`p-4 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-500 rounded-xl transition-all ${isSyncingPush ? 'animate-spin' : ''}`} title="Sincronizza Token Push"><RefreshCw size={18}/></button>
                           </div>
                        </div>
                     )}
                     {notificationStatus !== 'granted' ? (
                       <button onClick={requestNotificationPermission} className="text-[10px] font-black uppercase bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-blue-500/30 active:scale-95 transition-all italic leading-none text-left">Abilita Notifiche Native</button>
                     ) : (
                       <button onClick={() => { setReminderEnabled(!reminderEnabled); localStorage.setItem('reminder_enabled', !reminderEnabled); }} className={`w-16 h-9 rounded-full transition-all relative border-2 ${reminderEnabled ? `bg-${accentColor}-600 border-${accentColor}-600` : 'bg-slate-300 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                         <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${reminderEnabled ? 'right-1' : 'left-1'}`}></div>
                       </button>
                     )}
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* AREA DI STAMPA NASCOSTA */}
      <div id="report-print-area" style={{ display: 'none', position: 'fixed', top: 0, left: 0, width: '210mm', padding: '20mm', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif', zIndex: -1 }}>
          <h1 style={{ textAlign: 'center' }}>Vault Report - {monthName}</h1>
          <p>Dipendente: {user?.displayName}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #ccc', padding: '10px' }}>Data</th>
                  <th style={{ border: '1px solid #ccc', padding: '10px' }}>Tipo</th>
                  <th style={{ border: '1px solid #ccc', padding: '10px' }}>Straordinario</th>
                  <th style={{ border: '1px solid #ccc', padding: '10px' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {currentMonthLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ border: '1px solid #ccc', padding: '10px' }}>{formatDateIT(log.date)}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px' }}>{log.type}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px' }}>{log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '-'}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px' }}>{log.notes}</td>
                  </tr>
                ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}