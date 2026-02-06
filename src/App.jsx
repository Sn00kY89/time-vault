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
  browserLocalPersistence
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
  Briefcase, Sun, Moon, ChevronLeft, ChevronRight, ArrowLeft, CheckCircle2,
  Menu, Home, FileText, Settings, X, Zap
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

  // Gestione Tema
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') || 'light';
    return 'light';
  });

  const [authData, setAuthData] = useState({ username: '', password: '' });
  
  // Modifica: Inizializzo standardHours a vuoto o 0 per lasciare la scelta all'utente
  const [formData, setFormData] = useState({
    standardHours: '', 
    overtimeHours: '',
    notes: ''
  });

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
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
        await signInWithEmailAndPassword(auth, internalEmail, authData.password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, internalEmail, authData.password);
        await updateProfile(cred.user, { displayName: cleanUsername });
        setUser({ ...cred.user, displayName: cleanUsername });
      }
    } catch (error) {
      if (error.code === 'auth/operation-not-allowed') setAuthError("Abilita Email/Password nella console!");
      else setAuthError("Credenziali errate o errore di rete.");
    } finally { setIsSubmitting(false); }
  };

  const handleLogout = () => { signOut(auth); setView('calendar'); };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      const dateString = formatDateAsLocal(selectedDate);
      
      await addDoc(logsCollection, {
        ...formData,
        standardHours: Number(formData.standardHours) || 0,
        overtimeHours: Number(formData.overtimeHours) || 0,
        date: dateString,
        userId: user.uid,
        userName: user.displayName,
        createdAt: serverTimestamp()
      });
      setFormData({ standardHours: '', overtimeHours: '', notes: '' });
    } catch (e) { console.error(e); }
  };

  const deleteLog = async (id) => {
    try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', id)); } 
    catch (e) { console.error(e); }
  };

  // Funzione per riempimento rapido
  const fillStandardDay = () => {
    setFormData(prev => ({ ...prev, standardHours: STANDARD_HOURS_VALUE }));
  };

  const monthlyStats = useMemo(() => {
    const targetMonth = currentMonth.getMonth(); 
    const targetYear = currentMonth.getFullYear();
    const uniqueDays = new Set();
    let totalOvertime = 0;

    logs.forEach(log => {
      const [year, month, day] = log.date.split('-').map(Number);
      if ((month - 1) === targetMonth && year === targetYear) {
        uniqueDays.add(log.date);
        totalOvertime += Number(log.overtimeHours || 0);
      }
    });

    return { 
      daysWorked: uniqueDays.size, 
      ext: totalOvertime 
    };
  }, [logs, currentMonth]);

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
    // Reset form data quando cambio giorno
    setFormData({ standardHours: '', overtimeHours: '', notes: '' });
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-blue-500 font-bold animate-pulse uppercase tracking-widest italic">Caricamento Vault...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex justify-end mb-4">
             <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
               {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
          </div>
          <div className="text-center mb-10">
            <div className="inline-flex p-5 bg-blue-600 rounded-3xl text-white mb-6 shadow-xl shadow-blue-500/30"><Clock size={40} /></div>
            <h1 className="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none">TIMEVAULT</h1>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Personal Edition</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-5">
            <input type="text" placeholder="nome.cognome" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})} />
            <input type="password" placeholder="Password" required className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
            {authError && <div className="text-red-600 dark:text-red-400 text-[11px] font-black bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{authError}</div>}
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">{isSubmitting ? 'Verifica...' : authMode === 'login' ? 'Entra nel Vault' : 'Crea Credenziali'}</button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full mt-8 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{authMode === 'login' ? "Nuovo utente? Registrati ora" : "Hai già un ID? Accedi"}</button>
        </div>
      </div>
    );
  }

  const { days, offset } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 sticky top-0 z-30 px-4 md:px-8 h-20 flex justify-between items-center shadow-sm">
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 cursor-pointer group p-2 -ml-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-950 shadow-lg group-hover:scale-95 transition-transform"><Clock size={20} /></div>
            <div className="hidden sm:block text-left">
              <h1 className="text-xl font-black tracking-tighter italic leading-none">TIMEVAULT</h1>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Menu Principale</p>
            </div>
            <Menu size={16} className="text-slate-400 ml-1" />
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

        <div className="flex items-center gap-3">
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
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Aggiungi Ore</h3>
                 {/* PULSANTE GIORNATA STANDARD: Solo se NON è weekend */}
                 {!isWeekend && (
                   <button 
                     type="button" 
                     onClick={fillStandardDay}
                     className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                   >
                     <Zap size={14} /> Giornata Intera ({STANDARD_HOURS_VALUE}h)
                   </button>
                 )}
              </div>
              
              <form onSubmit={handleSubmitLog} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Standard (h)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required={!isWeekend} // Se weekend, non obbligatorio (o gestito diversamente)
                      placeholder={isWeekend ? "Weekend" : "8"} 
                      disabled={isWeekend} // Disabilitato nel weekend
                      className={`w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-black outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500 ${isWeekend ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={formData.standardHours} 
                      onChange={e => setFormData({...formData, standardHours: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Extra (h)</label>
                    <input type="number" step="0.5" required={isWeekend} placeholder="0" className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-black text-orange-600 dark:text-orange-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-orange-500" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Note</label>
                  <textarea placeholder="Dettagli attività..." className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-medium outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500" rows="2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                </div>
                <button className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white p-4 rounded-[1.25rem] font-black uppercase tracking-widest shadow-xl shadow-slate-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Salva Voce
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {dailyLogs.map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-black text-slate-800 dark:text-white">{log.standardHours}h</span>
                      {log.overtimeHours > 0 && <span className="text-sm font-black text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg">+{log.overtimeHours}h Extra</span>}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{log.notes || "Nessuna nota"}</p>
                  </div>
                  <button onClick={() => deleteLog(log.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={18} /></button>
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
                 <div className="inline-flex p-6 bg-blue-50 dark:bg-slate-800 rounded-full text-blue-600 dark:text-blue-400 mb-6"><FileText size={48} /></div>
                 
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
             </div>
          </div>
        )}

        {/* --- VISTA IMPOSTAZIONI --- */}
        {view === 'settings' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-black italic text-slate-800 dark:text-white uppercase tracking-tight">Impostazioni</h2>
            
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
                  <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                    <LogOut size={16}/> Disconnetti
                  </button>
               </div>
            </div>
          </div>
        )}

      </main>
      <footer className="max-w-6xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.5em]">TimeVault v5.3 (CCNL Logic)</footer>
    </div>
  );
}