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
  Menu, Home, FileText, Settings, X, Zap, Palmtree, Thermometer, AlertTriangle, Download, Eye, ShieldAlert, Lock, LogIn, UserPlus, Key, Copy, AlertOctagon, ShieldCheck, Unlock, RefreshCw, Users, CheckSquare, Square, User, Palette, Smartphone, Share, Search, ShieldX, Coffee, Loader2, Bell, BellOff, HelpCircle, Info, Send
} from 'lucide-react';

// -----------------------------------------------------------------------------
// ISTRUZIONI PER L'USO DEL FILE JSON ESTERNO
import externalTeamLeaders from './capisquadra.json';
// -----------------------------------------------------------------------------
const fallbackForPreview = []; 
// -----------------------------------------------------------------------------


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
    console.warn("Nessun file JSON caricato. Uso fallback.");
  }
  return ['Caposquadra 1', 'Caposquadra 2', 'Caposquadra 3', 'Caposquadra 4'];
};
const ACTIVE_TEAM_LEADERS = getLeadersList();

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

  // 1. --- REGISTRAZIONE SERVICE WORKER (FONDAMENTALE PER NOTIFICHE) ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Richiamo esatto al file sw.js nella cartella public
        navigator.serviceWorker.register('/sw.js').then(reg => {
          console.log('TimeVault SW Registrato con successo');
        }).catch(err => {
          console.error('Errore registrazione SW:', err);
        });
      });
    }
  }, []);

  // 2. --- INVIO IMPOSTAZIONI AL SERVICE WORKER ---
  useEffect(() => {
    if (reminderEnabled && notificationStatus === 'granted' && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_REMINDER',
        time: reminderTime,
        enabled: reminderEnabled
      });
    }
  }, [reminderEnabled, reminderTime, notificationStatus]);

  // --- CARICAMENTO LIBRERIE PDF ---
  useEffect(() => {
    const loadPdfScripts = () => {
      if (!document.getElementById('html2canvas-lib')) {
        const s1 = document.createElement('script');
        s1.id = 'html2canvas-lib';
        s1.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        s1.async = true;
        document.body.appendChild(s1);
      }
      if (!document.getElementById('jspdf-lib')) {
        const s2 = document.createElement('script');
        s2.id = 'jspdf-lib';
        s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s2.async = true;
        document.body.appendChild(s2);
      }
    };
    loadPdfScripts();
  }, []);

  // --- INTRO TIMER ---
  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 3200); 
    return () => clearTimeout(timer);
  }, []);

  // --- THEME SYNC ---
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

  // --- USER DATA & PREFERENCES LOAD ---
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

  // --- FIREBASE SYNC LOGS ---
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

  // --- AUTOMAZIONE RIPOSO WEEKEND ---
  useEffect(() => {
    if (!user || loading || logs.length === 0) return;
    const checkWeekendAutomation = async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      if (dayOfWeek >= 1) { 
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - dayOfWeek);
        const lastSaturday = new Date(lastSunday);
        lastSaturday.setDate(lastSunday.getDate() - 1);
        const datesToCheck = [formatDateAsLocal(lastSaturday), formatDateAsLocal(lastSunday)];
        for (const dateStr of datesToCheck) {
          const exists = logs.some(l => l.date === dateStr);
          if (!exists) {
            try {
              const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
              await addDoc(logsCollection, {
                standardHours: 0, overtimeHours: 0, notes: 'Riposo', type: 'riposo',
                date: dateStr, userId: user.uid, userName: user.displayName, createdAt: serverTimestamp()
              });
            } catch (e) { console.error("Errore weekend auto:", e); }
          }
        }
      }
    };
    const timer = setTimeout(checkWeekendAutomation, 2000);
    return () => clearTimeout(timer);
  }, [user, logs, loading]);

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

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    saveSettingsToCloud(nextTheme, accentColor);
  };

  const toggleAccent = (colorKey) => {
    setAccentColor(colorKey);
    saveSettingsToCloud(theme, colorKey);
  };

  const saveSettingsToCloud = async (m, a) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'theme'), {
        mode: m, accent: a, updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  };

  const handleVerifyCode = () => {
     if (unlockCodeInput.length < 16) { setAuthError("Codice non valido."); return; }
     setAuthError(""); setRecoveryStep(2);
  };

  const handleFinalPasswordReset = () => {
    if (newResetPassword.length < 6) { setAuthError("Minimo 6 caratteri."); return; }
    setIsLocked(false); setFailedAttempts(0); setAuthError(""); setUnlockCodeInput(''); setNewResetPassword(''); setRecoveryStep(1);
    alert("Sbloccato! Ora riprova il login.");
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

  const requestDeleteLog = (id) => setLogToDelete(id);
  const confirmDelete = async () => {
    if (!logToDelete) return;
    try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', logToDelete)); setLogToDelete(null); } catch (e) { console.error(e); }
  };

  const verifyRecoveryCodeForDeletion = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteRecoveryInput.length < 16) { setDeleteError("Codice incompleto."); return; }
    setIsDeleting(true);
    try {
       const securityDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'security'));
       if (securityDoc.exists() && securityDoc.data().recoveryCode === deleteRecoveryInput) {
          setIsDeleting(false); setShowDeleteRecoveryModal(false); setShowDeleteFinalConfirm(true);
       } else { setIsDeleting(false); setDeleteError("Codice errato."); }
    } catch (e) { setIsDeleting(false); setDeleteError("Errore."); }
  };

  const confirmFinalAccountDeletion = async () => {
    setIsDeleting(true);
    try { await deleteUser(user); } catch (error) { setIsDeleting(false); alert("Errore sicurezza."); }
  };

  const handleDownloadRequest = () => {
    setShowDownloadConfirm(true);
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

  // --- MEMO STATS ---
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-500 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 z-10"></div>
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative animate-in zoom-in duration-300">
          <div className="mb-12 mt-6">
             <div className={`inline-flex p-6 bg-${accentColor}-600 rounded-[2rem] text-white mb-6 shadow-xl shadow-${accentColor}-500/30 animate-in slide-in-from-top duration-500`}><Clock size={48} /></div>
             <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none mb-2 uppercase tracking-tight">TIMEVAULT</h1>
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] italic">Personal Workplace</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className={`w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95`}><LogIn size={20} /> Accedi</button>
            <button onClick={() => { setAuthMode('register'); setShowAuthModal(true); }} className="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 p-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"><UserPlus size={20} /> Registrati</button>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-6">
            <button onClick={() => setShowGuideModal(true)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 transition-colors italic tracking-widest leading-none"><HelpCircle size={14}/> Guida WebApp</button>
          </div>
        </div>

        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border relative animate-in zoom-in-95 duration-200 border-slate-200 dark:border-slate-800">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
                {isLocked ? (
                   <div className="text-center">
                      <div className="inline-flex p-4 rounded-2xl bg-red-600 text-white mb-4 animate-bounce"><AlertOctagon size={28} /></div>
                      <h2 className="text-2xl font-black italic text-red-600 uppercase">Vault Bloccato</h2>
                      {recoveryStep === 1 ? (
                        <div className="mt-6 space-y-4">
                           <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full p-4.5 bg-red-50 dark:bg-red-900/10 text-red-900 rounded-2xl font-mono text-center font-bold outline-none border border-red-100" value={unlockCodeInput} onChange={e => setUnlockCodeInput(e.target.value.toUpperCase())} />
                           <button onClick={handleVerifyCode} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg">Verifica Codice</button>
                        </div>
                      ) : (
                        <div className="mt-6 space-y-4 animate-in slide-in-from-bottom">
                           <input type="password" placeholder="Nuova Password" className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold outline-none dark:text-white" value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} />
                           <button onClick={handleFinalPasswordReset} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg">Resetta Vault</button>
                        </div>
                      )}
                   </div>
                ) : (
                   <>
                   <div className="text-center mb-8">
                     <div className={`inline-flex p-4 rounded-2xl text-white mb-4 bg-${accentColor}-600`}><LogIn size={28} /></div>
                     <h2 className="text-2xl font-black italic uppercase text-slate-900 dark:text-white leading-none">{authMode === 'login' ? 'Bentornato' : 'Nuovo Utente'}</h2>
                   </div>
                   <form onSubmit={handleAuth} className="space-y-4">
                     <input type="text" placeholder="nome.cognome" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 border border-slate-200 dark:border-slate-700 shadow-inner" value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} />
                     <input type="password" placeholder="••••••••" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/20 border border-slate-200 dark:border-slate-700 shadow-inner" value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
                     {authError && <div className="text-red-600 text-[11px] font-black italic animate-shake leading-none mt-2">{authError}</div>}
                     <button type="submit" disabled={isSubmitting} className={`w-full text-white p-5 rounded-2xl font-black uppercase tracking-widest bg-${accentColor}-600 shadow-xl active:scale-95 transition-all shadow-${accentColor}-500/20`}>{isSubmitting ? '...' : 'Entra nel Vault'}</button>
                   </form>
                   <div className="mt-6 text-center"><button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-slate-400 font-bold text-[10px] uppercase italic tracking-[0.2em]">{authMode === 'login' ? "Registrati" : "Accedi"}</button></div>
                   </>
                )}
             </div>
          </div>
        )}

        {showRecoveryModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm border-2 border-red-500 text-center shadow-2xl animate-in zoom-in duration-300">
                 <ShieldCheck size={48} className="mx-auto mb-6 text-red-600 animate-pulse" />
                 <h2 className="text-2xl font-black italic text-red-600 uppercase mb-2 tracking-tight leading-none">Chiave Privata</h2>
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6 leading-relaxed italic">Salva questo codice in un luogo sicuro. Senza di esso non potrai recuperare il Vault o eliminare l'account.</p>
                 <div className="bg-slate-100 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6 relative shadow-inner group">
                    <p className="font-mono text-lg font-black tracking-widest break-all dark:text-white select-all leading-none">{generatedRecoveryCode}</p>
                    <button onClick={() => { navigator.clipboard.writeText(generatedRecoveryCode); alert("Codice copiato!"); }} className="absolute right-2 top-2 p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-400 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={16} /></button>
                 </div>
                 <button onClick={() => { setShowRecoveryModal(false); setUser(auth.currentUser); }} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95">Ho salvato la chiave</button>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 print:hidden transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b sticky top-0 z-40 px-6 h-20 flex items-center justify-between shadow-sm border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500"><Menu size={24} /></button>
          <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-900 shadow-lg"><Clock size={20} /></div>
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
               <button onClick={() => { setView('calendar'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${view === 'calendar' ? `bg-${accentColor}-600 text-white` : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'}`}><Home size={18} /> Diario</button>
               <button onClick={() => { setView('report'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${view === 'report' ? `bg-${accentColor}-600 text-white` : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'}`}><FileText size={18} /> Resoconto</button>
               <button onClick={() => { setView('settings'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${view === 'settings' ? `bg-${accentColor}-600 text-white` : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400'}`}><Settings size={18} /> Impostazioni</button>
               <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => { setShowGuideModal(true); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase tracking-widest text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all italic leading-none"><Smartphone size={18} /> Guida WebApp</button>
               </div>
            </div>
          )}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block"><h1 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white leading-none">TIMEVAULT</h1></div>
        <div className="relative" ref={profileDropdownRef}>
            <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-3 focus:outline-none group">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5 leading-none tracking-widest">Vault User</p>
                <p className={`text-sm font-black text-${accentColor}-600 uppercase italic leading-none transition-all group-hover:scale-105`}>{user?.displayName}</p>
              </div>
              <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 shadow-sm transition-all group-hover:border-blue-500"><User size={22} className="text-slate-500"/></div>
            </button>
            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-3 animate-in fade-in slide-in-from-top-2">
                 <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all italic leading-none"><LogOut size={18} /> Chiudi Vault</button>
              </div>
            )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-12 pb-32">
        {view === 'calendar' && (
          <div className="space-y-10 animate-in fade-in zoom-in duration-300">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all group overflow-hidden relative">
                <div className={`absolute top-0 right-0 p-6 opacity-5 text-${accentColor}-600 group-hover:scale-125 transition-transform`}><CalendarIcon size={80}/></div>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 italic leading-none">Giornate Lavorate</p>
                <p className="text-4xl font-black dark:text-white leading-none tracking-tighter">{monthlyStats.daysWorked}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-5 text-orange-600 group-hover:scale-125 transition-transform"><Zap size={80}/></div>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 italic leading-none">Extra del Mese</p>
                <p className="text-4xl font-black text-orange-600 leading-none tracking-tighter">+{monthlyStats.ext}<span className="text-lg font-bold ml-1 italic leading-none">h</span></p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 overflow-hidden animate-in slide-in-from-bottom duration-500 relative">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-6 relative z-10">
                <h2 className="text-3xl font-black capitalize italic text-slate-900 dark:text-white tracking-tighter leading-none">{monthName}</h2>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl gap-1 border border-slate-200 dark:border-slate-700 shadow-inner">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-500 shadow-sm active:scale-90"><ChevronLeft size={22}/></button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 italic transition-colors leading-none">Oggi</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-500 shadow-sm active:scale-90"><ChevronRight size={22}/></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 mb-6 relative z-10">
                 {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (<div key={day} className="text-center text-[10px] font-black uppercase text-slate-400 py-3 tracking-[0.3em] italic leading-none">{day}</div>))}
              </div>

              <div className="grid grid-cols-7 gap-4 md:gap-6 relative z-10">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDateAsLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
                  const logsForDay = logs.filter(l => l.date === dateStr);
                  const active = logsForDay.length > 0;
                  const isToday = formatDateAsLocal(new Date()) === dateStr;
                  const logType = active ? logsForDay[0].type : null;
                  
                  return (
                    <button key={day} onClick={() => { setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)); setView('day'); }} className={`aspect-square rounded-[1.5rem] md:rounded-[2rem] flex flex-col items-center justify-center relative transition-all group ${active ? `bg-${accentColor}-600 text-white shadow-xl shadow-${accentColor}-500/20 scale-100` : isToday ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-105 active:scale-95 shadow-inner'}`}>
                      <span className={`text-xl font-black tracking-tighter leading-none ${isToday && !active ? 'text-blue-600 dark:text-blue-400 underline underline-offset-4 decoration-2' : ''}`}>{day}</span>
                      {active && <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-white opacity-80 animate-pulse"></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'day' && (
          <div className="space-y-8 animate-in slide-in-from-right duration-300">
            <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] mb-4 hover:text-slate-900 dark:hover:text-white transition-colors italic leading-none"><ArrowLeft size={16} /> Torna al diario</button>
            <div className="flex items-center justify-between">
               <h2 className="text-4xl font-black italic capitalize text-slate-900 dark:text-white tracking-tighter leading-none">{selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
               {isWeekend && <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest italic leading-none">Weekend</div>}
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
              <div className={`absolute top-0 left-0 h-full w-2 bg-${accentColor}-600`}></div>
              <h3 className="text-[11px] font-black mb-10 uppercase text-slate-400 tracking-[0.3em] italic leading-none border-l-4 border-blue-500 pl-4">Registrazione Attività</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                 {!isWeekend && (
                   <>
                     <button type="button" onClick={() => setFormData(p => ({ ...p, standardHours: STANDARD_HOURS_VALUE, type: 'work' }))} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'work' && formData.standardHours === STANDARD_HOURS_VALUE ? `bg-${accentColor}-600 text-white shadow-xl scale-105 shadow-${accentColor}-500/20` : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800'}`}><Briefcase size={24} />Standard</button>
                     <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Ferie', type: 'ferie' })} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'ferie' ? 'bg-emerald-500 text-white shadow-xl scale-105 shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800'}`}><Palmtree size={24} />Ferie</button>
                   </>
                 )}
                 <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Malattia', type: 'malattia' })} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'malattia' ? 'bg-pink-500 text-white shadow-xl scale-105 shadow-pink-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800'}`}><Thermometer size={24} />Malattia</button>
                 <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Riposo Compensativo', type: 'riposo_compensativo' })} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${formData.type === 'riposo_compensativo' ? 'bg-indigo-500 text-white shadow-xl scale-105 shadow-indigo-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800'}`}><Coffee size={24} />Riposo Comp.</button>
                 <button type="button" onClick={() => setShowOvertimeInput(!showOvertimeInput)} className={`p-5 rounded-3xl font-black uppercase text-[9px] flex flex-col items-center gap-3 transition-all ${showOvertimeInput ? 'bg-orange-500 text-white shadow-xl scale-105 shadow-orange-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-800'}`}><Zap size={24} />Straordinario</button>
              </div>

              <form onSubmit={handleSubmitLog} className="space-y-8 animate-in fade-in duration-300 relative z-10">
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
                       <div ref={leaderDropdownRef} className="relative">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic leading-none">Responsabile</label>
                          <div onClick={() => setIsLeaderDropdownOpen(!isLeaderDropdownOpen)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-[1.5rem] font-bold border border-slate-200 dark:border-slate-700 cursor-pointer flex justify-between items-center transition-all hover:border-blue-500 shadow-inner">
                              <span className="truncate uppercase text-xs tracking-tight">{selectedLeaders.length === 0 ? "Nessuno selezionato" : selectedLeaders.join(', ')}</span>
                              <ChevronDown size={18} className={`transition-transform duration-300 ${isLeaderDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>
                          {isLeaderDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-[2rem] shadow-2xl z-[60] p-3 max-h-60 overflow-y-auto animate-in zoom-in-95">
                                  {availableLeaders.map(l => (
                                      <div key={l} onClick={() => toggleLeaderSelection(l)} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all">
                                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedLeaders.includes(l) ? `bg-${accentColor}-600 text-white border-${accentColor}-600 shadow-lg shadow-${accentColor}-500/20` : 'border-slate-300 dark:border-slate-600'}`}>{selectedLeaders.includes(l) && <CheckSquare size={16} />}</div>
                                          <span className={`text-sm font-black uppercase tracking-tight ${selectedLeaders.includes(l) ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{l}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                       </div>
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 italic leading-none">Note Attività</label>
                          <textarea placeholder="Dettagli..." className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-[1.5rem] font-medium outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 shadow-inner min-h-[140px] italic text-sm" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                       </div>
                    </div>
                  )}
                </div>
                {formError && <p className="text-red-600 text-[10px] font-black italic animate-bounce leading-none mt-4 uppercase tracking-widest">{formError}</p>}
                <button type="submit" className={`w-full p-6 rounded-[1.5rem] font-black uppercase tracking-[0.4em] text-white shadow-2xl bg-${accentColor}-600 shadow-${accentColor}-500/40 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-4 text-xs italic leading-none`}><CheckCircle2 size={22} /> Archivia nel Vault</button>
              </form>
            </div>

            <div className="space-y-6">
               {logs.filter(l => l.date === formatDateAsLocal(selectedDate)).map(log => (
                 <div key={log.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between shadow-lg animate-in slide-in-from-right relative group overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full w-2 bg-${accentColor}-600`}></div>
                    <div className="space-y-4">
                       <div className="flex flex-wrap items-center gap-3">
                          <span className={`text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl italic tracking-[0.2em] text-slate-500 leading-none`}>{log.type.replace('_', ' ')}</span>
                          <span className="text-3xl font-black dark:text-white leading-none tracking-tighter">{log.standardHours > 0 ? log.standardHours + 'h' : ''}</span>
                          {log.overtimeHours > 0 && <span className="text-sm font-black text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-xl leading-none">+{log.overtimeHours}h Extra</span>}
                       </div>
                       {log.teamLeader && <p className={`text-[10px] font-black text-${accentColor}-500 uppercase tracking-[0.2em] flex items-center gap-2 italic leading-none`}><Users size={14}/> {log.teamLeader}</p>}
                       {log.notes && <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic border-l-2 border-slate-100 dark:border-slate-800 pl-4 py-1 leading-relaxed">{log.notes}</p>}
                    </div>
                    <div className="flex justify-end mt-6 sm:mt-0">
                       <button onClick={() => requestDeleteLog(log.id)} className="p-4 text-slate-200 hover:text-red-500 rounded-2xl transition-all hover:bg-red-50 dark:hover:bg-red-900/10"><Trash2 size={20} /></button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="space-y-10 animate-in zoom-in duration-300">
             <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                 <h2 className="text-3xl font-black italic uppercase text-slate-900 dark:text-white tracking-tighter leading-none">Resoconto Mese</h2>
                 <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-6 py-3 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm border-slate-100">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-all active:scale-90"><ChevronLeft size={22} /></button>
                    <p className="text-sm font-black min-w-[150px] text-center capitalize italic tracking-tighter leading-none">{monthName}</p>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-all active:scale-90"><ChevronRight size={22} /></button>
                 </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden">
                 <div className={`absolute top-0 left-0 w-2 h-full bg-${accentColor}-600`}></div>
                 <div className="grid grid-cols-2 gap-12 mb-14">
                    <div className="animate-in slide-in-from-left duration-500">
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 italic leading-none">Presenze</p>
                       <p className="text-7xl font-black dark:text-white tracking-tighter leading-none">{monthlyStats.daysWorked}</p>
                    </div>
                    <div className="animate-in slide-in-from-right duration-500">
                       <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 italic leading-none">Extra</p>
                       <p className="text-7xl font-black text-orange-600 tracking-tighter leading-none">{monthlyStats.ext}<span className="text-2xl font-black ml-1 italic leading-none">h</span></p>
                    </div>
                 </div>

                 <div className="relative mb-10 group">
                    <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" placeholder="Filtra tra note, date o responsabili..." className="w-full pl-16 pr-6 py-6 bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] font-bold outline-none italic text-sm shadow-inner dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300" value={reportSearchQuery} onChange={(e) => setReportSearchQuery(e.target.value)} />
                 </div>

                 <div className="space-y-5 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar text-left p-2">
                    {filteredMonthLogs.map(log => (
                         <div key={log.id} className={`bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border-2 transition-all cursor-pointer hover:bg-white dark:hover:bg-slate-800 shadow-sm ${expandedLogId === log.id ? `ring-4 ring-${accentColor}-500/10 border-blue-500/30 scale-[1.02] bg-white dark:bg-slate-800` : 'border-transparent'}`} onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}>
                            <div className="p-6 md:p-8 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black bg-white dark:bg-slate-700 border-2 shadow-sm ${expandedLogId === log.id ? `border-${accentColor}-500 text-${accentColor}-500 rotate-12 scale-110` : 'border-slate-100 dark:border-slate-600'}`}>{new Date(log.date).getDate()}</div>
                                   <div>
                                      <p className={`text-[10px] font-black uppercase text-slate-400 mb-1 tracking-[0.3em] italic leading-none`}>{log.type.replace('_', ' ')}</p>
                                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 leading-none">Giorno {new Date(log.date).getDate()}</h3>
                                   </div>
                                </div>
                                <div className="text-right flex items-center gap-6">
                                   <p className={`text-base font-black tracking-tight leading-none ${log.overtimeHours > 0 ? 'text-orange-500' : 'text-slate-300 dark:text-slate-700'}`}>{log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '- Extra'}</p>
                                   <ChevronDown size={22} className={`text-slate-200 transition-transform duration-500 ${expandedLogId === log.id ? 'rotate-180 text-blue-500' : ''}`} />
                                </div>
                            </div>
                            {expandedLogId === log.id && (
                                <div className="px-8 pb-10 pt-4 border-t border-slate-100 dark:border-slate-700/50 animate-in slide-in-from-top-4 duration-500">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                       <div className="space-y-3">
                                          <p className={`text-[10px] font-black text-${accentColor}-500 uppercase tracking-[0.2em] italic flex items-center gap-2 leading-none`}><Users size={16}/> Responsabile</p>
                                          <p className="text-sm font-black pl-6 italic dark:text-slate-300 tracking-tight leading-none">{log.teamLeader || "N/A"}</p>
                                       </div>
                                       <div className="space-y-3">
                                          <p className={`text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic flex items-center gap-2 leading-none`}><FileText size={16}/> Note Diario</p>
                                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 pl-6 italic leading-relaxed">{log.notes || "Nessun dettaglio."}</p>
                                       </div>
                                    </div>
                                </div>
                            )}
                         </div>
                    ))}
                 </div>

                 <button onClick={handleDownloadRequest} className={`mt-12 w-full p-6 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.5em] flex items-center justify-center gap-4 bg-slate-900 dark:bg-${accentColor}-600 transition-all hover:scale-[1.01] active:scale-95 shadow-2xl shadow-blue-500/30 leading-none italic group`}><Download size={22} className="group-hover:translate-y-1 transition-transform" /> Genera Vault Report PDF</button>
             </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-10 animate-in zoom-in duration-300 pb-20">
            <h2 className="text-3xl font-black italic uppercase text-slate-900 dark:text-white tracking-tighter leading-none uppercase tracking-[0.3em]">Impostazioni Vault</h2>
            <div className="bg-white dark:bg-slate-900 p-8 md:p-14 rounded-[4rem] shadow-2xl border border-slate-200 dark:border-slate-800 space-y-14 relative overflow-hidden">
               <div className={`absolute top-0 right-0 p-12 opacity-5 text-slate-400 dark:text-slate-800 pointer-events-none rotate-12`}><Settings size={200}/></div>
               
               <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-12 gap-8 relative z-10">
                  <div className="space-y-2">
                    <h3 className="font-black text-slate-900 dark:text-white italic uppercase text-sm tracking-widest leading-none">Esperienza Visiva</h3>
                    <p className="text-[11px] text-slate-400 italic font-medium tracking-tight leading-none">Interfaccia adattiva e colori accento</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-8">
                    <div className="flex gap-2.5 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
                      {Object.entries(ACCENT_COLORS).map(([key, { hex }]) => (
                        <button key={key} onClick={() => toggleAccent(key)} className={`w-9 h-9 rounded-full border-4 transition-all ${accentColor === key ? 'border-slate-900 dark:border-white scale-125 shadow-xl rotate-12' : 'border-transparent hover:scale-110 opacity-60 hover:opacity-100'}`} style={{ backgroundColor: hex }} />
                      ))}
                    </div>
                    <button onClick={toggleTheme} className="flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 italic leading-none">{theme === 'light' ? <><Moon size={18}/> Dark Mode</> : <><Sun size={18}/> Light Mode</>}</button>
                  </div>
               </div>

               <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-12 gap-8 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-[1.5rem] transition-all shadow-xl ${reminderEnabled ? `bg-${accentColor}-600 text-white shadow-${accentColor}-500/30 scale-110` : 'bg-slate-200 text-slate-400 dark:bg-slate-800 border opacity-50'}`}>
                      {reminderEnabled ? <Bell size={28} className="animate-ring"/> : <BellOff size={28}/>}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-black uppercase text-sm tracking-widest italic leading-none text-slate-900 dark:text-white">Reminder PWA Vault</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase italic tracking-[0.2em] leading-none">{notificationStatus === 'granted' ? 'Notifiche Native Attive' : 'Status: Non Autorizzato'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                     {reminderEnabled && (
                        <div className="animate-in slide-in-from-right duration-500 flex items-center gap-3">
                           <input type="time" className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl font-black text-xs outline-none border border-slate-100 dark:border-slate-700 dark:text-white shadow-inner" value={reminderTime} onChange={(e) => { setReminderTime(e.target.value); localStorage.setItem('reminder_time', e.target.value); }} />
                           <button onClick={sendTestNotification} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 rounded-xl transition-all active:scale-90" title="Prova Notifica"><Send size={18}/></button>
                        </div>
                     )}
                     {notificationStatus !== 'granted' ? (
                       <button onClick={requestNotificationPermission} className="text-[10px] font-black uppercase bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-blue-500/30 active:scale-95 transition-all tracking-[0.2em] italic leading-none">Abilita Notifiche Native</button>
                     ) : (
                       <button onClick={() => { setReminderEnabled(!reminderEnabled); localStorage.setItem('reminder_enabled', !reminderEnabled); }} className={`w-16 h-9 rounded-full transition-all relative border-2 ${reminderEnabled ? `bg-${accentColor}-600 border-${accentColor}-600 shadow-lg` : 'bg-slate-300 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                         <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${reminderEnabled ? 'right-1' : 'left-1'}`}></div>
                       </button>
                     )}
                  </div>
               </div>

               <div className="pt-6 relative z-10">
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-10 md:p-14 rounded-[3rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 text-red-600 group-hover:scale-125 transition-transform duration-700"><ShieldAlert size={140}/></div>
                    <div className="relative z-10">
                       <h3 className="font-black text-red-600 dark:text-red-500 mb-3 flex items-center gap-4 uppercase text-sm tracking-[0.3em] italic leading-none"><AlertTriangle size={24} className="animate-pulse"/> Area Sotto Protocollo</h3>
                       <p className="text-[10px] font-bold text-red-400 dark:text-red-700/80 mb-10 italic uppercase tracking-[0.2em] leading-relaxed max-w-sm">Attenzione: l'eliminazione dell'account rimuoverà tutti i tuoi dati e i tuoi registri in modo definitivo dal server.</p>
                       <button onClick={() => { setShowDeleteRecoveryModal(true); setDeleteRecoveryInput(''); setDeleteError(''); }} className="flex items-center gap-4 px-10 py-5 bg-red-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-2xl active:scale-95 leading-none italic"><ShieldX size={18}/> Formatta Vault Privato</button>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto p-16 text-center border-t border-slate-100 dark:border-slate-900">
         <div className="flex items-center justify-center gap-6 mb-6 opacity-20 dark:opacity-10 grayscale group">
            <Clock size={24} className="group-hover:rotate-45 transition-transform duration-500" />
            <div className="h-6 w-0.5 bg-slate-400"></div>
            <p className="text-[11px] font-black uppercase tracking-[1.2em] leading-none">TIMEVAULT</p>
         </div>
         <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.6em] italic leading-none">Pro Edition v0.9.8 • Personal Vault System • 2024</p>
      </footer>
    </div>

    {/* AREA DI STAMPA NASCOSTA - CRITICA PER IL FUNZIONAMENTO DEL REPORT */}
    <div id="report-print-area" style={{ display: 'none', position: 'fixed', top: 0, left: 0, width: '210mm', padding: '20mm', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif', zIndex: -1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '6px solid #000', paddingBottom: '25px', marginBottom: '45px' }}>
           <div>
              <h1 style={{ fontSize: '42px', fontWeight: 900, fontStyle: 'italic', margin: 0, letterSpacing: '-4px', lineHeight: 1 }}>TIMEVAULT REPORT</h1>
              <p style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', margin: '10px 0 0 0', color: '#666', letterSpacing: '4px' }}>Resoconto Personale Ore Lavorative</p>
           </div>
           <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '28px', fontWeight: 900, margin: 0, textTransform: 'capitalize', fontStyle: 'italic', lineHeight: 1 }}>{monthName}</p>
              <p style={{ fontSize: '15px', fontWeight: 900, margin: '10px 0 0 0', textTransform: 'uppercase', color: '#000' }}>Dipendente: {user?.displayName}</p>
           </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '35px', marginBottom: '45px' }}>
           <div style={{ padding: '30px', border: '4px solid #f8f8f8', borderRadius: '30px', backgroundColor: '#fafafa', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 12px 0', color: '#aaa', letterSpacing: '2px' }}>Presenze Totali</p>
              <p style={{ fontSize: '48px', fontWeight: 900, margin: 0, lineHeight: 1 }}>{monthlyStats.daysWorked}</p>
           </div>
           <div style={{ padding: '30px', border: '4px solid #f8f8f8', borderRadius: '30px', backgroundColor: '#fafafa', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 12px 0', color: '#aaa', letterSpacing: '2px' }}>Straordinari Totali</p>
              <p style={{ fontSize: '48px', fontWeight: 900, margin: 0, color: '#f97316', lineHeight: 1 }}>+{monthlyStats.ext}h</p>
           </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
           <thead>
              <tr style={{ borderBottom: '4px solid #000', backgroundColor: '#000', color: '#fff' }}>
                 <th style={{ padding: '18px 15px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '1px' }}>Data</th>
                 <th style={{ padding: '18px 15px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '1px' }}>Tipo Attività</th>
                 <th style={{ padding: '18px 15px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '1px' }}>Dettagli / Responsabile</th>
                 <th style={{ padding: '18px 15px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'right', letterSpacing: '1px' }}>Ore Extra</th>
              </tr>
           </thead>
           <tbody>
              {currentMonthLogs.map(log => (
                 <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '18px 15px', fontSize: '14px', fontWeight: 900 }}>{formatDateIT(log.date)}</td>
                    <td style={{ padding: '18px 15px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: log.type === 'work' ? '#000' : '#888' }}>{log.type.replace('_', ' ')}</td>
                    <td style={{ padding: '18px 15px', fontSize: '13px', fontWeight: 700 }}>
                       <div style={{ fontWeight: 900, marginBottom: '5px' }}>{log.teamLeader || '-'}</div>
                       <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#777', fontWeight: 500 }}>{log.notes}</div>
                    </td>
                    <td style={{ padding: '18px 15px', fontSize: '16px', fontWeight: 900, textAlign: 'right', color: '#f97316' }}>{log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '—'}</td>
                 </tr>
              ))}
           </tbody>
        </table>
        <div style={{ marginTop: '100px', borderTop: '3px solid #000', paddingTop: '40px', textAlign: 'center' }}>
           <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '10px', fontStyle: 'italic' }}>TIMBRO E FIRMA</div>
           <div style={{ height: '60px', width: '200px', borderBottom: '1px solid #ccc', margin: '0 auto 20px' }}></div>
           <p style={{ fontSize: '11px', color: '#aaa', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '6px' }}>Vault Security Protocol Enabled • Official Report • {new Date().toLocaleDateString('it-IT')}</p>
        </div>
    </div>

    {/* MODAL DOWNLOAD */}
    {showDownloadConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] shadow-2xl max-w-sm w-full text-center border-4 border-slate-50 dark:border-slate-800 animate-in zoom-in-95">
            <div className={`w-24 h-24 bg-${accentColor}-100 dark:bg-${accentColor}-900/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-${accentColor}-600 shadow-xl transition-transform hover:rotate-12`}><Download size={40} className="animate-bounce" /></div>
            <h3 className="text-xl font-black mb-4 uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Generare Report?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-12 font-medium italic leading-relaxed uppercase tracking-widest leading-none">Il Vault elaborerà un PDF professionale ottimizzato per la visualizzazione mobile.</p>
            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => setShowDownloadConfirm(false)} className="p-6 bg-slate-100 dark:bg-slate-800 rounded-3xl font-black text-[10px] uppercase text-slate-400 tracking-widest transition-all active:scale-95 leading-none">Annulla</button>
              <button onClick={confirmDownload} disabled={isGeneratingPDF} className={`p-6 text-white rounded-3xl font-black text-[10px] uppercase shadow-2xl bg-${accentColor}-600 flex items-center justify-center gap-3 active:scale-95 transition-all tracking-[0.2em] leading-none italic`}>
                 {isGeneratingPDF ? <><Loader2 className="animate-spin" size={18} /> ...</> : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
    )}

    {/* MODAL ELIMINAZIONE ACCOUNT CON CHIAVE */}
    {showDeleteRecoveryModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-2xl z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 p-12 md:p-14 rounded-[4rem] w-full max-w-sm border-4 border-red-500 relative animate-in zoom-in-95 text-center shadow-2xl shadow-red-500/20">
              <button onClick={() => setShowDeleteRecoveryModal(false)} className="absolute top-10 right-10 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-all hover:rotate-90 active:scale-90"><X size={24}/></button>
              <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse text-red-600 shadow-xl shadow-red-500/10"><Key size={48}/></div>
              <h2 className="text-3xl font-black text-red-600 uppercase mb-4 italic tracking-tighter leading-none dark:text-white">Formattazione</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black mt-2 italic mb-10 uppercase tracking-[0.2em] leading-relaxed leading-none">Inserisci la tua Chiave Privata di 16 cifre per autorizzare la distruzione totale dei dati.</p>
              <form onSubmit={verifyRecoveryCodeForDeletion} className="space-y-8">
                 <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-slate-100 dark:border-slate-700 rounded-3xl font-mono text-center font-black outline-none uppercase tracking-[0.2em] shadow-inner focus:ring-4 focus:ring-red-500/10 transition-all" value={deleteRecoveryInput} onChange={e => setDeleteRecoveryInput(e.target.value.toUpperCase())} maxLength={19} />
                 {deleteError && <p className="text-red-500 text-[11px] font-black italic animate-shake leading-none uppercase tracking-widest">{deleteError}</p>}
                 <button type="submit" disabled={isDeleting} className="w-full bg-red-600 text-white p-6 rounded-[2rem] font-black uppercase shadow-2xl active:scale-95 transition-all tracking-[0.3em] shadow-red-500/40 text-xs italic">{isDeleting ? "Wiping Data..." : "Autorizza Wiping"}</button>
              </form>
           </div>
        </div>
    )}

    {showDeleteFinalConfirm && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[130] flex items-center justify-center p-4 animate-in fade-in duration-700">
           <div className="text-center text-white animate-in zoom-in-95 duration-500 px-6">
              <ShieldAlert size={100} className="mx-auto mb-10 text-red-600 animate-bounce" />
              <h2 className="text-5xl md:text-6xl font-black uppercase italic mb-8 tracking-tighter leading-none">ADDIO VAULT?</h2>
              <p className="text-slate-500 mb-14 max-w-sm mx-auto italic font-black leading-relaxed uppercase tracking-[0.2em] text-[10px]">Il tuo spazio privato, ogni log di lavoro e le preferenze verranno vaporizzate. Azione irreversibile e definitiva.</p>
              <div className="space-y-8 flex flex-col items-center w-full max-w-xs mx-auto">
                 <button onClick={confirmFinalAccountDeletion} className="w-full max-w-xs bg-red-600 p-7 rounded-3xl font-black uppercase tracking-[0.4em] shadow-2xl shadow-red-600/40 hover:bg-red-700 active:scale-95 transition-all text-sm italic">Sì, Distruggi Tutto</button>
                 <button onClick={() => setShowDeleteFinalConfirm(false)} className="text-slate-600 font-black uppercase tracking-[0.4em] hover:text-white transition-all text-[10px] active:scale-90 italic">Annulla, Torna Indietro</button>
              </div>
           </div>
        </div>
    )}

    {showGuideModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[150] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-slate-900 p-10 md:p-14 rounded-[4rem] w-full max-w-md shadow-2xl border-4 border-slate-50 dark:border-slate-800 relative overflow-y-auto max-h-[90vh] animate-in zoom-in-95">
            <button onClick={() => setShowGuideModal(false)} className="absolute top-10 right-10 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all active:scale-90 hover:rotate-90"><X size={24} /></button>
            <div className="text-center mb-12 relative">
                <div className={`inline-flex p-6 rounded-[2rem] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-8 shadow-2xl shadow-blue-500/10 transition-transform hover:scale-110`}><Smartphone size={44} /></div>
                <h2 className="text-3xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-4">TIMEVAULT MOBILE</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none">Aggiungi alla Home Screen</p>
            </div>
            <div className="space-y-10">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 transition-all hover:shadow-xl group relative overflow-hidden">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-4 mb-6 uppercase italic text-xs tracking-[0.3em] relative z-10"><span className="text-3xl not-italic group-hover:animate-bounce"></span> iOS (iPhone)</h3>
                 <ol className="text-[11px] text-slate-600 dark:text-slate-300 space-y-5 list-decimal list-inside font-bold italic leading-relaxed uppercase tracking-tight relative z-10 leading-none">
                    <li>Apri <span className="text-blue-500">Safari</span>.</li>
                    <li>Tocca il tasto <span className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-xl text-[10px] shadow-sm">Condividi</span>.</li>
                    <li>Seleziona <span className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-xl text-[10px] shadow-sm">Aggiungi alla Home</span>.</li>
                 </ol>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 transition-all hover:shadow-xl group relative overflow-hidden">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-4 mb-6 uppercase italic text-xs tracking-[0.3em] relative z-10"><span className="text-2xl not-italic group-hover:animate-bounce">🤖</span> Android</h3>
                 <ol className="text-[11px] text-slate-600 dark:text-slate-300 space-y-5 list-decimal list-inside font-bold italic leading-relaxed uppercase tracking-tight relative z-10 leading-none">
                    <li>Apri <span className="text-orange-500">Chrome</span>.</li>
                    <li>Tocca i <span className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-xl text-[10px] shadow-sm">Tre Puntini</span>.</li>
                    <li>Seleziona <span className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-xl text-[10px] shadow-sm">Installa App</span>.</li>
                 </ol>
              </div>
            </div>
            <button onClick={() => setShowGuideModal(false)} className={`w-full mt-12 bg-slate-950 dark:bg-${accentColor}-600 text-white p-7 rounded-[2.5rem] font-black uppercase tracking-[0.5em] shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs italic leading-none`}>Confermo Procedura</button>
          </div>
        </div>
    )}

    {logToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl max-w-sm w-full border-4 border-slate-50 dark:border-slate-800 text-center animate-in zoom-in-95">
            <Trash2 size={48} className="mx-auto mb-6 text-red-500 animate-bounce" />
            <h3 className="text-2xl font-black mb-4 uppercase italic text-slate-900 dark:text-white tracking-tighter leading-none">Cancellare Log?</h3>
            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => setLogToDelete(null)} className="p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-[10px] uppercase text-slate-500 tracking-widest active:scale-95 transition-all">No</button>
              <button onClick={confirmDelete} className="p-5 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all tracking-widest shadow-red-500/20">Sì, Elimina</button>
            </div>
          </div>
        </div>
    )}
    </>
  );
}