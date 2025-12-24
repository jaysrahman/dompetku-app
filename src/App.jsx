import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wallet, CreditCard, PieChart, TrendingUp, TrendingDown } from 'lucide-react';

// Import modul Firebase
import { initializeApp } from "firebase/app";
// HAPUS: signInWithCustomToken karena tidak dipakai di local
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, deleteDoc, onSnapshot, doc } from "firebase/firestore";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyACCNttwmG0epb8gbVlv_V2W37Hs40VjFo",
  authDomain: "dompetku-app-220e2.firebaseapp.com",
  projectId: "dompetku-app-220e2",
  storageBucket: "dompetku-app-220e2.firebasestorage.app",
  messagingSenderId: "563298333992",
  appId: "1:563298333992:web:38ce2825de61a4e3c2cc1d",
  measurementId: "G-9VG5KSDE5Y"
};

// Inisialisasi Firebase
// Tambahkan Error Handling sederhana agar tidak blank putih jika config salah
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Gagal inisialisasi Firebase:", error);
}

const appId = 'dompetku-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    type: "expense",
    method: "cash"
  });

  // 1. PERBAIKAN: Login Anonim Sederhana (Hapus __initial_auth_token)
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        // Langsung login anonim tanpa cek token token
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Login gagal:", error);
      }
    };
    
    initAuth();
    
    // Listener status login
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false); // Stop loading jika gagal login
    });
    return () => unsubscribe();
  }, []);

  // 2. Mengambil Data Real-time dari Firestore
  useEffect(() => {
    if (!user || !db) return;

    const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    
    const unsubscribe = onSnapshot(transactionsRef, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        data.sort((a, b) => b.createdAt - a.createdAt);
        
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

  // Format Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(number);
  };

  // Perhitungan Statistik
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalBalance = totalIncome - totalExpense;

  const calculatePercentage = (part, total) => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  };

  const cashTransactions = transactions.filter(t => t.method === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
  const cashlessTransactions = transactions.filter(t => t.method === 'cashless').reduce((acc, curr) => acc + curr.amount, 0);
  const totalFlow = cashTransactions + cashlessTransactions;

  // Handle Form Input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle Submit ke Database
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !user || !db) return;

    try {
      const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
      await addDoc(transactionsRef, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
        method: formData.method,
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now() // Untuk sorting
      });

      // Reset form
      setFormData({ description: "", amount: "", type: "expense", method: "cash" });
    } catch (error) {
      console.error("Gagal menambah transaksi:", error);
      alert("Gagal menyimpan data. Cek koneksi internet.");
    }
  };

  // Handle Delete dari Database
  const handleDelete = async (id) => {
    if (!user || !db) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Gagal menghapus:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Wallet size={24} /> DompetKu Cloud
            </h1>
            <span className="text-xs bg-indigo-500 px-2 py-1 rounded-full border border-indigo-400">
              {loading ? 'Menghubungkan...' : 'Online'}
            </span>
          </div>
          
          <div className="text-center mt-2">
            <p className="text-indigo-200 text-sm">Total Saldo</p>
            <h2 className="text-3xl font-bold mt-1">{formatRupiah(totalBalance)}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-indigo-500/30 p-3 rounded-xl flex items-center gap-3 border border-indigo-400/30">
              <div className="bg-green-400 p-2 rounded-full text-white">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-xs text-indigo-100">Pemasukan</p>
                <p className="font-semibold text-sm">{formatRupiah(totalIncome)}</p>
              </div>
            </div>
            <div className="bg-indigo-500/30 p-3 rounded-xl flex items-center gap-3 border border-indigo-400/30">
              <div className="bg-red-400 p-2 rounded-full text-white">
                <TrendingDown size={16} />
              </div>
              <div>
                <p className="text-xs text-indigo-100">Pengeluaran</p>
                <p className="font-semibold text-sm">{formatRupiah(totalExpense)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
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
        <div className="p-5 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Tambah Transaksi</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <select 
                  name="type" 
                  value={formData.type} 
                  onChange={handleChange}
                  className={`w-full p-2 rounded-lg border text-sm font-medium focus:ring-2 focus:outline-none ${formData.type === 'income' ? 'bg-green-50 border-green-200 text-green-700 focus:ring-green-400' : 'bg-red-50 border-red-200 text-red-700 focus:ring-red-400'}`}
                >
                  <option value="income">Pemasukan (+)</option>
                  <option value="expense">Pengeluaran (-)</option>
                </select>
              </div>
              <div className="relative">
                <select 
                  name="method" 
                  value={formData.method} 
                  onChange={handleChange}
                  className="w-full p-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                >
                  <option value="cash">💵 Cash</option>
                  <option value="cashless">💳 Cashless</option>
                </select>
              </div>
            </div>

            <input
              type="text"
              name="description"
              placeholder="Catatan"
              value={formData.description}
              onChange={handleChange}
              className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
              required
            />

            <div className="flex gap-2">
              <input
                type="number"
                name="amount"
                placeholder="Jumlah (Rp)"
                value={formData.amount}
                onChange={handleChange}
                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                required
                min="1"
              />
              <button 
                type="submit" 
                disabled={!user}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center min-w-[50px] disabled:bg-gray-400"
              >
                <Plus size={20} />
              </button>
            </div>
          </form>
        </div>

        {/* Transaction List */}
        <div className="p-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Riwayat Transaksi</h3>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm animate-pulse">Memuat data...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">Belum ada transaksi tersimpan.</div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{t.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${t.method === 'cash' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {t.method}
                        </span>
                        <span>{t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'} {formatRupiah(t.amount)}
                    </p>
                    <button 
                      onClick={() => handleDelete(t.id)}
                      className="text-gray-400 hover:text-red-500 mt-1 transition"
                    >
                      <Trash2 size={14} />
                    </button>
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