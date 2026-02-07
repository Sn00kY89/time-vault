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
  Menu, Home, FileText, Settings, X, Zap, Palmtree, Thermometer, AlertTriangle, Download, Eye, ShieldAlert, Lock, LogIn, UserPlus, Key, Copy, AlertOctagon, ShieldCheck, Unlock, RefreshCw, Users, CheckSquare, Square, User, Palette, Smartphone, Share, Search, ShieldX, Coffee, FileDown, Loader2
} from 'lucide-react';

// --- LETTURA VARIBILI CAPITURNO ---
import externalTeamLeaders from './capisquadra.json';

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

const FALLBACK_TEAM_LEADERS = ['Caposquadra 1', 'Caposquadra 2'];
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
  const [isExporting, setIsExporting] = useState(false);
  
  const [view, setView] = useState('calendar'); 
  const [selectedDate, setSelectedDate] = useState(new Date()); 
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [availableLeaders] = useState(FALLBACK_TEAM_LEADERS); 
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

  const isWeekend = useMemo(() => {
    const day = selectedDate.getDay();
    return day === 0 || day === 6; 
  }, [selectedDate]);

  // Caricamento Script PDF
  useEffect(() => {
    const s1 = document.createElement('script');
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s1.async = true;
    document.body.appendChild(s1);

    const s2 = document.createElement('script');
    s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s2.async = true;
    document.body.appendChild(s2);
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

  // Automazione Weekend
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
            } catch (e) { console.error(e); }
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
    if (!cleanUsername.includes('.')) {
      setAuthError("L'ID deve essere 'nome.cognome'");
      setIsSubmitting(false);
      return;
    }
    const internalEmail = `${cleanUsername}${INTERNAL_DOMAIN}`;
    try {
      if (authMode === 'login') {
        if (isLocked) { setAuthError("Account bloccato. Inserisci il codice di recupero."); setIsSubmitting(false); return; }
        await signInWithEmailAndPassword(auth, internalEmail, authData.password);
        setFailedAttempts(0);
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
         if (newAttempts >= 3) { setIsLocked(true); setRecoveryStep(1); setAuthError("Troppi tentativi falliti. Account bloccato."); } 
         else setAuthError(`Password errata. Tentativi rimasti: ${3 - newAttempts}`);
      } else setAuthError(error.code === 'auth/email-already-in-use' ? "Utente già registrato." : "Errore registrazione.");
    } finally { setIsSubmitting(false); }
  };

  const handleRecoveryCodeSaved = () => { setShowRecoveryModal(false); setUser(auth.currentUser); };
  const handleVerifyCode = () => { if (unlockCodeInput.length < 16) { setAuthError("Codice non valido."); return; } setAuthError(""); setRecoveryStep(2); };
  const handleFinalPasswordReset = () => {
    if (newResetPassword.length < 6) { setAuthError("La password deve essere di almeno 6 caratteri."); return; }
    setIsLocked(false); setFailedAttempts(0); setAuthError(""); setUnlockCodeInput(''); setNewResetPassword(''); setRecoveryStep(1);
    alert("Password reimpostata con successo!");
  };

  const handleLogout = () => { signOut(auth); setView('calendar'); setFailedAttempts(0); setIsLocked(false); setIsProfileDropdownOpen(false); };
  const toggleLeaderSelection = (leaderName) => setSelectedLeaders(prev => prev.includes(leaderName) ? prev.filter(n => n !== leaderName) : [...prev, leaderName]);

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFormError('');
    const dateString = formatDateAsLocal(selectedDate);
    if (logs.some(l => l.date === dateString)) { setFormError("Attenzione: Esiste già una voce per questa data!"); return; }
    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      await addDoc(logsCollection, { ...formData, standardHours: Number(formData.standardHours) || 0, overtimeHours: Number(formData.overtimeHours) || 0, teamLeader: selectedLeaders.join(', '), date: dateString, userId: user.uid, userName: user.displayName, createdAt: serverTimestamp() });
      setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' });
      setSelectedLeaders([]); setShowOvertimeInput(false); setShowNotesInput(false); setIsLeaderDropdownOpen(false);
    } catch (e) { console.error(e); }
  };

  const verifyRecoveryCodeForDeletion = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteRecoveryInput.length < 16) { setDeleteError("Codice incompleto."); return; }
    setIsSubmitting(true);
    try {
       const securityDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'security'));
       if (securityDoc.exists() && securityDoc.data().recoveryCode === deleteRecoveryInput) {
          setIsSubmitting(false); setShowDeleteRecoveryModal(false); setShowDeleteFinalConfirm(true);
       } else { setIsSubmitting(false); setDeleteError("Codice non corretto."); }
    } catch (e) { setIsSubmitting(false); setDeleteError("Errore verifica."); }
  };

  const confirmFinalAccountDeletion = async () => {
    setIsSubmitting(true);
    try { await deleteUser(user); } catch (error) { setIsSubmitting(false); alert("Rieffettua l'accesso prima di eliminare l'account."); }
  };

  const handleDownloadPDF = async () => {
    if (!window.html2canvas || !window.jspdf) {
      alert("Librerie in caricamento... riprova tra un secondo.");
      return;
    }
    setIsExporting(true);
    const element = document.getElementById('report-print-area');
    const originalStyle = element.style.display;
    element.style.display = 'block'; // Mostra per cattura
    
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Report_${monthName.replace(' ', '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Errore durante la generazione del file.");
    } finally {
      element.style.display = originalStyle;
      setIsExporting(false);
      setShowDownloadConfirm(false);
    }
  };

  const handleSetStandard = () => { setFormError(''); setFormData(prev => ({ ...prev, standardHours: STANDARD_HOURS_VALUE, type: 'work', notes: '' })); };
  const handleSetFerie = () => { setFormError(''); setFormData({ standardHours: 0, overtimeHours: '', notes: 'Ferie', type: 'ferie' }); setSelectedLeaders([]); };
  const handleSetMalattia = () => { setFormError(''); setFormData({ standardHours: 0, overtimeHours: '', notes: 'Malattia', type: 'malattia' }); setSelectedLeaders([]); };
  const handleSetRiposoCompensativo = () => { setFormError(''); setFormData({ standardHours: 0, overtimeHours: '', notes: 'Riposo Compensativo', type: 'riposo_compensativo' }); setSelectedLeaders([]); };

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

  const { days, offset } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' });

  function getDaysInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const d = new Date(year, month + 1, 0).getDate();
    const f = new Date(year, month, 1).getDay();
    return { days: d, offset: f === 0 ? 6 : f - 1 };
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-blue-500 font-bold animate-pulse uppercase tracking-widest italic">Caricamento Vault...</div>;

  if (!user || showRecoveryModal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 relative">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in fade-in zoom-in">
          <button onClick={toggleTheme} className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"><Moon size={20} /></button>
          <div className="mb-12 mt-6">
             <div className={`inline-flex p-6 bg-${accentColor}-600 rounded-[2rem] text-white mb-6 shadow-xl`}><Clock size={48} /></div>
             <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none mb-2 uppercase">TIMEVAULT</h1>
             <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em]">Personal Edition</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => openAuthModal('login')} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"><LogIn size={20} /> Accedi al Vault</button>
            <button onClick={() => openAuthModal('register')} className="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 p-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3"><UserPlus size={20} /> Nuovo Account</button>
          </div>
        </div>

        {showRecoveryModal && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm border-2 border-red-500 text-center animate-in zoom-in">
                 <ShieldCheck size={48} className="mx-auto mb-6 text-red-600 animate-pulse" />
                 <h2 className="text-2xl font-black italic text-red-600 uppercase mb-2">Sicurezza</h2>
                 <p className="text-xs text-slate-500 mb-6 font-medium">Salva questo codice di recupero a 16 cifre.</p>
                 <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 relative">
                    <p className="font-mono text-lg font-black tracking-widest break-all">{generatedRecoveryCode}</p>
                    <button onClick={copyToClipboard} className="absolute right-2 top-2 p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500"><Copy size={16} /></button>
                 </div>
                 <button onClick={handleRecoveryCodeSaved} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3">Ho salvato il codice</button>
              </div>
           </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 relative">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-100"><X size={20} /></button>
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
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 print:hidden transition-colors duration-300">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b sticky top-0 z-30 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3" ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -ml-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"><Menu size={24} /></button>
          <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-900 shadow-lg"><Clock size={20} /></div>
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in fade-in slide-in-from-top-2">
               <button onClick={() => handleMenuNavigation('calendar')} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800"><Home size={18} /> Home</button>
               <button onClick={() => handleMenuNavigation('report')} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800"><FileText size={18} /> Resoconto</button>
               <button onClick={() => handleMenuNavigation('settings')} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800"><Settings size={18} /> Impostazioni</button>
            </div>
          )}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2"><h1 className="text-2xl font-black italic tracking-tighter uppercase">TIMEVAULT</h1></div>
        <div className="relative" ref={profileDropdownRef}>
            <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-3 focus:outline-none">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-slate-400 font-black uppercase mb-0.5 leading-none">Ciao</p>
                <p className={`text-sm font-black text-${accentColor}-600 uppercase italic leading-none`}>{user?.displayName}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center"><User size={20} /></div>
            </button>
            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2">
                 <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><LogOut size={18} /> Disconnetti</button>
              </div>
            )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
        {view === 'calendar' && (
          <div className="space-y-8 animate-in fade-in zoom-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Giornate Lavorate</p>
                <p className="text-3xl font-black">{monthlyStats.daysWorked}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Extra Mese</p>
                <p className="text-3xl font-black text-orange-600">+{monthlyStats.ext}<span className="text-sm">h</span></p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black capitalize italic">{monthName}</h2>
                <div className="flex gap-2">
                  <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><ChevronLeft /></button>
                  <button onClick={() => changeMonth(1)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><ChevronRight /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 mb-4">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (<div key={day} className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest py-2">{day}</div>))}</div>
              <div className="grid grid-cols-7 gap-4">
                {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const day = i + 1;
                  const active = hasData(day);
                  return (
                    <button key={day} onClick={() => selectDay(day)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all ${active ? `bg-${accentColor}-600 text-white shadow-lg` : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100'}`}>
                      <span className="text-lg font-bold">{day}</span>
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
            <h2 className="text-3xl font-black italic capitalize">{selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h2>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black mb-6 uppercase text-slate-400 tracking-widest">Registra Ore</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                 {!isWeekend && (
                   <>
                     <button type="button" onClick={handleSetStandard} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'work' && formData.standardHours === STANDARD_HOURS_VALUE ? `bg-${accentColor}-600 text-white shadow-lg` : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Briefcase size={20} />Standard (8h)</button>
                     <button type="button" onClick={handleSetFerie} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'ferie' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Palmtree size={20} />Ferie</button>
                   </>
                 )}
                 <button type="button" onClick={handleSetMalattia} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'malattia' ? 'bg-pink-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Thermometer size={20} />Malattia</button>
                 <button type="button" onClick={handleSetRiposoCompensativo} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${formData.type === 'riposo_compensativo' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Coffee size={20} />Riposo Comp.</button>
                 <button type="button" onClick={() => setShowOvertimeInput(!showOvertimeInput)} className={`p-4 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2 transition-all ${showOvertimeInput ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Zap size={20} />Straord.</button>
              </div>
              <form onSubmit={handleSubmitLog} className="space-y-6">
                {showOvertimeInput && (
                   <div className="animate-in slide-in-from-top-2">
                     <label className="block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1">Ore Extra</label>
                     <input type="number" step="0.5" autoFocus className="w-full p-4.5 bg-orange-50 dark:bg-orange-900/10 text-orange-600 rounded-2xl font-black outline-none border border-orange-100" placeholder="0.0" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})} />
                   </div>
                )}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <button type="button" onClick={() => setShowNotesInput(!showNotesInput)} className="w-full p-2 flex justify-center text-slate-300 hover:text-slate-600">{showNotesInput ? <ChevronUp /> : <ChevronDown />}</button>
                  {showNotesInput && (
                      <div className="mt-4 animate-in slide-in-from-top-2 space-y-3">
                        <div ref={leaderDropdownRef} className="relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Capisquadra</label>
                            <div onClick={() => setIsLeaderDropdownOpen(!isLeaderDropdownOpen)} className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold cursor-pointer flex justify-between items-center border border-slate-200">
                               <span className={selectedLeaders.length === 0 ? "text-slate-300" : ""}>{selectedLeaders.length === 0 ? "Seleziona..." : selectedLeaders.join(', ')}</span>
                               <ChevronDown size={16} />
                            </div>
                            {isLeaderDropdownOpen && (
                               <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border rounded-2xl shadow-xl z-50 p-2 max-h-48 overflow-y-auto">
                                 {availableLeaders.map(leader => (
                                     <div key={leader} onClick={() => toggleLeaderSelection(leader)} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                                       <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${selectedLeaders.includes(leader) ? `bg-${accentColor}-600 text-white` : ''}`}>{selectedLeaders.includes(leader) && <CheckSquare size={14} />}</div>
                                       <span className="text-sm font-bold">{leader}</span>
                                     </div>
                                 ))}
                               </div>
                            )}
                        </div>
                        <textarea placeholder="Note attività..." className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 rounded-2xl font-medium outline-none border border-slate-200" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                      </div>
                  )}
                </div>
                {formError && <p className="text-red-500 text-[10px] font-black italic">{formError}</p>}
                <button className={`w-full p-5 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl flex items-center justify-center gap-2 bg-${accentColor}-600`}><CheckCircle2 size={18} /> Salva Registro</button>
              </form>
            </div>
            <div className="space-y-4">
              {dailyLogs.map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between group">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{log.type.replace('_', ' ')}</span>
                      {log.standardHours > 0 && <span className="text-xl font-black">{log.standardHours}h</span>}
                      {log.overtimeHours > 0 && <span className="text-sm font-black text-orange-500 bg-orange-50 px-2 rounded-lg">+{log.overtimeHours}h</span>}
                    </div>
                    {log.teamLeader && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.teamLeader}</p>}
                  </div>
                  <button onClick={() => requestDeleteLog(log.id)} className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="space-y-8 animate-in fade-in zoom-in">
             <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black italic uppercase">Resoconto Mese</h2>
                 <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} /></button>
                    <p className="text-sm font-bold capitalize min-w-[120px] text-center">{monthName}</p>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} /></button>
                 </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 text-center">
                 <div className="grid grid-cols-2 gap-8 mb-10">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giornate</p><p className="text-5xl font-black">{monthlyStats.daysWorked}</p></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Extra</p><p className="text-5xl font-black text-orange-600">{monthlyStats.ext}<span className="text-lg">h</span></p></div>
                 </div>

                 <div className="relative mb-6">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Cerca..." className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border rounded-2xl font-bold outline-none" value={reportSearchQuery} onChange={(e) => setReportSearchQuery(e.target.value)} />
                 </div>

                 <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 text-left">
                    {filteredMonthLogs.map(log => (
                         <div key={log.id} className={`bg-slate-50/50 dark:bg-slate-800/20 rounded-[1.5rem] border overflow-hidden transition-all ${expandedLogId === log.id ? `ring-2 ring-${accentColor}-500/30` : ''}`}>
                            <div onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)} className="p-5 cursor-pointer flex items-center justify-between">
                               <div className="flex items-center gap-5">
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black bg-white dark:bg-slate-700 border-2">{new Date(log.date).getDate()}</div>
                                  <div>
                                     <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">{log.type.replace('_', ' ')}</p>
                                     <h3 className="text-xs font-bold uppercase">Giorno {new Date(log.date).getDate()}</h3>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4 text-right">
                                  <div><p className={`text-sm font-black ${log.overtimeHours > 0 ? 'text-orange-500' : 'text-slate-300'}`}>{log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '- Extra'}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{log.standardHours > 0 ? 'std' : ''}</p></div>
                                  <ChevronDown className={`text-slate-300 transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`} />
                               </div>
                            </div>
                            {expandedLogId === log.id && (
                               <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-slate-700 pt-4 animate-in slide-in-from-top-2">
                                     <p className={`text-[10px] font-black text-${accentColor}-500 uppercase flex items-center gap-2 mb-2`}><Users size={14} /> Capisquadra</p>
                                     <p className="text-xs font-bold pl-6">{log.teamLeader || "Nessuna specifica"}</p>
                               </div>
                            )}
                         </div>
                    ))}
                 </div>

                 <button onClick={() => setShowDownloadConfirm(true)} className={`mt-8 w-full p-5 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:scale-[1.02] bg-slate-900 dark:bg-${accentColor}-600`}><FileDown size={18} /> Scarica Report (PDF)</button>
             </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6 animate-in fade-in zoom-in">
            <h2 className="text-2xl font-black italic uppercase">Impostazioni</h2>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 space-y-8">
               <div className="flex items-center justify-between border-b pb-8">
                  <div><h3 className="font-bold mb-1">Aspetto</h3><p className="text-xs text-slate-500">Tema scuro o chiaro</p></div>
                  <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm transition-colors">{theme === 'light' ? <><Moon size={16}/> Dark</> : <><Sun size={16}/> Light</>}</button>
               </div>
               <div className="flex items-center justify-between border-b pb-8">
                  <div><h3 className="font-bold mb-1 flex items-center gap-2"><Palette size={18}/> Colore Accent</h3></div>
                  <div className="flex gap-2">
                    {Object.entries(ACCENT_COLORS).map(([key, { hex }]) => (
                      <button key={key} onClick={() => changeAccentColor(key)} className={`w-8 h-8 rounded-full border-2 ${accentColor === key ? 'border-slate-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: hex }} />
                    ))}
                  </div>
               </div>
               <div className="pt-4">
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 p-6 rounded-[2rem]">
                    <h3 className="font-black text-red-600 mb-1 flex items-center gap-2 uppercase text-xs tracking-widest"><AlertTriangle size={16}/> Zona Pericolosa</h3>
                    <button onClick={() => setShowDeleteRecoveryModal(true)} className="mt-4 flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-500/20"><ShieldX size={16}/> Elimina Account</button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
      <footer className="max-w-4xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em]">TimeVault v0.8.6</footer>
    </div>

    {/* MODAL DOWNLOAD PDF */}
    {showDownloadConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center">
            <div className={`w-16 h-16 bg-${accentColor}-100 rounded-full flex items-center justify-center mx-auto mb-4 text-${accentColor}-600`}><Download size={32} /></div>
            <h3 className="text-lg font-black mb-2">Generare Report PDF?</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium italic">Il file verrà generato e salvato automaticamente nella tua cartella download.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowDownloadConfirm(false)} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-xs uppercase text-slate-500 transition-colors">Annulla</button>
              <button onClick={handleDownloadPDF} disabled={isExporting} className={`p-4 text-white rounded-xl font-black text-xs uppercase shadow-lg bg-${accentColor}-600 flex items-center justify-center gap-2`}>
                 {isExporting ? <><Loader2 className="animate-spin" size={16} /> Generazione...</> : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
    )}

    {/* AREA DI CATTURA PER PDF (NASCOSTA) */}
    <div id="report-print-area" style={{ display: 'none', position: 'absolute', left: '-5000px', width: '800px', padding: '40px', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '4px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
           <div>
              <h1 style={{ fontSize: '32px', fontWeight: 900, fontStyle: 'italic', margin: 0, letterSpacing: '-2px' }}>TIMEVAULT REPORT</h1>
              <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', margin: 0, color: '#666' }}>Resoconto Personale Ore</p>
           </div>
           <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '20px', fontWeight: 900, margin: 0, textTransform: 'capitalize' }}>{monthName}</p>
              <p style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>Dipendente: {user?.displayName}</p>
           </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
           <div style={{ padding: '20px', border: '2px solid #eee', borderRadius: '20px', backgroundColor: '#fafafa' }}>
              <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 5px 0', color: '#999' }}>Giornate Lavorate</p>
              <p style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>{monthlyStats.daysWorked}</p>
           </div>
           <div style={{ padding: '20px', border: '2px solid #eee', borderRadius: '20px', backgroundColor: '#fafafa' }}>
              <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 5px 0', color: '#999' }}>Straordinari Totali</p>
              <p style={{ fontSize: '32px', fontWeight: 900, margin: 0, color: '#f97316' }}>+{monthlyStats.ext}h</p>
           </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
           <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>Data</th>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>Tipo</th>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>Caposquadra</th>
                 <th style={{ padding: '10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'right' }}>Ore</th>
              </tr>
           </thead>
           <tbody>
              {currentMonthLogs.map(log => (
                 <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 700 }}>{formatDateIT(log.date)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>{log.type.replace('_', ' ')}</td>
                    <td style={{ padding: '12px 10px', fontSize: '11px', fontWeight: 600 }}>{log.teamLeader || '-'}</td>
                    <td style={{ padding: '12px 10px', fontSize: '12px', fontWeight: 900, textAlign: 'right' }}>
                       {log.standardHours > 0 && <span>{log.standardHours}h std </span>}
                       {log.overtimeHours > 0 && <span style={{ color: '#f97316' }}>+{log.overtimeHours}h extra</span>}
                    </td>
                 </tr>
              ))}
           </tbody>
        </table>
        <div style={{ marginTop: '50px', borderTop: '2px solid #eee', paddingTop: '20px', textAlign: 'center' }}>
           <p style={{ fontSize: '10px', color: '#ccc', fontWeight: 900, textTransform: 'uppercase' }}>Documento generato da TimeVault App • Riservato • {new Date().toLocaleDateString('it-IT')}</p>
        </div>
    </div>

    {/* MODAL ELIMINAZIONE */}
    {showDeleteRecoveryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border-2 border-red-500 relative">
              <button onClick={() => setShowDeleteRecoveryModal(false)} className="absolute top-6 right-6 p-2 rounded-full text-slate-400"><X size={20}/></button>
              <div className="text-center mb-6">
                 <Key size={32} className="mx-auto mb-4 text-red-600"/>
                 <h2 className="text-xl font-black text-red-600 uppercase italic">Sicurezza</h2>
                 <p className="text-xs text-slate-500 font-medium mt-2">Inserisci il codice di recupero a 16 cifre.</p>
              </div>
              <form onSubmit={verifyRecoveryCodeForDeletion} className="space-y-4">
                 <input type="text" placeholder="XXXX-XXXX-XXXX-XXXX" required className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border rounded-2xl font-mono text-center font-black outline-none uppercase" value={deleteRecoveryInput} onChange={e => setDeleteRecoveryInput(e.target.value.toUpperCase())} maxLength={19} />
                 {deleteError && <p className="text-red-500 text-[10px] font-black text-center italic">{deleteError}</p>}
                 <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase shadow-xl">{isSubmitting ? "Verifica..." : "Verifica Codice"}</button>
              </form>
           </div>
        </div>
    )}

    {showDeleteFinalConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center">
              <ShieldAlert size={48} className="mx-auto mb-6 text-red-600 animate-pulse"/>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic mb-4">Sei Sicuro?</h2>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">Tutti i dati verranno cancellati istantaneamente e non potranno essere recuperati.</p>
              <div className="space-y-3">
                 <button onClick={confirmFinalAccountDeletion} disabled={isSubmitting} className="w-full bg-red-600 text-white p-5 rounded-2xl font-black uppercase shadow-xl">{isSubmitting ? "Eliminazione..." : "Sì, Elimina Tutto"}</button>
                 <button onClick={() => setShowDeleteFinalConfirm(false)} className="w-full bg-slate-100 text-slate-500 p-5 rounded-2xl font-black uppercase">Annulla</button>
              </div>
           </div>
        </div>
    )}
    </>
  );

  function openAuthModal(mode) { setAuthMode(mode); setAuthError(''); setAuthData({ username: '', password: '' }); setShowAuthModal(true); }
  function hasData(day) { return logs.some(l => l.date === formatDateAsLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))); }
  function handleMenuNavigation(targetView) { setView(targetView); setIsMenuOpen(false); }
  function copyToClipboard() { navigator.clipboard.writeText(generatedRecoveryCode); alert("Codice copiato!"); }
  function selectDay(day) { setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)); setFormData({ standardHours: 0, overtimeHours: '', notes: '', type: 'work' }); setSelectedLeaders([]); setShowOvertimeInput(false); setView('day'); }
  function changeMonth(inc) { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + inc, 1)); }
  function requestDeleteLog(id) { setLogToDelete(id); }
  async function confirmDelete() { try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', logToDelete)); setLogToDelete(null); } catch (e) { console.error(e); } }
}