import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  getDocs,
  query,
  where,
  setDoc,
  enableIndexedDbPersistence 
} from 'firebase/firestore';
import { 
  User, 
  Users, 
  CheckCircle, 
  FileText, 
  LogOut, 
  Award, 
  ChevronRight, 
  ClipboardList, 
  ShieldCheck, 
  Loader2, 
  Send, 
  Search, 
  Filter, 
  Trash2, 
  Calendar, 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  X, 
  Calculator, 
  Download, 
  FileSpreadsheet, 
  Percent, 
  Lock, 
  UserPlus, 
  Settings, 
  Building2, 
  WifiOff, 
  Wifi, 
  TrendingUp,
  MessageSquareQuote,
  Edit3,
  ListChecks,
  Boxes,
  Save,
  Briefcase,
  Camera,
  ImageIcon,
  Upload,
  CalendarDays
} from 'lucide-react';

// --- Konfigurasi Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "proyek-kamu.firebaseapp.com",
  projectId: "proyek-kamu",
  storageBucket: "proyek-kamu.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};

// --- Aktifkan Fitur Offline Sinkronisasi ---
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Persistence gagal: Multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.warn("Persistence gagal: Browser tidak mendukung.");
  }
});

const LIST_BULAN = [
  '1 - 31 Januari 2026', 
  '1 - 28 Februari 2026', 
  '1 - 31 Maret 2026',
  '1 - 30 April 2026',
  '1 - 31 Mei 2026',
  '1 - 30 Juni 2026'
];

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 z-[100] flex items-center p-4 rounded-xl shadow-lg border animate-in slide-in-from-right-10 ${
      type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
      <span className="text-sm font-bold">{message}</span>
    </div>
  );
};

