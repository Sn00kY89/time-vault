import React, { useState, useEffect, useMemo } from 'react';
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
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Clock, Plus, Trash2, Calendar as CalendarIcon, LogOut, TrendingUp, 
  Briefcase, Sun, Moon, ChevronLeft, ChevronRight, ArrowLeft, CheckCircle2
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

export default function App() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // STATI PER IL CALENDARIO E NAVIGAZIONE
  const [view, setView] = useState('calendar'); // 'calendar' | 'day'
  const [selectedDate, setSelectedDate] = useState(new Date()); // Data selezionata
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Mese visualizzato nel calendario

  // Gestione Tema
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') || 'light';
    return 'light';
  });

  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [formData, setFormData] = useState({
    standardHours: 8,
    overtimeHours: 0,
    notes: ''
  });

  // Effetto Tema
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Effetto Auth
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

  // Effetto Dati
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

  // AUTH ACTIONS
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

  // LOG ACTIONS
  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      // Usiamo la data selezionata nel calendario
      const dateString = selectedDate.toISOString().split('T')[0];
      
      await addDoc(logsCollection, {
        ...formData,
        date: dateString,
        userId: user.uid,
        userName: user.displayName,
        createdAt: serverTimestamp()
      });
      setFormData({ ...formData, overtimeHours: 0, notes: '' });
    } catch (e) { console.error(e); }
  };

  const deleteLog = async (id) => {
    try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', id)); } 
    catch (e) { console.error(e); }
  };

  // CALCOLI
  const stats = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc.std += Number(log.standardHours || 0);
      acc.ext += Number(log.overtimeHours || 0);
      return acc;
    }, { std: 0, ext: 0 });
  }, [logs]);

  // LOGICA CALENDARIO
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Dom, 1 = Lun...
    // Aggiustiamo per far partire Lunedì come primo giorno (0)
    const offset = firstDay === 0 ? 6 : firstDay - 1; 
    return { days, offset };
  };

  const changeMonth = (increment) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + increment, 1));
  };

  const selectDay = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    // Reset form data quando cambio giorno? Opzionale.
    setView('day');
  };

  // Filtra i log per la visualizzazione giornaliera
  const dailyLogs = useMemo(() => {
    const dateString = selectedDate.toISOString().split('T')[0];
    return logs.filter(l => l.date === dateString);
  }, [logs, selectedDate]);

  // Controlla se un giorno ha dati (per il pallino nel calendario)
  const hasData = (day) => {
    const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return logs.some(l => l.date === checkDate);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-blue-500 font-bold animate-pulse uppercase tracking-widest italic">Caricamento Vault...</div>;

  // LOGIN SCREEN
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

  // --- APP PRINCIPALE ---
  const { days, offset } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* HEADER */}
      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 sticky top-0 z-20 px-4 md:px-8 h-20 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('calendar')}>
          <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-950 shadow-lg"><Clock size={20} /></div>
          <h1 className="text-xl md:text-2xl font-black tracking-tighter italic leading-none hidden sm:block">TIMEVAULT</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-blue-100 dark:border-slate-700 hidden sm:block">
            <p className="text-[9px] text-blue-400 dark:text-blue-300 font-black uppercase mb-0.5 leading-none text-right">Utente</p>
            <p className="text-sm font-black text-blue-700 dark:text-blue-400 uppercase italic leading-none">{user.displayName}</p>
          </div>
          <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
          <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-red-100"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* VISTA CALENDARIO */}
        {view === 'calendar' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            {/* KPI MENSILI GLOBALI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Totale Standard</p>
                <p className="text-3xl font-black text-slate-800 dark:text-white">{stats.std}h</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Totale Extra</p>
                <p className="text-3xl font-black text-orange-600 dark:text-orange-500">+{stats.ext}h</p>
              </div>
            </div>

            {/* CALENDARIO */}
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

        {/* VISTA GIORNALIERA (DAY) */}
        {view === 'day' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={() => setView('calendar')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors font-bold uppercase text-xs tracking-widest mb-4">
              <ArrowLeft size={16} /> Torna al calendario
            </button>

            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black italic text-slate-800 dark:text-white capitalize">
                {selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h2>
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider">
                {dailyLogs.length > 0 ? `${dailyLogs.length} Attività` : 'Nessuna attività'}
              </div>
            </div>

            {/* FORM INSERIMENTO PER IL GIORNO SELEZIONATO */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black mb-6 uppercase text-slate-400 tracking-widest">Aggiungi Ore</h3>
              <form onSubmit={handleSubmitLog} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Standard (h)</label>
                    <input type="number" step="0.5" required placeholder="8" className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-black outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-500" value={formData.standardHours} onChange={e => setFormData({...formData, standardHours: e.target.value})}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Extra (h)</label>
                    <input type="number" step="0.5" required placeholder="0" className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-black text-orange-600 dark:text-orange-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-orange-500" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})}/>
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

            {/* LISTA LOG DEL GIORNO */}
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

      </main>
      <footer className="max-w-6xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.5em]">TimeVault Calendar • v5.0</footer>
    </div>
  );
}