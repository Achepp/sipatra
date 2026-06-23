import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Receipt, Wallet, 
  CheckCircle, Clock, XCircle, Plus, 
  LogOut, QrCode, Upload, Bell, ChevronRight, 
  User as UserIcon, Activity, Calendar, MapPin, 
  TrendingUp, PlusCircle, DollarSign, AlertCircle, 
  ChevronDown, Check, RefreshCw, Key, Shield, UserCheck,
  Sun, Moon, Lock, Mail, Eye, EyeOff, Smartphone, MoreVertical, Trash2, Edit
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';

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
  status_pembayaran: 'pending' | 'uploaded' | 'verified' | 'rejected' | 'Menunggu Verifikasi Cash' | 'unpaid' | 'generated';
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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  
  // Database states
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [sessionExpenses, setSessionExpenses] = useState<SessionExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Pengaturan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Superadmin & Trash Bin states
  const [softDeletedItems, setSoftDeletedItems] = useState<{ sessions: any[]; payments: any[]; members: any[] }>(() => {
    try {
      const saved = localStorage.getItem('sipatra_trash_bin');
      return saved ? JSON.parse(saved) : { sessions: [], payments: [], members: [] };
    } catch (e) {
      return { sessions: [], payments: [], members: [] };
    }
  });

  useEffect(() => {
    localStorage.setItem('sipatra_trash_bin', JSON.stringify(softDeletedItems));
  }, [softDeletedItems]);

  const restoreSoftDeletedItem = async (item: any) => {
    try {
      setIsLoading(true);
      if (item.type === 'session') {
        const { data: insertedSession, error: sErr } = await supabase
          .from('sessions')
          .insert({
            nama_sesi: item.data.nama_sesi,
            tanggal_main: item.data.tanggal_main,
            jam_main: item.data.jam_main,
            lokasi: item.data.lokasi,
            catatan: item.data.catatan,
            status_tagihan: item.data.status_tagihan,
            biaya_per_orang: item.data.biaya_per_orang
          })
          .select()
          .single();

        if (sErr) throw sErr;

        if (insertedSession) {
          const newSessionId = insertedSession.id;

          if (item.attendees && item.attendees.length > 0) {
            const attendeesToInsert = item.attendees.map((a: any) => ({
              session_id: newSessionId,
              member_id: a.member_id
            }));
            await supabase.from('session_attendees').insert(attendeesToInsert);
          }

          if (item.expenses && item.expenses.length > 0) {
            const expensesToInsert = item.expenses.map((e: any) => ({
              session_id: newSessionId,
              keterangan: e.keterangan,
              nominal: e.nominal,
              kategori: e.kategori
            }));
            await supabase.from('session_expenses').insert(expensesToInsert);
          }

          if (item.payments && item.payments.length > 0) {
            const paymentsToInsert = item.payments.map((p: any) => ({
              session_id: newSessionId,
              member_id: p.member_id,
              nominal_tagihan: p.nominal_tagihan,
              status_pembayaran: p.status_pembayaran,
              tanggal_bayar: p.tanggal_bayar,
              bukti_transfer: p.bukti_transfer
            }));
            await supabase.from('payments').insert(paymentsToInsert);
          }
        }
        
        setSoftDeletedItems(prev => ({
          ...prev,
          sessions: prev.sessions.filter(s => s.id !== item.id)
        }));
        showToast('✅ Sesi berhasil dipulihkan', 'success');

      } else if (item.type === 'payment') {
        const { error: pErr } = await supabase
          .from('payments')
          .insert({
            session_id: item.data.session_id,
            member_id: item.data.member_id,
            nominal_tagihan: item.data.nominal_tagihan,
            status_pembayaran: item.data.status_pembayaran,
            tanggal_bayar: item.data.tanggal_bayar,
            bukti_transfer: item.data.bukti_transfer
          });

        if (pErr) throw pErr;

        setSoftDeletedItems(prev => ({
          ...prev,
          payments: prev.payments.filter(p => p.id !== item.id)
        }));
        showToast('✅ Pembayaran berhasil dipulihkan', 'success');

      } else if (item.type === 'member') {
        const { error } = await supabase
          .from('members')
          .update({ status: 'aktif' })
          .eq('id', item.data.id);
        
        if (error) throw error;

        setSoftDeletedItems(prev => ({
          ...prev,
          members: prev.members.filter(m => m.id !== item.id)
        }));
        showToast('✅ Anggota berhasil dipulihkan', 'success');
      }
      
      await fetchData();
    } catch (e: any) {
      console.error(e);
      showToast(`❌ Gagal memulihkan: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const executeHardDeleteFromTrash = async (item: any) => {
    try {
      if (item.type === 'member') {
        if (item.data.user_id) {
          await supabase.rpc('admin_delete_user', { target_user_id: item.data.user_id });
        } else {
          await supabase.from('members').delete().eq('id', item.data.id);
        }
      }
      
      setSoftDeletedItems(prev => {
        const updated = { ...prev };
        if (item.type === 'session') {
          updated.sessions = updated.sessions.filter(s => s.id !== item.id);
        } else if (item.type === 'payment') {
          updated.payments = updated.payments.filter(p => p.id !== item.id);
        } else if (item.type === 'member') {
          updated.members = updated.members.filter(m => m.id !== item.id);
        }
        return updated;
      });
      showToast('✅ Data berhasil dihapus permanen', 'success');
      await fetchData();
    } catch (e: any) {
      showToast(`❌ Gagal: ${e.message}`, 'error');
    }
  };

  const resetUserPassword = async (userId: string, userName: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.rpc('admin_reset_user_password', { target_user_id: userId });
      if (error) throw error;
      showToast(`✅ Password "${userName}" berhasil di-reset ke "sisteminformasi"`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast(`❌ Gagal reset password: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const changeUserRole = async (userId: string, memberId: number, newRole: string) => {
    try {
      setIsLoading(true);
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (profileErr) throw profileErr;

      const { error: memberErr } = await supabase
        .from('members')
        .update({ role: newRole })
        .eq('id', memberId);
      if (memberErr) throw memberErr;

      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      showToast(`✅ Role berhasil diubah menjadi ${newRole === 'superadmin' ? 'SUPERADMIN' : newRole === 'admin' ? 'BENDAHARA' : 'ANGGOTA'}`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast(`❌ Gagal mengubah role: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const changeUserStatus = async (memberId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: newStatus })
        .eq('id', memberId);
      if (error) throw error;

      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: newStatus } : m));
      showToast(`✅ Status anggota berhasil diubah menjadi ${newStatus}`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast(`❌ Gagal mengubah status: ${e.message}`, 'error');
    }
  };

  const createAccountBySuperadmin = async (name: string, idDosenVal: string, phone: string, roleVal: string) => {
    try {
      setIsLoading(true);
      
      if (!/^\d{5}$/.test(idDosenVal)) {
        throw new Error('ID Dosen harus terdiri dari 5 digit angka.');
      }

      const targetEmail = `dosen${idDosenVal}@unpam.ac.id`;

      const { data: checkMember } = await supabase.from('members').select('*').eq('email', targetEmail).maybeSingle();
      if (checkMember) throw new Error('ID Dosen sudah terdaftar.');

      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const { data: signUpData, error: signUpErr } = await tempSupabase.auth.signUp({
        email: targetEmail,
        password: 'sisteminformasi',
        options: {
          data: {
            nama: name,
            nomor_hp: phone,
            id_dosen: idDosenVal,
            password_changed: false
          }
        }
      });

      if (signUpErr) throw signUpErr;

      if (signUpData.user) {
        const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', signUpData.user.id).maybeSingle();
        if (existingProfile) {
          await supabase.from('profiles').update({ role: roleVal, nama: name, nomor_hp: phone }).eq('id', signUpData.user.id);
        } else {
          await supabase.from('profiles').insert({
            id: signUpData.user.id,
            nama: name,
            email: targetEmail,
            nomor_hp: phone,
            role: roleVal
          });
        }

        const { data: existingMember } = await supabase.from('members').select('*').eq('user_id', signUpData.user.id).maybeSingle();
        if (existingMember) {
          await supabase.from('members').update({ role: roleVal, name: name, email: targetEmail, status: 'aktif' }).eq('user_id', signUpData.user.id);
        } else {
          await supabase.from('members').insert({
            name: name,
            email: targetEmail,
            role: roleVal,
            status: 'aktif',
            user_id: signUpData.user.id
          });
        }
      }

      await fetchData();
      showToast(`✅ Akun berhasil dibuat dengan password awal "sisteminformasi"`, 'success');
      return true;
    } catch (e: any) {
      console.error(e);
      showToast(`❌ Gagal membuat akun: ${e.message}`, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMember = async (memberId: number, userId: string | null) => {
    const isSuperAdmin = profile?.role === 'superadmin';
    const memberObj = members.find(m => m.id === memberId);
    
    if (isSuperAdmin) {
      setConfirmModal({
        isOpen: true,
        title: 'Hapus Anggota (Soft/Hard)',
        message: `Pilih metode penghapusan untuk pengguna "${memberObj?.name}":`,
        listItems: [
          `Nama: ${memberObj?.name}`,
          `Role: ${memberObj?.role}`,
          'Soft Delete: Pengguna dinonaktifkan dan disembunyikan. Dapat dipulihkan.',
          'Hard Delete: Akun pengguna dihapus secara permanen dari database.'
        ],
        showSoftDeleteOption: true,
        onSoftConfirm: async () => {
          try {
            const { error } = await supabase
              .from('members')
              .update({ status: 'soft_deleted' })
              .eq('id', memberId);
            if (error) throw error;
            
            const newSoftDeletedItem = {
              id: `member_${memberId}_${Date.now()}`,
              type: 'member' as const,
              deletedAt: new Date().toISOString(),
              data: memberObj
            };
            setSoftDeletedItems(prev => ({
              ...prev,
              members: [...prev.members, newSoftDeletedItem]
            }));
            
            setMembers(prev => prev.filter(m => m.id !== memberId));
            showToast('✅ Pengguna dipindahkan ke Keranjang Sampah', 'success');
          } catch (e: any) {
            showToast(`❌ Gagal: ${e.message}`, 'error');
          }
        },
        onConfirm: async () => {
          if (userId) {
            await executeHardDeleteUser(userId, memberId);
          } else {
            await supabase.from('members').delete().eq('id', memberId);
            setMembers(prev => prev.filter(m => m.id !== memberId));
            showToast('✅ Data berhasil dihapus permanen', 'success');
          }
        }
      });
    } else {
      showToast('Akses Terbatas: Hanya Superadmin yang dapat menghapus anggota.', 'error');
    }
  };

  const executeHardDeleteUser = async (userId: string, memberId: number) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });
      if (error) throw error;
      
      setMembers(prev => prev.filter(m => m.id !== memberId));
      showToast('✅ Akun berhasil dihapus secara permanen', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(`❌ Gagal: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

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

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    listItems?: string[];
    showSoftDeleteOption?: boolean;
    onSoftConfirm?: () => void | Promise<void>;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchUserProfile = async (userId: string, userEmail?: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) throw profileError;
      
      let finalProfile = profileData;
      
      // Resolve the actual authenticated user's email
      let actualEmail = userEmail;
      if (!actualEmail) {
        const { data: { user } } = await supabase.auth.getUser();
        actualEmail = user?.email || profileData?.email || '';
      }
      
      // Auto-migrate dosen02975@unpam.ac.id to superadmin
      if (profileData && (actualEmail === 'dosen02975@unpam.ac.id' || profileData.email === 'dosen02975@unpam.ac.id') && profileData.role !== 'superadmin') {
        const { error: profileUpdateErr } = await supabase
          .from('profiles')
          .update({ role: 'superadmin', email: 'dosen02975@unpam.ac.id' })
          .eq('id', userId);
        
        if (!profileUpdateErr) {
          finalProfile = { ...profileData, role: 'superadmin', email: 'dosen02975@unpam.ac.id' };
        }
        
        // Also update role in members table
        await supabase
          .from('members')
          .update({ role: 'superadmin', email: 'dosen02975@unpam.ac.id' })
          .eq('user_id', userId);
      }
      
      setProfile(finalProfile);

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
      setMembers(membersData?.filter(m => m.status !== 'soft_deleted') || []);

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

  const checkDefaultPassword = async (email: string): Promise<boolean> => {
    try {
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );
      const { data, error } = await tempSupabase.auth.signInWithPassword({
        email,
        password: 'sisteminformasi'
      });
      if (!error && data.session) {
        return true;
      }
    } catch (e) {
      console.error('Silent password check error:', e);
    }
    return false;
  };

  // Auth monitoring & PWA initialization
  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        setIsLoading(true);
        if (session.user.user_metadata?.password_changed) {
          setMustChangePassword(false);
          await fetchUserProfile(session.user.id);
          await fetchData();
          setIsLoading(false);
        } else {
          const isDefault = await checkDefaultPassword(session.user.email);
          setMustChangePassword(isDefault);
          if (!isDefault) {
            await supabase.auth.updateUser({
              data: { password_changed: true }
            });
          }
          await fetchUserProfile(session.user.id);
          await fetchData();
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen to auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        setIsLoading(true);
        if (session.user.user_metadata?.password_changed) {
          setMustChangePassword(false);
          await fetchUserProfile(session.user.id);
          await fetchData();
          setIsLoading(false);
        } else {
          const isDefault = await checkDefaultPassword(session.user.email);
          setMustChangePassword(isDefault);
          if (!isDefault) {
            await supabase.auth.updateUser({
              data: { password_changed: true }
            });
          }
          await fetchUserProfile(session.user.id);
          await fetchData();
          setIsLoading(false);
        }
      } else {
        setProfile(null);
        setMemberRecord(null);
        setMustChangePassword(false);
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
  useEffect(() => {
    if (profile) {
      const isSuperAdmin = profile.role === 'superadmin';
      const isAdmin = profile.role === 'superadmin' || profile.role === 'admin';
      
      if (activeTab === 'pengaturan' && !isSuperAdmin) {
        showToast('Akses Ditolak: Menu ini khusus untuk Superadmin.', 'error');
        setActiveTab('dashboard');
      } else if (activeTab === 'anggota' && !isAdmin) {
        showToast('Akses Ditolak: Anda tidak diizinkan membuka menu ini.', 'error');
        setActiveTab('dashboard');
      }
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
      showToast('✅ Data berhasil dihapus', 'success');
    } catch (err: any) {
      console.error('Error deleting session expense:', err);
      showToast(`❌ Gagal menghapus data${err?.message ? `: ${err.message}` : ''}`, 'error');
    }
  };

  const deleteSession = async (sessionId: number, isHardDelete = false) => {
    const isSuperAdmin = profile?.role === 'superadmin';
    if (isSuperAdmin && !isHardDelete) {
      const sessionObj = sessions.find(s => s.id === sessionId);
      const sessionAttendees = attendees.filter(a => a.session_id === sessionId);
      const sessionExpensesList = sessionExpenses.filter(e => e.session_id === sessionId);
      const sessionPayments = payments.filter(p => p.session_id === sessionId);

      setConfirmModal({
        isOpen: true,
        title: 'Hapus Sesi (Soft/Hard)',
        message: `Pilih metode penghapusan untuk sesi "${sessionObj?.nama_sesi}":`,
        listItems: [
          `Sesi: ${sessionObj?.nama_sesi}`,
          `${sessionAttendees.length} data kehadiran`,
          `${sessionExpensesList.length} pengeluaran`,
          `${sessionPayments.length} pembayaran`
        ],
        showSoftDeleteOption: true,
        onSoftConfirm: () => {
          const newSoftDeletedItem = {
            id: `session_${sessionId}_${Date.now()}`,
            type: 'session' as const,
            deletedAt: new Date().toISOString(),
            data: sessionObj,
            attendees: sessionAttendees,
            expenses: sessionExpensesList,
            payments: sessionPayments
          };
          setSoftDeletedItems(prev => ({
            ...prev,
            sessions: [...prev.sessions, newSoftDeletedItem]
          }));
          executeHardDeleteSession(sessionId);
          showToast('✅ Sesi dipindahkan ke Keranjang Sampah', 'success');
        },
        onConfirm: () => {
          executeHardDeleteSession(sessionId);
        }
      });
    } else {
      const sessionObj = sessions.find(s => s.id === sessionId);
      const sessionAttendees = attendees.filter(a => a.session_id === sessionId);
      const sessionExpensesList = sessionExpenses.filter(e => e.session_id === sessionId);
      const sessionPayments = payments.filter(p => p.session_id === sessionId);

      setConfirmModal({
        isOpen: true,
        title: 'Hapus Sesi Permanen',
        message: `Apakah Anda yakin ingin menghapus sesi "${sessionObj?.nama_sesi}" secara permanen?`,
        listItems: [
          `Sesi: ${sessionObj?.nama_sesi}`,
          `${sessionAttendees.length} data kehadiran`,
          `${sessionExpensesList.length} pengeluaran`,
          `${sessionPayments.length} pembayaran`
        ],
        onConfirm: () => {
          executeHardDeleteSession(sessionId);
        }
      });
    }
  };

  const executeHardDeleteSession = async (sessionId: number) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setAttendees(prev => prev.filter(a => a.session_id !== sessionId));
      setSessionExpenses(prev => prev.filter(e => e.session_id !== sessionId));
      setPayments(prev => prev.filter(p => p.session_id !== sessionId));
      
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
      showToast('✅ Sesi berhasil dihapus secara permanen', 'success');
    } catch (err: any) {
      console.error('Error hard deleting session:', err);
      showToast(`❌ Gagal menghapus sesi: ${err.message}`, 'error');
    }
  };

  const updateSession = async (sessionId: number, updatedData: { nama_sesi: string; tanggal_main: string; jam_main: string; lokasi: string; catatan: string }) => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update(updatedData)
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setSessions(prev => prev.map(s => s.id === sessionId ? data : s));
        showToast('Sesi berhasil diperbarui!', 'success');
      }
    } catch (err: any) {
      console.error('Error updating session:', err);
      showToast(`Gagal memperbarui sesi${err?.message ? `: ${err.message}` : ''}`, 'error');
    }
  };

  const deletePayment = async (paymentId: number) => {
    const isSuperAdmin = profile?.role === 'superadmin';
    const paymentObj = payments.find(p => p.id === paymentId);
    
    if (isSuperAdmin) {
      setConfirmModal({
        isOpen: true,
        title: 'Hapus Pembayaran (Soft/Hard)',
        message: `Pilih metode penghapusan untuk pembayaran tagihan ini:`,
        showSoftDeleteOption: true,
        onSoftConfirm: () => {
          const newSoftDeletedItem = {
            id: `payment_${paymentId}_${Date.now()}`,
            type: 'payment' as const,
            deletedAt: new Date().toISOString(),
            data: paymentObj
          };
          setSoftDeletedItems(prev => ({
            ...prev,
            payments: [...prev.payments, newSoftDeletedItem]
          }));
          executeHardDeletePayment(paymentId);
          showToast('✅ Pembayaran dipindahkan ke Keranjang Sampah', 'success');
        },
        onConfirm: () => {
          executeHardDeletePayment(paymentId);
        }
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Hapus Pembayaran Permanen',
        message: `Apakah Anda yakin ingin menghapus data pembayaran ini?`,
        onConfirm: () => {
          executeHardDeletePayment(paymentId);
        }
      });
    }
  };

  const executeHardDeletePayment = async (paymentId: number) => {
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);
      
      if (error) throw error;
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      showToast('✅ Pembayaran berhasil dihapus secara permanen', 'success');
    } catch (err: any) {
      console.error('Error deleting payment:', err);
      showToast(`❌ Gagal menghapus pembayaran: ${err.message}`, 'error');
    }
  };

  const deleteAttendanceRecord = async (sessionId: number, memberId: number) => {
    try {
      const { error } = await supabase
        .from('session_attendees')
        .delete()
        .eq('session_id', sessionId)
        .eq('member_id', memberId);
      
      if (error) throw error;
      setAttendees(prev => prev.filter(a => !(a.session_id === sessionId && a.member_id === memberId)));
      showToast('✅ Data berhasil dihapus', 'success');
    } catch (err: any) {
      console.error('Error deleting attendance record:', err);
      showToast(`❌ Gagal menghapus data${err?.message ? `: ${err.message}` : ''}`, 'error');
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
        status_pembayaran: 'unpaid'
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

  const submitCashPayment = async (paymentId: number) => {
    const dateStr = new Date().toISOString();
    const { error } = await supabase
      .from('payments')
      .update({
        status_pembayaran: 'Menunggu Verifikasi Cash',
        bukti_transfer: 'CASH',
        tanggal_bayar: dateStr
      })
      .eq('id', paymentId);

    if (error) throw error;

    setPayments(prev => prev.map(t => t.id === paymentId ? {
      ...t,
      status_pembayaran: 'Menunggu Verifikasi Cash',
      bukti_transfer: 'CASH',
      tanggal_bayar: dateStr
    } : t));
  };

  const markAsPaidCashDirectly = async (paymentId: number) => {
    try {
      const dateStr = new Date().toISOString();
      const { error } = await supabase
        .from('payments')
        .update({
          status_pembayaran: 'verified',
          bukti_transfer: 'CASH',
          tanggal_bayar: dateStr
        })
        .eq('id', paymentId);

      if (error) throw error;

      setPayments(prev => prev.map(t => t.id === paymentId ? {
        ...t,
        status_pembayaran: 'verified',
        bukti_transfer: 'CASH',
        tanggal_bayar: dateStr
      } : t));
      
      showToast('Pembayaran cash berhasil dicatat Lunas!', 'success');
    } catch (err) {
      console.error('Error marking as paid cash directly:', err);
      showToast('Gagal mencatat pembayaran cash.', 'error');
    }
  };

  const cleanupTestData = async () => {
    try {
      // 1. Delete all payments
      const { error: err1 } = await supabase.from('payments').delete().neq('id', 0);
      if (err1) throw err1;

      // 2. Delete all attendance records
      const { error: err2 } = await supabase.from('session_attendees').delete().neq('id', 0);
      if (err2) throw err2;

      // 3. Delete all expenses
      const { error: err3 } = await supabase.from('session_expenses').delete().neq('id', 0);
      if (err3) throw err3;

      // 4. Delete all sessions
      const { error: err4 } = await supabase.from('sessions').delete().neq('id', 0);
      if (err4) throw err4;

      // Sync local state
      setPayments([]);
      setAttendees([]);
      setSessionExpenses([]);
      setSessions([]);

      showToast('✅ Berhasil membersihkan semua data transaksi!', 'success');
    } catch (err: any) {
      console.error('Error cleaning up test data:', err);
      showToast(`❌ Gagal membersihkan data: ${err?.message || 'Error tidak diketahui'}`, 'error');
    }
  };

  const cleanupMemberAccounts = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_member_accounts');
      if (error) throw error;

      // Sync local state
      setPayments([]);
      setAttendees([]);
      setSessionExpenses([]);
      setSessions([]);
      setMembers(prev => prev.filter(m => m.role === 'admin' || m.role === 'superadmin'));

      showToast('✅ Berhasil menghapus semua member & data transaksi!', 'success');
    } catch (err: any) {
      console.error('Error cleaning up member accounts:', err);
      showToast(`❌ Gagal menghapus: ${err?.message || 'Error tidak diketahui'}`, 'error');
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
      loadingMessage = "Menghitung saldo kas...";
      skeletonContent = (
        <div className="space-y-6">
          {/* Treasury Card Skeleton */}
          <div className="bg-card rounded-[2rem] p-6 text-center border border-border shadow-theme relative overflow-hidden h-40 flex flex-col justify-center items-center gap-2">
            <div className="w-28 h-3.5 shimmer-card rounded mb-1" />
            <div className="w-48 h-8 shimmer-card rounded mb-4" />
            <div className="grid grid-cols-2 gap-4 w-full border-t border-border pt-4">
              <div className="flex flex-col items-center">
                <div className="w-24 h-2.5 shimmer-card rounded mb-1.5" />
                <div className="w-16 h-3.5 shimmer-card rounded" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-24 h-2.5 shimmer-card rounded mb-1.5" />
                <div className="w-16 h-3.5 shimmer-card rounded" />
              </div>
            </div>
          </div>

          {/* Histori Section Skeleton */}
          <div className="space-y-4">
            <div className="w-40 h-4 rounded shimmer-card animate-pulse" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card p-4 rounded-2xl border border-border flex items-center gap-3.5 shadow-theme justify-between">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-xl shimmer-card flex-shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="w-32 h-3.5 rounded shimmer-card" />
                    <div className="w-24 h-2.5 rounded shimmer-card" />
                  </div>
                </div>
                <div className="w-20 h-4 rounded shimmer-card" />
              </div>
            ))}
          </div>
        </div>
      );
    } else if (activeTab === 'tagihan') {
      const isUserAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
      loadingMessage = isUserAdmin ? "Memuat data sesi..." : "Menyiapkan tagihan...";
      if (isUserAdmin) {
        skeletonContent = (
          <div className="space-y-5">
            <div className="flex justify-between items-center mb-4">
              <div className="w-36 h-5 rounded shimmer-card" />
              <div className="w-24 h-8 rounded-xl shimmer-card" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-3xl border border-border shadow-theme p-4 flex justify-between items-center">
                <div className="space-y-2.5 flex-1 pr-4">
                  <div className="w-16 h-3.5 rounded shimmer-card" />
                  <div className="w-48 h-4 rounded shimmer-card" />
                  <div className="w-32 h-3 rounded shimmer-card" />
                </div>
                <div className="text-right space-y-1.5 flex-shrink-0">
                  <div className="w-12 h-2.5 rounded shimmer-card" />
                  <div className="w-20 h-4.5 rounded shimmer-card" />
                </div>
              </div>
            ))}
          </div>
        );
      } else {
        skeletonContent = (
          <div className="space-y-4">
            <div className="w-44 h-5 shimmer-card rounded mb-4" />
            {[1, 2].map(i => (
              <div key={i} className="bg-card rounded-3xl border border-border shadow-theme overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="w-24 h-4.5 shimmer-card rounded-full" />
                    <div className="w-20 h-4.5 shimmer-card rounded-full" />
                  </div>
                  <div className="w-48 h-4 shimmer-card rounded" />
                  <div className="flex justify-between items-center mt-4">
                    <div className="w-28 h-3.5 shimmer-card rounded" />
                    <div className="w-20 h-4.5 shimmer-card rounded" />
                  </div>
                </div>
                <div className="bg-background/30 px-5 py-4 border-t border-border">
                  <div className="w-full h-11 shimmer-card rounded-2xl" />
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
            <div className="w-28 h-5 rounded shimmer-card" />
            <div className="w-12 h-4 rounded shimmer-card" />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-card p-4 rounded-2xl border border-border flex items-center gap-3.5 shadow-theme justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full shimmer-card flex-shrink-0" />
                <div>
                  <div className="w-28 h-3.5 shimmer-card rounded mb-2" />
                  <div className="w-36 h-2.5 shimmer-card rounded" />
                </div>
              </div>
              <div className="w-12 h-4 shimmer-card rounded" />
            </div>
          ))}
        </div>
      );
    } else if (activeTab === 'profile') {
      loadingMessage = "Memuat data profil...";
      skeletonContent = (
        <div className="space-y-6">
          <div className="flex items-center gap-4 bg-card p-5 rounded-3xl border border-border shadow-theme">
            <div className="w-14 h-14 shimmer-card rounded-full" />
            <div className="space-y-2">
              <div className="w-32 h-4 bg-slate-800 shimmer-card rounded" />
              <div className="w-40 h-3 shimmer-card rounded" />
              <div className="w-12 h-4 shimmer-card rounded mt-2" />
            </div>
          </div>
          <div className="bg-card p-5 rounded-3xl border border-border shadow-theme space-y-4">
            <div className="w-40 h-4 shimmer-card rounded" />
            <div className="space-y-4">
              <div>
                <div className="w-24 h-2.5 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 shimmer-card rounded-xl" />
              </div>
              <div>
                <div className="w-36 h-2.5 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 shimmer-card rounded-xl" />
              </div>
              <div className="w-full h-11 shimmer-card rounded-2xl" />
            </div>
          </div>
        </div>
      );
    } else if (activeTab === 'pengaturan') {
      loadingMessage = "Memuat pengaturan...";
      skeletonContent = (
        <div className="space-y-6">
          <div className="bg-card p-5 rounded-3xl border border-border shadow-theme space-y-4">
            <div className="w-40 h-4 shimmer-card rounded" />
            <div className="space-y-4">
              <div>
                <div className="w-24 h-2.5 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 shimmer-card rounded-xl" />
              </div>
              <div>
                <div className="w-36 h-2.5 shimmer-card rounded mb-1.5" />
                <div className="w-full h-10 shimmer-card rounded-xl" />
              </div>
              <div>
                <div className="w-28 h-2.5 shimmer-card rounded mb-1.5" />
                <div className="flex flex-col items-center gap-4 p-4 border border-border rounded-2xl bg-background/40">
                  <div className="w-40 h-40 shimmer-card rounded-xl" />
                  <div className="w-36 h-8 shimmer-card rounded-xl" />
                </div>
              </div>
              <div className="w-full h-11 shimmer-card rounded-2xl" />
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
            <div className="bg-card p-4 rounded-2xl border border-border shadow-theme flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shimmer-card animate-pulse" />
              <div className="space-y-2">
                <div className="w-16 h-2 shimmer-card rounded" />
                <div className="w-12 h-3.5 shimmer-card rounded" />
              </div>
            </div>
            <div className="bg-card p-4 rounded-2xl border border-border shadow-theme flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shimmer-card animate-pulse" />
              <div className="space-y-2">
                <div className="w-16 h-2 shimmer-card rounded" />
                <div className="w-12 h-3.5 shimmer-card rounded" />
              </div>
            </div>
          </div>

          {/* Section Title Skeleton */}
          <div className="w-32 h-5 rounded shimmer-card" />

          {/* Sessions List Skeletons */}
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-card rounded-3xl border border-border shadow-theme flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl shimmer-card flex-shrink-0" />
                  <div>
                    <div className="w-40 h-4 rounded shimmer-card mb-2" />
                    <div className="w-28 h-3 rounded shimmer-card" />
                  </div>
                </div>
                <div className="w-16 h-4 rounded shimmer-card" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex justify-center text-primary font-sans">
        <div className="w-full max-w-md bg-card min-h-screen shadow-theme relative pb-20 flex flex-col border-x border-border animate-fadeIn">
          
          {/* SKELETON HEADER */}
          <header className="bg-card/80 backdrop-blur-md p-4 rounded-b-[2rem] border-b border-border shadow-theme">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {/* Avatar Skeleton */}
                <div className="w-12 h-12 rounded-full shimmer-card flex-shrink-0" />
                <div>
                  {/* Greeting Skeleton */}
                  <div className="w-20 h-3 rounded shimmer-card mb-2" />
                  {/* Name Skeleton */}
                  <div className="w-32 h-4.5 rounded shimmer-card" />
                </div>
              </div>
              {/* Role Badge Skeleton */}
              <div className="w-20 h-6 rounded-full shimmer-card" />
            </div>
          </header>

          {/* SKELETON BODY */}
          <main className="p-4 flex-1 space-y-6 overflow-hidden">
            {skeletonContent}
          </main>

          {/* User-friendly loading message at the bottom */}
          <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center justify-center gap-2 pointer-events-none z-10">
            <div className="px-4 py-2 bg-card/90 backdrop-blur-md rounded-full shadow-theme border border-border flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[11px] font-[700] text-emerald-400 tracking-wider uppercase">
                {loadingMessage}
              </span>
            </div>
          </div>

          {/* SKELETON NAVIGATION BAR */}
          <nav className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border p-3 flex justify-around rounded-t-[1.5rem] z-10">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-1.5 w-12">
                <div className="w-6 h-6 rounded-md shimmer-card" />
                <div className="w-8 h-2 rounded shimmer-card" />
              </div>
            ))}
          </nav>

        </div>
      </div>
    );
  }

  // --- CHANGE PASSWORD SCREEN ---
  if (session && mustChangePassword) {
    return (
      <ChangePasswordScreen
        session={session}
        onPasswordChanged={async () => {
          setMustChangePassword(false);
          setIsLoading(true);
          await fetchUserProfile(session.user.id);
          await fetchData();
          setIsLoading(false);
        }}
      />
    );
  }

  // --- AUTH SCREENS ---
  if (!session || !profile) {
    return <AuthScreen onLoginSuccess={fetchUserProfile} members={members} />;
  }

  const isSuperAdmin = profile.role === 'superadmin';
  const isAdmin = profile.role === 'superadmin' || profile.role === 'admin';

  return (
    <div className="min-h-screen bg-background flex justify-center text-primary font-sans transition-all duration-200">
      <div className="w-full max-w-md bg-card min-h-screen shadow-theme relative pb-28 flex flex-col border-x border-border transition-all duration-200">
        
        {/* HEADER */}
        <header className="bg-card/90 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-border shadow-theme transition-all duration-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0_4px_12px_rgba(16,185,129,0.25)] flex items-center justify-center flex-shrink-0 text-white font-[700] text-lg select-none">
                {getInitials(profile?.nama || profile?.full_name || session?.user?.user_metadata?.name || session?.user?.user_metadata?.nama)}
              </div>
              <div>
                <p className="text-[9px] text-secondary font-black uppercase tracking-wider leading-none">SELAMAT DATANG,</p>
                <p className="font-extrabold text-primary text-sm leading-tight mt-1.5 truncate w-36">{profile.nama}</p>
              </div>
            </div>
            <div className="flex gap-2.5 items-center">
              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                profile.role === 'superadmin'
                  ? 'bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20'
                  : profile.role === 'admin'
                    ? 'bg-amber-550/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                    : 'bg-emerald-500/10 text-accent border border-emerald-500/20'
              }`}>
                {profile.role === 'superadmin' ? 'SUPERADMIN' : profile.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA'}
              </span>
              <button 
                onClick={toggleTheme} 
                className="p-2.5 bg-card border border-border text-secondary hover:text-accent rounded-2xl shadow-theme transition-all duration-200 flex items-center justify-center"
                title={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <button 
                onClick={handleLogout} 
                className="p-2.5 bg-card border border-border text-secondary hover:text-red-500 dark:hover:text-red-400 rounded-2xl shadow-theme transition-all duration-200 flex items-center justify-center"
                title="Keluar Akun"
                aria-label="Keluar Akun"
              >
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
              setActiveTab={setActiveTab}
              setSelectedSessionId={setSelectedSessionId}
              showToast={showToast}
              setShowAddSessionModal={setShowAddSessionModal}
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
                markAsPaidCashDirectly={markAsPaidCashDirectly}
                deleteSession={deleteSession}
                updateSession={updateSession}
                deletePayment={deletePayment}
                deleteAttendanceRecord={deleteAttendanceRecord}
                setConfirmModal={setConfirmModal}
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
                submitCashPayment={submitCashPayment}
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
            <MembersList 
              members={members} 
              isSuperAdmin={isSuperAdmin}
              isAdmin={isAdmin}
              resetUserPassword={resetUserPassword}
              changeUserRole={changeUserRole}
              changeUserStatus={changeUserStatus}
              deleteMember={deleteMember}
              createAccountBySuperadmin={createAccountBySuperadmin}
            />
          )}

          {activeTab === 'profile' && !isAdmin && (
            <ProfileMember 
              profile={profile} 
              updateProfile={updateProfile} 
            />
          )}

          {activeTab === 'pengaturan' && isSuperAdmin && (
            <SettingsAdmin 
              settings={settings} 
              updateSettings={updateSettings} 
              setConfirmModal={setConfirmModal}
              cleanupTestData={cleanupTestData}
              cleanupMemberAccounts={cleanupMemberAccounts}
              isSuperAdmin={isSuperAdmin}
              softDeletedItems={softDeletedItems}
              restoreSoftDeletedItem={restoreSoftDeletedItem}
              executeHardDeleteFromTrash={executeHardDeleteFromTrash}
            />
          )}
        </main>

        {/* BOTTOM FLOATING NAVIGATION */}
        <nav className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-card border border-border rounded-[24px] shadow-theme flex justify-around p-2.5 z-30 transition-all duration-200">
          <NavItem icon={<Home size={20} />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Calendar size={20} />} label={isAdmin ? 'Sesi' : 'Tagihan Saya'} active={activeTab === 'tagihan'} onClick={() => setActiveTab('tagihan')} />
          <NavItem icon={<Wallet size={20} />} label={isAdmin ? 'Laporan' : 'Kas'} active={activeTab === 'kas'} onClick={() => setActiveTab('kas')} />
          {isAdmin ? (
            <>
              <NavItem icon={<Users size={20} />} label="Anggota" active={activeTab === 'anggota'} onClick={() => setActiveTab('anggota')} />
              {isSuperAdmin && (
                <NavItem icon={<Shield size={20} />} label="Pengaturan" active={activeTab === 'pengaturan'} onClick={() => setActiveTab('pengaturan')} />
              )}
            </>
          ) : (
            <NavItem icon={<UserIcon size={20} />} label="Profil" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          )}
        </nav>

        {/* FLOATING ACTION BUTTON */}
        {activeTab === 'dashboard' && isAdmin && (
          <button 
            onClick={() => setShowAddSessionModal(true)}
            className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-[#10B981] to-[#059669] text-white rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all z-30"
            title="Tambah Sesi Baru"
            aria-label="Tambah Sesi Baru"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        )}

        {/* IMAGE PROOF VIEWER MODAL */}
        {viewProofUrl && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewProofUrl(null)}>
            <div className="bg-card p-3 rounded-3xl border border-border max-w-sm w-full relative overflow-hidden shadow-theme" onClick={e => e.stopPropagation()}>
              <button onClick={() => setViewProofUrl(null)} className="absolute top-4 right-4 p-2 bg-background text-secondary hover:text-primary rounded-full hover:bg-border transition-colors">
                <XCircle size={20} />
              </button>
              <h3 className="font-extrabold text-sm mb-4 text-primary pr-10">Bukti Transfer Pembayaran</h3>
              <div className="bg-background rounded-2xl overflow-hidden aspect-square border border-border flex items-center justify-center">
                <img src={viewProofUrl} alt="Bukti Transfer" className="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM SUCCESS MODAL */}
        {successModal.isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}>
            <div className="bg-card rounded-[20px] p-6 max-w-xs w-full text-center shadow-theme border border-border flex flex-col items-center animate-scaleUp" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-4 border border-accent/20">
                <CheckCircle size={36} className="text-accent" strokeWidth={2.5} />
              </div>
              <h3 className="text-primary font-extrabold text-sm mb-2 tracking-tight">
                {successModal.title}
              </h3>
              <p className="text-secondary font-bold text-xs leading-relaxed px-1 mb-6">
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
                  className="w-full bg-background hover:bg-border/60 text-primary border border-border font-[800] py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM CONFIRMATION MODAL */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
            <div className="bg-card rounded-[24px] p-6 max-w-sm w-full shadow-theme border border-border flex flex-col gap-4 animate-scaleUp" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-500 animate-pulse-gentle" />
                </div>
                <h3 className="text-primary font-extrabold text-base tracking-tight uppercase">
                  {confirmModal.title}
                </h3>
                <p className="text-secondary font-bold text-xs leading-relaxed px-1">
                  {confirmModal.message}
                </p>
              </div>

              {confirmModal.listItems && confirmModal.listItems.length > 0 && (
                <div className="bg-background/50 p-4 rounded-2xl border border-border/85 text-left">
                  <p className="text-[10px] text-secondary font-black uppercase tracking-wider mb-2">Tindakan ini juga akan menghapus:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-primary font-bold">
                    {confirmModal.listItems.map((item, idx) => (
                      <li key={idx} className="text-secondary/90">
                        <span className="text-primary">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {confirmModal.showSoftDeleteOption ? (
                <div className="flex flex-col gap-2.5 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={async () => {
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        if (confirmModal.onSoftConfirm) await confirmModal.onSoftConfirm();
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-white font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] shadow-md"
                    >
                      Soft Delete
                    </button>
                    <button 
                      onClick={async () => {
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        await confirmModal.onConfirm();
                      }}
                      className="w-full bg-red-650 hover:bg-red-500 text-white font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] shadow-md"
                    >
                      Hard Delete
                    </button>
                  </div>
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="w-full border border-border bg-background text-secondary hover:text-primary font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] hover:bg-border/60"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="w-full border border-border bg-background text-secondary hover:text-primary font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] hover:bg-border/60"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={async () => {
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                      await confirmModal.onConfirm();
                    }}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] shadow-md shadow-red-950/20"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CUSTOM TOAST NOTIFICATIONS */}
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-[90%] max-w-[340px]">
          {toasts.map(t => (
            <div 
              key={t.id} 
              className="px-4 py-3 rounded-2xl bg-card/95 backdrop-blur-md text-primary shadow-theme border border-border flex items-center gap-2.5 pointer-events-auto animate-slideDown"
            >
              {t.type === 'success' ? (
                <CheckCircle size={15} className="text-accent flex-shrink-0" />
              ) : t.type === 'error' ? (
                <XCircle size={15} className="text-red-500 flex-shrink-0" />
              ) : (
                <AlertCircle size={15} className="text-blue-500 flex-shrink-0" />
              )}
              <span className="text-[11px] font-[700] text-primary leading-snug">{t.message}</span>
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
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center pt-2 pb-1 relative transition-all duration-200 flex-1 ${
        active 
          ? 'text-accent font-extrabold scale-105' 
          : 'text-secondary hover:text-primary'
      }`}
    >
      <div className="mb-0.5">{icon}</div>
      <span className="text-[10px] tracking-tight">{label}</span>
      {active && (
        <div className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-accent rounded-full animate-fadeIn" />
      )}
    </button>
  );
}

