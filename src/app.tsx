import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Receipt, Wallet, 
  CheckCircle, Clock, XCircle, Plus, 
  LogOut, QrCode, Upload, Bell, ChevronRight, User as UserIcon, Activity
} from 'lucide-react';

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

interface Payment {
  id: number;
  billId: number;
  userId: number;
  amount: number;
  status: string;
  date: string | null;
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

// --- MOCK DATA ---
const initialUsers: User[] = [
  { id: 1, name: 'Admin Bendahara', email: 'admin@sipatra.com', role: 'admin', status: 'aktif' },
  { id: 2, name: 'Budi Santoso', email: 'budi@dosen.com', role: 'member', status: 'aktif' },
  { id: 3, name: 'Andi Wijaya', email: 'andi@dosen.com', role: 'member', status: 'aktif' },
  { id: 4, name: 'Siti Aminah', email: 'siti@dosen.com', role: 'member', status: 'aktif' },
];

const initialBills: Bill[] = [
  { id: 1, title: 'Iuran Badminton Agustus', amount: 50000, dueDate: '2026-08-31', type: 'Bulanan', createdAt: '2026-08-01' },
  { id: 2, title: 'Iuran Kok Tambahan', amount: 20000, dueDate: '2026-08-15', type: 'Insidental', createdAt: '2026-08-10' },
];

const initialPayments: Payment[] = [
  { id: 1, billId: 1, userId: 2, amount: 50000, status: 'Lunas', date: '2026-08-05' },
  { id: 2, billId: 1, userId: 3, amount: 50000, status: 'Menunggu Verifikasi', date: '2026-08-12' },
  { id: 3, billId: 1, userId: 4, amount: 50000, status: 'Belum Bayar', date: null },
  { id: 4, billId: 2, userId: 2, amount: 20000, status: 'Belum Bayar', date: null },
];

const initialExpenses: Expense[] = [
  { id: 1, title: 'Sewa Lapangan Agustus', amount: 150000, category: 'Sewa', date: '2026-08-02' },
  { id: 2, title: 'Beli Shuttlecock (2 Slop)', amount: 180000, category: 'Peralatan', date: '2026-08-05' },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);

