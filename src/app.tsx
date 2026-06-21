import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Receipt, Wallet, 
  CheckCircle, Clock, XCircle, Plus, 
  LogOut, QrCode, Upload, Bell, ChevronRight, 
  User as UserIcon, Activity, Calendar, MapPin, 
  TrendingUp, PlusCircle, DollarSign, AlertCircle, 
  ChevronDown, Check, RefreshCw
} from 'lucide-react';
import { supabase } from './supabaseClient';

// --- TYPES ---
interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface Session {
  id: number;
  nama_sesi: string;
  tanggal_main: string;
  jam_main: string;
  lokasi: string;
  catatan: string | null;
  status_tagihan: 'draft' | 'generated';
  biaya_per_orang: number;
  created_at: string;
}

interface SessionAttendee {
  id: number;
  session_id: number;
  member_id: number;
  created_at: string;
}

interface SessionExpense {
  id: number;
  session_id: number;
  keterangan: string;
  nominal: number;
  kategori: string;
  created_at: string;
}

interface Payment {
  id: number;
  session_id: number;
  member_id: number;
  nominal_tagihan: number;
  status_pembayaran: 'pending' | 'uploaded' | 'verified' | 'rejected';
  tanggal_bayar: string | null;
  bukti_transfer: string | null;
  created_at: string;
}

