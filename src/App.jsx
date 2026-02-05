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
  Clock, Plus, Trash2, Users, Calendar, LogOut, TrendingUp, 
  Briefcase, LogIn, UserPlus, AlertCircle, ShieldCheck, 
  Hash, ExternalLink, HelpCircle, Sun, Moon 
} from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
// Configurazione integrata con le tue chiavi reali
const firebaseConfig = {
  apiKey: "AIzaSyDdxN05Yj1CtPOY69x3JJjuFuhEUelXWsc",
  authDomain: "work-time-vault.firebaseapp.com",
  projectId: "work-time-vault",
  storageBucket: "work-time-vault.firebasestorage.app",
  messagingSenderId: "957496336579",
  appId: "1:957496336579:web:f82df8f2d580b92ec58276"
};

const APP_ID = "time-vault-pro"; // ID per il path nel database

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
  
  // Gestione Tema (Dark/Light)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });

  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    standardHours: 8,
    overtimeHours: 0,
    notes: ''
  });

  // Effetto per applicare la classe 'dark' al tag HTML
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        console.error("Persistence error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setLogs([]);
      return;
    }

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
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError("Abilita Email/Password nella console Firebase!");
      } else {
        setAuthError("Credenziali non corrette o errore di rete.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const logsCollection = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs');
      await addDoc(logsCollection, {
        ...formData,
        userId: user.uid,
        userName: user.displayName,
        createdAt: serverTimestamp()
      });
      setFormData({ ...formData, overtimeHours: 0, notes: '' });
    } catch (e) { console.error(e); }
  };

  const deleteLog = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'work_logs', id));
    } catch (e) { console.error(e); }
  };

  const stats = useMemo(() => {
    return logs.reduce((acc, log) => {
      acc.std += Number(log.standardHours || 0);
      acc.ext += Number(log.overtimeHours || 0);
      return acc;
    }, { std: 0, ext: 0 });
  }, [logs]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-900 text-blue-500 font-bold animate-pulse uppercase tracking-widest italic">
      Caricamento Vault...
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 transition-colors duration-300">
          
          {/* Tasto Tema Login */}
          <div className="flex justify-end mb-4">
             <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:scale-110 transition-transform">
               {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
          </div>

          <div className="text-center mb-10">
            <div className="inline-flex p-5 bg-blue-600 rounded-3xl text-white mb-6 shadow-xl shadow-blue-500/30">
              <Clock size={40} />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none">TIMEVAULT</h1>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Personal Edition</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-5">
            <input 
              type="text" placeholder="nome.cognome" required
              className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white border border-transparent dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={authData.username} onChange={e => setAuthData({...authData, username: e.target.value})}
            />
            <input 
              type="password" placeholder="Password" required
              className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 dark:text-white border border-transparent dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})}
            />
            {authError && <div className="text-red-600 dark:text-red-400 text-[11px] font-black bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{authError}</div>}
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
              {isSubmitting ? 'Verifica...' : authMode === 'login' ? 'Entra nel Vault' : 'Crea Credenziali'}
            </button>
          </form>
          <button 
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="w-full mt-8 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {authMode === 'login' ? "Nuovo utente? Registrati ora" : "Hai già un ID? Accedi"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 sticky top-0 z-10 px-8 h-20 flex justify-between items-center shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 dark:bg-white p-2.5 rounded-2xl text-white dark:text-slate-950 shadow-lg transition-colors"><Clock size={20} /></div>
          <h1 className="text-2xl font-black tracking-tighter italic leading-none">TIMEVAULT</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block bg-blue-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-blue-100 dark:border-slate-700">
            <p className="text-[9px] text-blue-400 dark:text-blue-300 font-black uppercase mb-0.5 leading-none text-right">Utente</p>
            <p className="text-sm font-black text-blue-700 dark:text-blue-400 uppercase italic leading-none">{user.displayName}</p>
          </div>
          
          {/* Tasto Toggle Tema */}
          <button 
            onClick={toggleTheme} 
            className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Cambia tema"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all border border-slate-100 dark:border-slate-800 hover:border-red-100">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Le tue Ore Standard</p>
            <p className="text-4xl font-black text-slate-800 dark:text-white">{stats.std}<span className="text-xs font-bold text-slate-300 dark:text-slate-600 ml-1">H</span></p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">I tuoi Straordinari</p>
            <p className="text-4xl font-black text-orange-600 dark:text-orange-500">+{stats.ext}<span className="text-xs font-bold text-orange-200 dark:text-orange-900/50 ml-1">H</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 h-fit sticky top-28 transition-colors">
            <h2 className="text-xs font-black mb-8 uppercase text-slate-400 italic tracking-widest">Aggiungi Voce</h2>
            <form onSubmit={handleSubmitLog} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Data</label>
                <input type="date" required className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-bold outline-none focus:border-blue-600 transition-all dark:[color-scheme:dark]" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Std (h)</label>
                  <input type="number" step="0.5" required placeholder="8" className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-black outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600" value={formData.standardHours} onChange={e => setFormData({...formData, standardHours: e.target.value})}/>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ext (h)</label>
                  <input type="number" step="0.5" required placeholder="0" className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-black text-orange-600 dark:text-orange-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600" value={formData.overtimeHours} onChange={e => setFormData({...formData, overtimeHours: e.target.value})}/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Note Personali</label>
                <textarea placeholder="Cosa hai fatto oggi?" className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-[1.25rem] font-medium outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600" rows="3" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
              </div>
              <button className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white p-5 rounded-[1.25rem] font-black uppercase tracking-widest shadow-xl shadow-slate-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2">
                <Plus size={18} /> Salva nel Vault
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/20 font-black text-xs uppercase text-slate-400 tracking-widest flex items-center gap-3">
              <Calendar size={18} className="text-blue-600 dark:text-blue-400" /> Il tuo Storico
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] text-slate-400 uppercase font-black border-b border-slate-50 dark:border-slate-800">
                    <th className="px-8 py-5">Data</th>
                    <th className="px-8 py-5 text-center">Std</th>
                    <th className="px-8 py-5 text-center">Ext</th>
                    <th className="px-8 py-5 text-right">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-sm">
                  {logs.length === 0 ? (
                    <tr><td colSpan="4" className="px-8 py-20 text-center italic text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">Nessun record presente</td></tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 group transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-500 dark:text-slate-400 italic">{new Date(log.date).toLocaleDateString('it-IT')}</td>
                        <td className="px-8 py-5 text-center font-black text-slate-700 dark:text-slate-200">{log.standardHours}h</td>
                        <td className="px-8 py-5 text-center font-black text-orange-600 dark:text-orange-500">{log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '—'}</td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => deleteLog(log.id)} className="text-slate-200 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash2 size={16}/>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <footer className="max-w-6xl mx-auto p-12 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.5em]">TimeVault Personal • v4.2 Dark Mode</footer>
    </div>
  );
}