import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Receipt, Wallet, 
  CheckCircle, Clock, XCircle, Plus, 
  LogOut, QrCode, Upload, Bell, ChevronRight, 
  User as UserIcon, Activity, Calendar, MapPin, 
  TrendingUp, PlusCircle, DollarSign, AlertCircle, 
  ChevronDown, Check, RefreshCw, Key, Shield, UserCheck,
  Sun, Moon, Lock, Mail, Eye, EyeOff, Smartphone
} from 'lucide-react';
import { supabase } from './supabaseClient';

// --- TYPES ---
interface Profile {
  id: string;
  nama: string;
  email: string;
  nomor_hp: string;
  role: 'admin' | 'member';
  created_at: string;
  foto_url?: string | null;
  avatar_url?: string | null;
  photo_url?: string | null;
}

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  user_id: string | null;
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

const getInitials = (name?: string | null): string => {
  if (!name) return 'U';
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('sipatra_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    return systemPrefersLight ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('sipatra_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Auth states
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberRecord, setMemberRecord] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Database states
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [sessionExpenses, setSessionExpenses] = useState<SessionExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Pengaturan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // PWA & Splash Screen states
  const [showSplash, setShowSplash] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Modals & UI states
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);

  // Toast & Success Modal states
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onViewDetail?: () => void;
  }>({
    isOpen: false,
    title: '',
    description: ''
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: memberData } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      setMemberRecord(memberData || null);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchData = async () => {
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
      console.error('Error fetching core data from Supabase:', err);
    }
  };

  // Auth monitoring & PWA initialization
  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id).then(() => {
          fetchData().then(() => setIsLoading(false));
        });
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen to auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setIsLoading(true);
        fetchUserProfile(session.user.id).then(() => {
          fetchData().then(() => setIsLoading(false));
        });
      } else {
        setProfile(null);
        setMemberRecord(null);
        setIsLoading(false);
      }
    });

    // 3. PWA install prompt handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    // 4. Splash screen timer
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1800);

    // 5. Supabase Realtime channels
    const paymentsChannel = supabase
      .channel('payments_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPayments(prev => prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new as Payment]);
        } else if (payload.eventType === 'UPDATE') {
          setPayments(prev => prev.map(t => t.id === payload.new.id ? (payload.new as Payment) : t));
        } else if (payload.eventType === 'DELETE') {
          setPayments(prev => prev.filter(t => t.id !== payload.old.id));
        }
      }).subscribe();

    const sessionsChannel = supabase
      .channel('sessions_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => prev.some(s => s.id === payload.new.id) ? prev : [payload.new as Session, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => s.id === payload.new.id ? (payload.new as Session) : s));
        } else if (payload.eventType === 'DELETE') {
          setSessions(prev => prev.filter(s => s.id !== payload.old.id));
        }
      }).subscribe();

    const attendeesChannel = supabase
      .channel('attendees_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_attendees' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAttendees(prev => prev.some(a => a.id === payload.new.id) ? prev : [...prev, payload.new as SessionAttendee]);
        } else if (payload.eventType === 'UPDATE') {
          setAttendees(prev => prev.map(a => a.id === payload.new.id ? (payload.new as SessionAttendee) : a));
        } else if (payload.eventType === 'DELETE') {
          setAttendees(prev => prev.filter(a => a.id !== payload.old.id));
        }
      }).subscribe();

    const expensesChannel = supabase
      .channel('expenses_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_expenses' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessionExpenses(prev => prev.some(e => e.id === payload.new.id) ? prev : [...prev, payload.new as SessionExpense]);
        } else if (payload.eventType === 'UPDATE') {
          setSessionExpenses(prev => prev.map(e => e.id === payload.new.id ? (payload.new as SessionExpense) : e));
        } else if (payload.eventType === 'DELETE') {
          setSessionExpenses(prev => prev.filter(e => e.id !== payload.old.id));
        }
      }).subscribe();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(splashTimer);
      authSubscription.unsubscribe();
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(attendeesChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, []);

  // Protected Route Logic
  const adminOnlyTabs = ['anggota', 'pengaturan'];
  useEffect(() => {
    if (profile && profile.role !== 'admin' && adminOnlyTabs.includes(activeTab)) {
      showToast('Akses Ditolak: Anda tidak diizinkan membuka menu ini.', 'error');
      setActiveTab('dashboard');
    }
  }, [activeTab, profile]);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  // Kas calculations
  const totalIncome = payments.filter(p => p.status_pembayaran === 'verified').reduce((sum, p) => sum + p.nominal_tagihan, 0);
  const totalExpense = sessionExpenses.reduce((sum, e) => sum + e.nominal, 0);
  const saldoKas = totalIncome - totalExpense;

  const handleLogout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
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
      showToast('Gagal membuat sesi baru.', 'error');
    }
  };

  const saveAttendance = async (sessionId: number, selectedMemberIds: number[]) => {
    try {
      const { error: deleteError } = await supabase
        .from('session_attendees')
        .delete()
        .eq('session_id', sessionId);
      if (deleteError) throw deleteError;

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

      const { data: newAttendees, error: fetchError } = await supabase
        .from('session_attendees')
        .select('*')
        .order('id', { ascending: true });
      if (!fetchError && newAttendees) {
        setAttendees(newAttendees);
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
      showToast('Gagal menyimpan kehadiran.', 'error');
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
      showToast('Gagal menambahkan pengeluaran.', 'error');
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
      showToast('Gagal menghapus pengeluaran.', 'error');
    }
  };

  const generateBillsForSession = async (sessionId: number) => {
    try {
      const sessionAttendees = attendees.filter(a => a.session_id === sessionId);
      if (sessionAttendees.length === 0) {
        showToast('Tidak ada anggota yang hadir. Tandai kehadiran terlebih dahulu.', 'error');
        return;
      }
      
      const sessionExps = sessionExpenses.filter(e => e.session_id === sessionId);
      const totalSessionExpense = sessionExps.reduce((sum, e) => sum + e.nominal, 0);
      if (totalSessionExpense <= 0) {
        showToast('Total pengeluaran sesi adalah Rp 0. Tambahkan pengeluaran sesi terlebih dahulu.', 'error');
        return;
      }

      const costPerPerson = Math.round(totalSessionExpense / sessionAttendees.length);

      const paymentsToInsert = sessionAttendees.map(a => ({
        session_id: sessionId,
        member_id: a.member_id,
        nominal_tagihan: costPerPerson,
        status_pembayaran: 'pending'
      }));

      const { error: insertPaymentsError } = await supabase
        .from('payments')
        .insert(paymentsToInsert);
      if (insertPaymentsError) throw insertPaymentsError;

      const { error: updateSessionError } = await supabase
        .from('sessions')
        .update({
          status_tagihan: 'generated',
          biaya_per_orang: costPerPerson
        })
        .eq('id', sessionId);
      if (updateSessionError) throw updateSessionError;

      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        status_tagihan: 'generated',
        biaya_per_orang: costPerPerson
      } : s));

      const { data: newPaymentsData, error: payError } = await supabase
        .from('payments')
        .select('*')
        .order('id', { ascending: true });
      if (!payError && newPaymentsData) {
        setPayments(newPaymentsData);
      }

      setSuccessModal({
        isOpen: true,
        title: "Tagihan Berhasil Diterbitkan",
        description: `Setiap anggota dikenakan ${formatRp(costPerPerson)}`,
        onViewDetail: () => {
          setSelectedSessionId(sessionId);
        }
      });
    } catch (err) {
      console.error('Error generating bills:', err);
      showToast('Gagal menerbitkan tagihan.', 'error');
    }
  };

  const submitPaymentWithProof = async (paymentId: number, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${paymentId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filePath);

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
      showToast('Gagal memverifikasi pembayaran.', 'error');
    }
  };

  const updateProfile = async (nama: string, nomor_hp: string) => {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nama, nomor_hp })
        .eq('id', session.user.id);
      if (profileError) throw profileError;

      if (memberRecord) {
        const { error: memberError } = await supabase
          .from('members')
          .update({ name: nama })
          .eq('id', memberRecord.id);
        if (memberError) throw memberError;
      }

      await fetchUserProfile(session.user.id);
      showToast('Profil berhasil disimpan!', 'success');
    } catch (err) {
      console.error('Error updating profile:', err);
      showToast('Gagal menyimpan profil.', 'error');
    }
  };

  const updateSettings = async (namaKomunitas: string, rekeningPenerima: string, qrisFile?: File) => {
    try {
      let qrisUrl = settings?.qris_image_url || '';
      
      if (qrisFile) {
        const fileExt = qrisFile.name.split('.').pop();
        const fileName = `qris_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, qrisFile);
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(fileName);
        qrisUrl = publicUrl;
      }

      const { error } = await supabase
        .from('pengaturan')
        .update({
          nama_komunitas: namaKomunitas,
          rekening_penerima: rekeningPenerima,
          qris_image_url: qrisUrl
        })
        .eq('id', settings?.id);

      if (error) throw error;
      showToast('Pengaturan berhasil disimpan!', 'success');
      
      // Refresh settings
      const { data: settingsData } = await supabase.from('pengaturan').select('*').limit(1);
      if (settingsData && settingsData.length > 0) {
        setSettings(settingsData[0]);
      }
    } catch (err) {
      console.error('Error updating settings:', err);
      showToast('Gagal menyimpan pengaturan.', 'error');
    }
  };

  // --- SPLASH SCREEN RENDER ---
  if (showSplash) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-emerald-650 via-emerald-800 to-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="space-y-6 max-w-sm w-full">
          <img src="/logo.png" alt="Logo SI-PATRA" className="w-[150px] h-auto object-contain mx-auto animate-pulse-gentle" />
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-wider">SI-PATRA</h1>
            <p className="text-emerald-300 text-[10px] font-extrabold uppercase tracking-widest leading-relaxed">
              Sistem Manajemen Iuran & Sesi Badminton
            </p>
          </div>
          <div className="pt-8 space-y-3">
            <div className="w-40 h-1.5 bg-white/10 rounded-full mx-auto overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-loading-bar"></div>
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider animate-pulse">
              Memuat Sistem...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- LOADING RENDER ---
  if (isLoading) {
    let loadingMessage = "Menyiapkan dashboard...";
    let skeletonContent = null;

    if (activeTab === 'kas') {
      loadingMessage = "Menhitung saldo kas..."; // Wait, requested: "Menghitung saldo kas..." let's write exactly "Menghitung saldo kas..."
      loadingMessage = "Menghitung saldo kas...";
      skeletonContent = (
        <div className="space-y-6">
          {/* Treasury Card Skeleton */}
          <div className="bg-slate-800/80 rounded-[2rem] p-6 text-center border border-slate-700/50 shadow-lg relative overflow-hidden h-40 flex flex-col justify-center items-center gap-2">
            <div className="w-28 h-3.5 bg-slate-700 shimmer-card rounded mb-1" />
            <div className="w-48 h-8 bg-slate-750 shimmer-card rounded mb-4" />
            <div className="grid grid-cols-2 gap-4 w-full border-t border-slate-700/50 pt-4">
              <div className="flex flex-col items-center">
                <div className="w-24 h-2.5 bg-slate-700 shimmer-card rounded mb-1.5" />
                <div className="w-16 h-3.5 bg-slate-750 shimmer-card rounded" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-24 h-2.5 bg-slate-700 shimmer-card rounded mb-1.5" />
                <div className="w-16 h-3.5 bg-slate-750 shimmer-card rounded" />
              </div>
            </div>
          </div>

          {/* Histori Section Skeleton */}
          <div className="space-y-4">
            <div className="w-40 h-4 rounded bg-slate-800 shimmer-card animate-pulse" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3.5 shadow-sm justify-between">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 shimmer-card flex-shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="w-32 h-3.5 rounded bg-slate-800 shimmer-card" />
                    <div className="w-24 h-2.5 rounded bg-slate-855 shimmer-card" />
                  </div>
                </div>
                <div className="w-20 h-4 rounded bg-slate-800 shimmer-card" />
              </div>
            ))}
          </div>
        </div>
      );
    } else if (activeTab === 'tagihan') {
      const isUserAdmin = profile?.role === 'admin';
      loadingMessage = isUserAdmin ? "Memuat data sesi..." : "Menyiapkan tagihan...";
      if (isUserAdmin) {
        skeletonContent = (
          <div className="space-y-5">
            <div className="flex justify-between items-center mb-4">
              <div className="w-36 h-5 rounded bg-slate-800 shimmer-card" />
              <div className="w-24 h-8 rounded-xl bg-slate-800 shimmer-card" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-800/60 rounded-3xl border border-slate-800/90 shadow-md p-4 flex justify-between items-center">
                <div className="space-y-2.5 flex-1 pr-4">
                  <div className="w-16 h-3.5 rounded bg-slate-800 shimmer-card" />
                  <div className="w-48 h-4 rounded bg-slate-800 shimmer-card" />
                  <div className="w-32 h-3 rounded bg-slate-855 shimmer-card" />
                </div>
                <div className="text-right space-y-1.5 flex-shrink-0">
                  <div className="w-12 h-2.5 rounded bg-slate-855 shimmer-card" />
                  <div className="w-20 h-4.5 rounded bg-slate-800 shimmer-card" />
                </div>
              </div>
            ))}
          </div>
        );
      } else {
        skeletonContent = (
          <div className="space-y-4">
            <div className="w-44 h-5 bg-slate-800 shimmer-card rounded mb-4" />
            {[1, 2].map(i => (
              <div key={i} className="bg-slate-800/60 rounded-3xl border border-slate-800 shadow-md overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="w-24 h-4.5 bg-slate-800 shimmer-card rounded-full" />
                    <div className="w-20 h-4.5 bg-slate-800 shimmer-card rounded-full" />
                  </div>
                  <div className="w-48 h-4 bg-slate-800 shimmer-card rounded" />
                  <div className="flex justify-between items-center mt-4">
                    <div className="w-28 h-3.5 bg-slate-800 shimmer-card rounded" />
                    <div className="w-20 h-4.5 bg-slate-800 shimmer-card rounded" />
                  </div>
                </div>
                <div className="bg-slate-800/30 px-5 py-4 border-t border-slate-800">
                  <div className="w-full h-11 bg-slate-800 shimmer-card rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        );
      }
    } else if (activeTab === 'anggota') {
      loadingMessage = "Menyiapkan data anggota...";
      skeletonContent = (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <div className="w-28 h-5 rounded bg-slate-800 shimmer-card" />
            <div className="w-12 h-4 rounded bg-slate-800 shimmer-card" />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-3.5 shadow-sm justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 shimmer-card flex-shrink-0" />
                <div>
                  <div className="w-28 h-3.5 bg-slate-800 shimmer-card rounded mb-2" />
                  <div className="w-36 h-2.5 bg-slate-855 shimmer-card rounded" />
                </div>
              </div>
              <div className="w-12 h-4 bg-slate-800 shimmer-card rounded" />
            </div>
          ))}
        </div>
      );
    } else if (activeTab === 'profile') {
      loadingMessage = "Memuat data profil...";
      skeletonContent = (
        <div className="space-y-6">
          <div className="flex items-center gap-4 bg-slate-800/60 p-5 rounded-3xl border border-slate-800 shadow-md">
            <div className="w-14 h-14 bg-slate-800 shimmer-card rounded-full" />
            <div className="space-y-2">
              <div className="w-32 h-4 bg-slate-800 shimmer-card rounded" />
              <div className="w-40 h-3 bg-slate-855 shimmer-card rounded" />
              <div className="w-12 h-4 bg-slate-800 shimmer-card rounded mt-2" />
            </div>
          </div>
          <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800 shadow-sm space-y-4">
            <div className="w-40 h-4 bg-slate-800 shimmer-card rounded" />
            <div className="space-y-4">
              <div>
                <div className="w-24 h-2.5 bg-slate-800 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 bg-slate-855 shimmer-card rounded-xl" />
              </div>
              <div>
                <div className="w-36 h-2.5 bg-slate-800 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 bg-slate-855 shimmer-card rounded-xl" />
              </div>
              <div className="w-full h-11 bg-slate-800 shimmer-card rounded-2xl" />
            </div>
          </div>
        </div>
      );
    } else if (activeTab === 'pengaturan') {
      loadingMessage = "Memuat pengaturan...";
      skeletonContent = (
        <div className="space-y-6">
          <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800 shadow-sm space-y-4">
            <div className="w-40 h-4 bg-slate-800 shimmer-card rounded" />
            <div className="space-y-4">
              <div>
                <div className="w-24 h-2.5 bg-slate-800 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 bg-slate-855 shimmer-card rounded-xl" />
              </div>
              <div>
                <div className="w-36 h-2.5 bg-slate-800 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 bg-slate-855 shimmer-card rounded-xl" />
              </div>
              <div>
                <div className="w-28 h-2.5 bg-slate-800 shimmer-card rounded mb-1.5" />
                <div className="flex flex-col items-center gap-4 p-4 border border-slate-750 rounded-2xl bg-slate-850/40">
                  <div className="w-40 h-40 bg-slate-855 shimmer-card rounded-xl" />
                  <div className="w-36 h-8 bg-slate-800 shimmer-card rounded-xl" />
                </div>
              </div>
              <div className="w-full h-11 bg-slate-800 shimmer-card rounded-2xl" />
            </div>
          </div>
        </div>
      );
    } else {
      loadingMessage = "Menyiapkan dashboard...";
      skeletonContent = (
        <div className="space-y-6">
          {/* Shimmer Wallet/Kas Card */}
          <div className="rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden shimmer-green h-44 flex flex-col justify-between">
            <div>
              <div className="w-24 h-3 bg-white/20 rounded mb-2" />
              <div className="w-48 h-8 bg-white/30 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
              <div>
                <div className="w-16 h-2.5 bg-white/20 rounded mb-1.5" />
                <div className="w-24 h-4 bg-white/30 rounded" />
              </div>
              <div>
                <div className="w-16 h-2.5 bg-white/20 rounded mb-1.5" />
                <div className="w-24 h-4 bg-white/30 rounded" />
              </div>
            </div>
          </div>

          {/* Quick Actions Skeleton */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 shimmer-card animate-pulse" />
              <div className="space-y-2">
                <div className="w-16 h-2 bg-slate-855 rounded shimmer-card" />
                <div className="w-12 h-3.5 bg-slate-800 rounded shimmer-card" />
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 shimmer-card animate-pulse" />
              <div className="space-y-2">
                <div className="w-16 h-2 bg-slate-855 rounded shimmer-card" />
                <div className="w-12 h-3.5 bg-slate-800 rounded shimmer-card" />
              </div>
            </div>
          </div>

          {/* Section Title Skeleton */}
          <div className="w-32 h-5 rounded bg-slate-800 shimmer-card" />

          {/* Sessions List Skeletons */}
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-slate-800/40 rounded-3xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 shimmer-card flex-shrink-0" />
                  <div>
                    <div className="w-40 h-4 rounded bg-slate-800 shimmer-card mb-2" />
                    <div className="w-28 h-3 rounded bg-slate-855 shimmer-card" />
                  </div>
                </div>
                <div className="w-16 h-4 rounded bg-slate-800 shimmer-card" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-955 flex justify-center text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-900 min-h-screen shadow-2xl relative pb-20 flex flex-col border-x border-slate-800 animate-fadeIn">
          
          {/* SKELETON HEADER */}
          <header className="bg-slate-800/80 backdrop-blur-md p-4 rounded-b-[2rem] border-b border-slate-700/50 shadow-lg">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {/* Avatar Skeleton */}
                <div className="w-12 h-12 rounded-full shimmer-card flex-shrink-0" />
                <div>
                  {/* Greeting Skeleton */}
                  <div className="w-20 h-3 rounded bg-slate-700 shimmer-card mb-2" />
                  {/* Name Skeleton */}
                  <div className="w-32 h-4.5 rounded bg-slate-700 shimmer-card" />
                </div>
              </div>
              {/* Role Badge Skeleton */}
              <div className="w-20 h-6 rounded-full bg-slate-700 shimmer-card" />
            </div>
          </header>

          {/* SKELETON BODY */}
          <main className="p-4 flex-1 space-y-6 overflow-hidden">
            {skeletonContent}
          </main>

          {/* User-friendly loading message at the bottom */}
          <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center justify-center gap-2 pointer-events-none z-10">
            <div className="px-4 py-2 bg-slate-800/90 backdrop-blur-md rounded-full shadow-lg border border-slate-700/50 flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[11px] font-[700] text-emerald-400 tracking-wider uppercase">
                {loadingMessage}
              </span>
            </div>
          </div>

          {/* SKELETON NAVIGATION BAR */}
          <nav className="absolute bottom-0 left-0 right-0 bg-slate-850/90 backdrop-blur-lg border-t border-slate-800 p-3 flex justify-around rounded-t-[1.5rem] z-10">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-1.5 w-12">
                <div className="w-6 h-6 rounded-md bg-slate-800 shimmer-card" />
                <div className="w-8 h-2 bg-slate-855 rounded shimmer-card" />
              </div>
            ))}
          </nav>

        </div>
      </div>
    );
  }

  // --- AUTH SCREENS ---
  if (!session || !profile) {
    return <AuthScreen onLoginSuccess={fetchUserProfile} members={members} />;
  }

  const isAdmin = profile.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-955 flex justify-center text-slate-100 font-sans">
      <div className="w-full max-w-md bg-slate-900 min-h-screen shadow-2xl relative pb-20 flex flex-col border-x border-slate-800">
        
        {/* HEADER */}
        <header className="bg-slate-800/80 backdrop-blur-md text-slate-100 p-4 sticky top-0 z-10 rounded-b-[2rem] border-b border-slate-700/50 shadow-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0_4px_12px_rgba(16,185,129,0.25)] flex items-center justify-center flex-shrink-0 text-white font-[700] text-lg select-none">
                {getInitials(profile?.nama || profile?.full_name || session?.user?.user_metadata?.name || session?.user?.user_metadata?.nama)}
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selamat datang,</p>
                <p className="font-bold text-sm text-slate-100 truncate w-36 tracking-wide">{profile.nama}</p>
              </div>
            </div>
            <div className="flex gap-2.5 items-center">
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                {isAdmin ? 'Bendahara' : 'Anggota'}
              </span>
              <button 
                onClick={toggleTheme} 
                className="p-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-full transition-colors duration-200 flex items-center justify-center"
                title={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <button onClick={handleLogout} className="p-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-red-400 rounded-full transition-colors duration-200 flex items-center justify-center">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 hide-scrollbar space-y-6">
          {activeTab === 'dashboard' && (
            <Dashboard 
              user={profile} 
              memberRecord={memberRecord}
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
              isInstallable={isInstallable}
              handleInstallPWA={handleInstallPWA}
            />
          )}

          {activeTab === 'tagihan' && (
            isAdmin ? (
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
                user={memberRecord}
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

          {activeTab === 'anggota' && isAdmin && (
            <MembersList members={members} />
          )}

          {activeTab === 'profile' && !isAdmin && (
            <ProfileMember 
              profile={profile} 
              updateProfile={updateProfile} 
            />
          )}

          {activeTab === 'pengaturan' && isAdmin && (
            <SettingsAdmin 
              settings={settings} 
              updateSettings={updateSettings} 
            />
          )}
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav className="fixed bottom-0 w-full max-w-md bg-slate-900 border-t border-slate-800 flex justify-around p-3 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.3)] z-20">
          <NavItem icon={<Home size={20} />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Receipt size={20} />} label={isAdmin ? 'Sesi' : 'Tagihan Saya'} active={activeTab === 'tagihan'} onClick={() => setActiveTab('tagihan')} />
          <NavItem icon={<Wallet size={20} />} label={isAdmin ? 'Laporan' : 'Kas'} active={activeTab === 'kas'} onClick={() => setActiveTab('kas')} />
          {isAdmin ? (
            <>
              <NavItem icon={<Users size={20} />} label="Anggota" active={activeTab === 'anggota'} onClick={() => setActiveTab('anggota')} />
              <NavItem icon={<Shield size={20} />} label="Pengaturan" active={activeTab === 'pengaturan'} onClick={() => setActiveTab('pengaturan')} />
            </>
          ) : (
            <NavItem icon={<UserIcon size={20} />} label="Profil Saya" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          )}
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

        {/* CUSTOM SUCCESS MODAL */}
        {successModal.isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}>
            <div className="bg-white rounded-[20px] p-6 max-w-xs w-full text-center shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col items-center animate-scaleUp" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#10B981] flex items-center justify-center mb-4 border border-emerald-100/50">
                <CheckCircle size={36} className="text-[#10B981]" strokeWidth={2.5} />
              </div>
              <h3 className="text-slate-900 font-extrabold text-sm mb-2 tracking-tight">
                {successModal.title}
              </h3>
              <p className="text-slate-500 font-bold text-xs leading-relaxed px-1 mb-6">
                {successModal.description}
              </p>
              <div className="flex flex-col gap-2 w-full">
                {successModal.onViewDetail && (
                  <button 
                    onClick={() => {
                      successModal.onViewDetail?.();
                      setSuccessModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-[800] py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] shadow-md shadow-emerald-500/10"
                  >
                    Lihat Tagihan
                  </button>
                )}
                <button 
                  onClick={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-[800] py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM TOAST NOTIFICATIONS */}
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-[90%] max-w-[340px]">
          {toasts.map(t => (
            <div 
              key={t.id} 
              className="px-4 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-md text-slate-200 shadow-2xl border border-slate-800 flex items-center gap-2.5 pointer-events-auto animate-slideDown"
            >
              {t.type === 'success' ? (
                <CheckCircle size={15} className="text-[#10B981] flex-shrink-0" />
              ) : t.type === 'error' ? (
                <XCircle size={15} className="text-red-500 flex-shrink-0" />
              ) : (
                <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
              )}
              <span className="text-[11px] font-[700] text-slate-200 leading-snug">{t.message}</span>
            </div>
          ))}
        </div>

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
  user, memberRecord, saldoKas, totalIncome, totalExpense, members, sessions, attendees, sessionExpenses, payments, verifyPayment, setViewProofUrl, setSelectedPayment,
  isInstallable, handleInstallPWA
}: any) {
  const isAdmin = user.role === 'admin';
  
  // Pending payments (uploaded state)
  const pendingPayments = payments.filter((p: any) => p.status_pembayaran === 'uploaded');
  
  // Member specific active bills
  const myPayments = memberRecord ? payments.filter((p: any) => p.member_id === memberRecord.id) : [];
  const myActiveBills = myPayments.filter((p: any) => p.status_pembayaran === 'pending' || p.status_pembayaran === 'rejected');
  const myPaidCount = myPayments.filter((p: any) => p.status_pembayaran === 'verified').length;
  const myTotalPaidAmount = myPayments.filter((p: any) => p.status_pembayaran === 'verified').reduce((sum: number, p: any) => sum + p.nominal_tagihan, 0);

  return (
    <div className="space-y-6">
      
      {/* PWA INSTALLATION BANNER */}
      {isInstallable && (
        <div className="bg-slate-800 border border-slate-750 p-4 rounded-3xl flex justify-between items-center shadow-md animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <span className="text-lg">📱</span>
            </div>
            <div>
              <p className="font-extrabold text-xs text-slate-100">Instal Aplikasi SI-PATRA</p>
              <p className="text-[9px] text-slate-450 font-semibold mt-0.5">Akses instan dari Home Screen Anda</p>
            </div>
          </div>
          <button 
            onClick={handleInstallPWA}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-[0.97]"
          >
            Install
          </button>
        </div>
      )}
      
      {/* STATS OVERVIEW CARD */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-950/20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 p-4 opacity-10 transform rotate-12 scale-150">
          <Wallet size={160} />
        </div>
        
        <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-bold uppercase tracking-wider text-emerald-100">
          {isAdmin ? 'Total Saldo Kas' : 'Total Pembayaran Saya'}
        </span>
        <h2 className="text-3xl font-black mt-3 mb-6 tracking-tight">
          {isAdmin ? formatRp(saldoKas) : formatRp(myTotalPaidAmount)}
        </h2>
        
        <div className="flex gap-4 border-t border-white/10 pt-4">
          <div className="flex-1">
            <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
              {isAdmin ? 'Total Pemasukan' : 'Sesi Diikuti'}
            </p>
            <p className="font-extrabold text-sm text-slate-50">
              {isAdmin ? formatRp(totalIncome) : `${myPayments.length} Game`}
            </p>
          </div>
          <div className="w-px bg-white/10"></div>
          <div className="flex-1">
            <p className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
              {isAdmin ? 'Total Pengeluaran' : 'Lunas'}
            </p>
            <p className="font-extrabold text-sm text-slate-50">
              {isAdmin ? formatRp(totalExpense) : `${myPaidCount} Sesi`}
            </p>
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
                        <div className="flex items-center gap-1.5 text-slate-450 mt-1">
                          <Calendar size={11} />
                          <span className="text-[10px] font-semibold">{formatDate(session?.tanggal_main || '')}</span>
                        </div>
                        <p className="text-sm font-black text-red-400 mt-1">{formatRp(p.nominal_tagihan)}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${isRejected ? 'bg-red-500/20 text-red-300 border border-red-500/35' : 'bg-amber-500/20 text-amber-300 border border-amber-500/35'}`}>
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
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-300">Status Pembayaran Terakhir</h3>
            </div>
            
            <div className="space-y-3">
              {myPayments.filter((p: any) => p.status_pembayaran !== 'pending').slice(0, 2).map((p: any) => {
                const session = sessions.find((s: any) => s.id === p.session_id);
                const isVerified = p.status_pembayaran === 'verified';
                const isUploaded = p.status_pembayaran === 'uploaded';
                return (
                  <div key={p.id} className="bg-slate-800/30 p-3.5 rounded-2xl border border-slate-800/70 flex items-center gap-3.5">
                    <div className={`p-2 rounded-xl border ${isVerified ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isUploaded ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {isVerified ? <CheckCircle size={16} /> : <Clock size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-slate-200 truncate">{session?.nama_sesi}</p>
                      <p className="text-[9px] text-slate-500 font-semibold mt-0.5">{p.tanggal_bayar ? formatDate(p.tanggal_bayar) : '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-100">{formatRp(p.nominal_tagihan)}</p>
                      <p className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${isVerified ? 'text-emerald-400' : isUploaded ? 'text-blue-400 animate-pulse' : 'text-red-405'}`}>
                        {p.status_pembayaran}
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

              {/* EXPANDED DETAILS */}
              {isSelected && (
                <div className="border-t border-slate-700/50 bg-slate-800/30 p-4 space-y-5 animate-slide-down">
                  
                  <div className="text-xs bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60 space-y-1.5">
                    <p className="flex justify-between"><span className="text-slate-400 font-medium">Waktu Main:</span> <span className="font-bold text-slate-200">{s.jam_main}</span></p>
                    {s.catatan && <p className="flex justify-between"><span className="text-slate-400 font-medium">Catatan:</span> <span className="font-bold text-slate-200">{s.catatan}</span></p>}
                  </div>

                  {/* 1. ATTENDANCE CHECKS */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Kehadiran Peserta</span>
                      <span className="bg-slate-755 text-slate-300 text-[10px] px-2 py-0.5 rounded-md">{sAttendees.length} Hadir</span>
                    </h4>
                    
                    {s.status_tagihan === 'draft' ? (
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

                  {/* 2. EXPENSES */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Rincian Biaya Sesi</span>
                      <span className="text-red-400 font-extrabold">{formatRp(totalExps)}</span>
                    </h4>

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

                  {/* 3. ACTIONS MODULE */}
                  <div className="pt-2 border-t border-slate-700/50">
                    {s.status_tagihan === 'draft' ? (
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
                      <div className="space-y-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-bold text-xs uppercase tracking-wider text-slate-400">Status Bayar Peserta</p>
                          <span className="text-[10px] font-black text-emerald-455 bg-emerald-500/10 px-2 py-0.5 rounded">
                            {lunasCount}/{sAttendees.length} Lunas
                          </span>
                        </div>

                        <div className="w-full bg-slate-800 rounded-full h-1.5 border border-slate-750 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${sAttendees.length > 0 ? (lunasCount / sAttendees.length) * 100 : 0}%` }}
                          ></div>
                        </div>

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
                                      isRejected ? 'text-red-455' : 'text-slate-500'
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
                                      className="px-2 py-1 bg-slate-750 hover:bg-slate-700 text-slate-355 text-[9px] font-extrabold rounded-md transition-colors"
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

      {/* CREATE SESSION MODAL */}
      {showAddSessionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-6 relative border border-slate-800 shadow-2xl animate-slide-up">
            <button onClick={() => setShowAddSessionModal(false)} className="absolute top-5 right-5 p-2 bg-slate-800 text-slate-400 hover:text-slate-100 rounded-full transition-colors">
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
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl mt-4 transition-all shadow-lg shadow-emerald-950/20 active:scale-[0.98] text-xs">
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
      setToastError('Nominal tagihan harus lebih dari Rp 0.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setToastError('Format file harus JPG, PNG, atau WEBP.');
      setTimeout(() => setToastError(''), 4000);
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setToastError('Ukuran file maksimal 5 MB.');
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
      setToastMessage('Bukti pembayaran berhasil dikirim!');
      handleCancelFile();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err: any) {
      console.error(err);
      setToastError(err.message || 'Gagal mengirim bukti pembayaran.');
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

  const myPayments = user ? payments.filter((p: any) => p.member_id === user.id) : [];

  return (
    <div className="space-y-4">
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
          Anda tidak memiliki tagihan sesi badminton.
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
                      {isVerified ? 'Lunas' : isUploaded ? 'Verifikasi' : isRejected ? 'Ditolak' : 'Belum Bayar'}
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

      {/* MODAL QRIS & STATUS */}
      {currentPayment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl flex flex-col animate-scale-up">
            
            <div className="bg-emerald-700 p-5 text-center relative text-white">
              <button onClick={handleCloseModal} className="absolute top-4.5 right-4.5 p-1.5 bg-white/10 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all">
                <XCircle size={18} />
              </button>
              <h3 className="font-black text-sm uppercase tracking-wider">Pembayaran QRIS</h3>
              <p className="text-emerald-100 text-[10px] font-bold mt-0.5 truncate px-6">{sessionDetail?.nama_sesi}</p>
            </div>

            {currentPayment.status_pembayaran === 'uploaded' || currentPayment.status_pembayaran === 'verified' ? (
              <div className="p-6 flex flex-col items-center gap-6 text-center">
                <div className={`w-18 h-18 rounded-full flex items-center justify-center shadow-lg ${
                  currentPayment.status_pembayaran === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-bounce'
                }`}>
                  <CheckCircle size={36} strokeWidth={2.5} />
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-base font-black text-slate-100 tracking-tight">
                    {currentPayment.status_pembayaran === 'verified' ? 'Pembayaran Terverifikasi' : 'Bukti Pembayaran Dikirim'}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-4">
                    {currentPayment.status_pembayaran === 'verified'
                      ? 'Terima kasih! Pembayaran Anda telah terverifikasi oleh Bendahara PB.'
                      : 'Bukti transfer berhasil diunggah. Sedang menunggu konfirmasi/verifikasi dari admin.'}
                  </p>
                </div>

                <div className="w-full bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Nominal</span>
                    <span className="text-slate-200">{formatRp(currentPayment.nominal_tagihan)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Tanggal Upload</span>
                    <span className="text-slate-200">{currentPayment.tanggal_bayar ? formatDate(currentPayment.tanggal_bayar) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Status</span>
                    <span>
                      {currentPayment.status_pembayaran === 'verified' ? (
                        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-black">Lunas</span>
                      ) : (
                        <span className="bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-black">Menunggu Verifikasi</span>
                      )}
                    </span>
                  </div>
                </div>

                <button onClick={handleCloseModal} className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold py-3.5 rounded-2xl border border-slate-700/60 transition-all text-xs active:scale-[0.98]">
                  Tutup Rincian
                </button>
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center gap-5">
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Nominal Transfer</p>
                  <p className="text-2xl font-black text-emerald-450 tracking-tight">{formatRp(currentPayment.nominal_tagihan)}</p>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-3.5 w-full text-center space-y-1">
                  <span className="text-[8px] font-black tracking-wider uppercase bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/25 inline-block">QRIS STATIS</span>
                  <p className="text-[10px] font-bold text-amber-400 leading-snug">
                    Masukkan nominal <span className="font-black text-emerald-450">{formatRp(currentPayment.nominal_tagihan)}</span> saat melakukan scan pembayaran.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-[2rem] border-2 border-slate-800 shadow-inner w-48 h-48 flex items-center justify-center relative overflow-hidden">
                  {settings?.qris_image_url ? (
                    <img src={settings.qris_image_url} alt="QRIS Code" className="w-full h-full object-contain rounded-2xl" />
                  ) : (
                    <div className="text-center p-4">
                      <QrCode size={36} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-[9px] font-bold text-slate-400">QRIS Admin Belum Diunggah</p>
                    </div>
                  )}
                </div>

                <div className="w-full space-y-3">
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="hidden" />
                  
                  {!selectedFile ? (
                    <button onClick={triggerFilePicker} className="w-full border-2 border-dashed border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 bg-slate-850/40 hover:bg-slate-850 transition-colors">
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
                      <button onClick={handleCancelFile} disabled={isUploading} className="p-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0 disabled:opacity-50">
                        <XCircle size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full">
                  {isUploading ? (
                    <button disabled className="w-full bg-slate-800 text-slate-500 font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-slate-755 cursor-not-allowed text-xs">
                      <RefreshCw size={14} className="animate-spin" /> Mengirim Bukti...
                    </button>
                  ) : selectedFile ? (
                    <button onClick={handleUpload} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98]">
                      <CheckCircle size={14} /> Kirim Bukti Transfer
                    </button>
                  ) : (
                    <button onClick={triggerFilePicker} className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] border border-slate-700/60">
                      <Upload size={14} /> {currentPayment.status_pembayaran === 'rejected' ? 'Pilih Bukti Baru' : 'Saya Sudah Bayar'}
                    </button>
                  )}
                </div>

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

// --- PROFILE MEMBER COMPONENT ---
function ProfileMember({ profile, updateProfile }: { profile: Profile; updateProfile: (nama: string, nomor_hp: string) => Promise<void> }) {
  const [nama, setNama] = useState(profile.nama);
  const [nomorHp, setNomorHp] = useState(profile.nomor_hp || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await updateProfile(nama, nomorHp);
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 bg-slate-800/60 p-5 rounded-3xl border border-slate-800 shadow-md">
        <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center font-black text-xl shadow-inner">
          {profile.nama.charAt(0)}
        </div>
        <div>
          <h3 className="font-black text-base text-slate-100">{profile.nama}</h3>
          <p className="text-xs text-slate-450 font-bold mt-0.5">{profile.email}</p>
          <span className="inline-block mt-2 text-[8px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded uppercase tracking-wider">
            {profile.role}
          </span>
        </div>
      </div>

      <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800 shadow-sm space-y-4">
        <h4 className="font-black text-xs uppercase tracking-wider text-slate-400">Edit Profil</h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
            <input 
              type="text" 
              required 
              value={nama} 
              onChange={e => setNama(e.target.value)} 
              className="w-full px-4 py-2.5 rounded-xl bg-slate-850 border border-slate-750 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-100 font-bold text-xs" 
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Nomor Handphone</label>
            <input 
              type="text" 
              value={nomorHp} 
              onChange={e => setNomorHp(e.target.value)} 
              placeholder="08123456789" 
              className="w-full px-4 py-2.5 rounded-xl bg-slate-850 border border-slate-750 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-100 font-bold text-xs" 
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-505 text-white font-extrabold py-3 rounded-2xl transition-all text-xs active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Menyimpan perubahan...</span>
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- SETTINGS ADMIN COMPONENT ---
function SettingsAdmin({ settings, updateSettings }: any) {
  const [namaKomunitas, setNamaKomunitas] = useState(settings?.nama_komunitas || '');
  const [rekeningPenerima, setRekeningPenerima] = useState(settings?.rekening_penerima || '');
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisPreview, setQrisPreview] = useState<string | null>(settings?.qris_image_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrisFile(file);
      setQrisPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await updateSettings(namaKomunitas, rekeningPenerima, qrisFile || undefined);
    setIsSubmitting(false);
  };

  return (
    <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800 shadow-sm space-y-4 animate-fade-in">
      <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-2">Pengaturan Komunitas</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Nama Komunitas</label>
          <input 
            type="text" 
            required 
            value={namaKomunitas} 
            onChange={e => setNamaKomunitas(e.target.value)} 
            className="w-full px-4 py-2.5 rounded-xl bg-slate-850 border border-slate-750 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-100 font-bold text-xs" 
          />
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Informasi Rekening Penerima</label>
          <input 
            type="text" 
            required 
            value={rekeningPenerima} 
            onChange={e => setRekeningPenerima(e.target.value)} 
            placeholder="Mandiri 1234567890 a.n Bendahara"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-850 border border-slate-750 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-100 font-bold text-xs" 
          />
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">QRIS Statis (Gambar)</label>
          
          <div className="flex flex-col items-center gap-4 p-4 border border-slate-750 rounded-2xl bg-slate-850/40">
            {qrisPreview ? (
              <img src={qrisPreview} alt="QRIS Preview" className="w-40 h-40 object-contain rounded-xl bg-white p-2 border border-slate-700" />
            ) : (
              <div className="w-40 h-40 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-500 text-xs">
                Belum ada QRIS
              </div>
            )}
            
            <label className="px-4 py-2 bg-slate-750 hover:bg-slate-700 rounded-xl text-[10px] font-black text-slate-200 cursor-pointer border border-slate-700 flex items-center gap-1.5 transition-colors">
              <Upload size={12} /> Pilih Gambar QRIS Baru
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-505 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Menyimpan pengaturan...</span>
            </>
          ) : (
            <>
              <CheckCircle size={14} />
              <span>Simpan Pengaturan</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// --- SUPABASE AUTH SCREEN COMPONENT ---
function AuthScreen({ onLoginSuccess }: { onLoginSuccess: (userId: string) => Promise<void>; members: any }) {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Status states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI-specific states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved email on mount if rememberMe was previously active
  useEffect(() => {
    const savedEmail = localStorage.getItem('sipatra_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) throw error;
      if (data.session) {
        if (rememberMe) {
          localStorage.setItem('sipatra_remember_email', email.trim().toLowerCase());
        } else {
          localStorage.removeItem('sipatra_remember_email');
        }
        await onLoginSuccess(data.session.user.id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal login. Periksa kembali email dan password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            nama: fullName,
            nomor_hp: phone
          }
        }
      });

      if (error) throw error;
      
      setSuccessMsg('Pendaftaran sukses! Silakan periksa email untuk verifikasi (jika diaktifkan) atau langsung masuk.');
      
      if (data.session) {
        await onLoginSuccess(data.session.user.id);
      } else {
        setSuccessMsg('Registrasi berhasil! Silakan periksa email masuk Anda untuk memverifikasi akun.');
        setAuthMode('login');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal melakukan registrasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin
      });

      if (error) throw error;
      setSuccessMsg('Tautan instruksi reset password telah dikirim ke email Anda.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mengirim email reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHeader = (compact = false) => {
    return (
      <div className="relative w-full flex flex-col items-center justify-center text-center z-10">
        {/* Logo */}
        <img 
          src="/logo.png" 
          alt="Logo SI-PATRA" 
          className={`${compact ? 'w-[72px] h-[72px]' : 'w-[110px] h-[110px]'} object-contain mx-auto select-none`}
          style={{ imageRendering: 'crisp-edges', WebkitImageRendering: 'crisp-edges' } as any}
        />

        {/* Title */}
        <h1 className={`${compact ? 'text-[32px] mt-[10px]' : 'text-[44px] mt-[16px]'} font-[800] text-[#0F172A] leading-none tracking-tight font-sans bg-gradient-to-r from-[#0F172A] to-[#10B981] bg-clip-text text-transparent`}>
          SI-PATRA
        </h1>

        {/* Subtitle */}
        <p className="text-[#059669] text-[10px] font-[700] uppercase tracking-[4px] mt-[10px]">
          SI BADMINTON & KAS
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full md:bg-gradient-to-tr md:from-slate-950 md:via-slate-900 md:to-emerald-950/30 flex items-center justify-center p-0 md:p-8 font-sans overflow-hidden">
      {/* Simulated Mobile Mockup Container */}
      <div className="w-full h-screen md:h-[844px] md:w-[390px] bg-gradient-to-b from-[#F0FAF6] via-white to-[#EDF9F4] md:rounded-[40px] md:shadow-[0_24px_70px_rgba(0,0,0,0.4)] md:border-[8px] md:border-slate-800 overflow-hidden flex flex-col relative transition-all justify-center items-center">
        
        {/* Court background lines with 3% opacity */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="stroke-emerald-800 stroke-[0.5] fill-none">
            <rect x="5" y="5" width="90" height="90" />
            <line x1="5" y1="35" x2="95" y2="35" />
            <line x1="5" y1="65" x2="95" y2="65" />
            <line x1="50" y1="5" x2="50" y2="95" />
            <line x1="5" y1="15" x2="95" y2="15" />
            <line x1="5" y1="85" x2="95" y2="85" />
          </svg>
        </div>

        {/* Subtle green glow at bottom left */}
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-[#10B981] opacity-[0.08] blur-3xl pointer-events-none z-0" />

        {/* Bottom Left wave decoration */}
        <div className="absolute -left-10 -bottom-10 w-44 h-44 bg-gradient-to-tr from-[#059669] to-[#1ED760] opacity-30 rounded-tr-[100px] pointer-events-none z-0" />

        {/* Decorative dot grids on the left and right */}
        <div className="absolute left-3 bottom-[18%] opacity-25 pointer-events-none z-0">
          <svg width="24" height="80" viewBox="0 0 24 80" fill="currentColor" className="text-emerald-800">
            <pattern id="dot-grid-1" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="1.2" />
            </pattern>
            <rect width="24" height="80" fill="url(#dot-grid-1)" />
          </svg>
        </div>
        <div className="absolute right-3 top-[32%] opacity-25 pointer-events-none z-0">
          <svg width="24" height="80" viewBox="0 0 24 80" fill="currentColor" className="text-emerald-800">
            <rect width="24" height="80" fill="url(#dot-grid-1)" />
          </svg>
        </div>

        {/* Floating racket outline: Top Right, Opacity 8% */}
        <div className="absolute -right-6 top-[2%] text-[#10B981]/[0.08] pointer-events-none transform rotate-[25deg] w-[180px] h-[180px] z-0">
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-current stroke-[1.2]">
            <ellipse cx="40" cy="40" rx="20" ry="25" />
            <path d="M30 20 L30 60 M35 17 L35 63 M40 15 L40 65 M45 17 L45 63 M50 20 L50 60" className="stroke-[0.4] opacity-50" />
            <path d="M20 30 L60 30 M17 35 L63 35 M15 40 L65 40 M17 45 L63 45 M20 50 L60 50" className="stroke-[0.4] opacity-50" />
            <line x1="40" y1="65" x2="40" y2="95" />
            <rect x="38" y="95" width="4" height="15" rx="0.5" fill="currentColor" className="opacity-40" />
          </svg>
        </div>

        {/* Floating shuttlecock decor: Top Left, Opacity 100% */}
        <div className="absolute left-2 top-[8%] w-[90px] h-[90px] pointer-events-none transform -rotate-[20deg] z-0">
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none drop-shadow-[0_8px_16px_rgba(15,23,42,0.06)]">
            {/* Feathers skirt (pointing up-left) */}
            <path d="M 62 62 L 15 25 C 22 15, 45 8, 55 20 L 72 52 Z" fill="white" stroke="#E2E8F0" strokeWidth="0.5" />
            <line x1="63" y1="61" x2="20" y2="28" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="65" y1="59" x2="28" y2="21" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="67" y1="57" x2="38" y2="16" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="69" y1="55" x2="48" y2="15" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="71" y1="53" x2="58" y2="20" stroke="#CBD5E1" strokeWidth="0.8" />
            <path d="M 32 37 C 38 28, 48 23, 58 29" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
            <path d="M 45 47 C 50 39, 58 35, 66 40" fill="none" stroke="#E2E8F0" strokeWidth="0.8" />
            {/* Cork band (Green) */}
            <path d="M 61 61 C 59 63, 61 67, 65 69 C 69 67, 71 63, 69 61 Z" fill="#059669" />
            {/* Cork base (White dome) */}
            <path d="M 65 67 C 70 72, 80 80, 83 75 C 86 70, 78 60, 73 55 Z" fill="white" stroke="#E2E8F0" strokeWidth="0.5" />
            <path d="M 71 71 C 74 74, 80 78, 81 74" fill="none" stroke="#CBD5E1" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Content View Area */}
        <div className="flex-1 flex flex-col justify-center items-center overflow-hidden w-full h-full relative z-10">
          
          {authMode === 'login' && (
            <div className="w-full flex flex-col items-center justify-center animate-fadeIn">
              {/* Branding Section */}
              <img 
                src="/logo.png" 
                alt="Logo SI-PATRA" 
                className="w-[110px] h-[110px] object-contain mx-auto select-none" 
                style={{ imageRendering: 'crisp-edges', WebkitImageRendering: 'crisp-edges' } as any}
              />

              <h1 className="text-[44px] font-[800] text-[#0F172A] leading-none tracking-tight font-sans mt-[16px] text-center bg-gradient-to-r from-[#0F172A] to-[#10B981] bg-clip-text text-transparent">
                SI-PATRA
              </h1>

              <p className="text-[#059669] text-xs font-[700] uppercase tracking-[4px] mt-[10px] text-center">
                SI BADMINTON & KAS
              </p>
              
              {/* Card Section */}
              <div className="bg-white rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.08)] p-[32px] mt-[36px] flex flex-col w-[86%] max-w-[420px] mx-auto">
                {errorMsg && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 line-clamp-1 mb-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-emerald-100 line-clamp-1 mb-2">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col">
                  {/* Email Field */}
                  <div className="flex flex-col">
                    <label className="text-[11px] font-[700] text-[#0F172A] tracking-[1px] uppercase mb-[12px] self-start">
                      EMAIL
                    </label>
                    <div className="relative h-[58px]">
                      <div className="absolute inset-y-0 left-0 pl-[18px] flex items-center pointer-events-none text-[#10B981]">
                        <Mail size={20} strokeWidth={2} />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="08961234567"
                        className="w-full h-full pl-[52px] pr-4 rounded-[18px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-[15px] transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col mt-[24px]">
                    <label className="text-[11px] font-[700] text-[#0F172A] tracking-[1px] uppercase mb-[12px] self-start">
                      PASSWORD
                    </label>
                    <div className="relative h-[58px]">
                      <div className="absolute inset-y-0 left-0 pl-[18px] flex items-center pointer-events-none text-[#10B981]">
                        <Lock size={20} strokeWidth={2} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="•••••••••"
                        className="w-full h-full pl-[52px] pr-[52px] rounded-[18px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-[15px] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-[18px] flex items-center text-[#10B981] hover:text-[#059669] transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="flex items-center justify-between mt-[18px] px-[2px]">
                    <label className="flex items-center gap-[8px] cursor-pointer select-none text-[#64748B] text-sm font-[500]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rounded border-[#E5E7EB] text-[#10B981] focus:ring-[#10B981] h-[18px] w-[18px] transition-colors accent-[#10B981]"
                      />
                      <span className="text-[#64748B] text-[14px]">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setSuccessMsg('');
                        setAuthMode('forgot');
                      }}
                      className="font-[700] text-[#059669] hover:text-[#10B981] text-[14px] transition-colors"
                    >
                      Lupa password?
                    </button>
                  </div>

                  {/* Primary Login Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-[58px] bg-gradient-to-r from-[#1ED760] to-[#059669] text-white font-[700] rounded-[18px] mt-[20px] transition-all shadow-[0_8px_25px_rgba(5,150,105,0.15)] active:scale-[0.98] text-[16px] flex items-center justify-center gap-[10px] disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw size={20} className="animate-spin" />
                        <span>Memverifikasi akun...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span>Masuk</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-[14px] mt-[20px] mb-[20px]">
                  <div className="h-[1px] flex-1 bg-[#E5E7EB]"></div>
                  <span className="text-[12px] font-[700] text-[#94A3B8] tracking-widest uppercase">atau</span>
                  <div className="h-[1px] flex-1 bg-[#E5E7EB]"></div>
                </div>

                {/* Google Login */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full h-[56px] border border-[#E5E7EB] rounded-[18px] bg-white hover:bg-[#F9FAFB] text-[#0F172A] font-[700] text-[15px] flex items-center justify-center gap-[10px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-60"
                >
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Masuk dengan Google</span>
                </button>
              </div>

              {/* Footer Section */}
              <div className="mt-[20px] flex flex-col justify-start items-center w-full">
                <p className="text-[14px] text-[#64748B] font-[500]">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      setAuthMode('register');
                    }}
                    className="text-[#059669] hover:text-[#10B981] font-[700] transition-colors inline-flex items-center gap-0.5"
                  >
                    Daftar Sekarang →
                  </button>
                </p>
              </div>
            </div>
          )}

          {authMode === 'register' && (
            <div className="w-full flex flex-col items-center justify-center animate-fadeIn">
              {/* Header Section */}
              {renderHeader(true)}
              
              {/* Card Section */}
              <div className="bg-white rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.08)] p-[24px] mt-[24px] flex flex-col w-[86%] max-w-[420px] mx-auto">
                {errorMsg && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 line-clamp-1 mb-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-emerald-100 line-clamp-1 mb-2">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="flex flex-col gap-[14px]">
                  {/* Full Name */}
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#10B981]">
                      <UserIcon size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="w-full h-full pl-11 pr-4 rounded-[14px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-sm transition-all"
                    />
                  </div>

                  {/* Email */}
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#10B981]">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Alamat Email"
                      className="w-full h-full pl-11 pr-4 rounded-[14px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-sm transition-all"
                    />
                  </div>

                  {/* Phone */}
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#10B981]">
                      <Smartphone size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Nomor Handphone"
                      className="w-full h-full pl-11 pr-4 rounded-[14px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-sm transition-all"
                    />
                  </div>

                  {/* Passwords grid */}
                  <div className="grid grid-cols-2 gap-[10px]">
                    {/* Password */}
                    <div className="relative h-[52px]">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#10B981]">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full h-full pl-9 pr-8 rounded-[14px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#10B981] hover:text-[#059669]"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Confirm Password */}
                    <div className="relative h-[52px]">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#10B981]">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Konfirmasi"
                        className="w-full h-full pl-9 pr-8 rounded-[14px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#10B981] hover:text-[#059669]"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-[52px] bg-gradient-to-r from-[#1ED760] to-[#059669] text-white font-[700] rounded-[14px] mt-[6px] transition-all shadow-[0_6px_16px_rgba(5,150,105,0.15)] active:scale-[0.98] text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-1.5">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Mendaftarkan akun...</span>
                      </div>
                    ) : (
                      <>
                        <PlusCircle size={16} />
                        <span>Daftar Akun</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Footer Section */}
              <div className="mt-[20px] flex flex-col justify-start items-center w-full">
                <p className="text-[14px] text-[#64748B] font-[500]">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      setAuthMode('login');
                    }}
                    className="text-[#059669] hover:text-[#10B981] font-[700] transition-colors"
                  >
                    Masuk Disini
                  </button>
                </p>
              </div>
            </div>
          )}

          {authMode === 'forgot' && (
            <div className="w-full flex flex-col items-center justify-center animate-fadeIn">
              {/* Header Section */}
              {renderHeader(false)}
              
              {/* Card Section */}
              <div className="bg-white rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.08)] p-[32px] mt-[36px] flex flex-col w-[86%] max-w-[420px] mx-auto">
                {errorMsg && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 line-clamp-1 mb-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-emerald-100 line-clamp-1 mb-2">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                  {/* Email */}
                  <div className="relative h-[58px]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#10B981]">
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Masukkan Email Terdaftar"
                      className="w-full h-full pl-11 pr-4 rounded-[18px] bg-white border border-[#E5E7EB] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/10 outline-none text-[#0F172A] placeholder:text-[#94A3B8] font-[500] text-[15px] transition-all"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-[58px] bg-[#0F172A] hover:bg-slate-800 text-white font-[700] rounded-[18px] transition-all shadow-md active:scale-[0.98] text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-1.5">
                        <RefreshCw size={18} className="animate-spin" />
                        <span>Mengirim tautan...</span>
                      </div>
                    ) : (
                      <>
                        <Key size={18} />
                        <span>Kirim Tautan Reset</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Footer Section */}
              <div className="mt-[20px] flex flex-col justify-start items-center w-full">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setAuthMode('login');
                  }}
                  className="py-2.5 text-center text-[#64748B] hover:text-[#0F172A] text-xs font-[700] uppercase tracking-wider transition-colors inline-flex items-center gap-1 group"
                >
                  <span className="transition-transform group-hover:-translate-x-0.5">←</span> Kembali ke Login
                </button>
              </div>
            </div>
          )}

        </div>
        
        {/* Simulated Home Indicator */}
        <div className="hidden md:flex w-full py-2 justify-center bg-transparent z-20 select-none">
          <div className="w-24 h-1 bg-[#CBD5E1] rounded-full"></div>
        </div>
      </div>
    </div>
  );
}