const UserAvatar = ({ src, name, size = "md" }) => {
  const [error, setError] = useState(false);
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
  
  const sizeClasses = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-12 h-12 text-xs",
    lg: "w-20 h-20 text-xl",
    xl: "w-32 h-32 text-3xl"
  };

  if (src && !error) {
    return (
      <img 
        src={src} 
        alt={name} 
        onError={() => setError(true)}
        className={`${sizeClasses[size]} rounded-2xl object-cover shadow-sm border border-slate-100 bg-white`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-2xl bg-indigo-100 flex items-center justify-center font-black text-indigo-400 border border-indigo-200 shadow-sm`}>
      {initials}
    </div>
  );
};

export default function App() {
  const [userAuth, setUserAuth] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); 
  const [reports, setReports] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [view, setView] = useState('list');
  const [activeTab, setActiveTab] = useState(''); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState(LIST_BULAN[0]); 
  const [selectedReport, setSelectedReport] = useState(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    name: '',
    jobTitle: '',
    photoURL: '',
    roles: ['pegawai']
  });

  const fileInputRef = useRef(null);

  const [inputBulan, setInputBulan] = useState(LIST_BULAN[0]);
  const [tempActivities, setTempActivities] = useState([]);
  const [currentActivity, setCurrentActivity] = useState({ desc: '', target: '', realization: '', note: '', unit: '' });
  const [activityScores, setActivityScores] = useState({});
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const calculateFinalAverage = (report, scores) => {
    const activeReport = report || selectedReport;
    const activeScores = scores || activityScores;
    
    if (!activeReport) return 0;
    const acts = activeReport.activities || [];
    if (acts.length === 0) return 0;
    
    let sum = 0;
    acts.forEach(a => {
      const pct = parseFloat(a.achievementPct) || 0;
      const scoreValue = parseFloat(activeScores[a.id]) || 0;
      sum += (pct + scoreValue) / 2;
    });
    return sum / acts.length;
  };

  const getScoringProgress = (report, role) => {
    if (!report || !report.activities) return { scored: 0, total: 0, percent: 0 };
    const total = report.activities.length;
    let scored = 0;

    if (role === 'ketua_tim' || (role === 'pegawai' && report.status === 'diajukan')) {
      scored = report.activities.filter(a => {
        const scoreVal = activityScores[a.id] || a.scoreTim || 0;
        return parseFloat(scoreVal) > 0;
      }).length;
    } else if (role === 'pimpinan' || report.status === 'selesai' || report.status === 'dinilai_tim') {
      scored = report.activities.filter(a => {
        const scoreVal = activityScores[a.id] || a.scorePimpinan || 0;
        return parseFloat(scoreVal) > 0;
      }).length;
    }
    
    return {
      scored,
      total,
      percent: total > 0 ? (scored / total) * 100 : 0
    };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("File terlalu besar, maksimal 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300; 
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const base64data = canvas.toDataURL('image/jpeg', 0.7);
        setNewUserData(prev => ({ ...prev, photoURL: base64data }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); showToast("Koneksi pulih. Sinkronisasi otomatis..."); };
    const handleOffline = () => { setIsOnline(false); showToast("Anda Offline. Data disimpan lokal.", "error"); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        await seedDefaultUsers();
      } catch (err) { console.error("Auth Init Error:", err); }
      finally { setAuthLoading(false); }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUserAuth(u));
    return () => unsubscribeAuth();
  }, []);

  const seedDefaultUsers = async () => {
    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'kinerja_users');
      const snapshot = await getDocs(usersRef);
      if (snapshot.empty) {
        const demoUsers = [
          { username: 'admin', password: '123', name: 'Administrator PIRU', jobTitle: 'Pranata Komputer Madya', roles: ['admin', 'pegawai', 'ketua_tim', 'pimpinan'], photoURL: '' },
          { username: 'pimpinan', password: '123', name: 'Kepala BPS SBB', jobTitle: 'Kepala BPS Kabupaten', roles: ['pimpinan'], photoURL: '' },
          { username: 'pegawai1', password: '123', name: 'Pegawai Contoh', jobTitle: 'Statistisi Ahli Pertama', roles: ['pegawai'], photoURL: '' },
        ];
        for (const u of demoUsers) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kinerja_users', u.username), u);
        }
      }
    } catch (e) { console.error("Seed Error:", e); }
  };

  useEffect(() => {
    if (!userAuth || !currentUser) return;
    const reportsRef = collection(db, 'artifacts', appId, 'public', 'data', 'kinerja_reports_v4');
    const unsubscribeReports = onSnapshot(reportsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReports(data);
      setLoading(false);
    });
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'kinerja_users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => doc.data()));
    });
    return () => { unsubscribeReports(); unsubscribeUsers(); };
  }, [userAuth, currentUser]);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    setAuthLoading(true);
    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'kinerja_users');
      const q = query(usersRef, where("username", "==", loginUsername.toLowerCase()));
      const snapshot = await getDocs(q);
      const foundDoc = snapshot.docs.find(d => d.data().password === loginPassword);
      if (foundDoc) {
        const userData = foundDoc.data();
        setCurrentUser(userData);
        if (userData.roles?.includes('admin')) setActiveTab('admin');
        else if (userData.roles?.includes('pimpinan')) setActiveTab('pimpinan');
        else if (userData.roles?.includes('ketua_tim')) setActiveTab('ketua_tim');
        else setActiveTab('pegawai');
        showToast(`Selamat datang, ${userData.name}!`);
      } else {
        setLoginError('Username atau password salah.');
      }
    } catch (err) { setLoginError('Gagal menghubungkan ke database.'); }
    finally { setAuthLoading(false); }
  };

  const handleCreateUser = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'kinerja_users', newUserData.username.toLowerCase());
      await setDoc(userRef, { ...newUserData, username: newUserData.username.toLowerCase() });
      setShowUserModal(false);
      setNewUserData({ username: '', password: '', name: '', jobTitle: '', photoURL: '', roles: ['pegawai'] });
      showToast("User berhasil didaftarkan");
    } catch (err) { showToast("Gagal mendaftarkan user", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDeleteUser = async (username) => {
    if (username === 'admin') return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kinerja_users', username));
      showToast("User telah dihapus");
    } catch (err) { showToast("Gagal menghapus", "error"); }
  };

  const toggleRole = (role) => {
    const r = [...newUserData.roles];
    r.includes(role) ? setNewUserData({...newUserData, roles: r.filter(x => x !== role)}) : setNewUserData({...newUserData, roles: [...r, role]});
  };

  const calculatedPercentage = useMemo(() => {
    const target = parseFloat(currentActivity.target) || 0;
    const real = parseFloat(currentActivity.realization) || 0;
    return target === 0 ? 0 : Math.min((real / target) * 100, 100);
  }, [currentActivity.target, currentActivity.realization]);

  const addActivityToTemp = () => {
    if (!currentActivity.desc || !currentActivity.target) return;
    setTempActivities([...tempActivities, { 
      ...currentActivity, 
      achievementPct: calculatedPercentage, 
      id: 'act_' + Date.now(), 
      scoreTim: 0, 
      scorePimpinan: 0 
    }]);
    setCurrentActivity({ desc: '', target: '', realization: '', note: '', unit: '' });
  };

  const startEditReport = (report) => {
    setIsEditingExisting(true);
    setEditingDocId(report.id);
    setInputBulan(report.month);
    setTempActivities([...(report.activities || [])]);
    setView('create');
  };

  const handleSubmitMonthlyReport = async () => {
    setSubmitting(true);
    try {
      const reportsRef = collection(db, 'artifacts', appId, 'public', 'data', 'kinerja_reports_v4');
      const existingInView = reports.find(r => r.month === inputBulan && r.employeeId === currentUser.username);

      if (isEditingExisting && editingDocId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kinerja_reports_v4', editingDocId), {
          activities: tempActivities,
          updatedAt: serverTimestamp()
        });
        showToast("Laporan diperbarui");
      } else if (existingInView) {
        const mergedActivities = [...(existingInView.activities || []), ...tempActivities];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kinerja_reports_v4', existingInView.id), {
          activities: mergedActivities,
          updatedAt: serverTimestamp()
        });
        showToast("Kegiatan ditambahkan ke laporan " + inputBulan);
      } else {
        await addDoc(reportsRef, {
          employeeId: currentUser.username,
          employeeName: currentUser.name,
          employeeJob: currentUser.jobTitle || "-",
          employeePhoto: currentUser.photoURL || "",
          month: inputBulan,
          activities: tempActivities,
          status: 'diajukan',
          createdAt: serverTimestamp()
        });
        showToast("Laporan baru disimpan");
      }
      
      setView('list');
      setTempActivities([]);
      setIsEditingExisting(false);
      setEditingDocId(null);
    } catch (e) { showToast("Gagal menyimpan perubahan", "error"); }
    finally { setSubmitting(false); }
  };

  const handleUpdateScoreTim = async () => {
    const acts = selectedReport.activities.map(a => ({ 
      ...a, 
      scoreTim: parseFloat(activityScores[a.id] || 0) 
    }));
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kinerja_reports_v4', selectedReport.id), { activities: acts, status: 'dinilai_tim' });
    setSelectedReport(null);
    showToast("Verifikasi tim disimpan");
  };

  const handleUpdateScorePimpinan = async () => {
    const acts = selectedReport.activities.map(a => ({ 
      ...a, 
      scorePimpinan: parseFloat(activityScores[a.id] || 0) 
    }));
    const rawValue = calculateFinalAverage(selectedReport, activityScores);
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kinerja_reports_v4', selectedReport.id), {
      activities: acts,
      scorePimpinan: Math.round(rawValue),
      scorePimpinanRaw: rawValue,
      status: 'selesai'
    });
    setSelectedReport(null);
    showToast(selectedReport.status === 'selesai' ? "Perubahan nilai berhasil disimpan" : "Validasi selesai");
  };

  const handleExportExcel = () => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
      script.onload = () => processExport();
      document.head.appendChild(script);
    } else processExport();
  };

  const processExport = () => {
    const workbook = window.XLSX.utils.book_new();
    const pimpinan = allUsers.find(u => u.roles?.includes('pimpinan') && u.username !== 'admin');
    const pimpinanName = pimpinan ? pimpinan.name : "..........................";
    const pimpinanJob = pimpinan ? pimpinan.jobTitle : "Kepala BPS Kabupaten Seram Bagian Barat";
    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    if (filteredReports.length === 0) {
      showToast("Tidak ada data untuk bulan ini", "error");
      return;
    }

    filteredReports.forEach((report) => {
      const sheetRows = [
        ["LAPORAN CAPAIAN KINERJA PEGAWAI - RIIL (CKP-R)"], 
        ["BADAN PUSAT STATISTIK KABUPATEN SERAM BAGIAN BARAT"], 
        [],
        ["NAMA PEGAWAI", ": " + (report.employeeName || "-")],
        ["JABATAN", ": " + (report.employeeJob || "-")],
        ["PERIODE", ": " + (report.month || "-")],
        [],
        ["NO", "URAIAN KEGIATAN", "SATUAN", "TARGET", "REALISASI", "PERSENTASE (%)", "% Tingkat Kualitas", "Nilai Rata-Rata", "KETERANGAN"]
      ];

      (report.activities || []).forEach((act, idx) => {
        const pct = act.achievementPct || 0;
        const pimp = act.scorePimpinan || 0;
        sheetRows.push([
          idx + 1, 
          act.desc || "-", 
          act.unit || "-",
          act.target || 0, 
          act.realization || 0, 
          pct.toFixed(2), 
          pimp, 
          ((pct + pimp) / 2).toFixed(2), 
          act.note || "-"
        ]);
      });

      // Update Baris Total Label
      sheetRows.push(["", "Capaian Kinerja Pegawai (CKP)", "", "", "", "", "", report.scorePimpinan || "0", ""]);
      sheetRows.push([]);
      sheetRows.push(["", "", "", "", "", "", "Piru, " + dateStr]);
      sheetRows.push(["", "", "", "", "", "", pimpinanJob]);
      sheetRows.push([]);
      sheetRows.push([]);
      sheetRows.push([]);
      sheetRows.push(["", "", "", "", "", "", pimpinanName]);

      const ws = window.XLSX.utils.aoa_to_sheet(sheetRows);
      
      // Pengaturan lebar kolom presisi
      ws['!cols'] = [
        {wch: 4},  // NO
        {wch: 48}, // URAIAN
        {wch: 10}, // SATUAN
        {wch: 10}, // TARGET
        {wch: 12}, // REALISASI
        {wch: 15}, // PERSENTASE
        {wch: 20}, // % TINGKAT KUALITAS (Dulu Skor Pimpinan)
        {wch: 15}, // NILAI RATA-RATA (Dulu Nilai Akhir)
        {wch: 25}  // KET
      ];

      const sheetName = (report.employeeName || "Sheet").substring(0, 31).replace(/[\\/?*[\]]/g, '');
      window.XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });

    window.XLSX.writeFile(workbook, `CKPR_PIRU_SBB_${filterMonth.replace(/ /g, '_')}.xlsx`);
  };

  const filteredReports = useMemo(() => {
    if (!currentUser) return [];
    return reports.filter(r => {
      const name = r.employeeName || "";
      const matchSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMonth = filterMonth === 'Semua Bulan' || r.month === filterMonth;
      
      const isAdmin = currentUser?.roles?.includes('admin');
      if (activeTab === 'pegawai' && !isAdmin) {
        return r.employeeId === currentUser?.username && matchSearch && matchMonth;
      }
      return matchSearch && matchMonth;
    });
  }, [reports, searchTerm, filterMonth, currentUser, activeTab]);

  useEffect(() => {
    if (selectedReport) {
      const init = {};
      (selectedReport.activities || []).forEach(a => {
        init[a.id] = (activeTab === 'pimpinan' || activeTab === 'admin') 
          ? (a.scorePimpinan || a.scoreTim || 0) 
          : (a.scoreTim || 0);
      });
      setActivityScores(init);
    }
  }, [selectedReport, activeTab]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-50/50 flex items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-[3.5rem] shadow-2xl overflow-hidden border border-white p-2 text-center">
          <div className="p-12 text-center relative rounded-[3rem]">
             <div className="relative z-10 flex flex-col items-center text-center">
               <h1 className="text-7xl font-black text-indigo-400 tracking-tighter leading-none mb-3">PIRU</h1>
               <div className="h-1.5 w-12 bg-indigo-200 rounded-full mb-8"></div>
               <div className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em] leading-none mb-8 flex justify-center items-baseline gap-1">
                 <span><span className="text-indigo-500 text-sm font-black">P</span>enilaian</span>
                 <span>k<span className="text-indigo-500 text-sm font-black">I</span>ne<span className="text-indigo-500 text-sm font-black">R</span>ja</span>
                 <span>b<span className="text-indigo-500 text-sm font-black">U</span>lanan</span>
               </div>
               <div className="space-y-1 text-center">
                  <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">Badan Pusat Statistik</p>
                  <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Kab. Seram Bagian Barat</p>
               </div>
             </div>
          </div>
          <form onSubmit={handleLogin} className="px-10 py-12 space-y-4">
            {loginError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center justify-center gap-2"><AlertCircle size={14}/>{loginError}</div>}
            <input type="text" placeholder="Username" required className="w-full p-5 bg-indigo-50/30 border-2 border-transparent rounded-2xl focus:border-indigo-300 focus:bg-white outline-none font-bold text-slate-600 transition-all shadow-sm" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
            <input type="password" placeholder="Password" required className="w-full p-5 bg-indigo-50/30 border-2 border-transparent rounded-2xl focus:border-indigo-300 focus:bg-white outline-none font-bold text-slate-600 transition-all shadow-sm" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            <button disabled={authLoading} type="submit" className="w-full bg-indigo-400 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-3">
              {authLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
              <span>MASUK PIRU</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => { setView('list'); setIsEditingExisting(false); }}>
            <div className="border-l-4 border-indigo-400 pl-4">
              <h2 className="font-black text-indigo-500 leading-none text-3xl tracking-tighter">PIRU</h2>
              <p className="text-[10px] text-indigo-400 font-black uppercase mt-1 tracking-tighter leading-none">Badan Pusat Statistik</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">Kab. Seram Bagian Barat</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
                <UserAvatar src={currentUser.photoURL} name={currentUser.name} size="md" />
                <div className="hidden lg:block text-right">
                   <p className="text-xs font-black text-slate-900 uppercase leading-none">{currentUser.name}</p>
                   <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter mt-1">{currentUser.jobTitle || "User"}</p>
                </div>
             </div>
             <button onClick={() => setCurrentUser(null)} className="p-3 bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center justify-center gap-2 px-5 group">
                <LogOut size={18} />
             </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-8">
        
        <div className="flex flex-wrap bg-slate-200/50 p-1.5 rounded-3xl mb-10 w-fit gap-1 shadow-inner">
           {(currentUser?.roles || []).map(role => (
             <button 
              key={role} onClick={() => { setActiveTab(role); setView('list'); }}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === role ? 'bg-white text-indigo-500 shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
             >
               {role === 'admin' ? 'Pengaturan' : role === 'ketua_tim' ? 'Verifikasi' : role}
             </button>
           ))}
        </div>

        {activeTab === 'admin' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
               <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Daftar Pegawai</h3>
               <button onClick={() => setShowUserModal(true)} className="bg-indigo-400 text-white px-8 py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-2xl shadow-indigo-100 hover:bg-indigo-500 transition-all hover:-translate-y-1">
                  <UserPlus size={18} /> TAMBAH PEGAWAI
               </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {allUsers.map(u => (
                 <div key={u.username} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-2xl hover:border-indigo-100 transition-all group">
                    <div>
                       <div className="flex items-center gap-4 mb-6">
                          <UserAvatar src={u.photoURL} name={u.name} size="lg" />
                          <div className="flex-1">
                             <h4 className="font-black text-slate-800 text-xl leading-tight">{u.name}</h4>
                             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 italic leading-tight">{u.jobTitle || "-"}</p>
                          </div>
                       </div>
                       <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5 leading-none">ID: {u.username}</p>
                       <div className="flex flex-wrap gap-1.5 mt-4">
                          {(u.roles || []).map(r => (
                            <span key={r} className="text-[8px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg uppercase tracking-tighter group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">{r}</span>
                          ))}
                       </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                       <div className="flex items-center justify-center gap-2 text-slate-300">
                          <Lock size={12}/>
                          <p className="text-[10px] font-bold uppercase tracking-widest">{u.password}</p>
                       </div>
                       {u.username !== 'admin' && (
                         <button onClick={() => handleDeleteUser(u.username)} className="text-slate-200 hover:text-red-500 transition-colors p-2"><Trash2 size={20}/></button>
                       )}
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab !== 'admin' && view === 'list' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
              <div className="space-y-1">
                 <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">CKP-R</h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Badan Pusat Statistik Kab. SBB</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="relative flex-1 md:flex-initial">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <input 
                    type="text" placeholder="Cari nama pegawai..." 
                    className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-3xl text-sm focus:border-indigo-400 outline-none shadow-sm font-bold w-full md:w-64 transition-all"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                <div className="relative flex-1 md:flex-initial">
                   <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <select 
                    className="pl-12 pr-10 py-4 bg-white border border-slate-200 rounded-3xl text-sm focus:border-indigo-400 outline-none shadow-sm font-black uppercase tracking-tighter w-full md:w-64 appearance-none cursor-pointer"
                    value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                   >
                     <option value="Semua Bulan">Semua Bulan</option>
                     {LIST_BULAN.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                </div>
                <button onClick={handleExportExcel} className="bg-white text-slate-700 border border-slate-200 px-6 py-4 rounded-3xl font-black text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"><FileSpreadsheet size={18} />CETAK</button>
                {activeTab === 'pegawai' && <button onClick={() => { setView('create'); setIsEditingExisting(false); setTempActivities([]); }} className="bg-indigo-400 text-white px-8 py-4 rounded-3xl font-black text-xs shadow-2xl shadow-indigo-100 hover:bg-indigo-500 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"><Plus size={18}/>INPUT</button>}
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex justify-center items-center"><Loader2 className="animate-spin text-indigo-400" size={40}/></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReports.map(report => {
                  const progress = getScoringProgress(report, activeTab);
                  return (
                    <div key={report.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden cursor-pointer" onClick={() => setSelectedReport(report)}>
                      <div className="flex justify-between items-start mb-6 text-center">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${report.status === 'selesai' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{report.status?.toString().replace('_', ' ') || "status"}</span>
                        <div className="flex items-center justify-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-widest text-center">
                           <Calendar size={12}/>
                           {report.month || "-"}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mb-4">
                         <UserAvatar src={report.employeePhoto} name={report.employeeName} size="md" />
                         <div className="flex-1 overflow-hidden text-left">
                            <h4 className="font-black text-slate-800 text-xl group-hover:text-indigo-500 transition-colors leading-tight truncate text-left">{report.employeeName || "Tanpa Nama"}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate text-left">{report.employeeJob || "-"}</p>
                         </div>
                      </div>
                      
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full transition-all duration-500 ${progress.percent === 100 ? 'bg-emerald-400' : 'bg-amber-400'}`} 
                            style={{ width: `${progress.percent}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 tabular-nums uppercase tracking-tighter">
                          {progress.scored}/{progress.total} Dinilai
                        </span>
                      </div>
                      
                      <div className="mt-10 pt-8 border-t border-slate-50 flex justify-between items-end">
                        <div className="space-y-1 text-left">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none mb-2 text-left">Skor Akhir</p>
                          <p className={`text-6xl font-black tracking-tighter tabular-nums text-left ${report.status === 'selesai' ? 'text-indigo-400' : 'text-slate-100'}`}>{report.scorePimpinan || '-'}</p>
                        </div>
                        <div className="flex gap-2">
                          {activeTab === 'pegawai' && report.status === 'diajukan' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); startEditReport(report); }}
                              className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-inner"
                            >
                              <Edit3 size={20} />
                            </button>
                          )}
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-indigo-400 group-hover:text-white transition-all shadow-inner">
                             <ChevronRight size={24} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {filteredReports.length === 0 && !loading && (
               <div className="py-20 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                  <FileText size={64} className="mx-auto text-slate-200 mb-6" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Tidak ada laporan ditemukan untuk periode ini</p>
               </div>
            )}
          </div>
        )}

        {view === 'create' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-12">
            <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-50">
               <div className="flex justify-between items-center mb-12">
                  <div className="space-y-1 text-left">
                     <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase text-left">
                       {isEditingExisting ? 'Edit CKP-R' : 'Input CKP-R'}
                     </h3>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] text-left">PIRU • BPS Kab. SBB</p>
                  </div>
                  <button onClick={() => { setView('list'); setIsEditingExisting(false); }} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><X size={24} /></button>
               </div>
               
               <div className="mb-10 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 block mb-3 text-left">Pilih Periode Laporan</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                     {LIST_BULAN.map(m => (
                       <button 
                        key={m} 
                        disabled={isEditingExisting}
                        onClick={() => setInputBulan(m)}
                        className={`py-4 px-2 rounded-2xl font-black text-[9px] uppercase transition-all ${inputBulan === m ? 'bg-indigo-400 text-white shadow-xl shadow-indigo-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-50'}`}
                       >
                         {m}
                       </button>
                     ))}
                  </div>
               </div>

               <div className="bg-slate-50 p-8 rounded-[3.5rem] space-y-6 shadow-inner text-left">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                     <div className="md:col-span-12 text-left">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 mb-2 block text-left">Uraian Pekerjaan</label>
                        <input className="w-full p-5 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:border-indigo-400 outline-none text-left" placeholder="Masukkan rincian pekerjaan..." value={currentActivity.desc} onChange={(e) => setCurrentActivity({...currentActivity, desc: e.target.value})} />
                     </div>
                     <div className="md:col-span-2 text-left">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 mb-2 block text-left">Satuan</label>
                        <input className="w-full p-5 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:border-indigo-400 outline-none text-left" placeholder="Eks/Dok" value={currentActivity.unit} onChange={(e) => setCurrentActivity({...currentActivity, unit: e.target.value})} />
                     </div>
                     <div className="md:col-span-2 text-left">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 mb-2 block text-left">Target</label>
                        <input className="w-full p-5 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm text-left" type="number" placeholder="0" value={currentActivity.target} onChange={(e) => setCurrentActivity({...currentActivity, target: e.target.value})} />
                     </div>
                     <div className="md:col-span-2 text-left">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 mb-2 block text-left">Realisasi</label>
                        <input className="w-full p-5 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm text-left" type="number" placeholder="0" value={currentActivity.realization} onChange={(e) => setCurrentActivity({...currentActivity, realization: e.target.value})} />
                     </div>
                     <div className="md:col-span-6 text-left">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 mb-2 block text-left">Keterangan (Opsional)</label>
                        <input className="w-full p-5 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm text-left" type="text" placeholder="Catatan kegiatan" value={currentActivity.note} onChange={(e) => setCurrentActivity({...currentActivity, note: e.target.value})} />
                     </div>
                     <div className="md:col-span-12 flex items-center justify-end gap-3 pt-2">
                        <div className="px-6 bg-indigo-400 rounded-2xl flex flex-col justify-center items-center h-[62px] shadow-lg shadow-indigo-100 min-w-[120px] text-center">
                           <p className="text-[8px] font-black text-white/60 uppercase leading-none tracking-widest text-center">Persentase</p>
                           <p className="text-sm font-black text-white mt-1 text-center">{calculatedPercentage.toFixed(1)}%</p>
                        </div>
                        <button onClick={addActivityToTemp} className="bg-slate-900 text-white px-8 rounded-2xl hover:bg-black h-[62px] flex items-center justify-center gap-2 shadow-xl transition-transform active:scale-95 font-black text-xs uppercase tracking-widest">
                           <Plus size={24} /> TAMBAH KE DAFTAR
                        </button>
                     </div>
                  </div>
               </div>

               <div className="mt-10 space-y-4 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 text-left">Daftar Kegiatan CKP-R:</p>
                  {tempActivities.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-slate-100 rounded-[2.5rem] text-center">
                       <p className="text-xs font-bold text-slate-300 uppercase tracking-widest text-center">Belum ada kegiatan</p>
                    </div>
                  ) : (
                    tempActivities.map((act, idx) => (
                      <div key={act.id} className="flex items-center justify-between bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm animate-in slide-in-from-left-4 text-left">
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold text-slate-800 text-left">{idx + 1}. {act.desc}</p>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-[9px] font-black uppercase text-slate-400 tracking-widest text-left">
                             <span className="flex items-center justify-center gap-1"><Boxes size={10}/> Satuan: {act.unit || "-"}</span>
                             <span className="flex items-center justify-center gap-1"><TrendingUp size={10}/> Target: {act.target}</span>
                             <span className="text-left">Real: {act.realization}</span>
                             <span className="text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-lg text-left">Capaian: {act.achievementPct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <button onClick={() => setTempActivities(tempActivities.filter(x => x.id !== act.id))} className="text-slate-200 hover:text-red-500 p-3 transition-colors" title="Hapus Kegiatan"><Trash2 size={20} /></button>
                      </div>
                    ))
                  )}
               </div>

               <div className="mt-12 pt-8 border-t border-slate-50 text-center">
                  <button disabled={submitting || tempActivities.length === 0} onClick={handleSubmitMonthlyReport} className="w-full bg-indigo-400 text-white py-6 rounded-[3rem] font-black text-xl shadow-2xl shadow-indigo-100 hover:bg-indigo-500 transition-all flex items-center justify-center gap-4 active:scale-95">
                     {submitting ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                     {isEditingExisting ? 'SIMPAN PERUBAHAN CKP-R' : 'SIMPAN & KIRIM CKP-R'}
                  </button>
               </div>
            </div>
          </div>
        )}

        {showUserModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in">
             <div className="bg-white rounded-[4rem] max-w-md w-full shadow-2xl overflow-hidden border border-white/20">
                <div className="p-10 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center text-left">
                   <h3 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em] text-left">Tambah Pegawai</h3>
                   <button onClick={() => setShowUserModal(false)} className="text-slate-300 hover:text-red-500 font-bold p-3 transition-colors"><X size={24}/></button>
                </div>
                <form onSubmit={handleCreateUser} className="p-10 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-left">
                   <div className="flex flex-col items-center justify-center gap-4 py-2 border-b border-dashed border-slate-100 mb-2 text-center">
                      <UserAvatar src={newUserData.photoURL} name={newUserData.name || "Preview"} size="xl" />
                      <div className="flex gap-2 justify-center text-center">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden text-center" 
                          accept="image/*" 
                          onChange={handleFileUpload} 
                        />
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current.click()}
                          className="px-4 py-2 bg-indigo-50 text-indigo-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all shadow-inner text-center"
                        >
                          <Upload size={14}/> Pilih Foto Perangkat
                        </button>
                      </div>
                   </div>

                   <div className="space-y-1 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block mb-2 text-left">Nama Lengkap</label>
                      <input type="text" required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-400 outline-none font-bold shadow-inner text-left" placeholder="Budi Santoso" value={newUserData.name} onChange={(e) => setNewUserData({...newUserData, name: e.target.value})} />
                   </div>
                   <div className="space-y-1 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block mb-2 text-left">Jabatan</label>
                      <input type="text" required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-400 outline-none font-bold shadow-inner text-left" placeholder="Statistisi Ahli Pertama" value={newUserData.jobTitle} onChange={(e) => setNewUserData({...newUserData, jobTitle: e.target.value})} />
                   </div>
                   <div className="space-y-1 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block mb-2 flex items-center gap-2 text-left">
                        <ImageIcon size={12}/> Atau Masukkan URL Foto
                      </label>
                      <input type="url" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-400 outline-none font-bold shadow-inner text-left" placeholder="https://..." value={newUserData.photoURL} onChange={(e) => setNewUserData({...newUserData, photoURL: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-2 gap-4 text-left">
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-2 text-left">Username</label>
                        <input type="text" required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-400 outline-none font-bold shadow-inner text-left" placeholder="budi123" value={newUserData.username} onChange={(e) => setNewUserData({...newUserData, username: e.target.value})} />
                      </div>
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-2 text-left">Password</label>
                        <input type="text" required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-400 outline-none font-bold shadow-inner text-left" placeholder="123" value={newUserData.password} onChange={(e) => setNewUserData({...newUserData, password: e.target.value})} />
                      </div>
                   </div>
                   <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-3 text-left">Hak Akses</label>
                      <div className="flex flex-wrap gap-2 text-left">
                         {['pegawai', 'ketua_tim', 'pimpinan', 'admin'].map(r => (
                           <button key={r} type="button" onClick={() => toggleRole(r)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${newUserData.roles.includes(r) ? 'bg-indigo-400 text-white shadow-xl shadow-indigo-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                              {r}
                           </button>
                         ))}
                      </div>
                   </div>
                   <button disabled={submitting} type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase shadow-2xl hover:bg-black mt-4 flex items-center justify-center gap-3 transition-all text-center">
                      {submitting ? <Loader2 className="animate-spin" /> : <UserPlus size={20}/>}
                      DAFTARKAN PEGAWAI
                   </button>
                </form>
             </div>
          </div>
        )}

        {selectedReport && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in">
             <div className="bg-white rounded-[4rem] max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-white/20">
                <div className="px-12 py-10 bg-slate-50/50 border-b flex justify-between items-center text-left">
                   <div className="flex items-center gap-5 text-left">
                      <UserAvatar src={selectedReport.employeePhoto} name={selectedReport.employeeName} size="xl" />
                      <div className="space-y-1 text-left">
                        <h3 className="font-black text-slate-900 text-xs tracking-[0.3em] uppercase leading-none text-left">Detail CKP-R</h3>
                        <p className="text-3xl font-black text-indigo-400 leading-none text-left">{selectedReport.employeeName || "Tanpa Nama"}</p>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1 italic leading-tight text-left">{selectedReport.employeeJob || "-"}</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedReport(null)} className="p-3 bg-white rounded-2xl text-slate-300 hover:text-red-500 shadow-sm transition-all text-center"><X size={24} /></button>
                </div>
                <div className="p-12 overflow-y-auto flex-1 space-y-8 text-left">
                   
                   <div className="flex flex-wrap gap-4 text-left">
                      <div className="flex items-center justify-center gap-3 text-indigo-400 bg-indigo-50 px-6 py-3 rounded-2xl w-fit border border-indigo-100 shadow-sm text-center">
                         <Calculator size={20} />
                         <span className="text-sm font-black uppercase tracking-widest text-center">Rerata: {calculateFinalAverage(selectedReport, activityScores).toFixed(2)}</span>
                      </div>
                      
                      <div className="flex items-center justify-center gap-3 text-amber-600 bg-amber-50 px-6 py-3 rounded-2xl w-fit border border-amber-100 shadow-sm text-center">
                         <ListChecks size={20} />
                         <span className="text-sm font-black uppercase tracking-widest text-center">
                           Progres: {getScoringProgress(selectedReport, activeTab).scored}/{getScoringProgress(selectedReport, activeTab).total} Dinilai
                         </span>
                      </div>
                   </div>

                   <div className="space-y-4 text-left">
                      {(selectedReport.activities || []).map((act, i) => {
                         const pct = act.achievementPct || 0;
                         const scoreValue = parseFloat(activityScores[act.id] || 0);
                         const isPending = (activeTab === 'ketua_tim' && scoreValue === 0 && selectedReport.status !== 'selesai') || (activeTab === 'pimpinan' && scoreValue === 0);
                         const canInputThisScore = (activeTab === 'ketua_tim' && selectedReport.status !== 'selesai') || (activeTab === 'pimpinan') || (activeTab === 'admin');

                         return (
                           <div key={act.id} className={`bg-white p-6 rounded-[3rem] border-2 shadow-sm space-y-5 transition-all text-left ${isPending ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100 hover:border-indigo-200'}`}>
                              <div className="flex justify-between items-start text-left">
                                 <p className="text-base font-bold text-slate-800 leading-tight flex-1 text-left">{i+1}. {act.desc || "-"}</p>
                                 <div className="text-right ml-6 shrink-0 bg-indigo-50 p-3 rounded-2xl border border-indigo-100 text-center">
                                   <p className="text-[9px] font-black text-indigo-400 uppercase leading-none tracking-widest mb-1 text-center">Skor</p>
                                   <p className="text-xl font-black text-indigo-400 tabular-nums leading-none text-center">{( (pct + scoreValue) / 2 ).toFixed(1)}</p>
                                 </div>
                              </div>
                              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-black uppercase text-slate-400 border-b border-slate-50 pb-4 tracking-widest text-left">
                                 <span className="text-left">Satuan: {act.unit || "-"}</span>
                                 <span className="text-left">Tgt: {act.target || 0}</span>
                                 <span className="text-left">Real: {act.realization || 0}</span>
                                 <span className="text-indigo-400 text-left">Cap: {pct.toFixed(1)}%</span>
                              </div>
                              {canInputThisScore && (
                                <div className="space-y-3 pt-2 text-left">
                                   <div className="flex justify-between items-center text-left">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1 text-left">Input Nilai</label>
                                      {isPending && <span className="text-[8px] font-black text-amber-500 uppercase bg-amber-100 px-2 py-0.5 rounded-md animate-pulse text-center">Belum Dinilai</span>}
                                   </div>
                                   <input type="number" step="0.01" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-indigo-400 outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner text-left" value={activityScores[act.id] || ''} onChange={(e) => setActivityScores({...activityScores, [act.id]: e.target.value})} />
                                </div>
                              )}
                           </div>
                         )
                      })}
                   </div>
                   
                   {(activeTab === 'ketua_tim' || activeTab === 'pimpinan') && (
                      <div className="pt-8 border-t border-slate-100 space-y-4 text-center">
                         {activeTab === 'ketua_tim' && selectedReport.status !== 'selesai' && (
                           <div className="space-y-2 text-center">
                              <button onClick={handleUpdateScoreTim} className="w-full bg-indigo-400 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase shadow-2xl shadow-indigo-100 hover:bg-indigo-500 transition-all active:scale-95 text-center">
                                {selectedReport.status === 'dinilai_tim' ? 'UPDATE PENILAIAN TIM' : 'KIRIM KE PIMPINAN'}
                              </button>
                           </div>
                         )}
                         {activeTab === 'pimpinan' && (
                           <div className="space-y-2 text-center">
                              <button disabled={getScoringProgress(selectedReport, 'pimpinan').percent < 100 && selectedReport.status !== 'selesai'} onClick={handleUpdateScorePimpinan} className="w-full bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase shadow-2xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-30 text-center">
                                <div className="flex items-center justify-center gap-3 text-center">
                                  {selectedReport.status === 'selesai' ? <Save size={20}/> : null}
                                  {selectedReport.status === 'selesai' ? 'SIMPAN PERUBAHAN NILAI' : 'FINALISASI NILAI AKHIR'}
                                </div>
                              </button>
                           </div>
                         )}
                      </div>
                   )}
                   
                   {selectedReport.status === 'selesai' && (
                      <div className="bg-indigo-400 p-12 rounded-[4rem] text-center shadow-2xl animate-in zoom-in-95 relative overflow-hidden mt-8 text-center">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl text-center"></div>
                         <Award className="text-white mx-auto mb-6 opacity-60 text-center" size={64} />
                         <p className="text-blue-100 font-bold uppercase text-[10px] tracking-[0.5em] mb-4 leading-none text-center">Skor Akhir CKP-R</p>
                         <h2 className="text-9xl font-black text-white leading-none tracking-tighter tabular-nums text-center">{selectedReport.scorePimpinan || 0}</h2>
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );

}