interface Pengaturan {
  id: number;
  qris_image_url: string;
  nama_komunitas: string;
  rekening_penerima: string;
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
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(dateStr));
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<Member | null>(() => {
    const saved = localStorage.getItem('sipatra_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [sessionExpenses, setSessionExpenses] = useState<SessionExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Pengaturan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // States for modals and UI interactions
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .order('id', { ascending: true });
      if (membersError) throw membersError;
      setMembers(membersData || []);

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .order('tanggal_main', { ascending: false });
      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);

      const { data: attendeesData, error: attendeesError } = await supabase
        .from('session_attendees')
        .select('*')
        .order('id', { ascending: true });
      if (attendeesError) throw attendeesError;
      setAttendees(attendeesData || []);

      const { data: expensesData, error: expensesError } = await supabase
        .from('session_expenses')
        .select('*')
        .order('id', { ascending: true });
      if (expensesError) throw expensesError;
      setSessionExpenses(expensesData || []);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('id', { ascending: true });
      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

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

    // Subscribe to real-time changes on public tables
    const paymentsChannel = supabase
      .channel('payments_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPayments(prev => {
              if (prev.some(t => t.id === payload.new.id)) return prev;
              return [...prev, payload.new as Payment];
            });
          } else if (payload.eventType === 'UPDATE') {
            setPayments(prev => prev.map(t => t.id === payload.new.id ? (payload.new as Payment) : t));
          } else if (payload.eventType === 'DELETE') {
            setPayments(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel('sessions_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSessions(prev => {
              if (prev.some(s => s.id === payload.new.id)) return prev;
              return [payload.new as Session, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setSessions(prev => prev.map(s => s.id === payload.new.id ? (payload.new as Session) : s));
          } else if (payload.eventType === 'DELETE') {
            setSessions(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const attendeesChannel = supabase
      .channel('attendees_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_attendees' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAttendees(prev => {
              if (prev.some(a => a.id === payload.new.id)) return prev;
              return [...prev, payload.new as SessionAttendee];
            });
          } else if (payload.eventType === 'UPDATE') {
            setAttendees(prev => prev.map(a => a.id === payload.new.id ? (payload.new as SessionAttendee) : a));
          } else if (payload.eventType === 'DELETE') {
            setAttendees(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const expensesChannel = supabase
      .channel('expenses_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_expenses' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSessionExpenses(prev => {
              if (prev.some(e => e.id === payload.new.id)) return prev;
              return [...prev, payload.new as SessionExpense];
            });
          } else if (payload.eventType === 'UPDATE') {
            setSessionExpenses(prev => prev.map(e => e.id === payload.new.id ? (payload.new as SessionExpense) : e));
          } else if (payload.eventType === 'DELETE') {
            setSessionExpenses(prev => prev.filter(e => e.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(attendeesChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, []);

  // Kas calculations
  const totalIncome = payments.filter(p => p.status_pembayaran === 'verified').reduce((sum, p) => sum + p.nominal_tagihan, 0);
  const totalExpense = sessionExpenses.reduce((sum, e) => sum + e.nominal, 0);
  const saldoKas = totalIncome - totalExpense;

  const handleLogin = (member: Member) => {
    setCurrentUser(member);
    localStorage.setItem('sipatra_user', JSON.stringify(member));
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sipatra_user');
    setActiveTab('dashboard');
    setSelectedSessionId(null);
    setSelectedPayment(null);
  };

  // --- BACKEND MUTATIONS ---
  const addSession = async (newSession: { nama_sesi: string; tanggal_main: string; jam_main: string; lokasi: string; catatan: string }) => {
    try {
      const { data: insertedSession, error } = await supabase
        .from('sessions')
        .insert({
          nama_sesi: newSession.nama_sesi,
          tanggal_main: newSession.tanggal_main,
          jam_main: newSession.jam_main,
          lokasi: newSession.lokasi,
          catatan: newSession.catatan || null,
          status_tagihan: 'draft',
          biaya_per_orang: 0
        })
        .select()
        .single();
      
      if (error) throw error;
      if (insertedSession) {
        setSessions(prev => [insertedSession, ...prev]);
        setSelectedSessionId(insertedSession.id);
      }
    } catch (err) {
      console.error('Error adding session:', err);
      alert('Gagal membuat sesi baru. Silakan coba lagi.');
    }
  };

  const saveAttendance = async (sessionId: number, selectedMemberIds: number[]) => {
    try {
      // Delete existing attendance
      const { error: deleteError } = await supabase
        .from('session_attendees')
        .delete()
        .eq('session_id', sessionId);
      if (deleteError) throw deleteError;

      // Insert new attendance
      if (selectedMemberIds.length > 0) {
        const insertData = selectedMemberIds.map(memberId => ({
          session_id: sessionId,
          member_id: memberId
        }));
        const { error: insertError } = await supabase
          .from('session_attendees')
          .insert(insertData);
        if (insertError) throw insertError;
      }

      // Sync state
      const { data: newAttendees, error: fetchError } = await supabase
        .from('session_attendees')
        .select('*')
        .order('id', { ascending: true });
      if (!fetchError && newAttendees) {
        setAttendees(newAttendees);
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert('Gagal menyimpan kehadiran. Silakan coba lagi.');
    }
  };

  const addSessionExpense = async (sessionId: number, keterangan: string, nominal: number, kategori: string) => {
    try {
      const { data: insertedExpense, error } = await supabase
        .from('session_expenses')
        .insert({
          session_id: sessionId,
          keterangan,
          nominal,
          kategori
        })
        .select()
        .single();
      
      if (error) throw error;
      if (insertedExpense) {
        setSessionExpenses(prev => [...prev, insertedExpense]);
      }
    } catch (err) {
      console.error('Error adding session expense:', err);
      alert('Gagal menambahkan pengeluaran sesi.');
    }
  };

  const deleteSessionExpense = async (expenseId: number) => {
    try {
      const { error } = await supabase
        .from('session_expenses')
        .delete()
        .eq('id', expenseId);
      
      if (error) throw error;
      setSessionExpenses(prev => prev.filter(e => e.id !== expenseId));
    } catch (err) {
      console.error('Error deleting session expense:', err);
      alert('Gagal menghapus pengeluaran.');
    }
  };

  const generateBillsForSession = async (sessionId: number) => {
    try {
      const sessionAttendees = attendees.filter(a => a.session_id === sessionId);
      if (sessionAttendees.length === 0) {
        alert('Tidak ada anggota yang hadir pada sesi ini. Tandai kehadiran terlebih dahulu.');
        return;
      }
      
      const sessionExps = sessionExpenses.filter(e => e.session_id === sessionId);
      const totalSessionExpense = sessionExps.reduce((sum, e) => sum + e.nominal, 0);
      if (totalSessionExpense <= 0) {
        alert('Total pengeluaran sesi adalah Rp 0. Tambahkan pengeluaran sesi terlebih dahulu.');
        return;
      }

      const costPerPerson = Math.round(totalSessionExpense / sessionAttendees.length);

      // Create payments records
      const paymentsToInsert = sessionAttendees.map(a => ({
        session_id: sessionId,
        member_id: a.member_id,
        nominal_tagihan: costPerPerson,
        status_pembayaran: 'pending'
      }));

      // Insert payments into Supabase
      const { error: insertPaymentsError } = await supabase
        .from('payments')
        .insert(paymentsToInsert);
      if (insertPaymentsError) throw insertPaymentsError;

      // Update session status
      const { error: updateSessionError } = await supabase
        .from('sessions')
        .update({
          status_tagihan: 'generated',
          biaya_per_orang: costPerPerson
        })
        .eq('id', sessionId);
      if (updateSessionError) throw updateSessionError;

      // Update state
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        status_tagihan: 'generated',
        biaya_per_orang: costPerPerson
      } : s));

      // Fetch newly created payments
      const { data: newPaymentsData, error: payError } = await supabase
        .from('payments')
        .select('*')
        .order('id', { ascending: true });
      if (!payError && newPaymentsData) {
        setPayments(newPaymentsData);
      }

      alert(`Sukses! Tagihan berhasil diterbitkan bagi ${sessionAttendees.length} peserta hadir. Masing-masing: ${formatRp(costPerPerson)}`);
    } catch (err) {
      console.error('Error generating bills:', err);
      alert('Gagal menerbitkan tagihan. Silakan coba lagi.');
    }
  };

  const submitPaymentWithProof = async (paymentId: number, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${paymentId}_${Date.now()}.${fileExt}`;
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

    // Update payment in Supabase
    const dateStr = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status_pembayaran: 'uploaded',
        tanggal_bayar: dateStr,
        bukti_transfer: publicUrl
      })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    // Update local state to trigger instant UI refresh
    setPayments(prev => prev.map(t => t.id === paymentId ? {
      ...t,
      status_pembayaran: 'uploaded',
      tanggal_bayar: dateStr,
      bukti_transfer: publicUrl
    } : t));
  };

  const verifyPayment = async (paymentId: number, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status_pembayaran: status })
        .eq('id', paymentId);
      if (error) throw error;
      
      setPayments(prev => prev.map(t => t.id === paymentId ? { ...t, status_pembayaran: status } : t));
    } catch (err) {
      console.error('Error verifying payment:', err);
      alert('Gagal memperbarui status verifikasi pembayaran.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 w-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-emerald-400 font-extrabold tracking-wide text-sm animate-pulse">Menghubungkan ke Supabase...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} members={members} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center text-slate-100 font-sans">
      <div className="w-full max-w-md bg-slate-900 min-h-screen shadow-2xl relative pb-20 flex flex-col border-x border-slate-800">
        
        {/* HEADER */}
        <header className="bg-slate-800/80 backdrop-blur-md text-white p-4 sticky top-0 z-10 rounded-b-[2rem] border-b border-slate-700/50 shadow-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg font-black text-white text-base">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selamat datang,</p>
                <p className="font-bold text-sm text-slate-100 truncate w-36 tracking-wide">{currentUser.name}</p>
              </div>
            </div>
            <div className="flex gap-2.5 items-center">
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${currentUser.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                {currentUser.role === 'admin' ? 'Bendahara' : 'Anggota'}
              </span>
              <button onClick={handleLogout} className="p-2 bg-slate-700/60 hover:bg-slate-700 hover:text-red-400 rounded-full transition-colors duration-200">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 hide-scrollbar space-y-6">
          {activeTab === 'dashboard' && (
            <Dashboard 
              user={currentUser} 
              saldoKas={saldoKas} 
              totalIncome={totalIncome} 
              totalExpense={totalExpense} 
              members={members} 
              sessions={sessions} 
              attendees={attendees} 
              sessionExpenses={sessionExpenses} 
              payments={payments} 
              verifyPayment={verifyPayment}
              setViewProofUrl={setViewProofUrl}
              setSelectedPayment={setSelectedPayment}
            />
          )}

          {activeTab === 'tagihan' && (
            currentUser.role === 'admin' ? (
              <SessionsAdmin 
                sessions={sessions} 
                members={members} 
                attendees={attendees} 
                sessionExpenses={sessionExpenses} 
                payments={payments}
                selectedSessionId={selectedSessionId}
                setSelectedSessionId={setSelectedSessionId}
                showAddSessionModal={showAddSessionModal}
                setShowAddSessionModal={setShowAddSessionModal}
                addSession={addSession}
                saveAttendance={saveAttendance}
                addSessionExpense={addSessionExpense}
                deleteSessionExpense={deleteSessionExpense}
                generateBillsForSession={generateBillsForSession}
                verifyPayment={verifyPayment}
                setViewProofUrl={setViewProofUrl}
              />
            ) : (
              <MyBillsMember 
                user={currentUser}
                sessions={sessions}
                payments={payments}
                settings={settings}
                selectedPayment={selectedPayment}
                setSelectedPayment={setSelectedPayment}
                submitPaymentWithProof={submitPaymentWithProof}
              />
            )
          )}

          {activeTab === 'kas' && (
            <Treasury 
              saldoKas={saldoKas} 
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              sessionExpenses={sessionExpenses} 
              sessions={sessions}
            />
          )}

          {activeTab === 'anggota' && currentUser.role === 'admin' && (
            <MembersList members={members} />
          )}
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="fixed bottom-0 w-full max-w-md bg-slate-900 border-t border-slate-800 flex justify-around p-3 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.3)] z-20">
          <NavItem icon={<Home size={20} />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Receipt size={20} />} label={currentUser.role === 'admin' ? 'Kelola Sesi' : 'Tagihan'} active={activeTab === 'tagihan'} onClick={() => setActiveTab('tagihan')} />
          <NavItem icon={<Wallet size={20} />} label="Kas" active={activeTab === 'kas'} onClick={() => setActiveTab('kas')} />
          {currentUser.role === 'admin' && <NavItem icon={<Users size={20} />} label="Anggota" active={activeTab === 'anggota'} onClick={() => setActiveTab('anggota')} />}
        </nav>

        {/* IMAGE PROOF VIEWER MODAL */}
        {viewProofUrl && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewProofUrl(null)}>
            <div className="bg-slate-900 p-3 rounded-3xl border border-slate-800 max-w-sm w-full relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <button onClick={() => setViewProofUrl(null)} className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 transition-colors">
                <XCircle size={20} />
              </button>
              <h3 className="font-extrabold text-sm mb-4 text-slate-100 pr-10">Bukti Transfer Pembayaran</h3>
              <div className="bg-slate-950 rounded-2xl overflow-hidden aspect-square border border-slate-850 flex items-center justify-center">
                <img src={viewProofUrl} alt="Bukti Transfer" className="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 w-16 transition-all duration-200 ${active ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-500 hover:text-slate-400'}`}>
      <div className={`${active ? 'bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : ''} p-2 rounded-2xl transition-all duration-250`}>
        {icon}
      </div>
      <span className="text-[9px] tracking-wide">{label}</span>
    </button>
  );
}

// --- DASHBOARD COMPONENT ---
function Dashboard({ 
  user, saldoKas, totalIncome, totalExpense, members, sessions, attendees, sessionExpenses, payments, verifyPayment, setViewProofUrl, setSelectedPayment 
}: any) {
  const isAdmin = user.role === 'admin';
  
  // Pending payments (uploaded state)
  const pendingPayments = payments.filter((p: any) => p.status_pembayaran === 'uploaded');
  
  // Member specific active bills
  const myPayments = payments.filter((p: any) => p.member_id === user.id);
  const myActiveBills = myPayments.filter((p: any) => p.status_pembayaran === 'pending' || p.status_pembayaran === 'rejected');
  const myPaidCount = myPayments.filter((p: any) => p.status_pembayaran === 'verified').length;

  return (
    <div className="space-y-6">
      
      {/* STATS OVERVIEW CARD */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-950/20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 p-4 opacity-10 transform rotate-12 scale-150">
          <Wallet size={160} />
        </div>
        
        <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-bold uppercase tracking-wider text-emerald-100">
          Total Saldo Kas
        </span>
        <h2 className="text-3xl font-black mt-3 mb-6 tracking-tight">{formatRp(saldoKas)}</h2>
        
        <div className="flex gap-4 border-t border-white/10 pt-4">
          <div className="flex-1">
            <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider">Total Pemasukan</p>
            <p className="font-extrabold text-sm text-slate-50">{formatRp(totalIncome)}</p>
          </div>
          <div className="w-px bg-white/10"></div>
          <div className="flex-1">
            <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider">Total Pengeluaran</p>
            <p className="font-extrabold text-sm text-slate-50">{formatRp(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* QUICK STATS ROW */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Anggota</p>
            <p className="font-black text-slate-100 text-sm">{members.length} Orang</p>
          </div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Sesi</p>
            <p className="font-black text-slate-100 text-sm">{sessions.length} Sesi</p>
          </div>
        </div>
      </div>

      {/* ADMIN SECTION: PENDING PAYMENTS VERIFICATION */}
      {isAdmin ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-300">Menunggu Verifikasi</h3>
            <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-500/30">
              {pendingPayments.length}
            </span>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="text-center p-8 bg-slate-800/30 border border-dashed border-slate-800 rounded-3xl text-slate-500 text-xs font-bold">
              Tidak ada pembayaran pending.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPayments.map((p: any) => {
                const member = members.find((m: any) => m.id === p.member_id);
                const session = sessions.find((s: any) => s.id === p.session_id);
                return (
                  <div key={p.id} className="bg-slate-800/70 p-4 rounded-2xl border border-slate-800/80 shadow-md flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-sm text-slate-100 truncate">{member?.name || 'Anggota'}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{session?.nama_sesi || 'Sesi Game'}</p>
                      <p className="text-xs font-black text-emerald-400 mt-1">{formatRp(p.nominal_tagihan)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => p.bukti_transfer && setViewProofUrl(p.bukti_transfer)}
                        className="px-2.5 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-[10px] font-bold border border-slate-650 transition-colors"
                      >
                        Bukti
                      </button>
                      <button 
                        onClick={() => verifyPayment(p.id, 'rejected')} 
                        className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/25 rounded-xl transition-all"
                      >
                        <XCircle size={15} />
                      </button>
                      <button 
                        onClick={() => verifyPayment(p.id, 'verified')} 
                        className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl transition-all"
                      >
                        <CheckCircle size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* MEMBER SECTION: MY BILLS SUMMARY & HISTORY */
        <div className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-300">Tagihan Belum Dibayar</h3>
            
            {myActiveBills.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 text-center text-emerald-300 flex flex-col items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                  <CheckCircle size={28} className="text-emerald-400 animate-pulse" />
                </div>
                <div>
                  <p className="font-black text-sm text-slate-100">Hebat! Iuran Anda Lunas</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Semua tagihan kehadiran sesi Anda telah diselesaikan.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {myActiveBills.map((p: any) => {
                  const session = sessions.find((s: any) => s.id === p.session_id);
                  const isRejected = p.status_pembayaran === 'rejected';
                  return (
                    <div key={p.id} className={`bg-slate-800/60 p-4 rounded-2xl border ${isRejected ? 'border-red-500/30' : 'border-slate-800'} flex justify-between items-center gap-3 shadow-md`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-sm text-slate-100 truncate">{session?.nama_sesi || 'Sesi Badminton'}</p>
                        <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                          <Calendar size={11} />
                          <span className="text-[10px] font-semibold">{formatDate(session?.tanggal_main || '')}</span>
                        </div>
                        <p className="text-sm font-black text-red-400 mt-1">{formatRp(p.nominal_tagihan)}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${isRejected ? 'bg-red-500/20 text-red-300 border border-red-500/35 animate-pulse' : 'bg-amber-500/20 text-amber-300 border border-amber-500/35'}`}>
                          {isRejected ? 'Ditolak' : 'Belum Bayar'}
                        </span>
                        <button 
                          onClick={() => setSelectedPayment(p)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-[10px] transition-all active:scale-[0.97]"
                        >
                          Bayar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-300">Riwayat Sesi Saya</h3>
              <span className="text-[10px] font-bold text-slate-400">{myPaidCount} Sesi Lunas</span>
            </div>
            
            <div className="space-y-3">
              {myPayments.filter((p: any) => p.status_pembayaran === 'verified' || p.status_pembayaran === 'uploaded').slice(0, 3).map((p: any) => {
                const session = sessions.find((s: any) => s.id === p.session_id);
                const isVerified = p.status_pembayaran === 'verified';
                return (
                  <div key={p.id} className="bg-slate-800/30 p-3.5 rounded-2xl border border-slate-800/70 flex items-center gap-3.5">
                    <div className={`p-2 rounded-xl border ${isVerified ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {isVerified ? <CheckCircle size={16} /> : <Clock size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-slate-200 truncate">{session?.nama_sesi}</p>
                      <p className="text-[9px] text-slate-500 font-semibold mt-0.5">{p.tanggal_bayar ? formatDate(p.tanggal_bayar) : '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-100">{formatRp(p.nominal_tagihan)}</p>
                      <p className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${isVerified ? 'text-emerald-400' : 'text-blue-400 animate-pulse'}`}>
                        {isVerified ? 'Lunas' : 'Verifikasi'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* RECENT SESSIONS VIEW */}
      <div className="space-y-4 pt-2">
        <h3 className="font-black text-sm uppercase tracking-wider text-slate-300">Daftar Sesi Terkini</h3>
        <div className="space-y-3">
          {sessions.slice(0, 3).map((s: any) => {
            const attendeeCount = attendees.filter((a: any) => a.session_id === s.id).length;
            const isGenerated = s.status_tagihan === 'generated';
            return (
              <div key={s.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/80 flex justify-between items-center gap-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm text-slate-200 truncate">{s.nama_sesi}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold text-slate-400">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(s.tanggal_main)}</span>
                    <span className="flex items-center gap-1"><Users size={11} /> {attendeeCount} Hadir</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider inline-block mb-1.5 ${isGenerated ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700 text-slate-400'}`}>
                    {isGenerated ? 'Generated' : 'Draft'}
                  </span>
                  <p className="text-xs font-black text-slate-300">
                    {isGenerated ? formatRp(s.biaya_per_orang) : 'N/A'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// --- ADMIN SESSION & ATTENDANCE COMPONENT ---
function SessionsAdmin({ 
  sessions, members, attendees, sessionExpenses, payments, selectedSessionId, setSelectedSessionId, 
  showAddSessionModal, setShowAddSessionModal, addSession, saveAttendance, addSessionExpense, deleteSessionExpense, generateBillsForSession, verifyPayment, setViewProofUrl 
}: any) {
  
  const handleCreateSession = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addSession({
      nama_sesi: fd.get('nama_sesi') as string,
      tanggal_main: fd.get('tanggal_main') as string,
      jam_main: fd.get('jam_main') as string,
      lokasi: fd.get('lokasi') as string,
      catatan: fd.get('catatan') as string
    });
    setShowAddSessionModal(false);
  };

  const handleAddExpenseInline = (e: React.FormEvent<HTMLFormElement>, sessionId: number) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const keterangan = fd.get('keterangan') as string;
    const nominal = parseInt(fd.get('nominal') as string);
    const kategori = fd.get('kategori') as string;
    
    if (keterangan && nominal > 0) {
      addSessionExpense(sessionId, keterangan, nominal, kategori);
      e.currentTarget.reset();
    }
  };

  return (
    <div className="space-y-5">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black tracking-wide text-slate-100 uppercase">Manajemen Sesi</h2>
        <button 
          onClick={() => setShowAddSessionModal(true)} 
          className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl font-bold transition-all shadow-md shadow-emerald-950/20 active:scale-[0.98]"
        >
          <Plus size={14} /> Sesi Baru
        </button>
      </div>

      {/* SESSIONS LIST */}
      <div className="space-y-4">
        {sessions.map((s: any) => {
          const isSelected = selectedSessionId === s.id;
          const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
          const totalExps = sExpenses.reduce((sum: number, e: any) => sum + e.nominal, 0);
          const sAttendees = attendees.filter((a: any) => a.session_id === s.id);
          const sPayments = payments.filter((p: any) => p.session_id === s.id);
          const lunasCount = sPayments.filter((p: any) => p.status_pembayaran === 'verified').length;
          
          return (
            <div key={s.id} className="bg-slate-800/60 rounded-3xl border border-slate-800/90 shadow-md overflow-hidden">
              
              {/* SESSION BRIEF CARD */}
              <div 
                onClick={() => setSelectedSessionId(isSelected ? null : s.id)}
                className="p-4 flex justify-between items-center cursor-pointer select-none hover:bg-slate-800/80 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider inline-block mb-1.5 ${s.status_tagihan === 'generated' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                    {s.status_tagihan === 'generated' ? 'Tagihan Terbit' : 'Draft Sesi'}
                  </span>
                  <h3 className="font-extrabold text-sm text-slate-100 truncate">{s.nama_sesi}</h3>
                  <div className="flex flex-wrap items-center gap-3.5 mt-2 text-[10px] text-slate-400 font-semibold">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(s.tanggal_main)}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} /> {s.lokasi}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Split Cost</p>
                    <p className="text-sm font-black text-emerald-400 mt-0.5">{s.status_tagihan === 'generated' ? formatRp(s.biaya_per_orang) : '-'}</p>
                  </div>
                  <ChevronDown size={18} className={`text-slate-500 transition-transform duration-250 ${isSelected ? 'transform rotate-180 text-emerald-400' : ''}`} />
                </div>
              </div>

              {/* EXPANDED INTERACTIVE DETAILS */}
              {isSelected && (
                <div className="border-t border-slate-700/50 bg-slate-800/30 p-4 space-y-5 animate-slide-down">
                  
                  {/* DETAIL INFORMASI */}
                  <div className="text-xs bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60 space-y-1.5">
                    <p className="flex justify-between"><span className="text-slate-400 font-medium">Waktu Main:</span> <span className="font-bold text-slate-200">{s.jam_main}</span></p>
                    {s.catatan && <p className="flex justify-between"><span className="text-slate-400 font-medium">Catatan:</span> <span className="font-bold text-slate-200">{s.catatan}</span></p>}
                  </div>

                  {/* 1. MODULE: KEHADIRAN ANGGOTA */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Kehadiran Peserta</span>
                      <span className="bg-slate-755 text-slate-300 text-[10px] px-2 py-0.5 rounded-md">{sAttendees.length} Hadir</span>
                    </h4>
                    
                    {s.status_tagihan === 'draft' ? (
                      /* Draft State: Admin can edit checklist */
                      <div className="bg-slate-850 border border-slate-750 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 hide-scrollbar">
                        {members.filter((m: any) => m.role === 'member' && m.status === 'aktif').map((m: any) => {
                          const isChecked = sAttendees.some((a: any) => a.member_id === m.id);
                          return (
                            <label key={m.id} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors text-xs font-semibold">
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={async () => {
                                  const currentIds = sAttendees.map((a: any) => a.member_id);
                                  const newIds = isChecked 
                                    ? currentIds.filter(id => id !== m.id)
                                    : [...currentIds, m.id];
                                  await saveAttendance(s.id, newIds);
                                }}
                                className="w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500/20 bg-slate-800 border-slate-700" 
                              />
                              <span className={isChecked ? 'text-emerald-450 font-bold' : 'text-slate-400'}>{m.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      /* Generated State: Read-only attendance list */
                      <div className="flex flex-wrap gap-1.5">
                        {sAttendees.map((a: any) => {
                          const mName = members.find((m: any) => m.id === a.member_id)?.name || 'Anggota';
                          return (
                            <span key={a.id} className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                              <Check size={10} strokeWidth={3} /> {mName}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. MODULE: PENGELUARAN SESI */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Rincian Biaya Sesi</span>
                      <span className="text-red-400 font-extrabold">{formatRp(totalExps)}</span>
                    </h4>

                    {/* Expenses List */}
                    {sExpenses.length === 0 ? (
                      <p className="text-[10px] text-slate-500 font-bold italic text-center py-2 bg-slate-850/40 rounded-xl border border-slate-800">
                        Belum ada biaya pengeluaran sesi dicatat.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sExpenses.map((exp: any) => (
                          <div key={exp.id} className="bg-slate-850 p-2.5 rounded-xl border border-slate-750/70 flex justify-between items-center text-xs">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-extrabold text-slate-200 truncate">{exp.keterangan}</p>
                              <span className="text-[8px] bg-slate-800 text-slate-450 font-bold px-1.5 py-0.5 rounded mt-1 inline-block">{exp.kategori}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-100">{formatRp(exp.nominal)}</span>
                              {s.status_tagihan === 'draft' && (
                                <button 
                                  onClick={() => deleteSessionExpense(exp.id)} 
                                  className="text-red-450 hover:text-red-400 p-1 hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                  <XCircle size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Expense Form Inline (Draft Only) */}
                    {s.status_tagihan === 'draft' && (
                      <form onSubmit={(e) => handleAddExpenseInline(e, s.id)} className="bg-slate-850 border border-slate-750/80 p-3 rounded-2xl space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            name="keterangan" 
                            type="text" 
                            required 
                            placeholder="Contoh: Lapangan (2 Jam)" 
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-800 border border-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-100 placeholder:text-slate-500" 
                          />
                          <input 
                            name="nominal" 
                            type="number" 
                            required 
                            placeholder="Nominal (Rp)" 
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-800 border border-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-100 placeholder:text-slate-500" 
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <select 
                            name="kategori" 
                            className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-slate-800 border border-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none text-slate-350 appearance-none flex-1"
                          >
                            <option value="Sewa Lapangan">Sewa Lapangan</option>
                            <option value="Peralatan">Peralatan (Kok, dll)</option>
                            <option value="Konsumsi">Konsumsi</option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                          <button 
                            type="submit" 
                            className="px-4 py-1.5 bg-slate-755 hover:bg-slate-700 text-slate-200 font-extrabold rounded-lg text-[10px] flex items-center gap-1 transition-all"
                          >
                            <Plus size={11} /> Catat
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* 3. ACTIONS MODULE / PAYMENTS STATUS MONITOR */}
                  <div className="pt-2 border-t border-slate-700/50">
                    {s.status_tagihan === 'draft' ? (
                      /* Draft Actions: Publish Tagihan (Calculate split cost) */
                      <div className="space-y-3">
                        <div className="bg-emerald-500/10 border border-emerald-500/15 p-3 rounded-2xl text-xs flex justify-between items-center">
                          <div>
                            <p className="text-slate-400 font-semibold">Simulasi Biaya:</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {formatRp(totalExps)} / {sAttendees.length} orang
                            </p>
                          </div>
                          <span className="text-sm font-black text-emerald-400">
                            {sAttendees.length > 0 ? formatRp(Math.round(totalExps / sAttendees.length)) : 'Rp 0'}
                          </span>
                        </div>
                        <button 
                          onClick={() => generateBillsForSession(s.id)}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
                        >
                          <TrendingUp size={14} /> Terbitkan Tagihan Sesi
                        </button>
                      </div>
                    ) : (
                      /* Generated Actions: Check Payments & Verification Status */
                      <div className="space-y-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-bold text-xs uppercase tracking-wider text-slate-400">Status Bayar Peserta</p>
                          <span className="text-[10px] font-black text-emerald-450 bg-emerald-500/10 px-2 py-0.5 rounded">
                            {lunasCount}/{sAttendees.length} Lunas
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 rounded-full h-1.5 border border-slate-750 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${sAttendees.length > 0 ? (lunasCount / sAttendees.length) * 100 : 0}%` }}
                          ></div>
                        </div>

                        {/* Session Attendee Payments List */}
                        <div className="space-y-2 mt-3.5">
                          {sPayments.map((p: any) => {
                            const mName = members.find((m: any) => m.id === p.member_id)?.name || 'Anggota';
                            const isVerified = p.status_pembayaran === 'verified';
                            const isUploaded = p.status_pembayaran === 'uploaded';
                            const isRejected = p.status_pembayaran === 'rejected';
                            
                            return (
                              <div key={p.id} className="bg-slate-850 p-2.5 rounded-xl border border-slate-750/70 flex justify-between items-center text-xs">
                                <div className="min-w-0 flex-1">
                                  <p className="font-extrabold text-slate-200 truncate">{mName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`text-[8px] font-black uppercase tracking-wider ${
                                      isVerified ? 'text-emerald-450' : 
                                      isUploaded ? 'text-blue-400 animate-pulse' : 
                                      isRejected ? 'text-red-450' : 'text-slate-500'
                                    }`}>
                                      {isVerified ? 'Lunas' : 
                                       isUploaded ? 'Uploaded (Verifikasi)' : 
                                       isRejected ? 'Ditolak' : 'Belum Bayar'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isUploaded && p.bukti_transfer && (
                                    <button 
                                      onClick={() => setViewProofUrl(p.bukti_transfer)}
                                      className="px-2 py-1 bg-slate-750 hover:bg-slate-700 text-slate-350 text-[9px] font-extrabold rounded-md transition-colors"
                                    >
                                      Bukti
                                    </button>
                                  )}
                                  {isUploaded && (
                                    <div className="flex gap-1">
                                      <button 
                                        onClick={() => verifyPayment(p.id, 'rejected')}
                                        className="p-1 text-red-400 hover:bg-red-500/10 rounded border border-red-500/20"
                                      >
                                        <XCircle size={13} />
                                      </button>
                                      <button 
                                        onClick={() => verifyPayment(p.id, 'verified')}
                                        className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded border border-emerald-500/20"
                                      >
                                        <CheckCircle size={13} />
                                      </button>
                                    </div>
                                  )}
                                  {isVerified && (
                                    <CheckCircle size={15} className="text-emerald-400 border border-emerald-500/10 p-0.5 rounded-full" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* CREATE SESSION MODAL (Admin only) */}
      {showAddSessionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-6 relative border border-slate-800 shadow-2xl animate-slide-up">
            <button 
              onClick={() => setShowAddSessionModal(false)} 
              className="absolute top-5 right-5 p-2 bg-slate-800 text-slate-400 hover:text-slate-100 rounded-full transition-colors"
            >
              <XCircle size={18} />
            </button>
            <h3 className="text-base font-black text-slate-100 uppercase tracking-wide mb-6">Tambah Sesi Baru</h3>
            
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Nama Sesi</label>
                <input required name="nama_sesi" type="text" placeholder="Contoh: Badminton Minggu Pagi" className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Tanggal Main</label>
                  <input required name="tanggal_main" type="date" className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Jam Main</label>
                  <input required name="jam_main" type="text" placeholder="08:00 - 10:00" className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Lokasi</label>
                <input required name="lokasi" type="text" placeholder="GOR Badminton Utama" className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Catatan (Optional)</label>
                <textarea name="catatan" placeholder="Catatan opsional..." rows={2} className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-xs resize-none"></textarea>
              </div>
              <button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl mt-4 transition-all shadow-lg shadow-emerald-950/20 active:scale-[0.98] text-xs"
              >
                Buat Sesi & Tandai Hadir
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// --- MEMBER MY BILLS & QRIS MODAL COMPONENT ---
function MyBillsMember({ 
  user, sessions, payments, settings, selectedPayment, setSelectedPayment, submitPaymentWithProof 
}: any) {
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync state modal with payments state array
  const currentPayment = selectedPayment 
    ? payments.find((p: any) => p.id === selectedPayment.id) 
    : null;

  const sessionDetail = currentPayment 
    ? sessions.find((s: any) => s.id === currentPayment.session_id) 
    : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPayment) return;

    if (currentPayment.nominal_tagihan <= 0) {
      setToastError('Nominal tagihan harus lebih dari Rp 0 untuk melakukan pembayaran.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setToastError('Format file tidak didukung. Harap gunakan JPG, PNG, atau WEBP.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }

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
    if (!selectedFile || !currentPayment) return;

    setIsUploading(true);
    try {
      await submitPaymentWithProof(currentPayment.id, selectedFile);
      setToastMessage('Bukti pembayaran berhasil diunggah!');
      handleCancelFile();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err: any) {
      console.error(err);
      setToastError(err.message || 'Gagal mengunggah bukti pembayaran.');
      setTimeout(() => setToastError(''), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFilePicker = () => {
    if (currentPayment?.status_pembayaran === 'verified') {
      setToastError('Pembayaran sudah lunas.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCloseModal = () => {
    setSelectedPayment(null);
    handleCancelFile();
  };

  // Filter payments for this member
  const myPayments = payments.filter((p: any) => p.member_id === user.id);

  return (
    <div className="space-y-4">
      {/* Toast Alerts */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-5 py-3.5 rounded-full shadow-2xl z-50 text-xs font-bold flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle size={15} className="text-emerald-400" /> {toastMessage}
        </div>
      )}
      {toastError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-655 text-white px-5 py-3.5 rounded-full shadow-2xl z-50 text-xs font-bold flex items-center gap-2 border border-red-500 animate-shake">
          <XCircle size={15} className="text-white" /> {toastError}
        </div>
      )}

      <h2 className="text-lg font-black tracking-wide text-slate-100 uppercase mb-2">Tagihan Sesi Saya</h2>

      {myPayments.length === 0 ? (
        <div className="text-center p-8 bg-slate-800/30 border border-dashed border-slate-800 rounded-3xl text-slate-500 text-xs font-bold">
          Anda tidak memiliki tagihan sesi.
        </div>
      ) : (
        <div className="space-y-4">
          {myPayments.map((p: any) => {
            const session = sessions.find((s: any) => s.id === p.session_id);
            const isVerified = p.status_pembayaran === 'verified';
            const isUploaded = p.status_pembayaran === 'uploaded';
            const isRejected = p.status_pembayaran === 'rejected';
            
            return (
              <div key={p.id} className="bg-slate-800/60 rounded-3xl border border-slate-800 shadow-md overflow-hidden">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[9px] font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-355 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Sesi Kehadiran
                    </span>
                    <span className={`text-[8px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider ${
                      isVerified ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      isUploaded ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      isRejected ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {isVerified ? 'Lunas' :
                       isUploaded ? 'Verifikasi' :
                       isRejected ? 'Ditolak' : 'Belum Bayar'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-slate-100 leading-snug">{session?.nama_sesi}</h3>
                  <div className="flex items-center justify-between mt-4 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-450 font-bold">
                      <Calendar size={13} />
                      <span>{formatDate(session?.tanggal_main || '')}</span>
                    </div>
                    <div className="font-black text-slate-100 text-base">{formatRp(p.nominal_tagihan)}</div>
                  </div>
                </div>

                <div className="bg-slate-800/30 px-5 py-4 border-t border-slate-800 flex justify-between items-center">
                  <button 
                    onClick={() => setSelectedPayment(p)} 
                    className={`w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] ${
                      isVerified 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750' 
                        : isUploaded 
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20' 
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20'
                    }`}
                  >
                    <QrCode size={15} /> 
                    {isVerified ? 'Pembayaran Selesai' : isUploaded ? 'Detail Pembayaran' : 'Bayar Sekarang'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL QRIS & STATUS PEMBAYARAN */}
      {currentPayment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl flex flex-col animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-emerald-700 p-5 text-center relative text-white">
              <button 
                onClick={handleCloseModal} 
                className="absolute top-4.5 right-4.5 p-1.5 bg-white/10 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all duration-200"
              >
                <XCircle size={18} />
              </button>
              <h3 className="font-black text-sm uppercase tracking-wider">Pembayaran QRIS</h3>
              <p className="text-emerald-100 text-[10px] font-bold mt-0.5 truncate px-6">{sessionDetail?.nama_sesi}</p>
            </div>

            {/* Modal Body */}
            {currentPayment.status_pembayaran === 'uploaded' || currentPayment.status_pembayaran === 'verified' ? (
              /* SCREEN 2: SUCCESS / CONFIRMATION STATE */
              <div className="p-6 flex flex-col items-center gap-6 text-center">
                
                {/* Success/Pending Icon */}
                <div className={`w-18 h-18 rounded-full flex items-center justify-center shadow-lg ${
                  currentPayment.status_pembayaran === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-bounce'
                }`}>
                  <CheckCircle size={36} strokeWidth={2.5} />
                </div>

                {/* Title & Description */}
                <div className="space-y-1.5">
                  <h4 className="text-base font-black text-slate-100 tracking-tight">
                    {currentPayment.status_pembayaran === 'verified'
                      ? 'Pembayaran Terverifikasi'
                      : 'Bukti Pembayaran Dikirim'}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-4">
                    {currentPayment.status_pembayaran === 'verified'
                      ? 'Terima kasih! Pembayaran Anda telah terverifikasi oleh Bendahara PB.'
                      : 'Bukti transfer berhasil diunggah. Sedang menunggu konfirmasi/verifikasi dari admin.'}
                  </p>
                </div>

                {/* Details Card */}
                <div className="w-full bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Nominal</span>
                    <span className="text-slate-200">{formatRp(currentPayment.nominal_tagihan)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Tanggal Upload</span>
                    <span className="text-slate-200">
                      {currentPayment.tanggal_bayar ? formatDate(currentPayment.tanggal_bayar) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Status</span>
                    <span>
                      {currentPayment.status_pembayaran === 'verified' ? (
                        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-black">
                          Lunas
                        </span>
                      ) : (
                        <span className="bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-black">
                          Menunggu Verifikasi
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={handleCloseModal}
                  className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold py-3.5 rounded-2xl border border-slate-700/60 transition-all text-xs active:scale-[0.98]"
                >
                  Tutup Rincian
                </button>

              </div>
            ) : (
              /* SCREEN 1: SCAN & UPLOAD STATE */
              <div className="p-6 flex flex-col items-center gap-5">
                
                {/* Nominal Display */}
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Nominal Transfer</p>
                  <p className="text-2xl font-black text-emerald-450 tracking-tight">{formatRp(currentPayment.nominal_tagihan)}</p>
                </div>

                {/* Info Text Box */}
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-3.5 w-full text-center space-y-1">
                  <span className="text-[8px] font-black tracking-wider uppercase bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/25 inline-block">QRIS STATIS</span>
                  <p className="text-[10px] font-bold text-amber-400 leading-snug">
                    Masukkan nominal <span className="font-black text-emerald-450">{formatRp(currentPayment.nominal_tagihan)}</span> saat melakukan scan pembayaran.
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-[2rem] border-2 border-slate-800 shadow-inner w-48 h-48 flex items-center justify-center relative overflow-hidden">
                  {settings?.qris_image_url ? (
                    <img
                      src={settings.qris_image_url}
                      alt="QRIS Code"
                      className="w-full h-full object-contain rounded-2xl"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <QrCode size={36} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-[9px] font-bold text-slate-400">QRIS Admin Belum Diunggah</p>
                    </div>
                  )}
                </div>

                {/* File Upload Selector */}
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
                      className="w-full border-2 border-dashed border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 bg-slate-850/40 hover:bg-slate-850 transition-colors"
                    >
                      <Upload size={20} className="text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-300">Pilih Bukti Transfer Pembayaran</span>
                      <span className="text-[8px] text-slate-500">Format: JPG, PNG, WEBP (Maks 5MB)</span>
                    </button>
                  ) : (
                    <div className="border border-slate-800 rounded-2xl p-3 bg-slate-850/50 flex items-center gap-3 w-full">
                      {previewUrl && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0">
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-extrabold text-slate-300 truncate">{selectedFile.name}</p>
                        <p className="text-[9px] text-slate-500 font-semibold">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button
                        onClick={handleCancelFile}
                        disabled={isUploading}
                        className="p-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
                      >
                        <XCircle size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Action Button */}
                <div className="w-full">
                  {isUploading ? (
                    <button disabled className="w-full bg-slate-800 text-slate-500 font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-slate-755 cursor-not-allowed text-xs">
                      <RefreshCw size={14} className="animate-spin" /> Mengirim Bukti...
                    </button>
                  ) : selectedFile ? (
                    <button 
                      onClick={handleUpload}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98]"
                    >
                      <CheckCircle size={14} /> Kirim Bukti Transfer
                    </button>
                  ) : (
                    <button 
                      onClick={triggerFilePicker}
                      className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] border border-slate-700/60"
                    >
                      <Upload size={14} /> {currentPayment.status_pembayaran === 'rejected' ? 'Pilih Bukti Baru' : 'Saya Sudah Bayar'}
                    </button>
                  )}
                </div>

                {/* Account Receiver Information */}
                {settings && (
                  <div className="w-full border-t border-slate-800 pt-3.5 text-center space-y-1">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Atas Nama Rekening</p>
                    <p className="text-xs font-black text-slate-200">{settings.nama_komunitas}</p>
                    <p className="text-[10px] font-bold text-slate-400 bg-slate-850 py-1 px-3 rounded-lg inline-block border border-slate-800 mt-1">{settings.rekening_penerima}</p>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// --- TREASURY (KAS) COMPONENT ---
function Treasury({ saldoKas, totalIncome, totalExpense, sessionExpenses, sessions }: any) {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* TREASURY SUMMARY CARD */}
      <div className="bg-slate-800/80 rounded-[2rem] p-6 text-center border border-slate-700/50 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Activity size={100} />
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Saldo Kas</p>
        <h2 className="text-3xl font-black text-emerald-400 tracking-tight">{formatRp(saldoKas)}</h2>
        
        <div className="flex gap-4 border-t border-slate-700/50 pt-4 mt-5 text-left">
          <div className="flex-1">
            <p className="text-slate-500 text-[9px] font-bold uppercase">Total Tagihan Lunas</p>
            <p className="font-extrabold text-xs text-slate-300">{formatRp(totalIncome)}</p>
          </div>
          <div className="w-px bg-slate-700/50"></div>
          <div className="flex-1">
            <p className="text-slate-500 text-[9px] font-bold uppercase">Total Biaya Sesi</p>
            <p className="font-extrabold text-xs text-slate-300">{formatRp(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* KAS TRANSACTION HISTORY */}
      <div className="space-y-4">
        <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider">Histori Biaya Sesi</h2>
        
        {sessionExpenses.length === 0 ? (
          <div className="text-center p-8 bg-slate-800/30 border border-dashed border-slate-800 rounded-3xl text-slate-500 text-xs font-bold">
            Belum ada pengeluaran kas dicatat.
          </div>
        ) : (
          <div className="space-y-3">
            {[...sessionExpenses].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((exp: any) => {
              const session = sessions.find((s: any) => s.id === exp.session_id);
              return (
                <div key={exp.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Wallet size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-xs text-slate-100 truncate">{exp.keterangan}</p>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 font-bold">
                      <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{exp.kategori}</span>
                      <span>{session?.nama_sesi || 'Sesi Game'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-red-400">-{formatRp(exp.nominal)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// --- MEMBERS LIST COMPONENT ---
function MembersList({ members }: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider">Daftar Anggota</h2>
        <span className="text-xs font-bold text-slate-500">{members.length} Orang</span>
      </div>

      <div className="space-y-3">
        {members.map((m: any) => (
          <div key={m.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3.5 shadow-sm">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${m.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              {m.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-xs text-slate-100 truncate">{m.name}</p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{m.email}</p>
            </div>
            <div>
              <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                m.role === 'admin' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {m.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- LOGIN SCREEN COMPONENT ---
function LoginScreen({ onLogin, members }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const member = members.find((m: any) => m.email === email.trim().toLowerCase());
    if (member) {
      onLogin(member);
    } else {
      setError('Email tidak terdaftar. Gunakan akun demo di bawah.');
    }
  };

  const handleDemoLogin = (role: 'admin' | 'member') => {
    const demoUser = members.find((m: any) => m.role === role);
    if (demoUser) {
      onLogin(demoUser);
    } else {
      setError(`Akun demo ${role} tidak ditemukan di database.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 w-full">
      <div className="bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-800">
        
        {/* Upper Brand Section */}
        <div className="p-10 pb-6 text-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-400 to-teal-650 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-955/40">
            <Activity size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight mb-1">SI-PATRA</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Sesi Badminton & Kas</p>
        </div>

        {/* Form Container */}
        <div className="px-8 pb-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-2xl flex items-center gap-2 font-bold border border-red-500/20">
                <AlertCircle size={15} className="flex-shrink-0" /> 
                <span>{error}</span>
              </div>
            )}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Alamat Email</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="admin@sipatra.com" 
                className="w-full px-4.5 py-3 rounded-2xl bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-100 placeholder:text-slate-500 font-bold text-xs" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Kata Sandi</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••" 
                className="w-full px-4.5 py-3 rounded-2xl bg-slate-800 border border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-100 placeholder:text-slate-500 font-bold text-xs" 
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl mt-4 transition-all shadow-lg shadow-emerald-955/20 active:scale-[0.98] text-xs"
            >
              Masuk
            </button>
          </form>

          {/* Demo Login Shortcuts */}
          <div className="relative pt-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
            <div className="relative flex justify-center text-[9px]"><span className="bg-slate-900 px-3 text-slate-500 font-black uppercase tracking-wider">Akses Cepat Demo</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <button 
              onClick={() => handleDemoLogin('admin')} 
              type="button" 
              className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-800/40 border border-slate-800 rounded-2xl hover:bg-slate-800 hover:border-slate-700 transition-all group"
            >
              <div className="p-1.5 bg-slate-800 rounded-full text-slate-455 group-hover:text-amber-400 transition-colors">
                <UserIcon size={14} />
              </div>
              <span className="text-[9px] font-black text-slate-400 group-hover:text-slate-200">Bendahara</span>
            </button>
            <button 
              onClick={() => handleDemoLogin('member')} 
              type="button" 
              className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-800/40 border border-slate-800 rounded-2xl hover:bg-slate-800 hover:border-slate-700 transition-all group"
            >
              <div className="p-1.5 bg-slate-800 rounded-full text-slate-455 group-hover:text-emerald-455 transition-colors">
                <UserIcon size={14} />
              </div>
              <span className="text-[9px] font-black text-slate-400 group-hover:text-slate-200">Anggota</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}