// --- DASHBOARD COMPONENT ---
function Dashboard({ 
  user, memberRecord, saldoKas, totalIncome, totalExpense, members, sessions, attendees, sessionExpenses, payments, verifyPayment, setViewProofUrl, setSelectedPayment,
  isInstallable, handleInstallPWA, setActiveTab, setSelectedSessionId, showToast, setShowAddSessionModal
}: any) {
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  
  // Pending payments (uploaded state)
  const pendingPayments = payments.filter((p: any) => p.status_pembayaran === 'uploaded');
  
  // Pending cash payments
  const pendingCashPayments = payments.filter((p: any) => p.status_pembayaran === 'Menunggu Verifikasi Cash');
  
  // Member specific active bills
  const myPayments = memberRecord ? payments.filter((p: any) => p.member_id === memberRecord.id) : [];
  const myActiveBills = myPayments.filter((p: any) => p.status_pembayaran === 'pending' || p.status_pembayaran === 'rejected' || p.status_pembayaran === 'Menunggu Verifikasi Cash' || p.status_pembayaran === 'uploaded' || p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'generated');
  const myPaidCount = myPayments.filter((p: any) => p.status_pembayaran === 'verified' || p.status_pembayaran === 'paid' || p.status_pembayaran === 'lunas').length;
  const myPendingCount = myPayments.filter((p: any) => p.status_pembayaran === 'pending' || p.status_pembayaran === 'uploaded' || p.status_pembayaran === 'Menunggu Verifikasi Cash').length;
  const myTotalPaidAmount = myPayments.filter((p: any) => p.status_pembayaran === 'verified' || p.status_pembayaran === 'paid' || p.status_pembayaran === 'lunas').reduce((sum: number, p: any) => sum + p.nominal_tagihan, 0);

  // Unpaid payments calculation for KPI card
  const unpaidPayments = payments.filter((p: any) => p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'generated' || p.status_pembayaran === 'rejected');
  const totalUnpaidAmount = unpaidPayments.reduce((sum: number, p: any) => sum + p.nominal_tagihan, 0);
  const uniqueUnpaidMembersCount = new Set(unpaidPayments.map((p: any) => p.member_id)).size;

  // Local state to view/review pending payments
  const [reviewPayment, setReviewPayment] = useState<any>(null);

  if (isAdmin) {
    return (
      <div className="space-y-6 animate-fadeIn pb-6">
        
        {/* PWA INSTALLATION BANNER */}
        {isInstallable && (
          <div className="bg-card border border-border p-4 rounded-3xl flex justify-between items-center shadow-theme animate-bounce transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 text-accent rounded-xl flex items-center justify-center border border-accent/20">
                <span className="text-lg">📱</span>
              </div>
              <div>
                <p className="font-extrabold text-xs text-primary">Instal Aplikasi SI-PATRA</p>
                <p className="text-[9px] text-secondary font-semibold mt-0.5">Akses instan dari Home Screen Anda</p>
              </div>
            </div>
            <button 
              onClick={handleInstallPWA}
              className="bg-accent hover:opacity-90 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-[0.97]"
            >
              Install
            </button>
          </div>
        )}

        {/* MAIN CASH CARD */}
        <div className="bg-gradient-to-br from-[#064E3B] to-[#0D9488] rounded-[24px] p-6 text-white shadow-xl relative overflow-hidden">
          {/* Badminton Shuttlecock Watermark SVG in bottom right */}
          <div className="absolute bottom-0 right-0 w-36 h-36 opacity-[0.12] pointer-events-none transform translate-x-4 translate-y-4">
            <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full text-white">
              <path d="M 62 62 L 15 25 C 22 15, 45 8, 55 20 L 72 52 Z" />
              <line x1="63" y1="61" x2="20" y2="28" stroke="currentColor" strokeWidth="0.8" />
              <line x1="65" y1="59" x2="28" y2="21" stroke="currentColor" strokeWidth="0.8" />
              <line x1="67" y1="57" x2="38" y2="16" stroke="currentColor" strokeWidth="0.8" />
              <line x1="69" y1="55" x2="48" y2="15" stroke="currentColor" strokeWidth="0.8" />
              <line x1="71" y1="53" x2="58" y2="20" stroke="currentColor" strokeWidth="0.8" />
              <path d="M 32 37 C 38 28, 48 23, 58 29" fill="none" stroke="currentColor" strokeWidth="0.8" />
              <path d="M 45 47 C 50 39, 58 35, 66 40" fill="none" stroke="currentColor" strokeWidth="0.8" />
              <path d="M 61 61 C 59 63, 61 67, 65 69 C 69 67, 71 63, 69 61 Z" />
              <path d="M 65 67 C 70 72, 80 80, 83 75 C 86 70, 78 60, 73 55 Z" />
            </svg>
          </div>
          
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 text-emerald-100">
              <Wallet size={16} strokeWidth={2.2} />
              <span className="text-[10px] font-black uppercase tracking-wider">TOTAL SALDO KAS</span>
            </div>
            <button 
              onClick={() => setActiveTab('kas')}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-full text-[10px] font-black text-white flex items-center gap-0.5 transition-all"
            >
              Detail Kas <ChevronRight size={10} strokeWidth={3} />
            </button>
          </div>

          <h2 className="text-4xl font-[900] tracking-tight mb-7">
            {formatRp(saldoKas)}
          </h2>

          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-emerald-800 shadow-sm flex-shrink-0">
                <TrendingUp size={16} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-emerald-200 text-[9px] font-black uppercase tracking-wider leading-none">TOTAL PEMASUKAN</p>
                <p className="font-extrabold text-xs text-white mt-1">
                  {formatRp(totalIncome)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-red-600 shadow-sm flex-shrink-0">
                <TrendingUp size={16} strokeWidth={2.5} className="transform rotate-180" />
              </div>
              <div>
                <p className="text-emerald-200 text-[9px] font-black uppercase tracking-wider leading-none">TOTAL PENGELUARAN</p>
                <p className="font-extrabold text-xs text-white mt-1">
                  {formatRp(totalExpense)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTION SECTION */}
        <div className="bg-card rounded-[24px] p-3.5 shadow-theme border border-border grid grid-cols-5 divide-x divide-border transition-all duration-200">
          <div onClick={() => setShowAddSessionModal(true)} className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PlusCircle size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">Tambah Sesi</span>
          </div>
          <div onClick={() => { setActiveTab('tagihan'); showToast('Pilih sesi terlebih dahulu untuk mencatat biaya.', 'info'); }} className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity pl-1">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Wallet size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">Tambah Kas</span>
          </div>
          <div onClick={() => setActiveTab('pengaturan')} className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity pl-1">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <QrCode size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">QRIS Saya</span>
          </div>
          <div onClick={() => setActiveTab('kas')} className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity pl-1">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Receipt size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">Laporan</span>
          </div>
          <div onClick={() => setActiveTab('anggota')} className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity pl-1">
            <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Users size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">Anggota</span>
          </div>
        </div>

        {/* KPI CARDS GRID */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* CARD 1: TOTAL ANGGOTA */}
          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 p-4 rounded-[20px] flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <Users size={16} />
              </div>
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-wider">Total Anggota</span>
            </div>
            <div>
              <p className="text-lg font-black text-primary leading-none">{members.filter((m: any) => m.role === 'member').length} Orang</p>
              <p className="text-[9px] text-[#10B981] font-bold mt-1.5 flex items-center gap-1">● Aktif</p>
            </div>
          </div>

          {/* CARD 2: TOTAL SESI */}
          <div className="bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/10 p-4 rounded-[20px] flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
                <Activity size={16} />
              </div>
              <span className="text-[8px] font-black text-purple-500 uppercase tracking-wider">Total Sesi</span>
            </div>
            <div>
              <p className="text-lg font-black text-primary leading-none">{sessions.length} Sesi</p>
              <p className="text-[9px] text-secondary font-bold mt-1.5">Bulan ini</p>
            </div>
          </div>

          {/* CARD 3: TAGIHAN BELUM LUNAS */}
          <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 p-4 rounded-[20px] flex flex-col justify-between h-28 relative overflow-hidden col-span-2">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                <Clock size={16} />
              </div>
              <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider">Tagihan Belum Lunas</span>
            </div>
            <div>
              <p className="text-lg font-black text-red-505 dark:text-red-405 leading-none truncate">{formatRp(totalUnpaidAmount)}</p>
              <p className="text-[9px] text-secondary font-bold mt-1.5 flex items-center gap-1">
                <Users size={10} /> {uniqueUnpaidMembersCount} Anggota
              </p>
            </div>
          </div>
        </div>

        {/* ADMIN SECTION: PENDING PAYMENTS VERIFICATION */}
        <div className="bg-card rounded-[24px] p-4.5 shadow-theme border border-border space-y-4 transition-all duration-200">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-wider text-primary">Pembayaran QRIS Menunggu Verifikasi</h3>
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-2.5 py-0.5 rounded-full font-black border border-amber-500/20">
              {pendingPayments.length}
            </span>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="text-center py-6 bg-background border border-dashed border-border rounded-2xl text-secondary text-xs font-bold">
              Tidak ada pembayaran pending.
            </div>
          ) : (
            <div className="space-y-3.5">
              {pendingPayments.slice(0, 3).map((p: any) => {
                const member = members.find((m: any) => m.id === p.member_id);
                const session = sessions.find((s: any) => s.id === p.session_id);
                return (
                  <div key={p.id} className="flex justify-between items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs flex-shrink-0">
                        {getInitials(member?.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-xs text-primary truncate">{member?.name || 'Anggota'}</p>
                          <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-[7px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider flex-shrink-0">
                            QRIS
                          </span>
                        </div>
                        <p className="text-[9px] text-secondary font-bold truncate mt-0.5">
                          {session?.nama_sesi || 'Sesi Game'} • {session?.tanggal_main ? formatDate(session.tanggal_main) : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 mr-1">{formatRp(p.nominal_tagihan)}</span>
                      {p.bukti_transfer && p.bukti_transfer !== 'CASH' && (
                        <button 
                          onClick={() => setViewProofUrl(p.bukti_transfer)}
                          className="px-2 py-1.5 bg-card border border-border/40 hover:bg-background text-primary text-[9px] font-extrabold rounded-xl transition-colors"
                          title="Lihat Bukti Transfer"
                        >
                          Bukti
                        </button>
                      )}
                      <button 
                        onClick={async () => {
                          await verifyPayment(p.id, 'rejected');
                          showToast('Pembayaran ditolak.', 'info');
                        }}
                        className="p-1 text-red-500 hover:bg-red-500/10 rounded-xl border border-red-500/20 flex items-center justify-center"
                        title="Tolak Pembayaran"
                      >
                        <XCircle size={14} />
                      </button>
                      <button 
                        onClick={async () => {
                          await verifyPayment(p.id, 'verified');
                          showToast('Pembayaran berhasil diverifikasi!', 'success');
                        }}
                        className="p-1 text-accent hover:bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center"
                        title="Verifikasi Pembayaran"
                      >
                        <CheckCircle size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {pendingPayments.length > 3 && (
                <button 
                  onClick={() => { setActiveTab('tagihan'); showToast('Tinjau semua pembayaran tertunda di halaman Sesi.', 'info'); }}
                  className="w-full text-center text-[10px] font-black text-accent hover:opacity-80 pt-1 block"
                >
                  Lihat Semua
                </button>
              )}
            </div>
          )}
        </div>

        {/* ADMIN SECTION: CASH PAYMENTS VERIFICATION */}
        <div className="bg-card rounded-[24px] p-4.5 shadow-theme border border-border space-y-4 transition-all duration-200">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-wider text-primary">Pembayaran Cash Menunggu Verifikasi</h3>
            <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] px-2.5 py-0.5 rounded-full font-black border border-orange-500/20">
              {pendingCashPayments.length}
            </span>
          </div>

          {pendingCashPayments.length === 0 ? (
            <div className="text-center py-6 bg-background border border-dashed border-border rounded-2xl text-secondary text-xs font-bold">
              Tidak ada pembayaran cash pending.
            </div>
          ) : (
            <div className="space-y-3.5">
              {pendingCashPayments.slice(0, 3).map((p: any) => {
                const member = members.find((m: any) => m.id === p.member_id);
                const session = sessions.find((s: any) => s.id === p.session_id);
                return (
                  <div key={p.id} className="flex justify-between items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-xs flex-shrink-0">
                        {getInitials(member?.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-xs text-primary truncate">{member?.name || 'Anggota'}</p>
                          <span className="bg-emerald-500/10 text-accent border border-emerald-500/20 text-[7px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider flex-shrink-0">
                            CASH
                          </span>
                        </div>
                        <p className="text-[9px] text-secondary font-bold truncate mt-0.5">
                          {session?.nama_sesi || 'Sesi Game'} • {p.tanggal_bayar ? formatDate(p.tanggal_bayar) : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-black text-orange-600 dark:text-orange-400 mr-1">{formatRp(p.nominal_tagihan)}</span>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={async () => {
                            await verifyPayment(p.id, 'rejected');
                            showToast('Pembayaran cash ditolak.', 'info');
                          }}
                          className="p-1 text-red-500 hover:bg-red-500/10 rounded-xl border border-red-500/20 flex items-center justify-center"
                          title="Tolak Pembayaran"
                        >
                          <XCircle size={14} />
                        </button>
                        <button 
                          onClick={async () => {
                            await verifyPayment(p.id, 'verified');
                            showToast('Pembayaran cash berhasil diverifikasi!', 'success');
                          }}
                          className="p-1 text-accent hover:bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center"
                          title="Verifikasi Pembayaran"
                        >
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {pendingCashPayments.length > 3 && (
                <button 
                  onClick={() => { setActiveTab('tagihan'); showToast('Tinjau semua pembayaran tertunda di halaman Sesi.', 'info'); }}
                  className="w-full text-center text-[10px] font-black text-accent hover:opacity-80 pt-1 block"
                >
                  Lihat Semua
                </button>
              )}
            </div>
          )}
        </div>

        {/* RECENT SESSIONS VIEW */}
        <div className="bg-card rounded-[24px] p-4.5 shadow-theme border border-border space-y-4 transition-all duration-200">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-wider text-primary">Daftar Sesi Terkini</h3>
            <button onClick={() => setActiveTab('tagihan')} className="text-[10px] font-black text-accent hover:opacity-80">
              Lihat semua &gt;
            </button>
          </div>

          <div className="space-y-3">
            {sessions.slice(0, 3).map((s: any, idx: number) => {
              const attendeeCount = attendees.filter((a: any) => a.session_id === s.id).length;
              const isGenerated = s.status_tagihan === 'generated';
              
              // Dynamic colors for index icons
              const colors = [
                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                'bg-purple-500/10 text-purple-600 dark:text-purple-400'
              ];
              const iconColor = colors[idx % colors.length];

              return (
                <div 
                  key={s.id} 
                  onClick={() => {
                    setActiveTab('tagihan');
                    setSelectedSessionId(s.id);
                  }}
                  className="flex justify-between items-center gap-3 p-2 bg-background/50 hover:bg-background border border-border/30 hover:border-border/80 rounded-2xl cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${iconColor} flex items-center justify-center flex-shrink-0`}>
                      <Calendar size={16} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-primary truncate">{s.nama_sesi}</p>
                      <p className="text-[9px] text-secondary font-bold truncate mt-1 flex items-center gap-1.5">
                        <span>{formatDate(s.tanggal_main)}</span>
                        <span>•</span>
                        <span>{s.lokasi}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Users size={9} /> {attendeeCount} Hadir</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2 flex-shrink-0">
                    <div className="space-y-1">
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider inline-block ${
                        isGenerated 
                          ? 'bg-emerald-500/15 text-accent border border-emerald-500/20' 
                          : 'bg-background border border-border/30 text-secondary'
                      }`}>
                        {isGenerated ? 'Generated' : 'Draft'}
                      </span>
                      <p className="text-xs font-black text-primary">
                        {isGenerated ? formatRp(s.biaya_per_orang) : '-'}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-secondary" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* REVIEW PAYMENT MODAL */}
        {reviewPayment && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setReviewPayment(null)}>
            <div className="bg-card rounded-[24px] border border-border p-5 max-w-sm w-full relative overflow-hidden shadow-theme flex flex-col gap-4 animate-scaleUp transition-colors duration-200" onClick={e => e.stopPropagation()}>
              <button onClick={() => setReviewPayment(null)} className="absolute top-4 right-4 p-2 bg-background border border-border/30 text-secondary hover:text-primary rounded-full transition-colors">
                <XCircle size={18} />
              </button>
              <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider mb-1 pr-10">Tinjau Pembayaran</h3>
              
              <div className="bg-background/50 p-4 rounded-2xl border border-border space-y-2.5 text-xs text-primary transition-colors duration-200">
                <div className="flex justify-between"><span className="text-secondary font-medium">Nama Anggota:</span> <span className="font-bold text-primary">{members.find((m: any) => m.id === reviewPayment.member_id)?.name || 'Anggota'}</span></div>
                <div className="flex justify-between"><span className="text-secondary font-medium">Sesi:</span> <span className="font-bold text-primary truncate w-32 text-right">{sessions.find((s: any) => s.id === reviewPayment.session_id)?.nama_sesi || 'Sesi Game'}</span></div>
                <div className="flex justify-between"><span className="text-secondary font-medium">Nominal:</span> <span className="font-bold text-accent">{formatRp(reviewPayment.nominal_tagihan)}</span></div>
                <div className="flex justify-between"><span className="text-secondary font-medium">Tanggal Bayar:</span> <span className="font-bold text-primary">{reviewPayment.tanggal_bayar ? formatDate(reviewPayment.tanggal_bayar) : '-'}</span></div>
              </div>

              <div className="bg-background rounded-2xl overflow-hidden aspect-[4/3] border border-border flex items-center justify-center relative bg-black/40">
                {reviewPayment.bukti_transfer ? (
                  <img src={reviewPayment.bukti_transfer} alt="Bukti Transfer" className="w-full h-full object-contain cursor-pointer" onClick={() => setViewProofUrl(reviewPayment.bukti_transfer)} />
                ) : (
                  <span className="text-secondary text-xs font-bold italic">Tidak ada lampiran bukti transfer</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <button 
                  onClick={async () => {
                    await verifyPayment(reviewPayment.id, 'rejected');
                    setReviewPayment(null);
                    showToast('Pembayaran ditolak.', 'info');
                  }}
                  className="w-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-505 dark:text-red-400 font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98]"
                >
                  Tolak
                </button>
                <button 
                  onClick={async () => {
                    await verifyPayment(reviewPayment.id, 'verified');
                    setReviewPayment(null);
                    showToast('Pembayaran berhasil disetujui!', 'success');
                  }}
                  className="w-full bg-accent hover:opacity-90 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] shadow-md shadow-emerald-500/10"
                >
                  Setujui
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MEMBER DASHBOARD UI
  return (
    <div className="space-y-6 animate-fadeIn pb-6">
      
      {/* PWA INSTALLATION BANNER */}
      {isInstallable && (
        <div className="bg-card border border-border p-4 rounded-3xl flex justify-between items-center shadow-theme animate-bounce transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 text-accent rounded-xl flex items-center justify-center border border-accent/20">
              <span className="text-lg">📱</span>
            </div>
            <div>
              <p className="font-extrabold text-xs text-primary">Instal Aplikasi SI-PATRA</p>
              <p className="text-[9px] text-secondary font-semibold mt-0.5">Akses instan dari Home Screen Anda</p>
            </div>
          </div>
          <button 
            onClick={handleInstallPWA}
            className="bg-accent hover:opacity-90 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-[0.97]"
          >
            Install
          </button>
        </div>
      )}

      {/* MAIN CASH CARD */}
      <div className="bg-gradient-to-br from-[#064E3B] to-[#0D9488] rounded-[24px] p-6 text-white shadow-xl relative overflow-hidden">
        {/* Shuttlecock SVG watermark */}
        <div className="absolute bottom-0 right-0 w-36 h-36 opacity-[0.12] pointer-events-none transform translate-x-4 translate-y-4">
          <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full text-white">
            <path d="M 62 62 L 15 25 C 22 15, 45 8, 55 20 L 72 52 Z" />
            <line x1="63" y1="61" x2="20" y2="28" stroke="currentColor" strokeWidth="0.8" />
            <line x1="65" y1="59" x2="28" y2="21" stroke="currentColor" strokeWidth="0.8" />
            <line x1="67" y1="57" x2="38" y2="16" stroke="currentColor" strokeWidth="0.8" />
            <line x1="69" y1="55" x2="48" y2="15" stroke="currentColor" strokeWidth="0.8" />
            <line x1="71" y1="53" x2="58" y2="20" stroke="currentColor" strokeWidth="0.8" />
            <path d="M 32 37 C 38 28, 48 23, 58 29" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <path d="M 45 47 C 50 39, 58 35, 66 40" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <path d="M 61 61 C 59 63, 61 67, 65 69 C 69 67, 71 63, 69 61 Z" />
            <path d="M 65 67 C 70 72, 80 80, 83 75 C 86 70, 78 60, 73 55 Z" />
          </svg>
        </div>
        
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-emerald-100">
            <Wallet size={16} strokeWidth={2.2} />
            <span className="text-[10px] font-black uppercase tracking-wider">TOTAL PEMBAYARAN SAYA</span>
          </div>
          <button 
            onClick={() => setActiveTab('tagihan')}
            className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-full text-[10px] font-black text-white flex items-center gap-0.5 transition-all"
          >
            Tagihan Saya <ChevronRight size={10} strokeWidth={3} />
          </button>
        </div>

        <h2 className="text-4xl font-[900] tracking-tight mb-7">
          {formatRp(myTotalPaidAmount)}
        </h2>

        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-800 shadow-sm flex-shrink-0">
              <Calendar size={14} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-emerald-200 text-[8px] font-black uppercase tracking-wider leading-none truncate">Sesi Diikuti</p>
              <p className="font-extrabold text-[11px] text-white mt-1">
                {myPayments.length} Game
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-accent shadow-sm flex-shrink-0">
              <CheckCircle size={14} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-emerald-200 text-[8px] font-black uppercase tracking-wider leading-none truncate">Lunas</p>
              <p className="font-extrabold text-[11px] text-white mt-1">
                {myPaidCount} Sesi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm flex-shrink-0">
              <Clock size={14} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-emerald-200 text-[8px] font-black uppercase tracking-wider leading-none truncate">Menunggu Verifikasi</p>
              <p className="font-extrabold text-[11px] text-white mt-1">
                {myPendingCount} Sesi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MEMBER SECTION: MY BILLS SUMMARY & HISTORY */}
      <div className="space-y-4">
        <h3 className="font-black text-xs uppercase tracking-wider text-primary">Menunggu Verifikasi Pembayaran</h3>
        
        {myActiveBills.length === 0 ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[20px] p-5 text-center flex flex-col items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
              <CheckCircle size={28} className="text-accent animate-pulse" />
            </div>
            <div>
              <p className="font-black text-sm text-primary">Hebat! Iuran Anda Lunas</p>
              <p className="text-[10px] text-secondary mt-0.5">Semua tagihan kehadiran sesi Anda telah diselesaikan.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {myActiveBills.map((p: any) => {
              const session = sessions.find((s: any) => s.id === p.session_id);
              const isRejected = p.status_pembayaran === 'rejected';
              const isCashPending = p.status_pembayaran === 'Menunggu Verifikasi Cash';
              return (
                <div key={p.id} className={`bg-card p-4 rounded-[20px] border shadow-theme transition-all duration-200 flex justify-between items-center gap-3 ${isRejected ? 'border-red-500/30 bg-red-500/5' : isCashPending ? 'border-orange-500/30 bg-orange-500/5' : 'border-border'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-sm text-primary truncate">{session?.nama_sesi || 'Sesi Badminton'}</p>
                    <div className="flex items-center gap-1.5 text-secondary mt-1">
                      <Calendar size={11} />
                      <span className="text-[10px] font-bold">{formatDate(session?.tanggal_main || '')}</span>
                    </div>
                    <p className="text-sm font-black text-red-505 dark:text-red-404 mt-1">{formatRp(p.nominal_tagihan)}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1.5">
                    {p.status_pembayaran === 'verified' || p.status_pembayaran === 'paid' || p.status_pembayaran === 'lunas' ? (
                      <span className="bg-emerald-500/15 text-accent border border-emerald-500/20 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                        🟢 Lunas
                      </span>
                    ) : p.status_pembayaran === 'rejected' ? (
                      <span className="bg-red-500/15 text-red-500 border border-red-500/35 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                        🔴 Ditolak
                      </span>
                    ) : p.status_pembayaran === 'generated' || p.status_pembayaran === 'unpaid' ? (
                      <span className="bg-background text-secondary border border-border text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                        ⚪ Belum Bayar
                      </span>
                    ) : (
                      <span className="bg-orange-500/15 text-orange-500 border border-orange-500/20 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                        🟡 Menunggu Verifikasi Bendahara
                      </span>
                    )}
                    
                    {(p.status_pembayaran === 'generated' || p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'rejected') && (
                      <button 
                        onClick={() => setSelectedPayment(p)}
                        className="px-4 py-1.5 bg-accent hover:opacity-90 text-white font-extrabold rounded-xl text-[10px] transition-all active:scale-[0.97]"
                      >
                        Bayar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT SESSIONS VIEW */}
      <div className="bg-card rounded-[24px] p-4.5 shadow-theme border border-border space-y-4 transition-all duration-200">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-xs uppercase tracking-wider text-primary">Daftar Sesi Terkini</h3>
          <button onClick={() => setActiveTab('tagihan')} className="text-[10px] font-black text-accent hover:opacity-80">
            Lihat semua &gt;
          </button>
        </div>

        <div className="space-y-3">
          {sessions.slice(0, 3).map((s: any, idx: number) => {
            const attendeeCount = attendees.filter((a: any) => a.session_id === s.id).length;
            const isGenerated = s.status_tagihan === 'generated';
            
            const colors = [
              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              'bg-blue-500/10 text-blue-600 dark:text-blue-400',
              'bg-purple-500/10 text-purple-600 dark:text-purple-400'
            ];
            const iconColor = colors[idx % colors.length];

            return (
              <div 
                key={s.id} 
                className="flex justify-between items-center gap-3 p-2 bg-background/50 border border-border/30 rounded-2xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl ${iconColor} flex items-center justify-center flex-shrink-0`}>
                    <Calendar size={16} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-xs text-primary truncate">{s.nama_sesi}</p>
                    <p className="text-[9px] text-secondary font-bold truncate mt-1 flex items-center gap-1.5">
                      <span>{formatDate(s.tanggal_main)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5"><Users size={9} /> {attendeeCount} Hadir</span>
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2 flex-shrink-0">
                  <div className="space-y-1">
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider inline-block ${
                      isGenerated 
                        ? 'bg-emerald-500/15 text-accent border border-emerald-500/20' 
                        : 'bg-background border border-border/30 text-secondary'
                    }`}>
                      {isGenerated ? 'Generated' : 'Draft'}
                    </span>
                    <p className="text-xs font-black text-primary">
                      {isGenerated ? formatRp(s.biaya_per_orang) : '-'}
                    </p>
                  </div>
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
  showAddSessionModal, setShowAddSessionModal, addSession, saveAttendance, addSessionExpense, deleteSessionExpense, generateBillsForSession, verifyPayment, setViewProofUrl,
  markAsPaidCashDirectly, deleteSession, updateSession, deletePayment, deleteAttendanceRecord, setConfirmModal
}: any) {
  const [openMenuSessionId, setOpenMenuSessionId] = useState<number | null>(null);
  const [editingSession, setEditingSession] = useState<any | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenuSessionId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);
  
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

  const handleEditSessionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSession) return;
    const fd = new FormData(e.currentTarget);
    updateSession(editingSession.id, {
      nama_sesi: fd.get('nama_sesi') as string,
      tanggal_main: fd.get('tanggal_main') as string,
      jam_main: fd.get('jam_main') as string,
      lokasi: fd.get('lokasi') as string,
      catatan: fd.get('catatan') as string
    });
    setEditingSession(null);
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
        <h2 className="text-lg font-black tracking-wide text-primary uppercase">Manajemen Sesi</h2>
        <button 
          onClick={() => setShowAddSessionModal(true)} 
          className="flex items-center gap-1 text-xs bg-accent hover:opacity-90 text-white px-3.5 py-2 rounded-xl font-bold transition-all shadow-md active:scale-[0.98]"
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
            <div key={s.id} className="bg-card rounded-3xl border border-border shadow-theme overflow-hidden transition-all duration-200">
              
              {/* SESSION BRIEF CARD */}
              <div 
                onClick={() => setSelectedSessionId(isSelected ? null : s.id)}
                className="p-4 flex justify-between items-center cursor-pointer select-none hover:bg-background/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider inline-block mb-1.5 ${
                    s.status_tagihan === 'generated' 
                      ? 'bg-emerald-500/15 text-accent border border-emerald-500/20' 
                      : 'bg-background text-secondary border border-border/30'
                  }`}>
                    {s.status_tagihan === 'generated' ? 'Tagihan Terbit' : 'Draft Sesi'}
                  </span>
                  <h3 className="font-extrabold text-sm text-primary truncate">{s.nama_sesi}</h3>
                  <div className="flex flex-wrap items-center gap-3.5 mt-2 text-[10px] text-secondary font-semibold">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(s.tanggal_main)}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} /> {s.lokasi}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Split Cost</p>
                    <p className="text-sm font-black text-accent mt-0.5">{s.status_tagihan === 'generated' ? formatRp(s.biaya_per_orang) : '-'}</p>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuSessionId(openMenuSessionId === s.id ? null : s.id);
                      }}
                      className="p-1 hover:bg-background rounded-lg text-secondary hover:text-primary transition-colors flex items-center justify-center"
                      title="Menu Aksi"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenuSessionId === s.id && (
                      <div className="absolute right-0 mt-1 w-28 bg-card border border-border rounded-xl shadow-theme z-40 overflow-hidden py-1 animate-scaleUp">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuSessionId(null);
                            setEditingSession(s);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-primary hover:bg-background/80 flex items-center gap-2 transition-colors"
                        >
                          <Edit size={13} className="text-secondary" /> Edit
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuSessionId(null);
                            setConfirmModal({
                              isOpen: true,
                              title: 'Hapus Sesi',
                              message: 'Yakin ingin menghapus sesi ini?',
                              listItems: [
                                'session_attendees (catatan kehadiran)',
                                'session_expenses (rincian biaya sesi)',
                                'generated bills/payments related to this session (tagihan & pembayaran)'
                              ],
                              onConfirm: () => deleteSession(s.id)
                            });
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition-colors border-t border-border/45"
                        >
                          <Trash2 size={13} className="text-red-500" /> Hapus
                        </button>
                      </div>
                    )}
                  </div>
                  <ChevronDown size={18} className={`text-secondary transition-transform duration-250 ${isSelected ? 'transform rotate-180 text-accent' : ''}`} />
                </div>
              </div>

              {/* EXPANDED DETAILS */}
              {isSelected && (
                <div className="border-t border-border bg-background/20 p-4 space-y-5 transition-all duration-200">
                  
                  <div className="text-xs bg-card rounded-2xl p-3 border border-border space-y-1.5 transition-colors duration-200">
                    <p className="flex justify-between"><span className="text-secondary font-medium">Waktu Main:</span> <span className="font-bold text-primary">{s.jam_main}</span></p>
                    {s.catatan && <p className="flex justify-between"><span className="text-secondary font-medium">Catatan:</span> <span className="font-bold text-primary">{s.catatan}</span></p>}
                  </div>

                  {/* 1. ATTENDANCE CHECKS */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-secondary flex items-center justify-between">
                      <span>Kehadiran Peserta</span>
                      <span className="bg-card text-secondary text-[10px] px-2 py-0.5 rounded-md border border-border/40">{sAttendees.length} Hadir</span>
                    </h4>
                    
                    {s.status_tagihan === 'draft' ? (
                      <div className="bg-background border border-border rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 hide-scrollbar transition-colors duration-200">
                        {members.filter((m: any) => m.role === 'member' && m.status === 'aktif').map((m: any) => {
                          const isChecked = sAttendees.some((a: any) => a.member_id === m.id);
                          return (
                            <label key={m.id} className="flex items-center gap-2.5 p-1.5 hover:bg-card rounded-lg cursor-pointer transition-colors text-xs font-semibold">
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => {
                                  const currentIds = sAttendees.map((a: any) => a.member_id);
                                  if (isChecked) {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: 'Hapus Kehadiran',
                                      message: `Yakin ingin menghapus catatan kehadiran untuk ${m.name}?`,
                                      onConfirm: async () => {
                                        const newIds = currentIds.filter(id => id !== m.id);
                                        await saveAttendance(s.id, newIds);
                                      }
                                    });
                                  } else {
                                    saveAttendance(s.id, [...currentIds, m.id]);
                                  }
                                }}
                                className="w-4.5 h-4.5 rounded text-accent focus:ring-accent/10 bg-card border-border accent-accent" 
                              />
                              <span className={isChecked ? 'text-accent font-bold' : 'text-secondary'}>{m.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {sAttendees.map((a: any) => {
                          const mName = members.find((m: any) => m.id === a.member_id)?.name || 'Anggota';
                          return (
                            <span key={a.id} className="bg-emerald-500/10 text-accent border border-emerald-500/15 text-[10px] font-bold pl-2.5 pr-1.5 py-1 rounded-full flex items-center gap-1.5">
                              <Check size={10} strokeWidth={3} /> 
                              <span>{mName}</span>
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Hapus Kehadiran',
                                    message: `Yakin ingin menghapus catatan kehadiran untuk ${mName}?`,
                                    onConfirm: () => deleteAttendanceRecord(s.id, a.member_id)
                                  });
                                }}
                                className="text-accent/60 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-red-500/10 flex items-center justify-center"
                                title="Hapus Kehadiran"
                              >
                                <XCircle size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. EXPENSES */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-secondary flex items-center justify-between">
                      <span>Rincian Biaya Sesi</span>
                      <span className="text-red-500 font-extrabold">{formatRp(totalExps)}</span>
                    </h4>

                    {sExpenses.length === 0 ? (
                      <p className="text-[10px] text-secondary font-bold italic text-center py-2 bg-background/40 rounded-xl border border-border">
                        Belum ada biaya pengeluaran sesi dicatat.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sExpenses.map((exp: any) => (
                          <div key={exp.id} className="bg-background p-2.5 rounded-xl border border-border/60 flex justify-between items-center text-xs">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-extrabold text-primary truncate">{exp.keterangan}</p>
                              <span className="text-[8px] bg-card border border-border/30 text-secondary font-bold px-1.5 py-0.5 rounded mt-1 inline-block">{exp.kategori}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-primary">{formatRp(exp.nominal)}</span>
                              {s.status_tagihan === 'draft' && (
                                <button 
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: 'Hapus Pengeluaran',
                                      message: 'Yakin ingin menghapus pengeluaran ini?',
                                      onConfirm: () => deleteSessionExpense(exp.id)
                                    });
                                  }} 
                                  className="text-red-500 hover:text-red-400 p-1 hover:bg-background rounded-lg transition-colors"
                                  title="Hapus Pengeluaran"
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
                      <form onSubmit={(e) => handleAddExpenseInline(e, s.id)} className="bg-background border border-border/80 p-3 rounded-2xl space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            name="keterangan" 
                            type="text" 
                            required 
                            placeholder="Contoh: Lapangan (2 Jam)" 
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-card border border-border focus:border-accent focus:ring-1 focus:ring-accent/15 outline-none text-primary placeholder:text-secondary" 
                          />
                          <input 
                            name="nominal" 
                            type="number" 
                            required 
                            placeholder="Nominal (Rp)" 
                            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-card border border-border focus:border-accent focus:ring-1 focus:ring-accent/15 outline-none text-primary placeholder:text-secondary" 
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <select 
                            name="kategori" 
                            className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-card border border-border focus:border-accent focus:ring-1 focus:ring-accent/15 outline-none text-primary appearance-none flex-1"
                          >
                            <option value="Sewa Lapangan">Sewa Lapangan</option>
                            <option value="Peralatan">Peralatan (Kok, dll)</option>
                            <option value="Konsumsi">Konsumsi</option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                          <button 
                            type="submit" 
                            className="px-4 py-1.5 bg-card hover:bg-background border border-border/40 text-primary font-extrabold rounded-lg text-[10px] flex items-center gap-1 transition-all"
                          >
                            <Plus size={11} /> Catat
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* 3. ACTIONS MODULE */}
                  <div className="pt-2 border-t border-border">
                    {s.status_tagihan === 'draft' ? (
                      <div className="space-y-3">
                        <div className="bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-2xl text-xs flex justify-between items-center">
                          <div>
                            <p className="text-secondary font-semibold">Simulasi Biaya:</p>
                            <p className="text-[10px] text-secondary mt-0.5">
                              {formatRp(totalExps)} / {sAttendees.length} orang
                            </p>
                          </div>
                          <span className="text-sm font-black text-accent">
                            {sAttendees.length > 0 ? formatRp(Math.round(totalExps / sAttendees.length)) : 'Rp 0'}
                          </span>
                        </div>
                        <button 
                          onClick={() => generateBillsForSession(s.id)}
                          className="w-full py-3.5 bg-accent hover:opacity-90 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
                        >
                          <TrendingUp size={14} /> Terbitkan Tagihan Sesi
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-bold text-xs uppercase tracking-wider text-secondary">Status Bayar Peserta</p>
                          <span className="text-[10px] font-black text-accent bg-emerald-500/10 px-2 py-0.5 rounded">
                            {lunasCount}/{sAttendees.length} Lunas
                          </span>
                        </div>

                        <div className="w-full bg-background rounded-full h-1.5 border border-border/45 overflow-hidden">
                          <div 
                            className="bg-accent h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${sAttendees.length > 0 ? (lunasCount / sAttendees.length) * 100 : 0}%` }}
                          ></div>
                        </div>

                        <div className="space-y-2 mt-3.5">
                          {sPayments.map((p: any) => {
                            const mName = members.find((m: any) => m.id === p.member_id)?.name || 'Anggota';
                            const isVerified = p.status_pembayaran === 'verified';
                            const isUploaded = p.status_pembayaran === 'uploaded';
                            const isRejected = p.status_pembayaran === 'rejected';
                            const isCashPending = p.status_pembayaran === 'Menunggu Verifikasi Cash';
                            
                            return (
                              <div key={p.id} className="bg-background p-2.5 rounded-xl border border-border/60 flex justify-between items-center gap-2 text-xs">
                                <div className="min-w-0 flex-1">
                                  <p className="font-extrabold text-primary truncate">{mName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {p.bukti_transfer === 'CASH' ? (
                                      <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[7px] font-black px-1 py-0.2 rounded uppercase tracking-wider">
                                        CASH
                                      </span>
                                    ) : p.bukti_transfer || isUploaded ? (
                                      <span className="bg-emerald-500/10 text-accent border border-emerald-500/20 text-[7px] font-black px-1 py-0.2 rounded uppercase tracking-wider">
                                        QRIS
                                      </span>
                                    ) : null}
                                    
                                    <span className={`text-[8px] font-black uppercase tracking-wider ${
                                      isVerified ? 'text-accent' : 
                                      isCashPending ? 'text-orange-500 animate-pulse' :
                                      isUploaded ? 'text-blue-500 animate-pulse' : 
                                      isRejected ? 'text-red-500' : 'text-secondary'
                                    }`}>
                                      {isVerified ? 'Lunas' : 
                                       isCashPending ? 'Menunggu Verifikasi Cash' :
                                       isUploaded ? 'Uploaded (Verifikasi)' : 
                                       isRejected ? 'Ditolak' : 'Belum Bayar'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {(p.status_pembayaran === 'pending' || p.status_pembayaran === 'Menunggu Verifikasi Cash' || p.status_pembayaran === 'rejected') && (
                                    <button 
                                      onClick={() => {
                                        setConfirmModal({
                                          isOpen: true,
                                          title: 'Hapus Tagihan Pending',
                                          message: `Yakin ingin menghapus tagihan pending untuk ${mName}?`,
                                          onConfirm: () => deletePayment(p.id)
                                        });
                                      }}
                                      className="p-1 text-red-500 hover:bg-red-500/10 rounded border border-red-500/20 flex items-center justify-center"
                                      title="Hapus Tagihan Pending"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                  {isUploaded && p.bukti_transfer && p.bukti_transfer !== 'CASH' && (
                                    <button 
                                      onClick={() => setViewProofUrl(p.bukti_transfer)}
                                      className="px-2 py-1 bg-card border border-border/40 hover:bg-background text-primary text-[9px] font-extrabold rounded-md transition-colors"
                                    >
                                      Bukti
                                    </button>
                                  )}
                                  {(isUploaded || isCashPending) && (
                                    <div className="flex gap-1">
                                      <button 
                                        onClick={() => verifyPayment(p.id, 'rejected')}
                                        className="p-1 text-red-500 hover:bg-red-500/10 rounded border border-red-500/20"
                                        title="Tolak Pembayaran"
                                      >
                                        <XCircle size={13} />
                                      </button>
                                      <button 
                                        onClick={() => verifyPayment(p.id, 'verified')}
                                        className="p-1 text-accent hover:bg-emerald-500/10 rounded border border-emerald-500/20"
                                        title="Verifikasi Pembayaran"
                                      >
                                        <CheckCircle size={13} />
                                      </button>
                                    </div>
                                  )}
                                  {!isVerified && (
                                    <button 
                                      onClick={() => markAsPaidCashDirectly(p.id)}
                                      className="px-2 py-1 bg-orange-500/10 text-orange-550 border border-orange-500/20 hover:bg-orange-500/20 rounded text-[9px] font-black transition-colors"
                                    >
                                      ✓ Bayar Cash
                                    </button>
                                  )}
                                  {isVerified && (
                                    <CheckCircle size={15} className="text-accent border border-emerald-500/10 p-0.5 rounded-full" />
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
          <div className="bg-card w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-6 relative border border-border shadow-theme animate-slide-up transition-colors duration-200">
            <button onClick={() => setShowAddSessionModal(false)} className="absolute top-5 right-5 p-2 bg-background border border-border/45 text-secondary hover:text-primary rounded-full transition-colors">
              <XCircle size={18} />
            </button>
            <h3 className="text-base font-black text-primary uppercase tracking-wide mb-6">Tambah Sesi Baru</h3>
            
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Nama Sesi</label>
                <input required name="nama_sesi" type="text" placeholder="Contoh: Badminton Minggu Pagi" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Tanggal Main</label>
                  <input required name="tanggal_main" type="date" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Jam Main</label>
                  <input required name="jam_main" type="text" placeholder="08:00 - 10:00" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Lokasi</label>
                <input required name="lokasi" type="text" placeholder="GOR Badminton Utama" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Catatan (Optional)</label>
                <textarea name="catatan" placeholder="Catatan opsional..." rows={2} className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs resize-none"></textarea>
              </div>
              <button type="submit" className="w-full bg-accent hover:opacity-90 text-white font-extrabold py-3.5 rounded-2xl mt-4 transition-all shadow-lg active:scale-[0.98] text-xs">
                Buat Sesi & Tandai Hadir
              </button>
            </form>
          </div>
        </div>
      )}
      {/* EDIT SESSION MODAL */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4">
          <div className="bg-card w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-6 relative border border-border shadow-theme animate-slide-up transition-colors duration-200" onClick={e => e.stopPropagation()}>
            <button onClick={() => setEditingSession(null)} className="absolute top-5 right-5 p-2 bg-background border border-border/45 text-secondary hover:text-primary rounded-full transition-colors">
              <XCircle size={18} />
            </button>
            <h3 className="text-base font-black text-primary uppercase tracking-wide mb-6">Edit Sesi</h3>
            
            <form onSubmit={handleEditSessionSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Nama Sesi</label>
                <input required name="nama_sesi" defaultValue={editingSession.nama_sesi} type="text" placeholder="Contoh: Badminton Minggu Pagi" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Tanggal Main</label>
                  <input required name="tanggal_main" defaultValue={editingSession.tanggal_main} type="date" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Jam Main</label>
                  <input required name="jam_main" defaultValue={editingSession.jam_main} type="text" placeholder="08:00 - 10:00" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Lokasi</label>
                <input required name="lokasi" defaultValue={editingSession.lokasi} type="text" placeholder="GOR Badminton Utama" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Catatan (Optional)</label>
                <textarea name="catatan" defaultValue={editingSession.catatan || ''} placeholder="Catatan opsional..." rows={2} className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs resize-none"></textarea>
              </div>
              <button type="submit" className="w-full bg-accent hover:opacity-90 text-white font-extrabold py-3.5 rounded-2xl mt-4 transition-all shadow-lg active:scale-[0.98] text-xs">
                Simpan Perubahan
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
  user, sessions, payments, settings, selectedPayment, setSelectedPayment, submitPaymentWithProof, submitCashPayment 
}: any) {
  
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'CASH'>('QRIS');
  const [showConfirmCash, setShowConfirmCash] = useState(false);

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

  const handleConfirmCash = async () => {
    if (!currentPayment) return;
    setIsUploading(true);
    try {
      await submitCashPayment(currentPayment.id);
      setToastMessage('Pembayaran Cash ditandai! Menunggu verifikasi Bendahara.');
      setShowConfirmCash(false);
      setSelectedPayment(null);
      setPaymentMethod('QRIS');
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err: any) {
      console.error(err);
      setToastError(err.message || 'Gagal menandai pembayaran cash.');
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
    setPaymentMethod('QRIS');
    setShowConfirmCash(false);
  };

  const myPayments = user ? payments.filter((p: any) => p.member_id === user.id) : [];

  return (
    <div className="space-y-4">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-card text-primary px-5 py-3.5 rounded-full shadow-theme z-50 text-xs font-bold flex items-center gap-2 border border-border animate-bounce">
          <CheckCircle size={15} className="text-emerald-400" /> {toastMessage}
        </div>
      )}
      {toastError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-655 text-white px-5 py-3.5 rounded-full shadow-2xl z-50 text-xs font-bold flex items-center gap-2 border border-red-500 animate-shake">
          <XCircle size={15} className="text-white" /> {toastError}
        </div>
      )}

      <h2 className="text-lg font-black tracking-wide text-primary uppercase mb-2">Tagihan Sesi Saya</h2>

      {myPayments.length === 0 ? (
        <div className="text-center p-8 bg-card border border-dashed border-border rounded-3xl text-secondary text-xs font-bold">
          Anda tidak memiliki tagihan sesi badminton.
        </div>
      ) : (
        <div className="space-y-4">
          {myPayments.map((p: any) => {
            const session = sessions.find((s: any) => s.id === p.session_id);
            const isVerified = p.status_pembayaran === 'verified';
            const isUploaded = p.status_pembayaran === 'uploaded';
            const isRejected = p.status_pembayaran === 'rejected';
            const isCashPending = p.status_pembayaran === 'Menunggu Verifikasi Cash';
            
            return (
              <div key={p.id} className="bg-card rounded-3xl border border-border shadow-theme overflow-hidden">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-355 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        Sesi Kehadiran
                      </span>
                      {p.bukti_transfer === 'CASH' ? (
                        <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          CASH
                        </span>
                      ) : p.bukti_transfer || isUploaded ? (
                        <span className="bg-emerald-500/10 text-accent border border-emerald-500/20 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          QRIS
                        </span>
                      ) : null}
                    </div>
                    <span className={`text-[8px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider ${
                      isVerified ? 'bg-emerald-500/20 text-emerald-355 border border-emerald-500/30' :
                      isRejected ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      p.status_pembayaran === 'generated' || p.status_pembayaran === 'unpaid'
                        ? 'bg-background text-secondary border border-border'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse'
                    }`}>
                      {isVerified ? '🟢 Lunas' : 
                       isRejected ? '🔴 Ditolak' : 
                       p.status_pembayaran === 'generated' || p.status_pembayaran === 'unpaid' ? '⚪ Belum Bayar' : 
                       '🟡 Menunggu Verifikasi Bendahara'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-primary leading-snug">{session?.nama_sesi}</h3>
                  <div className="flex items-center justify-between mt-4 text-xs">
                    <div className="flex items-center gap-1.5 text-secondary font-bold">
                      <Calendar size={13} />
                      <span>{formatDate(session?.tanggal_main || '')}</span>
                    </div>
                    <div className="font-black text-primary text-base">{formatRp(p.nominal_tagihan)}</div>
                  </div>
                </div>

                {(p.status_pembayaran === 'generated' || p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'rejected') && (
                  <div className="bg-background/30 px-5 py-4 border-t border-border flex justify-between items-center">
                    <button 
                      onClick={() => setSelectedPayment(p)} 
                      className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20"
                    >
                      <QrCode size={15} />
                      Bayar Sekarang
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL QRIS & STATUS */}
      {currentPayment && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-[2.5rem] overflow-hidden border border-border shadow-theme flex flex-col animate-scale-up">
            
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
                  <h4 className="text-base font-black text-primary tracking-tight">
                    {currentPayment.status_pembayaran === 'verified' ? 'Pembayaran Terverifikasi' : 'Bukti Pembayaran Dikirim'}
                  </h4>
                  <p className="text-[10px] font-bold text-secondary leading-relaxed px-4">
                    {currentPayment.status_pembayaran === 'verified'
                      ? 'Terima kasih! Pembayaran Anda telah terverifikasi oleh Bendahara PB.'
                      : 'Bukti transfer berhasil diunggah. Sedang menunggu konfirmasi/verifikasi dari admin.'}
                  </p>
                </div>

                <div className="w-full bg-background border border-border rounded-2xl p-4 text-left space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-secondary uppercase tracking-wider">Nominal</span>
                    <span className="text-primary">{formatRp(currentPayment.nominal_tagihan)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-secondary uppercase tracking-wider">Tanggal Upload</span>
                    <span className="text-primary">{currentPayment.tanggal_bayar ? formatDate(currentPayment.tanggal_bayar) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-secondary uppercase tracking-wider">Status</span>
                    <span>
                      {currentPayment.status_pembayaran === 'verified' ? (
                        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-black">Lunas</span>
                      ) : (
                        <span className="bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-black">Menunggu Verifikasi</span>
                      )}
                    </span>
                  </div>
                </div>

                <button onClick={handleCloseModal} className="w-full bg-background hover:bg-border/60 text-primary font-extrabold py-3.5 rounded-2xl border border-border transition-all text-xs active:scale-[0.98]">
                  Tutup Rincian
                </button>
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center gap-5">
                <div className="text-center">
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">Nominal Transfer</p>
                  <p className="text-2xl font-black text-emerald-450 tracking-tight">{formatRp(currentPayment.nominal_tagihan)}</p>
                </div>

                {/* Payment Method Selector */}
                <div className="w-full space-y-2 border-b border-border/50 pb-4 mb-1">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider text-left">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center justify-center gap-2 p-3 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === 'QRIS'
                        ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-450 font-bold'
                        : 'border-border bg-background text-secondary hover:bg-background/80'
                    }`}>
                      <input 
                        type="radio" 
                        name="payment_method" 
                        value="QRIS" 
                        checked={paymentMethod === 'QRIS'} 
                        onChange={() => setPaymentMethod('QRIS')} 
                        className="sr-only" 
                      />
                      <QrCode size={14} />
                      <span className="text-xs">QRIS</span>
                    </label>

                    <label className={`flex items-center justify-center gap-2 p-3 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === 'CASH'
                        ? 'border-orange-500 bg-orange-500/5 text-orange-600 dark:text-orange-450 font-bold'
                        : 'border-border bg-background text-secondary hover:bg-background/80'
                    }`}>
                      <input 
                        type="radio" 
                        name="payment_method" 
                        value="CASH" 
                        checked={paymentMethod === 'CASH'} 
                        onChange={() => setPaymentMethod('CASH')} 
                        className="sr-only" 
                      />
                      <Wallet size={14} />
                      <span className="text-xs">CASH</span>
                    </label>
                  </div>
                </div>

                {paymentMethod === 'QRIS' ? (
                  <>
                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-3.5 w-full text-center space-y-1">
                      <span className="text-[8px] font-black tracking-wider uppercase bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/25 inline-block">QRIS STATIS</span>
                      <p className="text-[10px] font-bold text-amber-400 leading-snug">
                        Masukkan nominal <span className="font-black text-emerald-450">{formatRp(currentPayment.nominal_tagihan)}</span> saat melakukan scan pembayaran.
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-[2rem] border border-border shadow-inner w-48 h-48 flex items-center justify-center relative overflow-hidden">
                      {settings?.qris_image_url ? (
                        <img src={settings.qris_image_url} alt="QRIS Code" className="w-full h-full object-contain rounded-2xl" />
                      ) : (
                        <div className="text-center p-4">
                          <QrCode size={36} className="text-secondary mx-auto mb-2" />
                          <p className="text-[9px] font-bold text-secondary">QRIS Admin Belum Diunggah</p>
                        </div>
                      )}
                    </div>

                    <div className="w-full space-y-3">
                      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="hidden" />
                      
                      {!selectedFile ? (
                        <button onClick={triggerFilePicker} className="w-full border border-dashed border-border hover:border-accent/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 bg-background/40 hover:bg-background transition-colors">
                          <Upload size={20} className="text-secondary" />
                          <span className="text-[10px] font-bold text-primary">Pilih Bukti Transfer Pembayaran</span>
                          <span className="text-[8px] text-secondary">Format: JPG, PNG, WEBP (Maks 5MB)</span>
                        </button>
                      ) : (
                        <div className="border border-border rounded-2xl p-3 bg-background/50 flex items-center gap-3 w-full">
                          {previewUrl && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-background flex-shrink-0">
                              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-extrabold text-primary truncate">{selectedFile.name}</p>
                            <p className="text-[9px] text-secondary font-semibold">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                          <button onClick={handleCancelFile} disabled={isUploading} className="p-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0 disabled:opacity-50">
                            <XCircle size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      {isUploading ? (
                        <button disabled className="w-full bg-background text-secondary font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-border cursor-not-allowed text-xs">
                          <RefreshCw size={14} className="animate-spin" /> Mengirim Bukti...
                        </button>
                      ) : selectedFile ? (
                        <button onClick={handleUpload} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98]">
                          <CheckCircle size={14} /> Kirim Bukti Transfer
                        </button>
                      ) : (
                        <button onClick={triggerFilePicker} className="w-full bg-background hover:bg-border/60 text-primary font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] border border-border">
                          <Upload size={14} /> {currentPayment.status_pembayaran === 'rejected' ? 'Pilih Bukti Baru' : 'Saya Sudah Bayar'}
                        </button>
                      )}
                    </div>

                    {settings && (
                      <div className="w-full border-t border-border pt-3.5 text-center space-y-1">
                        <p className="text-[8px] font-black text-secondary uppercase tracking-widest">Atas Nama Rekening</p>
                        <p className="text-xs font-black text-primary">{settings.nama_komunitas}</p>
                        <p className="text-[10px] font-bold text-secondary bg-background py-1 px-3 rounded-lg inline-block border border-border mt-1">{settings.rekening_penerima}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-full text-center py-5 space-y-2 bg-orange-500/5 border border-orange-500/15 rounded-2xl">
                      <h4 className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">Pembayaran Tunai</h4>
                      <p className="text-[10px] font-bold text-secondary px-4 leading-relaxed">
                        Bayar langsung kepada Bendahara.
                      </p>
                    </div>

                    <div className="w-full">
                      {isUploading ? (
                        <button disabled className="w-full bg-background text-secondary font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-border cursor-not-allowed text-xs">
                          <RefreshCw size={14} className="animate-spin" /> Memproses...
                        </button>
                      ) : (
                        <button 
                          onClick={() => setShowConfirmCash(true)}
                          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] shadow-md shadow-orange-950/20"
                        >
                          Tandai Sudah Bayar Cash
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal overlay for CASH */}
      {showConfirmCash && currentPayment && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-[2rem] border border-border p-6 shadow-theme flex flex-col gap-4 animate-scaleUp">
            <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider text-center">
              Konfirmasi Pembayaran Cash
            </h3>
            
            <div className="bg-background/50 p-4 rounded-2xl border border-border space-y-2.5 text-xs text-primary">
              <div className="flex justify-between">
                <span className="text-secondary font-medium">Nama:</span> 
                <span className="font-bold text-primary">{user?.name || 'Anggota'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary font-medium">Nominal:</span> 
                <span className="font-bold text-accent">{formatRp(currentPayment.nominal_tagihan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary font-medium">Metode:</span> 
                <span className="font-bold text-orange-500 dark:text-orange-400">Cash</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button 
                onClick={() => setShowConfirmCash(false)}
                className="w-full border border-border bg-background text-primary font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98]"
              >
                Batalkan
              </button>
              <button 
                onClick={async () => {
                  await handleConfirmCash();
                }}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] shadow-md shadow-orange-950/20"
              >
                Konfirmasi
              </button>
            </div>
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
      <div className="bg-card rounded-[2rem] p-6 text-center border border-border shadow-theme relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 text-secondary">
          <Activity size={100} />
        </div>
        <p className="text-secondary text-xs font-bold uppercase tracking-wider mb-1">Total Saldo Kas</p>
        <h2 className="text-3xl font-black text-emerald-450 tracking-tight">{formatRp(saldoKas)}</h2>
        
        <div className="flex gap-4 border-t border-border pt-4 mt-5 text-left">
          <div className="flex-1">
            <p className="text-secondary text-[9px] font-bold uppercase">Total Tagihan Lunas</p>
            <p className="font-extrabold text-xs text-primary">{formatRp(totalIncome)}</p>
          </div>
          <div className="w-px bg-border"></div>
          <div className="flex-1">
            <p className="text-secondary text-[9px] font-bold uppercase">Total Biaya Sesi</p>
            <p className="font-extrabold text-xs text-primary">{formatRp(totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-black text-primary uppercase tracking-wider">Histori Biaya Sesi</h2>
        
        {sessionExpenses.length === 0 ? (
          <div className="text-center p-8 bg-card border border-dashed border-border rounded-3xl text-secondary text-xs font-bold">
            Belum ada pengeluaran kas dicatat.
          </div>
        ) : (
          <div className="space-y-3">
            {[...sessionExpenses].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((exp: any) => {
              const session = sessions.find((s: any) => s.id === exp.session_id);
              return (
                <div key={exp.id} className="bg-card p-4 rounded-2xl border border-border flex items-center gap-3.5 shadow-theme">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Wallet size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-xs text-primary truncate">{exp.keterangan}</p>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-secondary font-bold">
                      <span className="bg-background text-secondary px-1.5 py-0.5 rounded">{exp.kategori}</span>
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
function MembersList({ 
  members, 
  isSuperAdmin, 
  isAdmin, 
  resetUserPassword, 
  changeUserRole, 
  changeUserStatus, 
  deleteMember, 
  createAccountBySuperadmin 
}: any) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states for creating a new user
  const [newIdDosen, setNewIdDosen] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // States for managing an existing user
  const [manageRole, setManageRole] = useState('');
  const [manageStatus, setManageStatus] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!/^\d{5}$/.test(newIdDosen)) {
      setFormError('ID Dosen harus terdiri dari 5 digit angka.');
      return;
    }
    if (!newName.trim()) {
      setFormError('Nama lengkap harus diisi.');
      return;
    }
    
    setIsCreating(true);
    const success = await createAccountBySuperadmin(newName, newIdDosen, newPhone, newRole);
    setIsCreating(false);
    
    if (success) {
      setShowAddModal(false);
      setNewIdDosen('');
      setNewName('');
      setNewPhone('');
      setNewRole('member');
    }
  };

  const handleOpenManage = (user: any) => {
    if (!isSuperAdmin && user.role !== 'member') {
      return;
    }
    setSelectedUser(user);
    setManageRole(user.role);
    setManageStatus(user.status);
    setShowManageModal(true);
  };

  const handleApplyChanges = async () => {
    if (!selectedUser) return;
    
    if (isSuperAdmin && manageRole !== selectedUser.role) {
      if (selectedUser.user_id) {
        await changeUserRole(selectedUser.user_id, selectedUser.id, manageRole);
      } else {
        await supabase.from('members').update({ role: manageRole }).eq('id', selectedUser.id);
      }
    }

    if (manageStatus !== selectedUser.status) {
      await changeUserStatus(selectedUser.id, manageStatus);
    }

    setShowManageModal(false);
    setSelectedUser(null);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black text-primary uppercase tracking-wider">Daftar Anggota</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-secondary">{members.length} Orang</span>
          {isSuperAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="py-1 px-3 bg-gradient-to-r from-[#1ED760] to-[#059669] text-white font-extrabold text-[10px] rounded-lg uppercase tracking-wider transition-all hover:opacity-90 active:scale-[0.97]"
            >
              + Tambah Akun
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {members.map((m: any) => {
          const canManage = isSuperAdmin || (isAdmin && m.role === 'member');
          
          return (
            <div key={m.id} className="bg-card p-4 rounded-2xl border border-border flex items-center gap-3.5 shadow-theme transition-all">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                m.role === 'superadmin'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : m.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {m.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-xs text-primary truncate flex items-center gap-1.5">
                  {m.name}
                  <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'aktif' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </p>
                <p className="text-[10px] text-secondary truncate mt-0.5">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                  m.role === 'superadmin'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : m.role === 'admin' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-background text-secondary border border-border'
                }`}>
                  {m.role === 'superadmin' ? 'SUPERADMIN' : m.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA'}
                </span>
                
                {canManage && (
                  <button
                    onClick={() => handleOpenManage(m)}
                    className="p-1.5 bg-background border border-border hover:border-accent rounded-lg text-secondary hover:text-accent transition-colors"
                    title="Kelola Pengguna"
                  >
                    <Edit size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL TAMBAH AKUN */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowAddModal(false)}>
          <div className="bg-card rounded-[28px] p-6 max-w-sm w-full shadow-theme border border-border flex flex-col gap-4 animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              <h3 className="text-primary font-black text-base uppercase tracking-wider">Tambah Akun Baru</h3>
              <p className="text-xs text-secondary font-bold">Password awal adalah "sisteminformasi".</p>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 dark:border-red-900/30">
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">ID Dosen (5 Digit)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  required 
                  value={newIdDosen} 
                  onChange={e => setNewIdDosen(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 02975"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  required 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="Nama Lengkap"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">Nomor HP</label>
                <input 
                  type="text" 
                  required 
                  value={newPhone} 
                  onChange={e => setNewPhone(e.target.value)} 
                  placeholder="Contoh: 08123456789"
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">Role Akun</label>
                <select 
                  value={newRole} 
                  onChange={e => setNewRole(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs"
                >
                  <option value="member">Anggota (MEMBER)</option>
                  <option value="admin">Bendahara (ADMIN)</option>
                  <option value="superadmin">Superadmin (SUPERADMIN)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full border border-border bg-background text-secondary hover:text-primary font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98]"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-gradient-to-r from-[#1ED760] to-[#059669] text-white font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] disabled:opacity-60"
                >
                  {isCreating ? 'Membuat...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELOLA USER */}
      {showManageModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => { setShowManageModal(false); setSelectedUser(null); }}>
          <div className="bg-card rounded-[28px] p-6 max-w-sm w-full shadow-theme border border-border flex flex-col gap-4 animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-1 border-b border-border pb-3">
              <h3 className="text-primary font-black text-base uppercase tracking-wider">Kelola Pengguna</h3>
              <p className="text-xs text-secondary font-bold">{selectedUser.name}</p>
            </div>

            <div className="space-y-4">
              {isSuperAdmin && (
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">Role Akun</label>
                  <select 
                    value={manageRole} 
                    onChange={e => setManageRole(e.target.value)} 
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs"
                  >
                    <option value="member">Anggota (ANGGOTA)</option>
                    <option value="admin">Bendahara (BENDAHARA)</option>
                    <option value="superadmin">Superadmin (SUPERADMIN)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">Status Keaktifan</label>
                <select 
                  value={manageStatus} 
                  onChange={e => setManageStatus(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs"
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>

              {isSuperAdmin && selectedUser.user_id && (
                <div className="pt-2 border-t border-border space-y-2.5">
                  <p className="text-[9px] font-black text-secondary uppercase tracking-wider">Tindakan Khusus Superadmin</p>
                  
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`Reset password pengguna "${selectedUser.name}" ke "sisteminformasi"?`)) {
                        await resetUserPassword(selectedUser.user_id, selectedUser.name);
                        setShowManageModal(false);
                        setSelectedUser(null);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs rounded-xl transition-all"
                  >
                    <Key size={14} /> Reset Password ke Bawaan
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setShowManageModal(false);
                      await deleteMember(selectedUser.id, selectedUser.user_id);
                      setSelectedUser(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-xl transition-all"
                  >
                    <Trash2 size={14} /> Hapus Pengguna
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <button 
                type="button"
                onClick={() => { setShowManageModal(false); setSelectedUser(null); }}
                className="w-full border border-border bg-background text-secondary hover:text-primary font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98]"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleApplyChanges}
                className="w-full bg-primary text-background font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98]"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
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
      <div className="flex items-center gap-4 bg-card p-5 rounded-3xl border border-border shadow-theme">
        <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center font-black text-xl shadow-inner">
          {profile.nama.charAt(0)}
        </div>
        <div>
          <h3 className="font-black text-base text-primary">{profile.nama}</h3>
          <p className="text-xs text-secondary font-bold mt-0.5">{profile.email}</p>
          <span className={`inline-block mt-2 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
            profile.role === 'superadmin'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : profile.role === 'admin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}>
            {profile.role === 'superadmin' ? 'SUPERADMIN' : profile.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA'}
          </span>
        </div>
      </div>

      <div className="bg-card p-5 rounded-3xl border border-border shadow-theme space-y-4">
        <h4 className="font-black text-xs uppercase tracking-wider text-secondary">Edit Profil</h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1.5">Nama Lengkap</label>
            <input 
              type="text" 
              required 
              value={nama} 
              onChange={e => setNama(e.target.value)} 
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1.5">Nomor Handphone</label>
            <input 
              type="text" 
              value={nomorHp} 
              onChange={e => setNomorHp(e.target.value)} 
              placeholder="08123456789" 
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
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
function SettingsAdmin({ 
  settings, 
  updateSettings, 
  setConfirmModal, 
  cleanupTestData, 
  cleanupMemberAccounts,
  isSuperAdmin,
  softDeletedItems,
  restoreSoftDeletedItem,
  executeHardDeleteFromTrash
}: any) {
  const [namaKomunitas, setNamaKomunitas] = useState(settings?.nama_komunitas || '');
  const [rekeningPenerima, setRekeningPenerima] = useState(settings?.rekening_penerima || '');
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisPreview, setQrisPreview] = useState<string | null>(settings?.qris_image_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTrashTab, setActiveTrashTab] = useState<'session' | 'payment' | 'member'>('session');

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
    <div className="bg-card p-5 rounded-3xl border border-border shadow-theme space-y-6 animate-fadeIn">
      <div className="space-y-4">
        <h2 className="text-sm font-black text-primary uppercase tracking-wider mb-2">Pengaturan Komunitas</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1.5">Nama Komunitas</label>
            <input 
              type="text" 
              required 
              value={namaKomunitas} 
              onChange={e => setNamaKomunitas(e.target.value)} 
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1.5">Informasi Rekening Penerima</label>
            <input 
              type="text" 
              required 
              value={rekeningPenerima} 
              onChange={e => setRekeningPenerima(e.target.value)} 
              placeholder="Mandiri 1234567890 a.n Bendahara"
              className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1.5">QRIS Statis (Gambar)</label>
            
            <div className="flex flex-col items-center gap-4 p-4 border border-border rounded-2xl bg-background/40">
              {qrisPreview ? (
                <img src={qrisPreview} alt="QRIS Preview" className="w-40 h-40 object-contain rounded-xl bg-white p-2 border border-border" />
              ) : (
                <div className="w-40 h-40 border border-dashed border-border rounded-xl flex items-center justify-center text-secondary text-xs">
                  Belum ada QRIS
                </div>
              )}
              
              <label className="px-4 py-2 bg-background hover:bg-border text-[10px] font-black text-primary cursor-pointer border border-border flex items-center gap-1.5 transition-colors">
                <Upload size={12} /> Pilih Gambar QRIS Baru
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
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

      {/* KERANJANG SAMPAH (SUPERADMIN ONLY) */}
      {isSuperAdmin && (
        <div className="border border-border p-5 rounded-[24px] space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-primary font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Trash2 size={14} className="text-secondary" /> Keranjang Sampah (Trash Bin)
            </h3>
            <p className="text-[9px] text-secondary mt-1 font-bold">Pulihkan data soft-deleted atau hapus secara permanen.</p>
          </div>

          {/* TRASH TABS */}
          <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border">
            {(['session', 'payment', 'member'] as const).map(tab => {
              const count = tab === 'session' 
                ? softDeletedItems.sessions.length 
                : tab === 'payment' 
                  ? softDeletedItems.payments.length 
                  : softDeletedItems.members.length;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTrashTab(tab)}
                  className={`flex-1 py-1.5 text-center text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-all ${
                    activeTrashTab === tab
                      ? 'bg-card text-primary shadow-sm border border-border'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {tab === 'session' ? 'Sesi' : tab === 'payment' ? 'Bayar' : 'Anggota'} ({count})
                </button>
              );
            })}
          </div>

          {/* TRASH ITEMS LIST */}
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {activeTrashTab === 'session' && (
              softDeletedItems.sessions.length === 0 ? (
                <p className="text-[10px] text-secondary font-bold text-center py-4">Keranjang sampah sesi kosong.</p>
              ) : (
                softDeletedItems.sessions.map((item: any) => (
                  <div key={item.id} className="bg-background/40 p-3 rounded-xl border border-border flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-primary truncate">{item.data?.nama_sesi || 'Sesi Tanpa Nama'}</p>
                      <p className="text-[9px] text-secondary font-bold mt-0.5">{item.data?.tanggal_main} • {item.data?.jam_main}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => restoreSoftDeletedItem(item)}
                        className="py-1 px-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Pulihkan
                      </button>
                      <button
                        onClick={() => executeHardDeleteFromTrash(item)}
                        className="py-1 px-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {activeTrashTab === 'payment' && (
              softDeletedItems.payments.length === 0 ? (
                <p className="text-[10px] text-secondary font-bold text-center py-4">Keranjang sampah pembayaran kosong.</p>
              ) : (
                softDeletedItems.payments.map((item: any) => (
                  <div key={item.id} className="bg-background/40 p-3 rounded-xl border border-border flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-primary truncate">Tagihan: Rp{item.data?.nominal_tagihan?.toLocaleString('id-ID')}</p>
                      <p className="text-[9px] text-secondary font-bold mt-0.5">Status: {item.data?.status_pembayaran}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => restoreSoftDeletedItem(item)}
                        className="py-1 px-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Pulihkan
                      </button>
                      <button
                        onClick={() => executeHardDeleteFromTrash(item)}
                        className="py-1 px-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {activeTrashTab === 'member' && (
              softDeletedItems.members.length === 0 ? (
                <p className="text-[10px] text-secondary font-bold text-center py-4">Keranjang sampah anggota kosong.</p>
              ) : (
                softDeletedItems.members.map((item: any) => (
                  <div key={item.id} className="bg-background/40 p-3 rounded-xl border border-border flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-primary truncate">{item.data?.name}</p>
                      <p className="text-[9px] text-secondary font-bold mt-0.5">{item.data?.email}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => restoreSoftDeletedItem(item)}
                        className="py-1 px-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Pulihkan
                      </button>
                      <button
                        onClick={() => executeHardDeleteFromTrash(item)}
                        className="py-1 px-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* ZONA BAHAYA / DANGER ZONE */}
      <div className="border border-red-500/20 bg-red-500/5 p-5 rounded-[24px] space-y-4">
        <div>
          <h3 className="text-red-550 dark:text-red-500 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Trash2 size={14} /> Zona Bahaya (Danger Zone)
          </h3>
          <p className="text-[10px] text-secondary mt-1 font-bold leading-relaxed">
            Gunakan alat ini untuk membersihkan seluruh data transaksi uji coba sebelum onboard ke produksi. Tindakan ini akan menghapus semua sesi, tagihan, riwayat kehadiran, dan pengeluaran kas sesi secara permanen.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                title: 'Hapus Semua Data Transaksi',
                message: 'Apakah Anda yakin ingin menghapus seluruh data transaksi? Tindakan ini akan menghapus secara permanen:',
                listItems: [
                  'Semua data sesi badminton',
                  'Semua tagihan & bukti pembayaran',
                  'Semua daftar kehadiran (absen)',
                  'Semua rincian pengeluaran kas sesi'
                ],
                onConfirm: async () => {
                  await cleanupTestData();
                }
              });
            }}
            className="w-full bg-red-600 hover:bg-red-550 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md shadow-red-950/25"
          >
            <AlertCircle size={14} />
            <span>Bersihkan Semua Data Transaksi</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                title: 'Hapus Semua Akun Member & Profil',
                message: 'Apakah Anda yakin ingin menghapus seluruh akun member dan profil? Tindakan ini akan menghapus secara permanen:',
                listItems: [
                  'Semua akun autentikasi member (auth.users)',
                  'Semua data profil public.profiles member',
                  'Semua data anggota public.members (non-admin)',
                  'Semua data transaksi (sesi, tagihan, kas, dll.) untuk menghindari data yatim'
                ],
                onConfirm: async () => {
                  await cleanupMemberAccounts();
                }
              });
            }}
            className="w-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/15 text-red-550 dark:text-red-500 font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Users size={14} />
            <span>Hapus Semua Akun Member & Profil</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- GANTI PASSWORD SCREEN ---
function ChangePasswordScreen({ session, onPasswordChanged }: { session: any; onPasswordChanged: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Belum diisi', color: 'bg-border', textColor: 'text-secondary' };
    if (pwd.length < 8) return { score: 1, label: 'Sangat Lemah (Min. 8 Karakter)', color: 'bg-red-500', textColor: 'text-red-500' };
    
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);

    if (pwd === 'sisteminformasi') {
      return { score: 1, label: 'Sangat Lemah (Password Bawaan)', color: 'bg-red-500', textColor: 'text-red-500' };
    }

    if (hasLetters && hasNumbers && (hasSpecial || hasUpper)) {
      return { score: 4, label: 'Kuat', color: 'bg-emerald-500', textColor: 'text-emerald-500' };
    }
    if (hasLetters && hasNumbers) {
      return { score: 3, label: 'Sedang', color: 'bg-amber-500', textColor: 'text-amber-500' };
    }
    return { score: 2, label: 'Lemah', color: 'bg-orange-500', textColor: 'text-orange-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('Password baru minimal 8 karakter.');
      return;
    }

    if (newPassword === 'sisteminformasi') {
      setErrorMsg('Password baru tidak boleh menggunakan password bawaan.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { password_changed: true }
      });

      if (error) throw error;

      setSuccessMsg('Password berhasil diperbarui.');
      setTimeout(() => {
        onPasswordChanged();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memperbarui password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  return (
    <div className="min-h-screen w-full md:bg-gradient-to-tr md:from-background md:via-card md:to-emerald-950/30 flex items-center justify-center p-0 md:p-8 font-sans overflow-hidden transition-colors duration-200">
      <div className="w-full h-screen md:h-[844px] md:w-[390px] md:rounded-[40px] md:shadow-theme md:border-[8px] md:border-border overflow-hidden flex flex-col relative transition-all justify-center items-center" style={{ background: 'var(--login-bg)' }}>
        
        {/* Court lines */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="stroke-emerald-800 stroke-[0.5] fill-none">
            <rect x="5" y="5" width="90" height="90" />
            <line x1="5" y1="35" x2="95" y2="35" />
            <line x1="5" y1="65" x2="95" y2="65" />
            <line x1="50" y1="5" x2="50" y2="95" />
          </svg>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center overflow-hidden w-full h-full relative z-10">
          <div className="w-full flex flex-col items-center justify-center animate-fadeIn">
            {/* Logo and title */}
            <img 
              src="/logo.png" 
              alt="Logo SI-PATRA" 
              className="w-[90px] h-[90px] object-contain mx-auto select-none"
              style={{ imageRendering: 'crisp-edges', WebkitImageRendering: 'crisp-edges' } as any}
            />

            <h1 className="text-[36px] font-[800] text-primary leading-none tracking-tight font-sans mt-[12px] text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              SI-PATRA
            </h1>

            <p className="text-accent text-[10px] font-[700] uppercase tracking-[3px] mt-[6px] text-center">
              SI BADMINTON & KAS
            </p>
            
            {/* Card wrapper */}
            <div className="bg-card rounded-[28px] border border-border shadow-theme p-[28px] mt-[28px] flex flex-col w-[86%] max-w-[420px] mx-auto transition-all duration-200">
              <h2 className="text-xl font-[800] text-primary text-center mb-2">Ganti Password</h2>
              <p className="text-xs text-secondary text-center mb-6 leading-relaxed">
                Demi keamanan akun, silakan ubah password bawaan Anda sebelum melanjutkan.
              </p>

              {errorMsg && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 dark:border-red-900/30 mb-4">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-emerald-100 dark:border-emerald-900/30 mb-4">
                  <CheckCircle size={14} className="flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
                {/* New Password Field */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-[700] text-primary tracking-[1px] uppercase mb-2 self-start">
                    PASSWORD BARU
                  </label>
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-[16px] flex items-center pointer-events-none text-accent">
                      <Lock size={18} strokeWidth={2} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="w-full h-full pl-[46px] pr-[46px] rounded-[16px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-[16px] flex items-center text-accent hover:text-[#059669] transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Strength Bar */}
                  {newPassword && (
                    <div className="mt-2.5 px-1">
                      <div className="flex justify-between items-center text-[10px] font-[700] mb-1">
                        <span className="text-secondary">Kekuatan:</span>
                        <span className={strength.textColor}>{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${strength.color}`} 
                          style={{ width: `${(strength.score / 4) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-[700] text-primary tracking-[1px] uppercase mb-2 self-start">
                    KONFIRMASI PASSWORD BARU
                  </label>
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-[16px] flex items-center pointer-events-none text-accent">
                      <Lock size={18} strokeWidth={2} />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full h-full pl-[46px] pr-[46px] rounded-[16px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-[16px] flex items-center text-accent hover:text-[#059669] transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || strength.score < 2}
                  className="w-full h-[52px] bg-gradient-to-r from-[#1ED760] to-[#059669] text-white font-[700] rounded-[16px] mt-2 transition-all shadow-[0_6px_20px_rgba(5,150,105,0.15)] active:scale-[0.98] text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </div>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      <span>Simpan Password</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Logout Footer Button */}
            <div className="mt-6 flex justify-center w-full">
              <button
                type="button"
                onClick={handleLogout}
                className="py-2 px-4 text-center text-secondary hover:text-red-500 text-xs font-[700] uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
              >
                <LogOut size={14} /> Keluar dari Akun
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:flex w-full py-2 justify-center bg-transparent z-20 select-none">
          <div className="w-24 h-1 bg-border rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

// --- SUPABASE AUTH SCREEN COMPONENT ---
function AuthScreen({ onLoginSuccess }: { onLoginSuccess: (userId: string) => Promise<void>; members: any }) {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Input fields
  const [idDosen, setIdDosen] = useState('');
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

  // Load saved ID Dosen on mount if rememberMe was previously active
  useEffect(() => {
    const savedIdDosen = localStorage.getItem('sipatra_remember_iddosen');
    if (savedIdDosen) {
      setIdDosen(savedIdDosen);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!/^\d{5}$/.test(idDosen)) {
      setErrorMsg('ID Dosen harus terdiri dari 5 digit angka.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const email = `dosen${idDosen}@unpam.ac.id`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (data.session) {
        if (rememberMe) {
          localStorage.setItem('sipatra_remember_iddosen', idDosen);
        } else {
          localStorage.removeItem('sipatra_remember_iddosen');
        }
        await onLoginSuccess(data.session.user.id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal login. Periksa kembali ID Dosen dan password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!/^\d{5}$/.test(idDosen)) {
      setErrorMsg('ID Dosen harus terdiri dari 5 digit angka.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      const email = `dosen${idDosen}@unpam.ac.id`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nama: fullName,
            nomor_hp: phone,
            id_dosen: idDosen,
            password_changed: password !== 'sisteminformasi'
          }
        }
      });

      if (error) throw error;
      
      setSuccessMsg('Pendaftaran sukses! Silakan langsung masuk.');
      
      if (data.session) {
        await onLoginSuccess(data.session.user.id);
      } else {
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

    if (!/^\d{5}$/.test(idDosen)) {
      setErrorMsg('ID Dosen harus terdiri dari 5 digit angka.');
      return;
    }

    setIsSubmitting(true);

    try {
      const email = `dosen${idDosen}@unpam.ac.id`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
        <h1 className={`${compact ? 'text-[32px] mt-[10px]' : 'text-[44px] mt-[16px]'} font-[800] text-primary leading-none tracking-tight font-sans bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent`}>
          SI-PATRA
        </h1>

        {/* Subtitle */}
        <p className="text-accent text-[10px] font-[700] uppercase tracking-[4px] mt-[10px]">
          SI BADMINTON & KAS
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full md:bg-gradient-to-tr md:from-background md:via-card md:to-emerald-950/30 flex items-center justify-center p-0 md:p-8 font-sans overflow-hidden transition-colors duration-200">
      {/* Simulated Mobile Mockup Container */}
      <div className="w-full h-screen md:h-[844px] md:w-[390px] md:rounded-[40px] md:shadow-theme md:border-[8px] md:border-border overflow-hidden flex flex-col relative transition-all justify-center items-center" style={{ background: 'var(--login-bg)' }}>
        
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
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-accent opacity-[0.08] blur-3xl pointer-events-none z-0" />

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
        <div className="absolute -right-6 top-[2%] text-accent/[0.08] pointer-events-none transform rotate-[25deg] w-[180px] h-[180px] z-0">
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

              <h1 className="text-[44px] font-[800] text-primary leading-none tracking-tight font-sans mt-[16px] text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                SI-PATRA
              </h1>

              <p className="text-accent text-xs font-[700] uppercase tracking-[4px] mt-[10px] text-center">
                SI BADMINTON & KAS
              </p>
              
              {/* Card Section */}
              <div className="bg-card rounded-[28px] border border-border shadow-theme p-[32px] mt-[36px] flex flex-col w-[86%] max-w-[420px] mx-auto transition-all duration-200">
                {errorMsg && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 dark:border-red-900/30 line-clamp-1 mb-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-emerald-100 dark:border-emerald-900/30 line-clamp-1 mb-2">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col">
                  {/* ID Dosen Field */}
                  <div className="flex flex-col">
                    <label className="text-[11px] font-[700] text-primary tracking-[1px] uppercase mb-[12px] self-start">
                      ID DOSEN
                    </label>
                    <div className="relative h-[58px]">
                      <div className="absolute inset-y-0 left-0 pl-[18px] flex items-center pointer-events-none text-accent">
                        <UserIcon size={20} strokeWidth={2} />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={5}
                        required
                        value={idDosen}
                        onChange={e => setIdDosen(e.target.value.replace(/\D/g, ''))}
                        placeholder="Contoh: 02975"
                        className="w-full h-full pl-[52px] pr-4 rounded-[18px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-[15px] transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col mt-[24px]">
                    <label className="text-[11px] font-[700] text-primary tracking-[1px] uppercase mb-[12px] self-start">
                      PASSWORD
                    </label>
                    <div className="relative h-[58px]">
                      <div className="absolute inset-y-0 left-0 pl-[18px] flex items-center pointer-events-none text-accent">
                        <Lock size={20} strokeWidth={2} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Masukan password"
                        className="w-full h-full pl-[52px] pr-[52px] rounded-[18px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-[15px] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-[18px] flex items-center text-accent hover:text-[#059669] transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="flex items-center justify-between mt-[18px] px-[2px]">
                    <label className="flex items-center gap-[8px] cursor-pointer select-none text-secondary text-sm font-[500]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent h-[18px] w-[18px] transition-colors accent-accent"
                      />
                      <span className="text-secondary text-[14px]">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setSuccessMsg('');
                        setAuthMode('forgot');
                      }}
                      className="font-[700] text-accent hover:opacity-80 text-[14px] transition-colors"
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
                  <div className="h-[1px] flex-1 bg-border"></div>
                  <span className="text-[12px] font-[700] text-secondary tracking-widest uppercase">atau</span>
                  <div className="h-[1px] flex-1 bg-border"></div>
                </div>

                {/* Google Login */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full h-[56px] border border-border rounded-[18px] bg-card hover:opacity-90 text-primary font-[700] text-[15px] flex items-center justify-center gap-[10px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-60"
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
                <p className="text-[14px] text-secondary font-[500]">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      setAuthMode('register');
                    }}
                    className="text-accent hover:opacity-80 font-[700] transition-colors inline-flex items-center gap-0.5"
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
              <div className="bg-card rounded-[28px] border border-border shadow-theme p-[24px] mt-[24px] flex flex-col w-[86%] max-w-[420px] mx-auto transition-all duration-200">
                {errorMsg && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 dark:border-red-900/30 line-clamp-1 mb-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-emerald-100 dark:border-emerald-900/30 line-clamp-1 mb-2">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="flex flex-col gap-[14px]">
                  {/* Full Name */}
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-accent">
                      <UserIcon size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="w-full h-full pl-11 pr-4 rounded-[14px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-sm transition-all"
                    />
                  </div>

                  {/* ID Dosen */}
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-accent">
                      <UserIcon size={18} />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      required
                      value={idDosen}
                      onChange={e => setIdDosen(e.target.value.replace(/\D/g, ''))}
                      placeholder="ID Dosen (Contoh: 02975)"
                      className="w-full h-full pl-11 pr-4 rounded-[14px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-sm transition-all"
                    />
                  </div>

                  {/* Phone */}
                  <div className="relative h-[52px]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-accent">
                      <Smartphone size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Nomor Handphone"
                      className="w-full h-full pl-11 pr-4 rounded-[14px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-sm transition-all"
                    />
                  </div>

                  {/* Passwords grid */}
                  <div className="grid grid-cols-2 gap-[10px]">
                    {/* Password */}
                    <div className="relative h-[52px]">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-accent">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full h-full pl-9 pr-8 rounded-[14px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-accent hover:text-[#059669]"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Confirm Password */}
                    <div className="relative h-[52px]">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-accent">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Konfirmasi"
                        className="w-full h-full pl-9 pr-8 rounded-[14px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-accent hover:text-[#059669]"
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
                <p className="text-[14px] text-secondary font-[500]">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      setAuthMode('login');
                    }}
                    className="text-accent hover:opacity-80 font-[700] transition-colors"
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
              <div className="bg-card rounded-[28px] border border-border shadow-theme p-[32px] mt-[36px] flex flex-col w-[86%] max-w-[420px] mx-auto transition-all duration-200">
                {errorMsg && (
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 dark:border-red-900/30 line-clamp-1 mb-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-emerald-100 dark:border-emerald-900/30 line-clamp-1 mb-2">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span className="truncate">{successMsg}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                  {/* ID Dosen */}
                  <div className="relative h-[58px]">
                    <div className="absolute inset-y-0 left-0 pl-[18px] flex items-center pointer-events-none text-accent">
                      <UserIcon size={20} />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      required
                      value={idDosen}
                      onChange={e => setIdDosen(e.target.value.replace(/\D/g, ''))}
                      placeholder="Masukkan ID Dosen Anda (Contoh: 02975)"
                      className="w-full h-full pl-[52px] pr-4 rounded-[18px] bg-card border border-border focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none text-primary placeholder:text-secondary font-[500] text-[15px] transition-all"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-[58px] bg-primary text-background font-[700] rounded-[18px] transition-all shadow-theme active:scale-[0.98] text-[15px] flex items-center justify-center gap-1.5 disabled:opacity-60"
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
                  className="py-2.5 text-center text-secondary hover:text-primary text-xs font-[700] uppercase tracking-wider transition-colors inline-flex items-center gap-1 group"
                >
                  <span className="transition-transform group-hover:-translate-x-0.5">←</span> Kembali ke Login
                </button>
              </div>
            </div>
          )}

        </div>
        
        {/* Simulated Home Indicator */}
        <div className="hidden md:flex w-full py-2 justify-center bg-transparent z-20 select-none">
          <div className="w-24 h-1 bg-border rounded-full"></div>
        </div>
      </div>
    </div>
  );
}