  const totalIncome = payments.filter(p => p.status === 'Lunas').reduce((sum, p) => sum + p.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const saldoKas = totalIncome - totalExpense;

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const verifyPayment = (paymentId: number, status: string) => {
    setPayments(payments.map(p => p.id === paymentId ? { ...p, status, date: new Date().toISOString() } : p));
  };

  const submitPayment = (billId: number, userId: number) => {
    const existingPayment = payments.find(p => p.billId === billId && p.userId === userId);
    if (existingPayment) {
      setPayments(payments.map(p => p.id === existingPayment.id ? { ...p, status: 'Menunggu Verifikasi', date: new Date().toISOString() } : p));
    } else {
      const billAmount = bills.find(b => b.id === billId)?.amount || 0;
      setPayments([...payments, {
        id: Date.now(),
        billId,
        userId,
        amount: billAmount,
        status: 'Menunggu Verifikasi',
        date: new Date().toISOString()
      }]);
    }
  };

  const addBill = (newBill: Omit<Bill, 'id' | 'createdAt'>) => {
    const billId = Date.now();
    setBills([...bills, { ...newBill, id: billId, createdAt: new Date().toISOString() }]);
    
    const newPayments = users.filter(u => u.role === 'member' && u.status === 'aktif').map(u => ({
      id: Math.random(),
      billId: billId,
      userId: u.id,
      amount: newBill.amount,
      status: 'Belum Bayar',
      date: null
    }));
    setPayments([...payments, ...newPayments]);
  };

  const addExpense = (newExpense: Omit<Expense, 'id' | 'date'>) => {
    setExpenses([...expenses, { ...newExpense, id: Date.now(), date: new Date().toISOString() }]);
  };

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
            <Dashboard user={currentUser} saldoKas={saldoKas} totalIncome={totalIncome} totalExpense={totalExpense} users={users} bills={bills} payments={payments} verifyPayment={verifyPayment} />
          )}
          {activeTab === 'tagihan' && (
            <Bills user={currentUser} bills={bills} payments={payments} users={users} addBill={addBill} submitPayment={submitPayment} />
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

function Dashboard({ user, saldoKas, totalIncome, totalExpense, users, bills, payments, verifyPayment }: any) {
  const isAdmin = user.role === 'admin';
  const pendingPayments = isAdmin ? payments.filter((p: any) => p.status === 'Menunggu Verifikasi') : [];
  const myActiveBills = !isAdmin ? payments.filter((p: any) => p.userId === user.id && (p.status === 'Belum Bayar' || p.status === 'Ditolak')) : [];

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
                      <div className="flex-1"><p className="font-bold text-sm text-slate-800">{member?.name}</p><p className="text-xs text-slate-500 truncate mt-0.5">{bill?.title}</p><p className="text-sm font-extrabold text-emerald-600 mt-1">{formatRp(payment.amount)}</p></div>
                      <div className="flex gap-2">
                        <button onClick={() => verifyPayment(payment.id, 'Ditolak')} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><XCircle size={20} /></button>
                        <button onClick={() => verifyPayment(payment.id, 'Lunas')} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"><CheckCircle size={20} /></button>
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
                  return (
                    <div key={payment.id} className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm flex justify-between items-center gap-4 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                      <div className="flex-1 pl-2"><p className="font-bold text-sm text-slate-800">{bill?.title}</p><p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-1.5"><Clock size={12} /> Jatuh tempo: {formatDate(bill?.dueDate || '')}</p><p className="text-sm font-extrabold text-red-600 mt-1">{formatRp(payment.amount)}</p></div>
                      <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-lg">Belum Lunas</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-6">
            <h3 className="font-extrabold text-slate-800 mb-4">Riwayat Pembayaran Anda</h3>
            <div className="space-y-3">
              {payments.filter((p:any) => p.userId === user.id && p.status !== 'Belum Bayar').slice(0, 3).map((payment:any) => {
                const bill = bills.find((b:any) => b.id === payment.billId);
                const isVerified = payment.status === 'Lunas';
                const isPending = payment.status === 'Menunggu Verifikasi';
                return (
                  <div key={payment.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isVerified ? 'bg-emerald-50 text-emerald-600' : isPending ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                      {isVerified ? <CheckCircle size={20} /> : isPending ? <Clock size={20} /> : <XCircle size={20} />}
                    </div>
                    <div className="flex-1"><p className="font-bold text-sm text-slate-800">{bill?.title}</p><p className="text-xs font-medium text-slate-500 mt-0.5">{payment.date ? formatDate(payment.date) : '-'}</p></div>
                    <div className="text-right"><p className="text-sm font-extrabold">{formatRp(payment.amount)}</p><p className={`text-[10px] font-bold mt-0.5 ${isVerified ? 'text-emerald-600' : isPending ? 'text-orange-600' : 'text-red-600'}`}>{payment.status}</p></div>
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

function Bills({ user, bills, payments, users, addBill, submitPayment }: any) {
  const isAdmin = user.role === 'admin';
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [toastMessage, setToastMessage] = useState('');

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

  return (
    <div className="space-y-4 animate-fade-in relative">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl z-50 text-sm font-bold flex items-center gap-2 border border-slate-700">
          <CheckCircle size={18} className="text-emerald-400" /> {toastMessage}
        </div>
      )}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-extrabold text-slate-800">Daftar Tagihan</h2>
        {isAdmin && <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-4 py-2 rounded-full font-bold hover:bg-emerald-700 transition-colors shadow-sm"><Plus size={16} /> Buat Baru</button>}
      </div>
      <div className="space-y-4">
        {bills.map((bill: any) => {
          let paymentStatus = null;
          let paymentRecord = null;
          if (!isAdmin) {
            paymentRecord = payments.find((p:any) => p.billId === bill.id && p.userId === user.id);
            paymentStatus = paymentRecord ? paymentRecord.status : 'Belum Bayar';
          } else {
            const billPayments = payments.filter((p:any) => p.billId === bill.id);
            const lunasCount = billPayments.filter((p:any) => p.status === 'Lunas').length;
            const totalMembers = users.filter((u:any) => u.role === 'member').length;
            paymentStatus = `${lunasCount}/${totalMembers} Lunas`;
          }
          return (
            <div key={bill.id} className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex justify-between items-start mb-3"><span className="text-[10px] font-extrabold tracking-wider uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">{bill.type}</span>{!isAdmin && paymentStatus && <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${paymentStatus === 'Lunas' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : paymentStatus === 'Menunggu Verifikasi' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>{paymentStatus}</span>}</div>
                <h3 className="font-extrabold text-slate-800 text-lg">{bill.title}</h3>
                <div className="flex items-center justify-between mt-4 text-sm"><div className="flex items-center gap-1.5 text-slate-500 font-medium"><Clock size={14} /><span>JT: {formatDate(bill.dueDate)}</span></div><div className="font-extrabold text-slate-800 text-lg">{formatRp(bill.amount)}</div></div>
              </div>
              <div className="bg-slate-50/50 px-5 py-4 border-t border-slate-100 flex justify-between items-center">
                {isAdmin ? <span className="text-sm font-bold text-slate-600 flex items-center gap-2"><Users size={16} className="text-slate-400" /> {paymentStatus}</span> : (
                  <div className="w-full">
                    {(!paymentRecord || paymentRecord.status === 'Belum Bayar' || paymentRecord.status === 'Ditolak') ? <button onClick={() => setSelectedBill(bill)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"><QrCode size={18} /> Bayar Sekarang</button> : <button disabled className="w-full bg-slate-100 text-slate-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-slate-200">{paymentRecord.status === 'Lunas' ? <CheckCircle size={18} /> : <Clock size={18} />}{paymentRecord.status === 'Lunas' ? 'Pembayaran Selesai' : 'Sedang Diproses'}</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
      {selectedBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-emerald-600 p-5 text-center relative"><button onClick={() => setSelectedBill(null)} className="absolute top-4 right-4 p-1.5 bg-white/10 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"><XCircle size={20} /></button><h3 className="text-white font-extrabold text-lg">Pembayaran QRIS</h3><p className="text-emerald-100 text-xs font-medium mt-1">{selectedBill.title}</p></div>
            <div className="p-6 flex flex-col items-center">
              <div className="text-center mb-6"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Tagihan</p><p className="text-3xl font-extrabold text-slate-800">{formatRp(selectedBill.amount)}</p></div>
              <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm w-56 h-56 flex items-center justify-center mb-6 relative"><QrCode size={140} strokeWidth={1} className="text-slate-800" /><div className="absolute inset-0 flex items-center justify-center"><div className="bg-white px-3 py-1.5 rounded-full shadow-md text-[10px] font-extrabold text-emerald-600 border border-slate-100">GPN QRIS</div></div></div>
              <div className="w-full space-y-4 mt-2"><p className="text-xs text-center text-slate-500 font-medium leading-relaxed">Scan QR Code di atas menggunakan m-Banking atau E-Wallet. Simpan bukti transfer Anda.</p><button onClick={() => {submitPayment(selectedBill.id, user.id); setSelectedBill(null); setToastMessage('Bukti pembayaran berhasil diupload!'); setTimeout(() => setToastMessage(''), 3500);}} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"><Upload size={18} /> Upload Bukti Transfer</button></div>
            </div>
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
             <button onClick={() => onLogin(users[0])} type="button" className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors group bg-slate-50/30"><div className="p-2 bg-white rounded-full shadow-sm text-slate-400 group-hover:text-emerald-600 transition-all"><UserIcon size={18} strokeWidth={2.5} /></div><span className="text-xs font-extrabold text-slate-600 group-hover:text-emerald-700">Login Admin</span></button>
             <button onClick={() => onLogin(users[1])} type="button" className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 rounded-2xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors group bg-slate-50/30"><div className="p-2 bg-white rounded-full shadow-sm text-slate-400 group-hover:text-blue-600 transition-all"><UserIcon size={18} strokeWidth={2.5} /></div><span className="text-xs font-extrabold text-slate-600 group-hover:text-blue-700">Login Anggota</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}