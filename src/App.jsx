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
  Menu, Home, FileText, Settings, X, Zap, Palmtree, Thermometer, AlertTriangle, Download, Eye, ShieldAlert, Lock, LogIn, UserPlus, Key, Copy, AlertOctagon, ShieldCheck, Unlock, RefreshCw, Users, CheckSquare, Square, User, Palette, Smartphone, Share, Search, ShieldX, Coffee, Loader2, Bell, BellOff
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
    console.warn("Nessun file JSON caricato o array vuoto. Uso fallback.");
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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
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
  const [formData, setFormData] = useState({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
  const [showOvertimeInput, setShowOvertimeInput] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false); 

  // --- STATI REMINDER (INTEGRAZIONE) ---
  const [reminderEnabled, setReminderEnabled] = useState(() => localStorage.getItem('reminder_enabled') === 'true');
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem('reminder_time') || "18:00");
  const [notificationStatus, setNotificationStatus] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');

  // --- REGISTRAZIONE SERVICE WORKER ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => console.log('SW pronto')).catch(err => console.log('SW errore', err));
      });
    }
  }, []);

  // --- COMUNICAZIONE SETTAGGI AL SW ---
  useEffect(() => {
    if (reminderEnabled && notificationStatus === 'granted' && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_REMINDER',
        time: reminderTime,
        enabled: reminderEnabled
      });
    }
  }, [reminderEnabled, reminderTime, notificationStatus]);

  // --- CARICAMENTO LIBRERIE PDF (FIX MOBILE) ---
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
    const unsubscribe = onSnapshot(logsCollection, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      },
      (error) => console.error("Firestore Error:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // --- LOGICA AUTOMAZIONE RIPOSO WEEKEND ---
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
        } else {
           setAuthError("Errore durante la registrazione.");
        }
    } finally { setIsSubmitting(false); }
  };

  const handleVerifyCode = () => {
     if (unlockCodeInput.length < 16) { setAuthError("Codice non valido."); return; }
     setAuthError(""); setRecoveryStep(2);
  };
  const handleFinalPasswordReset = () => {
    if (newResetPassword.length < 6) { setAuthError("Minimo 6 caratteri."); return; }
    setIsLocked(false); setFailedAttempts(0); setAuthError(""); setUnlockCodeInput(''); setNewResetPassword(''); setRecoveryStep(1);
    alert("Password reimpostata!");
  };

  const toggleLeaderSelection = (leaderName) => {
    setSelectedLeaders(prev => prev.includes(leaderName) ? prev.filter(n => n !== leaderName) : [...prev, leaderName]);
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');
    const dateString = formatDateAsLocal(selectedDate);
    if (logs.some(l => l.date === dateString)) { setFormError("Record esistente!"); return; }
    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      await addDoc(logsCollection, { ...formData, standardHours: Number(formData.standardHours) || 0, overtimeHours: Number(formData.overtimeHours) || 0, teamLeader: selectedLeaders.join(', '), date: dateString, userId: user.uid, userName: user.displayName, createdAt: serverTimestamp() });
      setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
      setSelectedLeaders([]); setShowOvertimeInput(false); setShowNotesInput(false);
    } catch (e) { console.error(e); }
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

  const handleDownloadRequest = () => setShowDownloadConfirm(true);
  
  const confirmDownload = async () => {
    if (!window.html2canvas || !window.jspdf) {
      alert("Risorse in caricamento...");
      return;
    }
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
      pdf.save(`Report_${monthName.replace(' ', '_')}.pdf`);
      setShowDownloadConfirm(false);
    } catch (err) { alert("Errore download PDF."); } finally {
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
    const day = selectedDate.getDay();
    return day === 0 || day === 6; 
  }, [selectedDate]);

  if (showIntro) return <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-8 animate-in fade-in"><Clock size={80} className={`text-${accentColor}-600 animate-pulse`} /><h1 className="text-6xl font-black italic tracking-tighter text-white uppercase mt-10">TIMEVAULT</h1></div>;
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-blue-500 font-bold uppercase tracking-widest italic animate-pulse">Caricamento...</div>;

  if (!user || showRecoveryModal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 relative">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in">
          <div className="flex justify-end mb-4 absolute top-6 right-6">
             <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"><Moon size={20} /></button>
          </div>
          <div className="mb-12 mt-6">
             <div className={`inline-flex p-6 bg-${accentColor}-600 rounded-[2rem] text-white mb-6 shadow-xl`}><Clock size={48} /></div>
             <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none mb-2 uppercase">TIMEVAULT</h1>
          </div>
          <div className="space-y-4">
            <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><LogIn size={20} /> Accedi</button>
            <button onClick={() => { setAuthMode('register'); setShowAuthModal(true); }} className="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 p-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3"><UserPlus size={20} /> Registrati</button>
          </div>
        </div>

        {showRecoveryModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm border-2 border-red-500 text-center animate-in zoom-in">
                 <ShieldCheck size={48} className="mx-auto mb-6 text-red-600 animate-pulse" />
                 <h2 className="text-2xl font-black italic text-red-600 uppercase mb-2">Sicurezza</h2>
                 <p className="text-xs text-slate-500 mb-6 font-medium">Salva questo codice di recupero.</p>
                 <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 relative">
                    <p className="font-mono text-lg font-black tracking-widest break-all">{generatedRecoveryCode}</p>
                    <button onClick={() => { navigator.clipboard.writeText(generatedRecoveryCode); alert("Copiato!"); }} className="absolute right-2 top-2 p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-400"><Copy size={16} /></button>
                 </div>
                 <button onClick={() => { setShowRecoveryModal(false); setUser(auth.currentUser); }} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest">Ho salvato</button>
              </div>
           </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border relative">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 p-2 rounded-full text-slate-400"><X size={20} /></button>
                {isLocked ? (
                   <div className="text-center">
                      <div className="inline-flex p-4 rounded-2xl bg-red-600 text-white mb-4 animate-bounce"><AlertOctagon size={28} /></div>
                      <h2 className="text-2xl font-black italic text-red-600 uppercase">Account Bloccato</h2>
                      {recoveryStep === 1 ? (
                        <div className="mt-6 space-y-4">
                           <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full p-4.5 bg-red-50 dark:bg-red-900/10 text-red-900 rounded-2xl font-mono text-center font-bold outline-none" value={unlockCodeInput} onChange={e => setUnlockCodeInput(e.target.value.toUpperCase())} />
                           <button onClick={handleVerifyCode} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase">Verifica Codice</button>
                        </div>
                      ) : (
                        <div className="mt-6 space-y-4">
                           <input type="password" placeholder="Nuova Password" className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold outline-none" value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} />
                           <button onClick={handleFinalPasswordReset} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase">Resetta</button>
                        </div>
                      )}
                   </div>
                ) : (
                   <>
                   <div className="text-center mb-8">
                     <div className={`inline-flex p-4 rounded-2xl text-white mb-4 bg-${accentColor}-600`}><LogIn size={28} /></div>
                     <h2 className="text-2xl font-black italic uppercase">{authMode === 'login' ? 'Bentornato' : 'Nuovo Utente'}</h2>
                   </div>
                   <form onSubmit={handleAuth} className="space-y-4">
                     <input type="text" placeholder="nome.cognome" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none" value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} />
                     <input type="password" placeholder="••••••••" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none" value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
                     {authError && <div className="text-red-600 text-[11px] font-black italic">{authError}</div>}
                     <button type="submit" disabled={isSubmitting} className={`w-full text-white p-5 rounded-2xl font-black uppercase tracking-widest bg-${accentColor}-600`}>{isSubmitting ? '...' : 'Conferma'}</button>
                   </form>
                   <div className="mt-6 text-center"><button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-slate-400 font-bold text-[10px] uppercase italic tracking-widest">Cambia modalità</button></div>
                   </>
                )}
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 print:hidden transition-colors">
      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b sticky top-0 z-30 px-6 h-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -ml-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"><Menu size={24} /></button>
          <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-900 shadow-lg"><Clock size={20} /></div>
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-2">
               <button onClick={() => { setView('calendar'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Home size={18} /> Home</button>
               <button onClick={() => { setView('report'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><FileText size={18} /> Resoconto</button>
               <button onClick={() => { setView('settings'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Settings size={18} /> Impostazioni</button>
            </div>
          )}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2"><h1 className="text-2xl font-black italic tracking-tighter uppercase">TIMEVAULT</h1></div>
        <div className="relative" ref={profileDropdownRef}>
            <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-3 focus:outline-none">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-slate-400 font-black uppercase mb-0.5 leading-none">Ciao</p>
                <p className={`text-sm font-black text-${accentColor}-600 uppercase italic leading-none`}>{user?.displayName}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 transition-colors"><User size={20} /></div>
            </button>
            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2">
                 <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><LogOut size={18} /> Disconnetti</button>
              </div>
            )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
        {view === 'calendar' && (
          <div className="space-y-8 animate-in fade-in zoom-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 italic">Giornate Lavorate</p>
                <p className="text-3xl font-black">{monthlyStats.daysWorked}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 italic">Extra Mese</p>
                <p className="text-3xl font-black text-orange-600">+{monthlyStats.ext}<span className="text-sm">h</span></p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 p-8 overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black capitalize italic">{monthName}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><ChevronLeft /></button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><ChevronRight /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 mb-4">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (<div key={day} className="text-center text-[10px] font-black uppercase text-slate-400 py-2 tracking-widest">{day}</div>))}</div>
              <div className="grid grid-cols-7 gap-3">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const active = logs.some(l => l.date === formatDateAsLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)));
                  return (
                    <button key={day} onClick={() => { setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)); setView('day'); }} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all ${active ? `bg-${accentColor}-600 text-white shadow-lg` : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100'}`}>
                      <span className="text-lg font-bold">{day}</span>
                      {active && <div className="w-1.5 h-1.5 rounded-full mt-1 bg-white"></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'day' && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-slate-500 font-bold uppercase text-xs tracking-widest mb-4 hover:text-slate-900"><ArrowLeft size={16} /> Torna al calendario</button>
            <h2 className="text-3xl font-black italic capitalize text-slate-900 dark:text-white">{selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h2>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black mb-6 uppercase text-slate-400 tracking-widest italic">Registra Attività</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                 {!isWeekend && (
                   <>
                     <button type="button" onClick={() => setFormData(p => ({ ...p, standardHours: STANDARD_HOURS_VALUE, type: 'work' }))} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'work' && formData.standardHours === STANDARD_HOURS_VALUE ? `bg-${accentColor}-600 text-white shadow-lg` : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Briefcase size={20} />Standard (8h)</button>
                     <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Ferie', type: 'ferie' })} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'ferie' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Palmtree size={20} />Ferie</button>
                   </>
                 )}
                 <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Malattia', type: 'malattia' })} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'malattia' ? 'bg-pink-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Thermometer size={20} />Malattia</button>
                 <button type="button" onClick={() => setFormData({ standardHours: 0, overtimeHours: '', notes: 'Riposo Compensativo', type: 'riposo_compensativo' })} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'riposo_compensativo' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Coffee size={20} />Riposo Comp.</button>
                 <button type="button" onClick={() => setShowOvertimeInput(!showOvertimeInput)} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${showOvertimeInput ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Zap size={20} />Extra</button>
              </div>
              <form onSubmit={handleSubmitLog} className="space-y-6">
                {showOvertimeInput && (
                   <div className="animate-in slide-in-from-top-2">
                     <label className="block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1">Ore Straordinario</label>
                     <input type="number" step="0.5" className="w-full p-4.5 bg-orange-50 dark:bg-orange-900/10 text-orange-600 rounded-2xl font-black outline-none border border-orange-100" placeholder="0.0" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})} />
                   </div>
                )}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
                  <button type="button" onClick={() => setShowNotesInput(!showNotesInput)} className="text-slate-300 hover:text-slate-600 p-2">{showNotesInput ? <ChevronUp /> : <ChevronDown />}</button>
                  {showNotesInput && (
                    <div className="mt-4 space-y-3">
                       <div ref={leaderDropdownRef} className="relative text-left">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 italic">Caposquadra (Multipla)</label>
                          <div onClick={() => setIsLeaderDropdownOpen(!isLeaderDropdownOpen)} className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-2xl font-bold border border-slate-200 dark:border-slate-700 cursor-pointer flex justify-between items-center transition-colors">
                              <span>{selectedLeaders.length === 0 ? "Seleziona..." : selectedLeaders.join(', ')}</span>
                              <ChevronDown size={16} />
                          </div>
                          {isLeaderDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border rounded-2xl shadow-xl z-50 p-2 max-h-48 overflow-y-auto">
                                  {availableLeaders.map(l => (
                                      <div key={l} onClick={() => toggleLeaderSelection(l)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${selectedLeaders.includes(l) ? `bg-${accentColor}-600 text-white border-${accentColor}-600` : 'border-slate-300'}`}>{selectedLeaders.includes(l) && <CheckSquare size={14} />}</div>
                                          <span className="text-sm font-bold">{l}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                       </div>
                       <textarea placeholder="Note attività..." className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-medium outline-none border border-slate-200 dark:border-slate-700" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                    </div>
                  )}
                </div>
                {formError && <p className="text-red-600 text-[10px] font-black italic">{formError}</p>}
                <button type="submit" className={`w-full p-5 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl bg-${accentColor}-600 transition-transform active:scale-95 shadow-${accentColor}-500/20`}><CheckCircle2 size={18} /> Salva Registro</button>
              </form>
            </div>
            <div className="space-y-4">
               {logs.filter(l => l.date === formatDateAsLocal(selectedDate)).map(log => (
                 <div key={log.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg italic tracking-tight">{log.type.replace('_', ' ')}</span>
                          <span className="text-xl font-black">{log.standardHours > 0 ? log.standardHours + 'h' : ''}</span>
                          {log.overtimeHours > 0 && <span className="text-sm font-black text-orange-600 bg-orange-50 px-2 rounded-lg">+{log.overtimeHours}h Extra</span>}
                       </div>
                       {log.teamLeader && <p className={`text-[9px] font-black text-${accentColor}-500 uppercase tracking-widest flex items-center gap-1 italic mb-1`}><Users size={12}/> {log.teamLeader}</p>}
                       <p className="text-sm text-slate-500 font-medium italic">{log.notes || "Nessuna nota"}</p>
                    </div>
                    <button onClick={() => requestDeleteLog(log.id)} className="p-3 text-slate-200 hover:text-red-500 rounded-xl transition-all hover:bg-red-50"><Trash2 size={18} /></button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="space-y-8 animate-in zoom-in">
             <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black italic uppercase">Resoconto Mese</h2>
                 <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronLeft size={20} /></button>
                    <p className="text-sm font-bold min-w-[120px] text-center capitalize italic tracking-tight">{monthName}</p>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><ChevronRight size={20} /></button>
                 </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 text-center">
                 <div className="grid grid-cols-2 gap-8 mb-10">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Giornate Lavorate</p><p className="text-5xl font-black">{monthlyStats.daysWorked}</p></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Straordinari</p><p className="text-5xl font-black text-orange-600">{monthlyStats.ext}<span className="text-lg">h</span></p></div>
                 </div>

                 <div className="relative mb-6">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Cerca note o caposquadra..." className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border rounded-2xl font-bold outline-none border-slate-200 dark:border-slate-700 italic" value={reportSearchQuery} onChange={(e) => setReportSearchQuery(e.target.value)} />
                 </div>

                 <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar text-left">
                    {filteredMonthLogs.map(log => (
                         <div key={log.id} className={`bg-slate-50/50 dark:bg-slate-800/20 rounded-[1.5rem] border p-5 transition-all cursor-pointer ${expandedLogId === log.id ? `ring-2 ring-${accentColor}-500/30` : ''}`} onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                   <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black bg-white dark:bg-slate-700 border-2 ${expandedLogId === log.id ? `border-${accentColor}-500 text-${accentColor}-500` : 'border-slate-200'}`}>{new Date(log.date).getDate()}</div>
                                   <div><p className="text-[10px] font-black uppercase text-slate-400 mb-0.5 tracking-widest italic">{log.type.replace('_', ' ')}</p><h3 className="text-xs font-bold uppercase">Giorno {new Date(log.date).getDate()}</h3></div>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                   <p className={`text-sm font-black ${log.overtimeHours > 0 ? 'text-orange-500' : 'text-slate-300'}`}>{log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '- Extra'}</p>
                                   <ChevronDown size={16} className={`text-slate-300 transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`} />
                                </div>
                            </div>
                            {expandedLogId === log.id && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2">
                                    <p className={`text-[10px] font-black text-${accentColor}-500 uppercase tracking-widest italic flex items-center gap-2 mb-2`}><Users size={14}/> Capisquadra</p>
                                    <p className="text-xs font-bold pl-6 italic mb-3">{log.teamLeader || "Nessun caposquadra specificato"}</p>
                                    <p className={`text-[10px] font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-2 mb-2`}><FileText size={14}/> Note</p>
                                    <p className="text-xs font-medium text-slate-500 pl-6 italic">{log.notes || "Nessuna nota"}</p>
                                </div>
                            )}
                         </div>
                    ))}
                    {filteredMonthLogs.length === 0 && (
                        <div className="py-20 text-center italic text-slate-300 font-bold uppercase tracking-widest">Nessun record trovato</div>
                    )}
                 </div>

                 <button onClick={handleDownloadRequest} className={`mt-8 w-full p-5 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 bg-slate-900 dark:bg-${accentColor}-600 transition-all hover:scale-[1.02] active:scale-95 shadow-xl`}><Download size={18} /> Scarica Report PDF</button>
             </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6 animate-in zoom-in">
            <h2 className="text-2xl font-black italic uppercase">Impostazioni</h2>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 space-y-8">
               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div><h3 className="font-bold mb-1 text-slate-900 dark:text-white italic">Aspetto</h3><p className="text-xs text-slate-500 dark:text-slate-400 italic">Tema scuro o chiaro</p></div>
                  <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm transition-colors text-slate-600 dark:text-slate-400">{theme === 'light' ? <><Moon size={16}/> Dark Mode</> : <><Sun size={16}/> Light Mode</>}</button>
               </div>
               
               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl transition-colors ${reminderEnabled ? `bg-${accentColor}-600 text-white` : 'bg-slate-200 text-slate-400'}`}>
                      {reminderEnabled ? <Bell size={20}/> : <BellOff size={20}/>}
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 uppercase text-xs tracking-widest italic leading-none text-slate-900 dark:text-white">Promemoria</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase italic">{notificationStatus === 'granted' ? 'Attivo (PWA)' : 'Non autorizzato'}</p>
                    </div>
                  </div>
                  {notificationStatus !== 'granted' ? (
                    <button onClick={requestNotificationPermission} className="text-[10px] font-black uppercase bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-500/20">Abilita</button>
                  ) : (
                    <button onClick={() => { setReminderEnabled(!reminderEnabled); localStorage.setItem('reminder_enabled', !reminderEnabled); }} className={`w-12 h-6 rounded-full transition-colors relative ${reminderEnabled ? `bg-${accentColor}-600` : 'bg-slate-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${reminderEnabled ? 'right-1' : 'left-1'}`}></div>
                    </button>
                  )}
               </div>

               {reminderEnabled && (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 italic">Ora del promemoria</label>
                    <input type="time" className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xl outline-none text-slate-800 dark:text-white shadow-inner" value={reminderTime} onChange={(e) => { setReminderTime(e.target.value); localStorage.setItem('reminder_time', e.target.value); }} />
                    <p className="text-[10px] text-slate-400 mt-3 font-medium italic flex items-center gap-2 leading-tight uppercase"><Smartphone size={14}/> Assicurati di aver aggiunto l'app alla Schermata Home.</p>
                  </div>
               )}

               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div><h3 className="font-bold mb-1 flex items-center gap-2 text-slate-900 dark:text-white italic"><Palette size={18}/> Colore Accent</h3><p className="text-xs text-slate-500 dark:text-slate-400 italic">Personalizza lo stile</p></div>
                  <div className="flex gap-2">
                    {Object.entries(ACCENT_COLORS).map(([key, { hex }]) => (
                      <button key={key} onClick={() => changeAccentColor(key)} className={`w-8 h-8 rounded-full border-2 transition-transform ${accentColor === key ? 'border-slate-900 dark:border-white scale-125 shadow-lg' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: hex }} />
                    ))}
                  </div>
               </div>

               <div className="pt-4">
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-6 rounded-[2rem]">
                    <h3 className="font-black text-red-600 dark:text-red-500 mb-1 flex items-center gap-2 uppercase text-xs tracking-widest italic"><AlertTriangle size={16}/> Zona Pericolosa</h3>
                    <p className="text-[10px] font-medium text-red-400 dark:text-red-700 mb-4 italic uppercase">L'eliminazione dei dati è permanente.</p>
                    <button onClick={() => { setShowDeleteRecoveryModal(true); setDeleteRecoveryInput(''); setDeleteError(''); }} className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-shadow shadow-lg shadow-red-500/20"><ShieldX size={16}/> Elimina Account</button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
      <footer className="max-w-4xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em] italic">TimeVault v0.9.2 • Mobile Edition</footer>
    </div>

    {/* AREA DI STAMPA NASCOSTA - TEMPLATE ORIGINALE 0.8.5 */}
    <div id="report-print-area" style={{ display: 'none', position: 'fixed', top: 0, left: 0, width: '210mm', padding: '20mm', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif', zIndex: -1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '4px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
           <div>
              <h1 style={{ fontSize: '32px', fontWeight: 900, fontStyle: 'italic', margin: 0, letterSpacing: '-2px' }}>TIMEVAULT REPORT</h1>
              <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', margin: 0, color: '#666' }}>Resoconto Personale Ore Lavorative</p>
           </div>
           <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '20px', fontWeight: 900, margin: 0, textTransform: 'capitalize' }}>{monthName}</p>
              <p style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>Dipendente: {user?.displayName}</p>
           </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
           <div style={{ padding: '20px', border: '2px solid #eee', borderRadius: '20px', backgroundColor: '#fafafa', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 5px 0', color: '#999' }}>Giorni Lavorati</p>
              <p style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>{monthlyStats.daysWorked}</p>
           </div>
           <div style={{ padding: '20px', border: '2px solid #eee', borderRadius: '20px', backgroundColor: '#fafafa', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 5px 0', color: '#999' }}>Extra Totali</p>
              <p style={{ fontSize: '32px', fontWeight: 900, margin: 0, color: '#f97316' }}>+{monthlyStats.ext}h</p>
           </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
           <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'left' }}>Data</th>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'left' }}>Tipo</th>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'left' }}>Caposquadra</th>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'right' }}>Extra</th>
              </tr>
           </thead>
           <tbody>
              {currentMonthLogs.map(log => (
                 <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700 }}>{formatDateIT(log.date)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>{log.type.replace('_', ' ')}</td>
                    <td style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 600 }}>{log.teamLeader || '-'}</td>
                    <td style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 900, textAlign: 'right' }}>{log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '-'}</td>
                 </tr>
              ))}
           </tbody>
        </table>
        <div style={{ marginTop: '50px', borderTop: '2px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
           <p style={{ fontSize: '10px', color: '#ccc', fontWeight: 900, textTransform: 'uppercase' }}>Documento generato da TimeVault App • {new Date().toLocaleDateString('it-IT')} • Riservato</p>
        </div>
    </div>

    {/* MODAL DOWNLOAD CON FEEDBACK (FIX MOBILE) */}
    {showDownloadConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center border dark:border-slate-800 animate-in zoom-in-95">
            <Download size={48} className={`mx-auto mb-6 text-${accentColor}-600`} />
            <h3 className="text-lg font-black mb-2 uppercase italic tracking-tight text-slate-900 dark:text-white leading-none">Generare Report?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium italic leading-tight">Il PDF verrà scaricato automaticamente sul tuo smartphone con la grafica ufficiale.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowDownloadConfirm(false)} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-xs uppercase text-slate-500 tracking-widest transition-colors">Annulla</button>
              <button onClick={confirmDownload} disabled={isGeneratingPDF} className={`p-4 text-white rounded-xl font-black text-xs uppercase shadow-lg bg-${accentColor}-600 flex items-center justify-center gap-2 active:scale-95 transition-all tracking-widest`}>
                 {isGeneratingPDF ? <><Loader2 className="animate-spin" size={16} /> Generazione...</> : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
    )}

    {/* MODAL ELIMINAZIONE ACCOUNT CON CODICE RECUPERO (INTEGRALE) */}
    {showDeleteRecoveryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border-2 border-red-500 relative animate-in zoom-in-95 text-center">
              <button onClick={() => setShowDeleteRecoveryModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
              <Key size={32} className="mx-auto mb-4 text-red-600"/>
              <h2 className="text-xl font-black text-red-600 uppercase mb-4 italic tracking-tight leading-none">Sicurezza Account</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 italic mb-6">Inserisci il codice di recupero a 16 cifre ricevuto durante la registrazione per procedere.</p>
              <form onSubmit={verifyRecoveryCodeForDeletion} className="space-y-4">
                 <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-center font-black outline-none uppercase tracking-widest shadow-inner focus:ring-2 focus:ring-red-500/20" value={deleteRecoveryInput} onChange={e => setDeleteRecoveryInput(e.target.value.toUpperCase())} maxLength={19} />
                 {deleteError && <p className="text-red-500 text-[10px] font-black italic">{deleteError}</p>}
                 <button type="submit" disabled={isDeleting} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-transform tracking-widest shadow-red-500/30">{isDeleting ? "Verifica..." : "Verifica Codice"}</button>
              </form>
           </div>
        </div>
    )}

    {showDeleteFinalConfirm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[110] flex items-center justify-center p-4 animate-in fade-in">
           <div className="text-center text-white animate-in zoom-in-95">
              <ShieldAlert size={64} className="mx-auto mb-6 text-red-600 animate-pulse" />
              <h2 className="text-3xl font-black uppercase italic mb-4 tracking-tighter">Eliminare Tutto?</h2>
              <p className="text-slate-400 mb-10 max-w-xs mx-auto italic font-medium leading-relaxed">Questa operazione è definitiva. Tutti i registri e i tuoi dati privati verranno cancellati per sempre dal Vault.</p>
              <div className="space-y-4">
                 <button onClick={confirmFinalAccountDeletion} className="w-full bg-red-600 p-5 rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-red-500/40 hover:bg-red-700 active:scale-95 transition-all">Sì, Elimina Account</button>
                 <button onClick={() => setShowDeleteFinalConfirm(false)} className="w-full text-slate-400 font-black uppercase tracking-widest hover:text-white transition-colors">No, Annulla</button>
              </div>
           </div>
        </div>
    )}

    {/* MODAL ELIMINAZIONE LOG (INTEGRALE) */}
    {logToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border dark:border-slate-800 text-center animate-in zoom-in-95">
            <Trash2 size={40} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-black mb-4 uppercase italic text-slate-900 dark:text-white tracking-tight leading-none">Cancellare Registro?</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLogToDelete(null)} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-xs uppercase text-slate-500 tracking-widest transition-colors">Annulla</button>
              <button onClick={confirmDelete} className="p-4 bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-transform tracking-widest">Sì, Elimina</button>
            </div>
          </div>
        </div>
    )}

    {/* MODAL GUIDA (INTEGRALE) */}
    {showGuideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border dark:border-slate-800 relative overflow-y-auto max-h-[90vh] animate-in zoom-in-95">
            <button onClick={() => setShowGuideModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X size={20} /></button>
            <div className="text-center mb-8">
                <div className={`inline-flex p-4 rounded-2xl bg-${accentColor}-100 dark:bg-${accentColor}-900/30 text-${accentColor}-600 dark:text-${accentColor}-400 mb-4 shadow-lg`}><Smartphone size={32} /></div>
                <h2 className="text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight leading-none">App Mobile</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2 italic">Aggiungi TimeVault alla tua Home Screen</p>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 transition-colors">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3 uppercase italic text-xs tracking-widest"><span className="text-xl"></span> iOS</h3>
                 <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-3 list-decimal list-inside font-medium italic">
                    <li>Apri <strong>Safari</strong> su questo sito.</li>
                    <li>Tocca l'icona <strong>Condividi</strong> (quadrato con freccia).</li>
                    <li>Scorri e seleziona <strong>Aggiungi alla Home</strong>.</li>
                 </ol>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 transition-colors">
                 <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3 uppercase italic text-xs tracking-widest"><span className="text-lg">🤖</span> Android</h3>
                 <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-3 list-decimal list-inside font-medium italic">
                    <li>Apri <strong>Chrome</strong> su questo sito.</li>
                    <li>Tocca i <strong>tre puntini</strong> in alto a destra.</li>
                    <li>Seleziona <strong>Installa App</strong> o Aggiungi.</li>
                 </ol>
              </div>
            </div>
            <button onClick={() => setShowGuideModal(false)} className={`w-full mt-8 bg-slate-900 dark:bg-${accentColor}-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all`}>Ho Capito</button>
          </div>
        </div>
      )}
    </>
  );
}