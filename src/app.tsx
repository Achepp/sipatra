import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Receipt, Wallet, 
  CheckCircle, Clock, XCircle, Plus, 
  LogOut, QrCode, Upload, Bell, ChevronRight, User as UserIcon, Activity
} from 'lucide-react';
import { supabase } from './supabaseClient';

// --- TYPES ---
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface Bill {
  id: number;
  title: string;
  amount: number;
  dueDate: string;
  type: string;
  createdAt: string;
}

interface Transaksi {
  id: number;
  billId: number;
  userId: number;
  jenis_tagihan: string;
  nominal_tagihan: number;
  status_pembayaran: 'pending' | 'uploaded' | 'verified' | 'rejected';
  tanggal_bayar: string | null;
  bukti_transfer: string | null;
}

interface Pengaturan {
  id: number;
  qris_image_url: string;
  nama_komunitas: string;
  rekening_penerima: string;
}

interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
}

// --- UTILITIES ---
const formatRp = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
};

const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(dateStr));
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sipatra_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [users, setUsers] = useState<User[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Pengaturan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('id', { ascending: true });
      if (usersError) throw usersError;
      setUsers(usersData || []);

      const { data: billsData, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .order('id', { ascending: true });
      if (billsError) throw billsError;
      setBills(billsData || []);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transaksi')
        .select('*')
        .order('id', { ascending: true });
      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);

      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .order('id', { ascending: true });
      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      const { data: settingsData, error: settingsError } = await supabase
        .from('pengaturan')
        .select('*')
        .limit(1);
      if (settingsError) throw settingsError;
      if (settingsData && settingsData.length > 0) {
        setSettings(settingsData[0]);
      }
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes on transaksi table
    const channel = supabase
      .channel('transaksi_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaksi' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTransactions(prev => {
              if (prev.some(t => t.id === payload.new.id)) return prev;
              return [...prev, payload.new as Transaksi];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTransactions(prev => prev.map(t => t.id === payload.new.id ? (payload.new as Transaksi) : t));
          } else if (payload.eventType === 'DELETE') {
            setTransactions(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totalIncome = transactions.filter(t => t.status_pembayaran === 'verified').reduce((sum, t) => sum + t.nominal_tagihan, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const saldoKas = totalIncome - totalExpense;

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sipatra_user', JSON.stringify(user));
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sipatra_user');
    setActiveTab('dashboard');
  };

  const verifyPayment = async (paymentId: number, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('transaksi')
        .update({ status_pembayaran: status })
        .eq('id', paymentId);
      if (error) throw error;
      
      setTransactions(prev => prev.map(t => t.id === paymentId ? { ...t, status_pembayaran: status } : t));
    } catch (err) {
      console.error('Error verifying payment:', err);
      alert('Gagal memverifikasi pembayaran. Silakan coba lagi.');
    }
  };

  const submitPaymentWithProof = async (transactionId: number, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${transactionId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload image to Supabase Storage bucket 'payment-proofs'
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filePath);

    // Update transaksi in Supabase
    const dateStr = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('transaksi')
      .update({
        status_pembayaran: 'uploaded',
        tanggal_bayar: dateStr,
        bukti_transfer: publicUrl
      })
      .eq('id', transactionId);

    if (updateError) throw updateError;

    // Update local state
    setTransactions(prev => prev.map(t => t.id === transactionId ? {
      ...t,
      status_pembayaran: 'uploaded',
      tanggal_bayar: dateStr,
      bukti_transfer: publicUrl
    } : t));
  };

  const addBill = async (newBill: Omit<Bill, 'id' | 'createdAt'>) => {
    try {
      const { data: insertedBill, error: billError } = await supabase
        .from('bills')
        .insert({
          title: newBill.title,
          amount: newBill.amount,
          dueDate: newBill.dueDate,
          type: newBill.type
        })
        .select()
        .single();
      
      if (billError) throw billError;
      if (!insertedBill) return;

      setBills(prev => [...prev, insertedBill]);

      const activeMembers = users.filter(u => u.role === 'member' && u.status === 'aktif');
      if (activeMembers.length > 0) {
        const transactionsToInsert = activeMembers.map(u => ({
          billId: insertedBill.id,
          userId: u.id,
          jenis_tagihan: insertedBill.title,
          nominal_tagihan: insertedBill.amount,
          status_pembayaran: 'pending',
          tanggal_bayar: null,
          bukti_transfer: null
        }));

        const { error: transactionsError } = await supabase
          .from('transaksi')
          .insert(transactionsToInsert);

        if (transactionsError) throw transactionsError;
      }
    } catch (err) {
      console.error('Error adding bill and transactions:', err);
      alert('Gagal membuat tagihan baru. Silakan coba lagi.');
    }
  };

  const addExpense = async (newExpense: Omit<Expense, 'id' | 'date'>) => {
    try {
      const { data: insertedExpense, error } = await supabase
        .from('expenses')
        .insert({
          title: newExpense.title,
          amount: newExpense.amount,
          category: newExpense.category
        })
        .select()
        .single();
      
      if (error) throw error;
      if (insertedExpense) {
        setExpenses(prev => [...prev, insertedExpense]);
      }
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('Gagal mencatat pengeluaran. Silakan coba lagi.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold animate-pulse text-sm">Menghubungkan ke database...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} users={users} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative pb-20 flex flex-col">
        <header className="bg-emerald-600 text-white p-4 sticky top-0 z-10 rounded-b-2xl shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                <UserIcon size={20} />
              </div>
              <div>
                <p className="text-xs text-emerald-100 font-medium">Selamat datang,</p>
                <p className="font-bold truncate w-32 tracking-wide">{currentUser.name}</p>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <button className="relative p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-emerald-600"></span>
              </button>
              <button onClick={handleLogout} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          {activeTab === 'dashboard' && (
            <Dashboard user={currentUser} saldoKas={saldoKas} totalIncome={totalIncome} totalExpense={totalExpense} users={users} bills={bills} transactions={transactions} verifyPayment={verifyPayment} />
          )}
          {activeTab === 'tagihan' && (
            <Bills user={currentUser} bills={bills} transactions={transactions} users={users} addBill={addBill} submitPaymentWithProof={submitPaymentWithProof} settings={settings} />
          )}
          {activeTab === 'kas' && (
            <Treasury user={currentUser} saldoKas={saldoKas} expenses={expenses} addExpense={addExpense} />
          )}
          {activeTab === 'anggota' && currentUser.role === 'admin' && (
            <MembersList users={users} />
          )}
        </main>

        <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-100 flex justify-around p-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
          <NavItem icon={<Home size={24} />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Receipt size={24} />} label="Tagihan" active={activeTab === 'tagihan'} onClick={() => setActiveTab('tagihan')} />
          <NavItem icon={<Wallet size={24} />} label="Kas" active={activeTab === 'kas'} onClick={() => setActiveTab('kas')} />
          {currentUser.role === 'admin' && <NavItem icon={<Users size={24} />} label="Anggota" active={activeTab === 'anggota'} onClick={() => setActiveTab('anggota')} />}
        </nav>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 w-16 transition-colors ${active ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-500'}`}>
      <div className={`${active ? 'bg-emerald-50' : ''} p-1.5 rounded-xl`}>{icon}</div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function Dashboard({ user, saldoKas, totalIncome, totalExpense, users, bills, transactions, verifyPayment }: any) {
  const isAdmin = user.role === 'admin';
  const pendingPayments = isAdmin ? transactions.filter((t: any) => t.status_pembayaran === 'uploaded') : [];
  const myActiveBills = !isAdmin ? transactions.filter((t: any) => t.userId === user.id && (t.status_pembayaran === 'pending' || t.status_pembayaran === 'rejected')) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-900/10 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 p-4 opacity-10 transform rotate-12 scale-150"><Wallet size={120} /></div>
        <p className="text-emerald-100 text-sm font-medium mb-1">Saldo Kas Komunitas</p>
        <h2 className="text-3xl font-extrabold mb-6 tracking-tight">{formatRp(saldoKas)}</h2>
        {isAdmin && (
          <div className="flex gap-4 border-t border-emerald-500/50 pt-4">
            <div className="flex-1">
              <p className="text-emerald-200 text-xs font-medium">Pemasukan</p>
              <p className="font-bold text-sm">{formatRp(totalIncome)}</p>
            </div>
            <div className="w-px bg-emerald-500/50"></div>
            <div className="flex-1">
              <p className="text-emerald-200 text-xs font-medium">Pengeluaran</p>
              <p className="font-bold text-sm">{formatRp(totalExpense)}</p>
            </div>
          </div>
        )}
      </div>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={20} strokeWidth={2.5} /></div>
              <div><p className="text-xs font-medium text-slate-500">Total Anggota</p><p className="font-extrabold text-slate-800">{users.filter((u:any) => u.role === 'member').length} Org</p></div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center gap-3">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Receipt size={20} strokeWidth={2.5} /></div>
              <div><p className="text-xs font-medium text-slate-500">Tagihan Aktif</p><p className="font-extrabold text-slate-800">{bills.length} Tagihan</p></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4"><h3 className="font-extrabold text-slate-800">Menunggu Verifikasi</h3><span className="bg-orange-100 text-orange-600 text-xs px-2.5 py-1 rounded-full font-bold">{pendingPayments.length}</span></div>
            {pendingPayments.length === 0 ? <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-slate-400 text-sm font-medium">Tidak ada pembayaran yang perlu diverifikasi.</div> : (
              <div className="space-y-3">
                {pendingPayments.map((payment: any) => {
                  const member = users.find((u:any) => u.id === payment.userId);
                  const bill = bills.find((b:any) => b.id === payment.billId);
                  return (
                    <div key={payment.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center gap-4">
                      <div className="flex-1"><p className="font-bold text-sm text-slate-800">{member?.name}</p><p className="text-xs text-slate-500 truncate mt-0.5">{bill?.title}</p><p className="text-sm font-extrabold text-emerald-600 mt-1">{formatRp(payment.nominal_tagihan)}</p></div>
                      <div className="flex gap-2">
                        <button onClick={() => verifyPayment(payment.id, 'rejected')} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><XCircle size={20} /></button>
                        <button onClick={() => verifyPayment(payment.id, 'verified')} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><CheckCircle size={20} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div>
            <h3 className="font-extrabold text-slate-800 mb-4">Tagihan Belum Dibayar</h3>
            {myActiveBills.length === 0 ? <div className="bg-emerald-50 border border-emerald-100/50 rounded-3xl p-6 text-center text-emerald-800 flex flex-col items-center gap-3"><div className="p-3 bg-emerald-100 rounded-full"><CheckCircle size={32} className="text-emerald-600" /></div><p className="font-bold text-sm">Hebat! Semua iuran Anda sudah lunas.</p></div> : (
              <div className="space-y-3">
                {myActiveBills.map((payment: any) => {
                  const bill = bills.find((b:any) => b.id === payment.billId);
                  const isRejected = payment.status_pembayaran === 'rejected';
                  return (
                    <div key={payment.id} className={`bg-white p-4 rounded-2xl border ${isRejected ? 'border-red-200' : 'border-amber-200'} shadow-sm flex justify-between items-center gap-4 relative overflow-hidden`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isRejected ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                      <div className="flex-1 pl-2"><p className="font-bold text-sm text-slate-800">{bill?.title}</p><p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-1.5"><Clock size={12} /> Jatuh tempo: {formatDate(bill?.dueDate || '')}</p><p className="text-sm font-extrabold text-red-600 mt-1">{formatRp(payment.nominal_tagihan)}</p></div>
                      <span className={`text-[10px] font-bold ${isRejected ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'} px-2.5 py-1 rounded-lg`}>{isRejected ? 'Ditolak (Upload Ulang)' : 'Belum Bayar'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-6">
            <h3 className="font-extrabold text-slate-800 mb-4">Riwayat Pembayaran Anda</h3>
            <div className="space-y-3">
              {transactions.filter((t:any) => t.userId === user.id && t.status_pembayaran !== 'pending').slice(0, 3).map((payment:any) => {
                const bill = bills.find((b:any) => b.id === payment.billId);
                const isVerified = payment.status_pembayaran === 'verified';
                const isPending = payment.status_pembayaran === 'uploaded';
                const isRejected = payment.status_pembayaran === 'rejected';
                
                const statusLabel = isVerified ? 'Lunas' : isPending ? 'Menunggu Verifikasi' : 'Ditolak';
                const statusColor = isVerified ? 'text-emerald-600' : isPending ? 'text-orange-600' : 'text-red-600';
                
                return (
                  <div key={payment.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isVerified ? 'bg-emerald-50 text-emerald-600' : isPending ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                      {isVerified ? <CheckCircle size={20} /> : isPending ? <Clock size={20} /> : <XCircle size={20} />}
                    </div>
                    <div className="flex-1"><p className="font-bold text-sm text-slate-800">{bill?.title}</p><p className="text-xs font-medium text-slate-500 mt-0.5">{payment.tanggal_bayar ? formatDate(payment.tanggal_bayar) : '-'}</p></div>
                    <div className="text-right"><p className="text-sm font-extrabold">{formatRp(payment.nominal_tagihan)}</p><p className={`text-[10px] font-bold mt-0.5 ${statusColor}`}>{statusLabel}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Bills({ user, bills, transactions, users, addBill, submitPaymentWithProof, settings }: any) {
  const isAdmin = user.role === 'admin';
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaksi | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync modal view with the realtime state from transactions array
  const currentTransaction = selectedTransaction
    ? transactions.find((t: any) => t.id === selectedTransaction.id)
    : null;

  const handleCreateBill = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addBill({
      title: fd.get('title') as string,
      amount: parseInt(fd.get('amount') as string),
      dueDate: fd.get('dueDate') as string,
      type: fd.get('type') as string
    });
    setShowAddModal(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTransaction) return;

    // Validasi nominal_tagihan > 0
    if (currentTransaction.nominal_tagihan <= 0) {
      setToastError('Nominal tagihan harus lebih dari Rp 0 untuk melakukan pembayaran.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }

    // Validasi tipe file (JPG, PNG, WEBP)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setToastError('Format file tidak didukung. Harap gunakan JPG, PNG, atau WEBP.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }

    // Validasi ukuran (Maksimal 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setToastError('Ukuran file terlalu besar. Maksimal ukuran adalah 5 MB.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCancelFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentTransaction) return;

    setIsUploading(true);
    try {
      await submitPaymentWithProof(currentTransaction.id, selectedFile);
      setToastMessage('Bukti pembayaran berhasil diunggah!');
      handleCancelFile();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err: any) {
      console.error(err);
      setToastError(err.message || 'Gagal mengunggah bukti pembayaran. Silakan coba lagi.');
      setTimeout(() => setToastError(''), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFilePicker = () => {
    if (currentTransaction?.status_pembayaran === 'verified') {
      setToastError('Pembayaran sudah lunas, tidak dapat mengunggah bukti lagi.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCloseModal = () => {
    setSelectedTransaction(null);
    handleCancelFile();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            🟡 Menunggu Pembayaran
          </span>
        );
      case 'uploaded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            🔵 Menunggu Verifikasi
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            🟢 Lunas
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            🔴 Ditolak
          </span>
        );
      default:
        return null;
    }
  };

  const renderQRCode = () => {
    if (!settings || !settings.qris_image_url) {
      return (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl w-56 h-56 flex flex-col items-center justify-center p-4 text-center">
          <QrCode size={40} className="text-slate-400 mb-2" strokeWidth={1.5} />
          <p className="text-xs font-bold text-slate-500 leading-relaxed">
            QRIS belum dikonfigurasi admin
          </p>
        </div>
      );
    }

    if (isUploading) {
      return (
        <div className="bg-slate-50 border border-slate-100 rounded-3xl w-56 h-56 flex items-center justify-center p-4 animate-pulse">
          <div className="w-40 h-40 bg-slate-200 rounded-2xl"></div>
        </div>
      );
    }

    return (
      <div className="bg-white p-3 rounded-[2rem] border-2 border-slate-100 shadow-md w-56 h-56 flex items-center justify-center relative overflow-hidden group">
        <img
          src={settings.qris_image_url}
          alt="QRIS Code"
          className="w-full h-full object-contain rounded-2xl transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    );
  };

  const renderActionButton = (status: string) => {
    if (isUploading) {
      return (
        <button disabled className="w-full bg-slate-100 text-slate-400 font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 border border-slate-200 cursor-not-allowed">
          <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          Mengirim Pembayaran...
        </button>
      );
    }

    switch (status) {
      case 'pending':
      case 'rejected':
        if (selectedFile) {
          return (
            <button onClick={handleUpload} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20">
              <CheckCircle size={18} />
              Kirim Bukti Pembayaran
            </button>
          );
        } else {
          return (
            <button onClick={triggerFilePicker} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/10">
              <Upload size={18} />
              {status === 'rejected' ? 'Pilih Bukti Baru' : 'Saya Sudah Membayar'}
            </button>
          );
        }
      case 'uploaded':
        return (
          <button disabled className="w-full bg-blue-50 text-blue-400 font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 border border-blue-100 cursor-not-allowed">
            <Clock size={18} />
            Menunggu Verifikasi Admin
          </button>
        );
      case 'verified':
        return (
          <button disabled className="w-full bg-emerald-600 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed shadow-md">
            <CheckCircle size={18} />
            Pembayaran Berhasil
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in relative">
      {/* Toast Success */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-5 py-3.5 rounded-full shadow-2xl z-50 text-sm font-bold flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle size={18} className="text-emerald-400" /> {toastMessage}
        </div>
      )}

      {/* Toast Error */}
      {toastError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-5 py-3.5 rounded-full shadow-2xl z-50 text-sm font-bold flex items-center gap-2 border border-red-500 animate-shake">
          <XCircle size={18} className="text-white" /> {toastError}
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-extrabold text-slate-800">Daftar Tagihan</h2>
        {isAdmin && <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-4 py-2 rounded-full font-bold hover:bg-emerald-700 transition-colors shadow-sm"><Plus size={16} /> Buat Baru</button>}
      </div>

      <div className="space-y-4">
        {bills.map((bill: any) => {
          let paymentStatus = null;
          let transactionRecord = null;
          if (!isAdmin) {
            transactionRecord = transactions.find((t:any) => t.billId === bill.id && t.userId === user.id);
            paymentStatus = transactionRecord ? transactionRecord.status_pembayaran : 'pending';
          } else {
            const billTransactions = transactions.filter((t:any) => t.billId === bill.id);
            const lunasCount = billTransactions.filter((t:any) => t.status_pembayaran === 'verified').length;
            const totalMembers = users.filter((u:any) => u.role === 'member').length;
            paymentStatus = `${lunasCount}/${totalMembers} Lunas`;
          }
          return (
            <div key={bill.id} className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">{bill.type}</span>
                  {!isAdmin && paymentStatus && (
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${
                      paymentStatus === 'verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      paymentStatus === 'uploaded' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                      paymentStatus === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                      'bg-slate-50 text-slate-700 border border-slate-100'
                    }`}>
                      {paymentStatus === 'verified' ? 'Lunas' :
                       paymentStatus === 'uploaded' ? 'Menunggu Verifikasi' :
                       paymentStatus === 'rejected' ? 'Ditolak' : 'Belum Bayar'}
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-slate-800 text-lg">{bill.title}</h3>
                <div className="flex items-center justify-between mt-4 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium"><Clock size={14} /><span>JT: {formatDate(bill.dueDate)}</span></div>
                  <div className="font-extrabold text-slate-800 text-lg">{formatRp(bill.amount)}</div>
                </div>
              </div>
              <div className="bg-slate-50/50 px-5 py-4 border-t border-slate-100 flex justify-between items-center">
                {isAdmin ? (
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-2"><Users size={16} className="text-slate-400" /> {paymentStatus}</span>
                ) : (
                  <div className="w-full">
                    {(!transactionRecord || transactionRecord.status_pembayaran === 'pending' || transactionRecord.status_pembayaran === 'rejected') ? (
                      <button onClick={() => setSelectedTransaction(transactionRecord || null)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm">
                        <QrCode size={18} /> Bayar Sekarang
                      </button>
                    ) : (
                      <button disabled className="w-full bg-slate-100 text-slate-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-slate-200">
                        {transactionRecord.status_pembayaran === 'verified' ? <CheckCircle size={18} /> : <Clock size={18} />}
                        {transactionRecord.status_pembayaran === 'verified' ? 'Pembayaran Selesai' : 'Sedang Diproses'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tambah Tagihan Baru (Admin Only) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 relative shadow-2xl">
            <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors"><XCircle size={20} /></button>
            <h3 className="text-xl font-extrabold text-slate-800 mb-6">Buat Tagihan Baru</h3>
            <form onSubmit={handleCreateBill} className="space-y-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Judul Tagihan</label><input required name="title" type="text" placeholder="Contoh: Iuran Bulan September" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-slate-50/50 font-medium" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Nominal (Rp)</label><input required name="amount" type="number" placeholder="50000" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-slate-50/50 font-medium" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Tanggal Jatuh Tempo</label><input required name="dueDate" type="date" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-slate-50/50 font-medium" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Jenis Tagihan</label><select name="type" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-slate-50/50 font-medium appearance-none"><option value="Bulanan">Rutin / Bulanan</option><option value="Insidental">Insidental / Sekali Bayar</option></select></div>
              <button type="submit" className="w-full bg-emerald-600 text-white font-extrabold py-3.5 rounded-xl mt-6 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 active:scale-[0.98]">Terbitkan Tagihan</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Redesigned QRIS Payment (Member Only) */}
      {currentTransaction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            
            {/* Header */}
            <div className="bg-emerald-600 p-5 text-center relative text-white">
              <button onClick={handleCloseModal} className="absolute top-4 right-4 p-1.5 bg-white/10 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors">
                <XCircle size={20} />
              </button>
              <h3 className="font-extrabold text-lg tracking-wide">Pembayaran QRIS</h3>
              <p className="text-emerald-100 text-xs font-semibold mt-0.5">{currentTransaction.jenis_tagihan}</p>
            </div>

            {/* Content Body */}
            {currentTransaction.status_pembayaran === 'uploaded' || currentTransaction.status_pembayaran === 'verified' ? (
              /* Halaman Status / Konfirmasi Pembayaran */
              <div className="p-6 flex flex-col items-center gap-6 text-center">
                
                {/* Icon */}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
                  currentTransaction.status_pembayaran === 'verified'
                    ? 'bg-emerald-50 text-emerald-600 shadow-emerald-100 animate-pulse'
                    : 'bg-blue-50 text-blue-600 shadow-blue-100 animate-bounce'
                }`}>
                  <CheckCircle size={44} strokeWidth={2.5} />
                </div>

                {/* Text Header & Desc */}
                <div className="space-y-2">
                  <h4 className="text-lg font-black text-slate-800 tracking-tight animate-fade-in">
                    {currentTransaction.status_pembayaran === 'verified'
                      ? 'Pembayaran Lunas'
                      : 'Bukti Pembayaran Berhasil Dikirim'}
                  </h4>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed px-2">
                    {currentTransaction.status_pembayaran === 'verified'
                      ? 'Pembayaran Anda telah berhasil diverifikasi oleh admin. Terima kasih!'
                      : 'Bukti pembayaran Anda telah berhasil dikirim dan sedang menunggu verifikasi admin.'}
                  </p>
                </div>

                {/* Information Card */}
                <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400">Nominal Tagihan</span>
                    <span className="font-extrabold text-slate-800">{formatRp(currentTransaction.nominal_tagihan)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400">Tanggal Upload</span>
                    <span className="font-extrabold text-slate-800">
                      {currentTransaction.tanggal_bayar ? formatDate(currentTransaction.tanggal_bayar) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400">Status</span>
                    <span>
                      {currentTransaction.status_pembayaran === 'verified' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          🟢 Lunas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100">
                          🔵 Menunggu Verifikasi
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={handleCloseModal}
                  className="w-full bg-slate-850 hover:bg-slate-900 text-white font-extrabold py-3.5 rounded-2xl transition-all active:scale-[0.98] shadow-md shadow-slate-900/10 mt-2"
                >
                  Tutup
                </button>

              </div>
            ) : (
              /* Halaman Pindai/Scan QRIS & Unggah Bukti */
              <div className="p-6 flex flex-col items-center gap-5">
                
                {/* Nominal Tagihan */}
                <div className="text-center">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Nominal Tagihan</p>
                  <p className="text-3xl font-black text-slate-800">{formatRp(currentTransaction.nominal_tagihan)}</p>
                </div>

                {/* Status Badge */}
                <div className="text-center">
                  {getStatusBadge(currentTransaction.status_pembayaran)}
                </div>

                {/* Badge QRIS Statis */}
                <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 w-full text-center">
                  <span className="text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-800 px-3 py-1 rounded-full inline-block">QRIS STATIS</span>
                  <p className="text-xs font-bold text-amber-900 mt-2">
                    Masukkan nominal <span className="text-sm font-black text-emerald-600">{formatRp(currentTransaction.nominal_tagihan)}</span> saat melakukan pembayaran.
                  </p>
                </div>

                {/* QR Code Container */}
                {renderQRCode()}

                {/* File Selection Preview Section */}
                <div className="w-full space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {!selectedFile ? (
                    <button
                      onClick={triggerFilePicker}
                      className="w-full border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group transition-colors bg-slate-50/50"
                    >
                      <Upload size={24} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      <span className="text-xs font-extrabold text-slate-500 group-hover:text-emerald-600 transition-colors">Pilih Foto Bukti Transfer</span>
                      <span className="text-[9px] text-slate-400">JPG, PNG, atau WEBP (Maks 5MB)</span>
                    </button>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 relative overflow-hidden flex items-center gap-3 w-full animate-fade-in">
                      {previewUrl && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-white">
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button
                        onClick={handleCancelFile}
                        disabled={isUploading}
                        className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="w-full mt-2">
                  {renderActionButton(currentTransaction.status_pembayaran)}
                </div>

                {/* Community & Receiver Bank Details */}
                {settings && (
                  <div className="w-full border-t border-slate-100 pt-4 mt-1 text-center space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Penerima</p>
                    <p className="text-sm font-extrabold text-slate-800">{settings.nama_komunitas}</p>
                    <p className="text-xs font-semibold text-slate-500 bg-slate-50 py-1.5 px-3 rounded-xl inline-block border border-slate-100">{settings.rekening_penerima}</p>
                  </div>
                )}

                {/* Small Footnote */}
                <p className="text-[9px] text-center text-slate-400 font-semibold leading-relaxed mt-1">
                  QRIS ini bersifat statis. Pastikan nominal yang dibayarkan sesuai dengan tagihan.
                </p>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Treasury({ user, saldoKas, expenses, addExpense }: any) {
  const isAdmin = user.role === 'admin';
  const [showAddExpense, setShowAddExpense] = useState(false);

  const handleAddExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addExpense({
      title: fd.get('title') as string,
      amount: parseInt(fd.get('amount') as string),
      category: fd.get('category') as string
    });
    setShowAddExpense(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-800 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-900/10 text-center relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-5"><Activity size={100} /></div><p className="text-slate-400 text-sm font-medium mb-1">Total Saldo Kas</p><h2 className="text-4xl font-extrabold text-emerald-400 tracking-tight">{formatRp(saldoKas)}</h2></div>
      <div>
        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-extrabold text-slate-800">Riwayat Pengeluaran</h2>{isAdmin && <button onClick={() => setShowAddExpense(true)} className="flex items-center gap-1.5 text-sm bg-red-50 text-red-600 px-4 py-2 rounded-full font-bold hover:bg-red-100 transition-colors"><Plus size={16} /> Catat</button>}</div>
        {expenses.length === 0 ? <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-slate-400 font-medium text-sm">Belum ada catatan pengeluaran.</div> : (
          <div className="space-y-3">
            {expenses.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((exp:any) => (
              <div key={exp.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0"><Wallet size={20} strokeWidth={2.5} /></div>
                <div className="flex-1 min-w-0"><p className="font-extrabold text-sm text-slate-800 truncate">{exp.title}</p><div className="flex items-center gap-2 mt-1"><span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md">{exp.category}</span><span className="text-xs font-medium text-slate-400">{formatDate(exp.date)}</span></div></div>
                <div className="text-right"><p className="text-sm font-extrabold text-red-500">-{formatRp(exp.amount)}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showAddExpense && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 relative shadow-2xl"><button onClick={() => setShowAddExpense(false)} className="absolute top-5 right-5 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors"><XCircle size={20} /></button><h3 className="text-xl font-extrabold text-slate-800 mb-6">Catat Pengeluaran</h3><form onSubmit={handleAddExpense} className="space-y-4"><div><label className="block text-sm font-bold text-slate-700 mb-1.5">Keterangan</label><input required name="title" type="text" placeholder="Contoh: Beli Shuttlecock" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all bg-slate-50/50 font-medium" /></div><div><label className="block text-sm font-bold text-slate-700 mb-1.5">Nominal (Rp)</label><input required name="amount" type="number" placeholder="100000" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all bg-slate-50/50 font-medium" /></div><div><label className="block text-sm font-bold text-slate-700 mb-1.5">Kategori</label><select name="category" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all bg-slate-50/50 font-medium appearance-none"><option value="Sewa Lapangan">Sewa Lapangan</option><option value="Peralatan">Peralatan (Kok, dll)</option><option value="Konsumsi">Konsumsi</option><option value="Lainnya">Lainnya</option></select></div><button type="submit" className="w-full bg-red-600 text-white font-extrabold py-3.5 rounded-xl mt-6 hover:bg-red-700 transition-all active:scale-[0.98] shadow-lg shadow-red-600/20">Simpan Pengeluaran</button></form></div>
        </div>
      )}
    </div>
  );
}

function MembersList({ users }: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-extrabold text-slate-800">Daftar Anggota</h2><button className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><Plus size={20} strokeWidth={2.5} /></button></div>
      <div className="space-y-3">
        {users.map((user:any) => (
          <div key={user.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg ${user.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{user.name.charAt(0)}</div>
            <div className="flex-1"><p className="font-extrabold text-sm text-slate-800">{user.name}</p><p className="text-xs font-medium text-slate-500">{user.email}</p></div>
            <div><span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wide ${user.role === 'admin' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>{user.role}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, users }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const user = users.find((u:any) => u.email === email);
    if (user) {
      onLogin(user);
    } else {
      setError('Email tidak terdaftar. Gunakan akun demo di bawah.');
    }
  };

  const handleDemoLogin = (role: 'admin' | 'member') => {
    const user = users.find((u: any) => u.role === role);
    if (user) {
      onLogin(user);
    } else {
      setError(`Akun demo ${role} tidak ditemukan di database Supabase.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 w-full">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col border border-slate-100/50">
        <div className="p-10 pb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30"><Activity size={32} strokeWidth={2.5} /></div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">SI-PATRA</h1>
          <p className="text-slate-500 text-sm font-medium">Sistem Pengelolaan Iuran Badminton</p>
        </div>
        <div className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2 font-bold border border-red-100"><XCircle size={18} className="flex-shrink-0" /> {error}</div>}
            <div><label className="block text-sm font-extrabold text-slate-700 mb-2">Alamat Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@sipatra.com" className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-slate-50/50 text-slate-800 font-bold placeholder:font-medium placeholder:text-slate-400" /></div>
            <div><label className="block text-sm font-extrabold text-slate-700 mb-2">Kata Sandi</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-slate-50/50 text-slate-800 font-bold placeholder:font-medium placeholder:text-slate-400" /></div>
            <div className="flex items-center justify-between pt-2 pb-4"><label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none font-bold"><input type="checkbox" className="w-4 h-4 rounded text-emerald-600 border-slate-300" />Ingat saya</label><button type="button" className="text-sm font-extrabold text-emerald-600 hover:text-emerald-700">Lupa sandi?</button></div>
            <button type="submit" className="w-full bg-slate-800 text-white font-extrabold py-4 rounded-2xl hover:bg-slate-900 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20">Masuk Sekarang</button>
          </form>
          <div className="mt-8 mb-6 relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div><div className="relative flex justify-center text-xs"><span className="bg-white px-4 text-slate-400 font-extrabold uppercase tracking-widest">Akses Demo</span></div></div>
          <div className="grid grid-cols-2 gap-3">
             <button onClick={() => handleDemoLogin('admin')} type="button" className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors group bg-slate-50/30"><div className="p-2 bg-white rounded-full shadow-sm text-slate-400 group-hover:text-emerald-600 transition-all"><UserIcon size={18} strokeWidth={2.5} /></div><span className="text-xs font-extrabold text-slate-600 group-hover:text-emerald-700">Login Admin</span></button>
             <button onClick={() => handleDemoLogin('member')} type="button" className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 rounded-2xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors group bg-slate-50/30"><div className="p-2 bg-white rounded-full shadow-sm text-slate-400 group-hover:text-blue-600 transition-all"><UserIcon size={18} strokeWidth={2.5} /></div><span className="text-xs font-extrabold text-slate-600 group-hover:text-blue-700">Login Anggota</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}