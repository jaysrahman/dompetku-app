import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Wallet, CreditCard, PieChart, TrendingUp, TrendingDown, Pencil, X, GripVertical, Save, LogIn, LogOut, User, Clock } from 'lucide-react';

// Import modul Firebase
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, onSnapshot, doc, writeBatch } from "firebase/firestore";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inisialisasi Firebase
let app, auth, db;
try {
  if (!firebaseConfig.apiKey) {
    // Silent fail
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Gagal inisialisasi Firebase:", error);
}

const appId = 'dompetku-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const [editId, setEditId] = useState(null);

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    type: "expense",
    method: "cash"
  });

  // Cek Config
  useEffect(() => {
    if (!firebaseConfig.apiKey) {
      setConfigError(true);
      setLoading(false);
    }
  }, []);

  // 1. Monitor Status Login
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
    });
    return () => unsubscribe();
  }, []);

  // --- FUNGSI LOGIN & LOGOUT ---
  const handleGoogleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Gagal Login Google:", error);
      alert("Gagal Login: " + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setTransactions([]); 
    } catch (error) {
      console.error("Gagal Logout:", error);
    }
  };

  // 2. Mengambil Data Real-time
  useEffect(() => {
    if (!user || !db) return;

    setLoading(true);
    const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    
    const unsubscribe = onSnapshot(transactionsRef, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        data.sort((a, b) => {
          const orderA = a.order ?? a.createdAt;
          const orderB = b.order ?? b.createdAt;
          return orderB - orderA;
        });
        
        setTransactions(data);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal mengambil data:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- UTILITIES ---
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(number);
  };

  const getUserName = () => {
    return user ? (user.displayName || user.email) : "Anonim";
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const totalBalance = totalIncome - totalExpense;

  const cashTransactions = transactions.filter(t => t.method === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
  const cashlessTransactions = transactions.filter(t => t.method === 'cashless').reduce((acc, curr) => acc + curr.amount, 0);
  const totalFlow = cashTransactions + cashlessTransactions;
  
  const calculatePercentage = (part, total) => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- CRUD (CREATE, UPDATE, DELETE) ---
  const handleEdit = (t) => {
    setEditId(t.id);
    setFormData({ description: t.description, amount: t.amount, type: t.type, method: t.method });
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setFormData({ description: "", amount: "", type: "expense", method: "cash" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !user || !db) return;

    try {
      const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
      
      if (editId) {
        // --- LOGIKA UPDATE ---
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editId);
        await updateDoc(docRef, {
          description: formData.description,
          amount: parseFloat(formData.amount),
          type: formData.type,
          method: formData.method,
          // Tambahkan Audit Trail (Siapa yang mengubah)
          updatedBy: getUserName(),
          updatedAt: Date.now()
        });
        setEditId(null);
      } else {
        // --- LOGIKA CREATE ---
        await addDoc(collectionRef, {
          description: formData.description,
          amount: parseFloat(formData.amount),
          type: formData.type,
          method: formData.method,
          date: new Date().toISOString().split('T')[0],
          // Tambahkan Audit Trail (Siapa yang membuat)
          createdBy: getUserName(),
          createdAt: Date.now(),
          order: Date.now()
        });
      }
      setFormData({ description: "", amount: "", type: "expense", method: "cash" });
    } catch (error) {
      console.error("Gagal menyimpan data:", error);
      alert("Gagal menyimpan data.");
    }
  };

  const handleDelete = async (id) => {
    if (!user || !db) return;
    // --- LOGIKA DELETE (Konfirmasi Personal) ---
    if (window.confirm(`Halo ${getUserName()}, Anda yakin ingin MENGHAPUS data ini?`)) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id);
        await deleteDoc(docRef);
      } catch (error) { console.error(error); }
    }
  };

  // --- DRAG & DROP ---
  const handleDragStart = (e, position) => {
    dragItem.current = position;
    e.target.classList.add("opacity-50");
  };
  const handleDragEnter = (e, position) => { dragOverItem.current = position; };
  const handleDragEnd = async (e) => {
    e.target.classList.remove("opacity-50");
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null; dragOverItem.current = null; return;
    }
    const _transactions = [...transactions];
    const draggedItemContent = _transactions[dragItem.current];
    _transactions.splice(dragItem.current, 1);
    _transactions.splice(dragOverItem.current, 0, draggedItemContent);
    setTransactions(_transactions);

    try {
      const batch = writeBatch(db);
      const baseOrder = Date.now(); 
      _transactions.forEach((item, index) => {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', item.id);
        batch.update(docRef, { order: baseOrder - (index * 1000) });
      });
      await batch.commit();
    } catch (error) { console.error(error); }
    dragItem.current = null; dragOverItem.current = null;
  };

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 font-sans">
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md text-center border border-red-200">
          <h2 className="text-xl font-bold text-red-700 mb-2">Konfigurasi Hilang!</h2>
          <p className="text-gray-600 mb-4 text-sm">Cek file .env Anda.</p>
        </div>
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <div className="bg-indigo-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Wallet className="text-indigo-600" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Selamat Datang</h1>
          <p className="text-gray-500 mb-8">Kelola keuangan Anda. Login Google untuk menyimpan riwayat.</p>
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 p-3 rounded-xl hover:bg-gray-50 transition text-gray-700 font-medium shadow-sm"
          >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" />
              <path fill="#EA4335" d="M12 4.63c1.61 0 3.06.56 4.21 1.64l3.16-3.16C17.45 1.18 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden pb-10">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Wallet size={24} /> DompetKu
              </h1>
              {user && (
                <div className="flex items-center gap-2 mt-2 bg-indigo-500/50 p-1.5 pr-3 rounded-full w-fit">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full border border-white" />
                  ) : (
                    <div className="w-6 h-6 bg-indigo-300 rounded-full flex items-center justify-center"><User size={14} /></div>
                  )}
                  <span className="text-xs font-medium truncate max-w-[100px]">{getUserName()}</span>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="bg-indigo-500 hover:bg-indigo-400 p-2 rounded-lg transition" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
          
          <div className="text-center mt-2">
            <p className="text-indigo-200 text-sm">Total Saldo</p>
            <h2 className="text-3xl font-bold mt-1">{formatRupiah(totalBalance)}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-indigo-500/30 p-3 rounded-xl flex items-center gap-3 border border-indigo-400/30">
              <div className="bg-green-400 p-2 rounded-full text-white"><TrendingUp size={16} /></div>
              <div>
                <p className="text-xs text-indigo-100">Pemasukan</p>
                <p className="font-semibold text-sm">{formatRupiah(totalIncome)}</p>
              </div>
            </div>
            <div className="bg-indigo-500/30 p-3 rounded-xl flex items-center gap-3 border border-indigo-400/30">
              <div className="bg-red-400 p-2 rounded-full text-white"><TrendingDown size={16} /></div>
              <div>
                <p className="text-xs text-indigo-100">Pengeluaran</p>
                <p className="font-semibold text-sm">{formatRupiah(totalExpense)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <PieChart size={16} /> Analisis
          </h3>
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1 text-gray-500">
              <span>Masuk ({calculatePercentage(totalIncome, totalIncome + totalExpense)}%)</span>
              <span>Keluar ({calculatePercentage(totalExpense, totalIncome + totalExpense)}%)</span>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden flex">
              <div style={{ width: `${calculatePercentage(totalIncome, totalIncome + totalExpense)}%` }} className="bg-green-500 h-full"></div>
              <div style={{ width: `${calculatePercentage(totalExpense, totalIncome + totalExpense)}%` }} className="bg-red-500 h-full"></div>
            </div>
          </div>

          {/* --- BAGIAN CASH VS CASHLESS DIKEMBALIKAN --- */}
          <div>
            <div className="flex justify-between text-xs mb-1 text-gray-500">
              <span className="flex items-center gap-1"><Wallet size={10}/> Cash</span>
              <span className="flex items-center gap-1"><CreditCard size={10}/> Cashless</span>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden flex">
              <div style={{ width: `${calculatePercentage(cashTransactions, totalFlow)}%` }} className="bg-blue-500 h-full"></div>
              <div style={{ width: `${calculatePercentage(cashlessTransactions, totalFlow)}%` }} className="bg-purple-500 h-full"></div>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="p-5 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-600">
              {editId ? "Edit Transaksi" : "Tambah Transaksi"}
            </h3>
            {editId && (
              <button onClick={cancelEdit} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                <X size={12} /> Batal
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <select name="type" value={formData.type} onChange={handleChange} className={`w-full p-2 rounded-lg border text-sm font-medium focus:ring-2 focus:outline-none ${formData.type === 'income' ? 'bg-green-50 border-green-200 text-green-700 focus:ring-green-400' : 'bg-red-50 border-red-200 text-red-700 focus:ring-red-400'}`}>
                  <option value="income">Pemasukan (+)</option>
                  <option value="expense">Pengeluaran (-)</option>
                </select>
              </div>
              <div className="relative">
                <select name="method" value={formData.method} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                  <option value="cash">💵 Cash</option>
                  <option value="cashless">💳 Cashless</option>
                </select>
              </div>
            </div>
            <input type="text" name="description" placeholder="Catatan" value={formData.description} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm" required />
            <div className="flex gap-2">
              <input type="number" name="amount" placeholder="Jumlah (Rp)" value={formData.amount} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm" required min="1" />
              <button type="submit" disabled={!user} className={`text-white p-2 rounded-lg transition flex items-center justify-center min-w-[50px] disabled:bg-gray-400 ${editId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {editId ? <Save size={20} /> : <Plus size={20} />}
              </button>
            </div>
          </form>
        </div>

        {/* Transaction List */}
        <div className="p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 flex justify-between items-center">
            <span>Riwayat Transaksi</span>
            <span className="text-[10px] text-gray-400 font-normal italic">Tahan icon grip untuk geser</span>
          </h3>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm animate-pulse">Memuat data...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">Belum ada transaksi tersimpan.</div>
            ) : (
              transactions.map((t, index) => (
                <div key={t.id} draggable={!editId} onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDragEnd} className={`flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition group ${editId === t.id ? 'ring-2 ring-orange-400 bg-orange-50' : 'hover:shadow-md cursor-default'}`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`text-gray-300 cursor-move p-1 hover:text-gray-500 ${editId ? 'opacity-20 cursor-not-allowed' : ''}`}><GripVertical size={16} /></div>
                    <div className={`p-2 rounded-full shrink-0 ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{t.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${t.method === 'cash' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{t.method}</span>
                        <span>{t.date}</span>
                      </div>
                      
                      {/* --- MENAMPILKAN SIAPA YANG MENAMBAH/MENGUBAH --- */}
                      <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 italic">
                        <Clock size={10} />
                        {t.updatedBy 
                          ? <span>Diubah: {t.updatedBy}</span> 
                          : <span>Dibuat: {t.createdBy || "User"}</span>
                        }
                      </div>

                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'} {formatRupiah(t.amount)}</p>
                    <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(t)} className="text-gray-400 hover:text-orange-500 transition p-1" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500 transition p-1" title="Hapus"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}