import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Receipt, Wallet, 
  CheckCircle, Clock, XCircle, Plus, X, 
  LogOut, QrCode, Upload, Bell, ChevronRight, 
  User as UserIcon, Activity, Calendar, MapPin, 
  TrendingUp, TrendingDown, PlusCircle, DollarSign, AlertCircle, AlertTriangle, 
  ChevronDown, Check, RefreshCw, Key, Shield, UserCheck,
  Sun, Moon, Lock, Mail, Eye, EyeOff, Smartphone, MoreVertical, Trash2, Edit, Download, Camera, FileText
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { SessionReportTemplate } from './SessionReportTemplate';

// --- SUPABASE ERROR MAPPER ---
// Maps Supabase auth error messages to user-friendly Indonesian messages.
// Ensures no raw Supabase error is ever shown to the user.
function mapSupabaseError(err: any): string {
  const msg = (err?.message || err?.error_description || '').toLowerCase();
  const status = err?.status || err?.statusCode || 0;

  // Network / connectivity errors
  if (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('net::') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('timeout') ||
    msg.includes('offline') ||
    !navigator.onLine
  ) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.';
  }

  // Server errors (5xx)
  if (status >= 500 || msg.includes('internal server error') || msg.includes('server error')) {
    return 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.';
  }

  // Invalid credentials
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid email or password') ||
    msg.includes('invalid credentials') ||
    msg.includes('wrong password') ||
    msg.includes('unauthorized')
  ) {
    return 'ID Dosen atau Password yang Anda masukkan tidak sesuai. Silakan periksa kembali dan coba lagi.';
  }

  // Email not confirmed
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return 'Akun Anda belum dikonfirmasi. Silakan hubungi administrator.';
  }

  // User not found
  if (
    msg.includes('user not found') ||
    msg.includes('no user found') ||
    msg.includes('unable to validate email') ||
    msg.includes('user does not exist')
  ) {
    return 'Akun tidak ditemukan.';
  }

  // User banned / disabled
  if (
    msg.includes('user banned') ||
    msg.includes('user is banned') ||
    msg.includes('disabled') ||
    msg.includes('blocked')
  ) {
    return 'Akun Anda sedang dinonaktifkan. Silakan hubungi administrator.';
  }

  // Rate limiting
  if (
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('for security purposes')
  ) {
    return 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat sebelum mencoba lagi.';
  }

  // Email already registered (for registration)
  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already exists') ||
    msg.includes('duplicate')
  ) {
    return 'ID Dosen ini sudah terdaftar. Silakan gunakan ID Dosen lain atau login dengan akun yang sudah ada.';
  }

  // Weak password
  if (msg.includes('weak password') || msg.includes('password should be')) {
    return 'Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.';
  }

  // Session expired
  if (
    msg.includes('session expired') ||
    msg.includes('refresh_token') ||
    msg.includes('token expired') ||
    msg.includes('jwt expired')
  ) {
    return 'Sesi Anda telah berakhir. Silakan login kembali.';
  }

  // Catch-all: never expose raw Supabase messages
  return 'Terjadi kesalahan. Silakan coba lagi.';
}

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
  avatar_url?: string | null;
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
  biaya_lapangan?: number;
  kas_wajib_per_orang?: number;
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

interface BillingNotification {
  paymentId: number;
  sessionId: number;
  sessionName: string;
  amount: number;
  createdAt: string;
}

// --- UTILITIES ---
const formatRp = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
};

/**
 * Sumber kebenaran tunggal untuk menghitung biaya sewa lapangan sebuah sesi.
 * Selalu membaca dari session_expenses dengan kategori 'Sewa Lapangan' atau 'Lapangan'.
 * Fallback ke s.biaya_lapangan hanya jika sama sekali tidak ada data di session_expenses.
 */
const KATEGORI_LAPANGAN = ['Sewa Lapangan', 'Lapangan'];

const getSewaLapangan = (s: any, sExpenses: any[]): number => {
  const fromExpenses = sExpenses
    .filter((e: any) => KATEGORI_LAPANGAN.includes(e.kategori))
    .reduce((acc: number, e: any) => acc + e.nominal, 0);
  // Jika ada data di session_expenses, gunakan itu (sumber paling akurat)
  if (fromExpenses > 0) return fromExpenses;
  // Fallback ke kolom sessions.biaya_lapangan untuk sesi lama yang mungkin belum punya expense record
  return s?.biaya_lapangan ?? 0;
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

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 150;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        const minSize = Math.min(img.width, img.height);
        const startX = (img.width - minSize) / 2;
        const startY = (img.height - minSize) / 2;
        ctx.drawImage(img, startX, startY, minSize, minSize, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
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
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  useEffect(() => {
    if (profile?.avatar_url) {
      setProfilePhoto(profile.avatar_url);
    } else {
      setProfilePhoto(null);
    }
  }, [profile]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('#recovery'))) {
      setIsRecoveringPassword(true);
    }
  }, []);
  
  // Database states
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [sessionExpenses, setSessionExpenses] = useState<SessionExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Pengaturan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Financial config state
  const [iuranKasConfig, setIuranKasConfig] = useState<number>(() => {
    const saved = localStorage.getItem('sipatra_iuran_kas');
    return saved ? parseInt(saved) : 5000;
  });

  // Tambah Kas Modal states
  const [showAddKasModal, setShowAddKasModal] = useState(false);
  const [txJenis, setTxJenis] = useState<'masuk' | 'keluar'>('masuk');
  const [txTanggal, setTxTanggal] = useState('');
  const [txKategori, setTxKategori] = useState('');
  const [txNominal, setTxNominal] = useState('');
  const [txKeterangan, setTxKeterangan] = useState('');
  const [editingTx, setEditingTx] = useState<any>(null);

  // Notification read-state (localStorage-backed, no DB needed)
  const [readNotificationIds, setReadNotificationIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('sipatra_read_notifications');
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  useEffect(() => {
    localStorage.setItem('sipatra_read_notifications', JSON.stringify([...readNotificationIds]));
  }, [readNotificationIds]);

  const markNotificationsRead = (ids: number[]) => {
    if (ids.length === 0) return;
    setReadNotificationIds(prev => new Set([...prev, ...ids]));
  };

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

  const resetUserPassword = async (userId: string, userName: string): Promise<{ success: boolean; error?: string }> => {
    // Guard: hanya Superadmin yang boleh menggunakan fitur ini
    if (profile?.role !== 'superadmin') {
      const msg = 'Akses Ditolak: Hanya Superadmin yang dapat mereset password.';
      showToast(`❌ ${msg}`, 'error');
      return { success: false, error: msg };
    }
    try {
      setIsLoading(true);

      console.log(`[Reset Password] Memanggil Edge Function untuk userId: ${userId} (${userName})`);

      // Panggil Supabase Edge Function — Admin API dijalankan di server (AMAN)
      // Service role key tidak pernah ada di frontend
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId, userName },
      });

      // Tampilkan response lengkap dari Edge Function (data dan error)
      console.log('[Reset Password] Edge Function response data:', JSON.stringify(data));
      console.log('[Reset Password] Edge Function response error:', JSON.stringify(error));

      if (error) {
        // Error dari jaringan / Edge Function tidak dapat diakses
        console.error('[Reset Password] Edge Function invoke error:', error);
        const errMsg = error?.message || JSON.stringify(error) || 'Gagal menghubungi Edge Function';
        return { success: false, error: errMsg };
      }

      if (!data?.success) {
        // Edge Function berhasil diakses, tapi operasi di dalamnya gagal
        const errMsg = data?.error || 'Gagal mereset password (Edge Function mengembalikan kegagalan)';
        console.error('[Reset Password] Edge Function returned failure:', errMsg);
        return { success: false, error: errMsg };
      }

      // Hanya sukses jika data.success === true
      console.log('[Reset Password] SUCCESS: Password berhasil direset untuk userId:', userId);
      return { success: true };
    } catch (e: any) {
      console.error('[Reset Password] Unexpected error:', e);
      const errMsg = e?.message || e?.error_description || JSON.stringify(e) || 'Terjadi kesalahan tidak diketahui.';
      return { success: false, error: errMsg };
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
            detectSessionInUrl: false,
            storageKey: 'sipatra-temp-signup-storage',
            storage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {}
            }
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
        // ── UPSERT profile — atomic, no race condition, no duplicates possible ──
        //    onConflict:'id' means if a row with this auth UUID already exists
        //    (e.g. from a Supabase trigger), it is updated in-place rather than
        //    inserting a second row.
        const { error: profileUpsertErr } = await supabase
          .from('profiles')
          .upsert(
            {
              id: signUpData.user.id,
              nama: name,
              email: targetEmail,
              nomor_hp: phone,
              role: roleVal,
            },
            { onConflict: 'id', ignoreDuplicates: false }
          );
        if (profileUpsertErr) throw profileUpsertErr;

        // ── UPSERT member — same pattern, keyed on user_id ────────────────────
        const { data: existingMember } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', signUpData.user.id)
          .maybeSingle();
        if (existingMember) {
          await supabase
            .from('members')
            .update({ role: roleVal, name: name, email: targetEmail, status: 'aktif' })
            .eq('user_id', signUpData.user.id);
        } else {
          await supabase.from('members').insert({
            name: name,
            email: targetEmail,
            role: roleVal,
            status: 'aktif',
            user_id: signUpData.user.id,
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
      const hasHistory = attendees.some(a => Number(a.member_id) === Number(memberId)) || payments.some(p => Number(p.member_id) === Number(memberId));

      setConfirmModal({
        isOpen: true,
        title: 'Hapus Anggota (Soft/Hard)',
        message: `Pilih metode tindakan untuk pengguna "${memberObj?.name}":`,
        listItems: [
          `Nama: ${memberObj?.name}`,
          `Role: ${memberObj?.role === 'superadmin' ? 'SUPERADMIN' : memberObj?.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA'}`
        ],
        showSoftDeleteOption: true,
        hardDeleteDisabled: hasHistory,
        hardDeleteDisabledMessage: 'Pengguna memiliki histori data dan tidak dapat dihapus permanen.',
        onSoftConfirm: async () => {
          try {
            const { error } = await supabase
              .from('members')
              .update({ status: 'nonaktif' })
              .eq('id', memberId);
            if (error) throw error;
            
            setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'nonaktif' } : m));
            showToast('✅ Pengguna berhasil dinonaktifkan', 'success');
          } catch (e: any) {
            showToast(`❌ Gagal menonaktifkan: ${e.message}`, 'error');
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

      // Step 1: Delete from auth.users via secure RPC (SECURITY DEFINER)
      const { error: rpcError } = await supabase.rpc('admin_delete_user', { target_user_id: userId });
      if (rpcError) throw rpcError;

      // Step 2: Explicitly delete from public.members — no CASCADE FK exists from
      // auth.users to public.members, so we must do this manually.
      const { error: memberError } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId);
      if (memberError) console.warn('members delete warning:', memberError.message);

      // Step 3: Explicitly delete from public.profiles (same reason as above)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (profileError) console.warn('profiles delete warning:', profileError.message);

      // Step 4: Sync local state and re-fetch to ensure UI matches database
      setMembers(prev => prev.filter(m => m.id !== memberId));
      await fetchData();

      showToast('✅ Akun berhasil dihapus secara permanen', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(`❌ Gagal hapus: ${e.message}`, 'error');
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

  // Lifted state and form inputs for adding member accounts (Superadmin action)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newIdDosen, setNewIdDosen] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [memberFormError, setMemberFormError] = useState('');

  // FAB bottom sheet menu state
  const [showFabActionMenu, setShowFabActionMenu] = useState(false);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberFormError('');
    if (!/^\d{5}$/.test(newIdDosen)) {
      setMemberFormError('ID Dosen harus terdiri dari 5 digit angka.');
      return;
    }
    if (!newName.trim()) {
      setMemberFormError('Nama lengkap harus diisi.');
      return;
    }
    
    setIsCreatingMember(true);
    const success = await createAccountBySuperadmin(newName, newIdDosen, newPhone, newRole);
    setIsCreatingMember(false);
    
    if (success) {
      setShowAddMemberModal(false);
      setNewIdDosen('');
      setNewName('');
      setNewPhone('');
      setNewRole('member');
    }
  };

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
    hardDeleteDisabled?: boolean;
    hardDeleteDisabledMessage?: string;
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
      // ── Step 1: Resolve the authenticated user's email ──────────────────────
      let actualEmail = userEmail;
      if (!actualEmail) {
        const { data: { user } } = await supabase.auth.getUser();
        actualEmail = user?.email || '';
      }

      // ── Step 2: Fetch existing profile (maybeSingle — never throws on 0 rows) ─
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      let finalProfile = profileData;

      // ── Step 3: If no profile exists, create it via UPSERT (idempotent) ─────
      //    Using upsert with onConflict:'id' means concurrent calls are safe —
      //    only one row will ever be written regardless of how many times this
      //    function fires (login, refresh, session restore, etc.).
      if (!profileData) {
        const { data: upsertedProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: userId,
              email: actualEmail,
              nama: actualEmail.split('@')[0],
              nomor_hp: '',
              role: 'member',
            },
            { onConflict: 'id', ignoreDuplicates: true }
          )
          .select()
          .maybeSingle();

        if (upsertError) throw upsertError;
        finalProfile = upsertedProfile;
      }

      // ── Step 4: Auto-migrate superadmin account ───────────────────────────────
      if (
        finalProfile &&
        (actualEmail === 'dosen02975@unpam.ac.id' || finalProfile.email === 'dosen02975@unpam.ac.id') &&
        finalProfile.role !== 'superadmin'
      ) {
        const { error: profileUpdateErr } = await supabase
          .from('profiles')
          .update({ role: 'superadmin', email: 'dosen02975@unpam.ac.id' })
          .eq('id', userId);

        if (!profileUpdateErr) {
          finalProfile = { ...finalProfile, role: 'superadmin', email: 'dosen02975@unpam.ac.id' };
        }

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

      if (memberData && memberData.status === 'nonaktif') {
        await supabase.auth.signOut();
        setProfile(null);
        setMemberRecord(null);
        setSession(null);
        setIsLoading(false);
        showToast('❌ Akun Anda dinonaktifkan. Silakan hubungi admin.', 'error');
        return;
      }

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

      // Fetch avatar_url from profiles for each member that has a user_id
      const userIds = (membersData || []).map((m: any) => m.user_id).filter(Boolean);
      let avatarMap: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', userIds);
        (profilesData || []).forEach((p: any) => {
          avatarMap[p.id] = p.avatar_url ?? null;
        });
      }

      // Merge avatar_url into each member object
      const membersWithAvatar = (membersData || []).map((m: any) => ({
        ...m,
        avatar_url: m.user_id ? (avatarMap[m.user_id] ?? null) : null,
      }));
      setMembers(membersWithAvatar.filter((m: any) => m.status !== 'soft_deleted'));

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
            detectSessionInUrl: false,
            storageKey: 'sipatra-temp-checkpwd-storage',
            storage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {}
            }
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
    // Self-healing database check to ensure profiles.avatar_url exists
    const ensureAvatarColumn = async () => {
      try {
        await supabase.rpc('check_and_create_avatar_url_column');
      } catch (err) {
        console.warn('RPC check_and_create_avatar_url_column not available. Checking schema fallback...', err);
        try {
          const { error: selectError } = await supabase
            .from('profiles')
            .select('avatar_url')
            .limit(1);
          if (selectError && selectError.message.includes('avatar_url')) {
            console.error('PENTING: Kolom "avatar_url" tidak ada pada tabel "profiles".');
          }
        } catch (selectErr) {
          console.error('Error verifying profiles schema:', selectErr);
        }
      }
    };
    ensureAvatarColumn();

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
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (sessionStorage.getItem('sipatra_is_registering') === 'true') {
        sessionStorage.removeItem('sipatra_is_registering');
        await supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
      }
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

    // Real-time sync for profiles.avatar_url changes
    // When any user updates their profile photo, refresh the members list
    const profilesChannel = supabase
      .channel('profiles_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new as any;
        // Update avatar_url in members list if this profile's user_id matches
        setMembers(prev => prev.map(m => {
          if (m.user_id === updated.id) {
            return { ...m, avatar_url: updated.avatar_url ?? null };
          }
          return m;
        }));
      }).subscribe();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(splashTimer);
      authSubscription.unsubscribe();
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(attendeesChannel);
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(profilesChannel);
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

  // Auto mark-as-read when member opens Tagihan Saya (must be before early returns)
  useEffect(() => {
    if (
      activeTab === 'tagihan' &&
      profile &&
      profile.role !== 'admin' &&
      profile.role !== 'superadmin' &&
      memberRecord
    ) {
      const ids = payments
        .filter((p: Payment) =>
          p.member_id === memberRecord.id &&
          (p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'generated')
        )
        .map((p: Payment) => p.id);
      markNotificationsRead(ids);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  // Kas and Session calculations (Separated Accounting Model)
  const totalIncome = React.useMemo(() => {
    const sessionInflows = payments
      ? payments
          .filter((p: any) => p.status_pembayaran === 'verified')
          .reduce((sum: number, p: any) => {
            const s = sessions.find((x: any) => x.id === p.session_id);
            const kasWajib = s ? (s.kas_wajib_per_orang ?? iuranKasConfig) : iuranKasConfig;
            return sum + kasWajib;
          }, 0)
      : 0;

    const manualInflows = sessionExpenses
      ? sessionExpenses
          .filter((e: any) => e.session_id === null && e.jenis_transaksi === 'masuk')
          .reduce((sum: number, e: any) => sum + e.nominal, 0)
      : 0;

    return sessionInflows + manualInflows;
  }, [payments, sessions, sessionExpenses, iuranKasConfig]);

  const totalExpense = React.useMemo(() => {
    return sessionExpenses
      ? sessionExpenses
          .filter((e: any) => e.jenis_transaksi === 'keluar' && (e.session_id === null || e.kategori !== 'Sewa Lapangan'))
          .reduce((sum: number, e: any) => sum + e.nominal, 0)
      : 0;
  }, [sessionExpenses]);

  const saldoKas = totalIncome - totalExpense;

  const totalIuranKasTerkumpul = totalIncome;

  const totalSessionIncome = React.useMemo(() => {
    // Gunakan biaya lapangan aktual per sesi (bukan hasil perkalian split cost yang sudah dibulatkan)
    // untuk menghindari rounding error. Pendapatan Operasional = total biaya lapangan dari sesi
    // yang memiliki setidaknya satu pembayaran terverifikasi.
    if (!payments || !sessions) return 0;
    const verifiedSessionIds = new Set(
      payments
        .filter((p: any) => p.status_pembayaran === 'verified')
        .map((p: any) => p.session_id)
    );
    return sessions.reduce((sum: number, s: any) => {
      if (!verifiedSessionIds.has(s.id)) return sum;
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);
  }, [payments, sessions, sessionExpenses]);

  const totalSessionExpense = React.useMemo(() => {
    // Selalu baca dari session_expenses (single source of truth)
    // Mendukung kategori 'Sewa Lapangan' dan 'Lapangan'
    return sessions.reduce((sum: number, s: any) => {
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);
  }, [sessions, sessionExpenses]);

  const sessionBalance = totalSessionIncome - totalSessionExpense;

  const contributionsThisMonth = React.useMemo(() => {
    return payments
      ? payments
          .filter((p: any) => p.status_pembayaran === 'verified')
          .reduce((sum: number, p: any) => {
            const s = sessions.find((x: any) => x.id === p.session_id);
            if (s && s.tanggal_main) {
              const d = new Date(s.tanggal_main);
              const now = new Date();
              if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
                const kasWajib = s.kas_wajib_per_orang ?? iuranKasConfig;
                return sum + kasWajib;
              }
            }
            return sum;
          }, 0)
      : 0;
  }, [payments, sessions, iuranKasConfig]);

  const handleLogout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
  };

  // --- BACKEND MUTATIONS ---
  const addSession = async (newSession: { 
    nama_sesi: string; 
    tanggal_main: string; 
    jam_main: string; 
    lokasi: string; 
    catatan: string;
    biaya_lapangan: number;
    kas_wajib_per_orang: number;
  }) => {
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
          biaya_per_orang: 0,
          biaya_lapangan: newSession.biaya_lapangan,
          kas_wajib_per_orang: newSession.kas_wajib_per_orang
        })
        .select()
        .single();
      
      if (error) {
        console.error('Supabase insert sessions error:', error);
        const msg = error.message || JSON.stringify(error);
        if (msg.includes('column') && (msg.includes('biaya_lapangan') || msg.includes('kas_wajib_per_orang'))) {
          showToast('Gagal: Kolom database belum diperbarui. Jalankan migration SQL terlebih dahulu.', 'error');
        } else if (msg.includes('permission denied') || msg.includes('violates row-level security')) {
          showToast('Gagal: Tidak ada izin untuk membuat sesi. Hubungi admin.', 'error');
        } else {
          showToast(`Gagal membuat sesi: ${msg}`, 'error');
        }
        return false;
      }
      if (insertedSession) {
        setSessions(prev => [insertedSession, ...prev]);
        setSelectedSessionId(insertedSession.id);

        // Sync 'Sewa Lapangan' expense to session_expenses table
        if (newSession.biaya_lapangan > 0) {
          const { data: expData, error: expError } = await supabase
            .from('session_expenses')
            .insert({
              session_id: insertedSession.id,
              keterangan: 'Sewa Lapangan',
              nominal: newSession.biaya_lapangan,
              kategori: 'Sewa Lapangan',
              jenis_transaksi: 'keluar'
            })
            .select()
            .single();
          if (!expError && expData) {
            setSessionExpenses(prev => [...prev, expData]);
          }
        }
        showToast('Sesi baru berhasil dibuat!', 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error adding session:', err);
      const msg = err?.message || 'Terjadi kesalahan tidak terduga.';
      showToast(`Gagal membuat sesi baru: ${msg}`, 'error');
      return false;
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

  const handleTypeChange = (type: 'masuk' | 'keluar') => {
    setTxJenis(type);
    setTxKategori('');
  };

  const handleTambahKasClick = () => {
    setEditingTx(null);
    setTxJenis('masuk');
    setTxTanggal(new Date().toISOString().split('T')[0]);
    setTxKategori('');
    setTxNominal('');
    setTxKeterangan('');
    setShowAddKasModal(true);
  };

  const saveKasTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      showToast('Anda harus login terlebih dahulu.', 'error');
      return;
    }
    try {
      const nominalNum = parseInt(txNominal);
      if (isNaN(nominalNum) || nominalNum <= 0) {
        showToast('Nominal harus berupa angka valid dan lebih dari 0.', 'error');
        return;
      }

      const dateISO = txTanggal ? `${txTanggal}T12:00:00.000Z` : new Date().toISOString();

      if (editingTx) {
        const oldVal = editingTx;
        const { data: updatedTx, error } = await supabase
          .from('session_expenses')
          .update({
            keterangan: txKeterangan,
            nominal: nominalNum,
            kategori: txKategori,
            jenis_transaksi: txJenis,
            created_at: dateISO
          })
          .eq('id', oldVal.id)
          .select()
          .single();

        if (error) throw error;

        setSessionExpenses(prev => prev.map(item => item.id === oldVal.id ? updatedTx : item));
        
        const roleStr = profile.role === 'superadmin' ? 'SUPERADMIN' : profile.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA';
        const logDetail = `Mengubah Transaksi ID ${oldVal.id}. Sebelum: [Jenis: ${oldVal.jenis_transaksi || 'keluar'}, Kategori: ${oldVal.kategori}, Nominal: ${oldVal.nominal}, Keterangan: ${oldVal.keterangan}, Tanggal: ${oldVal.created_at?.split('T')[0]}]. Sesudah: [Jenis: ${txJenis}, Kategori: ${txKategori}, Nominal: ${nominalNum}, Keterangan: ${txKeterangan}, Tanggal: ${txTanggal}].`;
        
        await supabase.from('activity_logs').insert({
          action: 'edit_transaksi',
          performed_by: profile.nama || profile.email,
          performed_by_id: profile.id,
          detail: `User: ${profile.nama || profile.email} | Role: ${roleStr} | Tanggal & Jam: ${new Date().toLocaleString('id-ID')} | ${logDetail}`
        });

        showToast('✅ Transaksi berhasil diperbarui', 'success');
      } else {
        const { data: insertedTx, error } = await supabase
          .from('session_expenses')
          .insert({
            session_id: null,
            keterangan: txKeterangan,
            nominal: nominalNum,
            kategori: txKategori,
            jenis_transaksi: txJenis,
            created_at: dateISO
          })
          .select()
          .single();

        if (error) throw error;

        setSessionExpenses(prev => [...prev, insertedTx]);

        const roleStr = profile.role === 'superadmin' ? 'SUPERADMIN' : profile.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA';
        const logDetail = `Menambahkan Transaksi Baru. Jenis: ${txJenis}, Kategori: ${txKategori}, Nominal: ${nominalNum}, Keterangan: ${txKeterangan}, Tanggal: ${txTanggal}.`;
        
        await supabase.from('activity_logs').insert({
          action: 'tambah_transaksi',
          performed_by: profile.nama || profile.email,
          performed_by_id: profile.id,
          detail: `User: ${profile.nama || profile.email} | Role: ${roleStr} | Tanggal & Jam: ${new Date().toLocaleString('id-ID')} | ${logDetail}`
        });

        showToast('✅ Transaksi berhasil dicatat', 'success');
      }

      setShowAddKasModal(false);
      setEditingTx(null);
      setTxTanggal('');
      setTxKategori('');
      setTxNominal('');
      setTxKeterangan('');
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      showToast(`❌ Gagal menyimpan transaksi: ${err.message || err}`, 'error');
    }
  };

  const deleteKasTransaction = async (tx: any) => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('session_expenses')
        .delete()
        .eq('id', tx.id);

      if (error) throw error;

      setSessionExpenses(prev => prev.filter(item => item.id !== tx.id));

      const roleStr = profile.role === 'superadmin' ? 'SUPERADMIN' : profile.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA';
      const logDetail = `Menghapus Transaksi ID ${tx.id}. Detail: [Jenis: ${tx.jenis_transaksi || 'keluar'}, Kategori: ${tx.kategori}, Nominal: ${tx.nominal}, Keterangan: ${tx.keterangan}, Tanggal: ${tx.created_at?.split('T')[0]}].`;
      
      await supabase.from('activity_logs').insert({
        action: 'hapus_transaksi',
        performed_by: profile.nama || profile.email,
        performed_by_id: profile.id,
        detail: `User: ${profile.nama || profile.email} | Role: ${roleStr} | Tanggal & Jam: ${new Date().toLocaleString('id-ID')} | ${logDetail}`
      });

      showToast('✅ Transaksi berhasil dihapus', 'success');
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      showToast(`❌ Gagal menghapus transaksi: ${err.message || err}`, 'error');
    }
  };

  const handleEditKasTransaction = (tx: any) => {
    setEditingTx(tx);
    setTxJenis(tx.jenis_transaksi || 'keluar');
    setTxTanggal(tx.created_at ? tx.created_at.split('T')[0] : '');
    setTxKategori(tx.kategori);
    setTxNominal(tx.nominal.toString());
    setTxKeterangan(tx.keterangan);
    setShowAddKasModal(true);
  };

  const handleDeleteKasTransaction = (tx: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Transaksi Kas',
      message: `Apakah Anda yakin ingin menghapus transaksi "${tx.keterangan}" sebesar ${formatRp(tx.nominal)}?`,
      onConfirm: () => deleteKasTransaction(tx)
    });
  };

  const deleteSession = async (sessionId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Sesi',
      message: 'Data sesi beserta seluruh transaksi terkait akan dihapus permanen dan tidak dapat dipulihkan.',
      onConfirm: () => {
        executeHardDeleteSession(sessionId);
      }
    });
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

  const updateSession = async (sessionId: number, updatedData: { 
    nama_sesi: string; 
    tanggal_main: string; 
    jam_main: string; 
    lokasi: string; 
    catatan: string;
    biaya_lapangan: number;
    kas_wajib_per_orang: number;
  }) => {
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

        // Sync 'Sewa Lapangan' expense to session_expenses table
        const { data: existingExps } = await supabase
          .from('session_expenses')
          .select('*')
          .eq('session_id', sessionId)
          .eq('kategori', 'Sewa Lapangan');
          
        if (existingExps && existingExps.length > 0) {
          if (updatedData.biaya_lapangan > 0) {
            const { data: updatedExp } = await supabase
              .from('session_expenses')
              .update({ nominal: updatedData.biaya_lapangan, keterangan: 'Sewa Lapangan' })
              .eq('id', existingExps[0].id)
              .select()
              .single();
            if (updatedExp) {
              setSessionExpenses(prev => prev.map(e => e.id === existingExps[0].id ? updatedExp : e));
            }
            
            // Delete any duplicates
            if (existingExps.length > 1) {
              const duplicateIds = existingExps.slice(1).map(e => e.id);
              await supabase.from('session_expenses').delete().in('id', duplicateIds);
              setSessionExpenses(prev => prev.filter(e => !duplicateIds.includes(e.id)));
            }
          } else {
            // Delete if biaya_lapangan is 0
            const deleteIds = existingExps.map(e => e.id);
            await supabase.from('session_expenses').delete().in('id', deleteIds);
            setSessionExpenses(prev => prev.filter(e => !deleteIds.includes(e.id)));
          }
        } else if (updatedData.biaya_lapangan > 0) {
          const { data: insertedExp } = await supabase
            .from('session_expenses')
            .insert({
              session_id: sessionId,
              keterangan: 'Sewa Lapangan',
              nominal: updatedData.biaya_lapangan,
              kategori: 'Sewa Lapangan',
              jenis_transaksi: 'keluar'
            })
            .select()
            .single();
          if (insertedExp) {
            setSessionExpenses(prev => [...prev, insertedExp]);
          }
        }
        
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
      // 1. Hapus tagihan (payments) member di sesi ini terlebih dahulu,
      //    kecuali yang sudah verified/lunas (uang sudah masuk, jangan dihapus)
      const { error: paymentError } = await supabase
        .from('payments')
        .delete()
        .eq('session_id', sessionId)
        .eq('member_id', memberId)
        .in('status_pembayaran', ['unpaid', 'uploaded', 'rejected', 'generated', 'pending']);

      if (paymentError) throw paymentError;

      // 2. Hapus data kehadiran dari session_attendees
      const { error } = await supabase
        .from('session_attendees')
        .delete()
        .eq('session_id', sessionId)
        .eq('member_id', memberId);
      
      if (error) throw error;

      // 3. Update state lokal
      setAttendees(prev => prev.filter(a => !(a.session_id === sessionId && a.member_id === memberId)));
      setPayments(prev => prev.filter(p => !(p.session_id === sessionId && p.member_id === memberId && p.status_pembayaran !== 'verified' && p.status_pembayaran !== 'lunas' && p.status_pembayaran !== 'paid')));
      showToast('✅ Data kehadiran & tagihan berhasil dihapus', 'success');
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
      
      const s = sessions.find(x => x.id === sessionId);
      const sExpenses = sessionExpenses.filter(e => e.session_id === sessionId);
      const biayaLapangan = s ? getSewaLapangan(s, sExpenses) : 0;
      const kasWajib = s ? (s.kas_wajib_per_orang ?? iuranKasConfig) : iuranKasConfig;

      const costPerPerson = Math.round(biayaLapangan / sessionAttendees.length);
      const finalBill = costPerPerson + kasWajib;

      const paymentsToInsert = sessionAttendees.map(a => ({
        session_id: sessionId,
        member_id: a.member_id,
        nominal_tagihan: finalBill,
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
        description: `Setiap anggota dikenakan ${formatRp(finalBill)}`,
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

  const updateProfile = async (
    nama: string,
    nomor_hp: string,
    fileToUpload: File | Blob | null,
    isPhotoRemoved?: boolean
  ) => {
    try {
      const { data: currentProfile, error: getProfileError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      if (getProfileError) throw getProfileError;

      let newAvatarUrl = currentProfile?.avatar_url || null;

      if (isPhotoRemoved) {
        if (newAvatarUrl) {
          try {
            const bucketSearchStr = '/avatars/';
            const bucketIdx = newAvatarUrl.indexOf(bucketSearchStr);
            if (bucketIdx !== -1) {
              const filePathInBucket = decodeURIComponent(newAvatarUrl.substring(bucketIdx + bucketSearchStr.length));
              console.log('Deleting removed avatar from storage:', filePathInBucket);
              const { error: removeError } = await supabase.storage.from('avatars').remove([filePathInBucket]);
              if (removeError) console.warn('Warning: Failed to delete old avatar:', removeError);
            }
          } catch (deleteError) {
            console.error('Error deleting old avatar:', deleteError);
          }
        }
        newAvatarUrl = null;
      } else if (fileToUpload) {
        if (newAvatarUrl) {
          try {
            const bucketSearchStr = '/avatars/';
            const bucketIdx = newAvatarUrl.indexOf(bucketSearchStr);
            if (bucketIdx !== -1) {
              const filePathInBucket = decodeURIComponent(newAvatarUrl.substring(bucketIdx + bucketSearchStr.length));
              console.log('Deleting old avatar before upload:', filePathInBucket);
              const { error: removeError } = await supabase.storage.from('avatars').remove([filePathInBucket]);
              if (removeError) console.warn('Warning: Failed to delete old avatar:', removeError);
            }
          } catch (deleteError) {
            console.error('Error deleting old avatar before upload:', deleteError);
          }
        }

        const fileExt = fileToUpload instanceof File ? fileToUpload.name.split('.').pop() || 'jpg' : 'jpg';
        const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;



        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, fileToUpload, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('Avatar upload to Supabase Storage failed:', uploadError);
          const customErrorMsg = uploadError.message?.toLowerCase().includes('bucket')
            ? 'Gagal mengunggah: Bucket "avatars" tidak ditemukan di Supabase Storage. Silakan buat bucket "avatars" (Public) terlebih dahulu di Dashboard Supabase Anda.'
            : `Gagal mengunggah foto ke Storage: ${uploadError.message}`;
          showToast(customErrorMsg, 'error');
          throw new Error(customErrorMsg);
        }



        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);


        newAvatarUrl = publicUrl;
      }

      const profileUpdates: any = { nama, nomor_hp };
      
      let hasAvatarUrlColumn = true;
      try {
        const { error: checkColError } = await supabase
          .from('profiles')
          .select('avatar_url')
          .limit(1);
        if (checkColError && checkColError.message.includes('avatar_url')) {
          hasAvatarUrlColumn = false;
        }
      } catch (checkColErr) {
        hasAvatarUrlColumn = false;
      }

      if (hasAvatarUrlColumn) {
        profileUpdates.avatar_url = newAvatarUrl;
      } else {
        console.warn('Kolom "avatar_url" tidak ada di database, update foto profil dilewati.');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', session.user.id);
      if (profileError) throw profileError;

      if (memberRecord) {
        const { error: memberError } = await supabase
          .from('members')
          .update({ name: nama })
          .eq('id', memberRecord.id);
        if (memberError) throw memberError;
      }

      setProfilePhoto(newAvatarUrl);
      await fetchUserProfile(session.user.id);
      await fetchData();
      showToast('✅ Foto profil berhasil diperbarui.', 'success');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showToast(err.message || 'Gagal menyimpan profil.', 'error');
      throw err;
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
    const isLight = theme === 'light';
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center p-6 text-center select-none transition-colors duration-300 ${
        isLight
          ? 'bg-white'
          : 'bg-gradient-to-br from-emerald-650 via-emerald-800 to-slate-950'
      }`}>
        <div className="space-y-6 max-w-sm w-full">
          <img src="/logo.png" alt="Logo SI-PATRA" className="w-[150px] h-auto object-contain mx-auto animate-pulse-gentle" />
          <div className="space-y-2">
            {/* Title: dark gray in light mode, white in dark mode */}
            <h1 className={`text-4xl font-black tracking-wider ${isLight ? 'text-[#111827]' : 'text-white'}`}>
              SI-PATRA
            </h1>
            {/* Subtitle: brand green in light mode, soft mint in dark mode */}
            <p className={`text-[10px] font-extrabold uppercase tracking-widest leading-relaxed ${
              isLight ? 'text-[#10B981]' : 'text-[#6EE7B7]'
            }`}>
              Sistem Manajemen Iuran &amp; Sesi Badminton
            </p>
          </div>
          <div className="pt-8 space-y-3">
            <div className={`w-40 h-1.5 rounded-full mx-auto overflow-hidden border ${
              isLight ? 'bg-emerald-100 border-emerald-200' : 'bg-white/10 border-white/5'
            }`}>
              <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-loading-bar"></div>
            </div>
            {/* Loading text: medium gray in light mode, light gray in dark mode */}
            <p className={`text-[9px] font-bold uppercase tracking-wider animate-pulse ${
              isLight ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
            }`}>
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

  // --- RESET PASSWORD SCREEN (RECOVERY) ---
  if (session && isRecoveringPassword) {
    return (
      <ChangePasswordScreen
        session={session}
        isRecovery={true}
        onPasswordChanged={async () => {
          setIsRecoveringPassword(false);
          setMustChangePassword(false);
          setIsLoading(true);
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          setMemberRecord(null);
          setIsLoading(false);
          showToast('✅ Password berhasil diperbarui! Silakan masuk kembali.', 'success');
        }}
        onCancel={async () => {
          setIsRecoveringPassword(false);
          setIsLoading(true);
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          setMemberRecord(null);
          setIsLoading(false);
        }}
      />
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

  // Badge hanya menghitung tagihan yang BENAR-BENAR memerlukan tindakan anggota:
  // 'unpaid' = belum bayar, 'generated' = tagihan baru diterbitkan
  // TIDAK termasuk: uploaded, Menunggu Verifikasi Cash, verified, rejected
  const memberPendingBills = !isAdmin && memberRecord
    ? payments.filter((p: Payment) =>
        p.member_id === memberRecord.id &&
        (p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'generated')
      )
    : [];
  const memberUnreadBills = memberPendingBills;
  const unreadCount = memberPendingBills.length;

  return (
    <div className="min-h-screen bg-background flex justify-center text-primary font-sans transition-all duration-200">
      <div className="w-full max-w-md bg-card min-h-screen shadow-theme relative pb-28 flex flex-col border-x border-border transition-all duration-200">
        
        {/* HEADER */}
        <header className="bg-card/90 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-border shadow-theme transition-all duration-200">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-3 text-left focus:outline-none hover:opacity-85 active:scale-[0.98] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0_4px_12px_rgba(16,185,129,0.25)] flex items-center justify-center flex-shrink-0 text-white font-[700] text-lg select-none overflow-hidden border border-border group-hover:border-accent transition-colors">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Foto Profil" className="w-full h-full object-cover" />
                ) : (
                  getInitials(profile?.nama || profile?.full_name || session?.user?.user_metadata?.name || session?.user?.user_metadata?.nama)
                )}
              </div>
              <div>
                <p className="text-[9px] text-secondary font-black uppercase tracking-wider leading-none group-hover:text-accent transition-colors">SELAMAT DATANG,</p>
                <p className="font-extrabold text-primary text-sm leading-tight mt-1.5 truncate w-36">{profile.nama}</p>
              </div>
            </button>
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
              contributionsThisMonth={contributionsThisMonth}
              profilePhoto={profilePhoto}
              session={session}
              readNotificationIds={readNotificationIds}
              markNotificationsRead={markNotificationsRead}
              unreadCount={unreadCount}
              memberUnreadBills={memberUnreadBills}
              onTambahKasClick={handleTambahKasClick}
              iuranKasConfig={iuranKasConfig}
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
                iuranKasConfig={iuranKasConfig}
                settings={settings}
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
              payments={payments}
              members={members}
              isAdmin={isAdmin}
              handleEditKasTransaction={handleEditKasTransaction}
              handleDeleteKasTransaction={handleDeleteKasTransaction}
              iuranKasConfig={iuranKasConfig}
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
              session={session}
              profilePhoto={profilePhoto}
              setShowAddModal={setShowAddMemberModal}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileMember 
              profile={profile} 
              updateProfile={updateProfile} 
              profilePhoto={profilePhoto}
              showToast={showToast}
              memberRecord={memberRecord}
              payments={payments}
              attendees={attendees}
              sessions={sessions}
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
              iuranKasConfig={iuranKasConfig}
              setIuranKasConfig={setIuranKasConfig}
              showToast={showToast}
            />
          )}
        </main>

        {/* BOTTOM FLOATING NAVIGATION */}
        <nav className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-card border border-border rounded-[24px] shadow-theme flex justify-around p-2.5 z-30 transition-all duration-200">
          <NavItem icon={<Home size={20} />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Calendar size={20} />} label={isAdmin ? 'Sesi' : 'Tagihan Saya'} active={activeTab === 'tagihan'} onClick={() => setActiveTab('tagihan')} badge={!isAdmin ? unreadCount : 0} />
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
        {activeTab === 'dashboard' && isSuperAdmin && (
          <button 
            onClick={() => setShowFabActionMenu(true)}
            className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-[#10B981] to-[#059669] text-white rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all z-30"
            title="Menu Cepat"
            aria-label="Menu Cepat"
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

        {/* STANDALONE MEMBER PAYMENT MODAL */}
        {!isAdmin && (
          <PaymentModal
            user={profile}
            memberRecord={memberRecord}
            sessions={sessions}
            payments={payments}
            settings={settings}
            selectedPayment={selectedPayment}
            setSelectedPayment={setSelectedPayment}
            submitPaymentWithProof={submitPaymentWithProof}
            submitCashPayment={submitCashPayment}
          />
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
                  {confirmModal.hardDeleteDisabled && confirmModal.hardDeleteDisabledMessage && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-red-500 font-bold leading-relaxed">
                        ⚠️ {confirmModal.hardDeleteDisabledMessage}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={async () => {
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        if (confirmModal.onSoftConfirm) await confirmModal.onSoftConfirm();
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-white font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] shadow-md"
                    >
                      Nonaktifkan
                    </button>
                    <button 
                      disabled={confirmModal.hardDeleteDisabled}
                      onClick={async () => {
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        await confirmModal.onConfirm();
                      }}
                      className={`w-full font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] shadow-md ${
                        confirmModal.hardDeleteDisabled 
                          ? 'bg-red-500/30 text-white/50 cursor-not-allowed border border-red-500/10 shadow-none' 
                          : 'bg-red-650 hover:bg-red-500 text-white'
                      }`}
                    >
                      Hapus Permanen
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

        {/* FAB BOTTOM SHEET ACTION MENU */}
        {showFabActionMenu && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 flex items-end justify-center sm:items-center p-4 animate-fadeIn" onClick={() => setShowFabActionMenu(false)}>
            <div className="bg-card w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-5 pb-6 relative border border-border shadow-theme animate-slide-up transition-colors duration-200" onClick={e => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-5" />

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setShowFabActionMenu(false);
                    setActiveTab('tagihan');
                    setShowAddSessionModal(true);
                  }}
                  className="w-full h-[52px] px-4 bg-background hover:bg-border/30 rounded-2xl flex items-center gap-3.5 font-extrabold text-sm text-primary transition-all active:scale-[0.98] border border-border"
                >
                  <span className="text-base flex items-center justify-center">➕</span>
                  <span>Tambah Sesi</span>
                </button>

                <button
                  onClick={() => {
                    setShowFabActionMenu(false);
                    setActiveTab('anggota');
                    setShowAddMemberModal(true);
                  }}
                  className="w-full h-[52px] px-4 bg-background hover:bg-border/30 rounded-2xl flex items-center gap-3.5 font-extrabold text-sm text-primary transition-all active:scale-[0.98] border border-border"
                >
                  <span className="text-base flex items-center justify-center">👤</span>
                  <span>Tambah Anggota</span>
                </button>

                <button
                  onClick={() => setShowFabActionMenu(false)}
                  className="w-full h-[48px] border border-border/80 hover:bg-border/20 text-secondary hover:text-primary rounded-2xl font-bold text-xs uppercase tracking-wider text-center transition-all active:scale-[0.98] mt-1"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL TAMBAH ANGGOTA MODAL */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowAddMemberModal(false)}>
            <div className="bg-card rounded-[28px] p-6 max-w-sm w-full shadow-theme border border-border flex flex-col gap-4 animate-scaleUp" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col gap-1">
                <h3 className="text-primary font-black text-base uppercase tracking-wider">Tambah Akun Baru</h3>
                <p className="text-xs text-secondary font-bold">Password awal adalah "sisteminformasi".</p>
              </div>

              {memberFormError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-1.5 font-[600] border border-red-100 dark:border-red-900/30">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{memberFormError}</span>
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
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">Nomor HP / WhatsApp</label>
                  <input 
                    type="text" 
                    value={newPhone} 
                    onChange={e => setNewPhone(e.target.value)} 
                    placeholder="Nomor HP / WhatsApp"
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-1">Peran (Role)</label>
                  <select 
                    value={newRole} 
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 outline-none text-primary font-bold text-xs"
                  >
                    <option value="member">Anggota (Member)</option>
                    <option value="admin">Admin (Bendahara)</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddMemberModal(false)}
                    className="flex-1 py-2.5 bg-background border border-border text-secondary font-black text-[10px] rounded-xl uppercase tracking-wider transition-all hover:bg-border/20 active:scale-[0.97]"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isCreatingMember}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#1ED760] to-[#059669] text-white font-black text-[10px] rounded-xl uppercase tracking-wider transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
                  >
                    {isCreatingMember ? 'Memproses...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TRANSACTION KAS ORGANISASI MODAL (TAMBAH/EDIT KAS) */}
        {showAddKasModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4" onClick={() => { setShowAddKasModal(false); setEditingTx(null); }}>
            <div className="bg-card w-full max-w-md rounded-t-[24px] sm:rounded-[24px] p-6 relative border border-border shadow-theme animate-slide-up transition-colors duration-200" onClick={e => e.stopPropagation()}>
              <button 
                type="button"
                onClick={() => { setShowAddKasModal(false); setEditingTx(null); }} 
                className="absolute top-5 right-5 p-2 bg-background border border-border/45 text-secondary hover:text-primary rounded-full transition-colors"
              >
                <XCircle size={18} />
              </button>
              <h3 className="text-base font-black text-primary uppercase tracking-wide mb-1">
                {editingTx ? 'Edit Transaksi Kas Organisasi' : 'Transaksi Kas Organisasi'}
              </h3>
              <p className="text-[10px] font-bold text-secondary mb-6">
                {editingTx ? 'Perbarui pencatatan transaksi kas organisasi.' : 'Catat pemasukan maupun pengeluaran kas organisasi.'}
              </p>
              
              {/* Segmented Control */}
              <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-2">Jenis Transaksi</label>
              <div className="relative flex bg-background border border-border rounded-2xl p-1 shadow-inner w-full mb-5">
                <button
                  type="button"
                  onClick={() => handleTypeChange('masuk')}
                  className={`flex-grow py-2 text-center text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    txJenis === 'masuk' 
                      ? 'bg-emerald-500 text-white shadow-theme' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <TrendingUp size={14} /> Pemasukan Kas
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('keluar')}
                  className={`flex-grow py-2 text-center text-xs font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    txJenis === 'keluar' 
                      ? 'bg-red-500 text-white shadow-theme' 
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <TrendingDown size={14} /> Pengeluaran Kas
                </button>
              </div>

              <form onSubmit={saveKasTransaction} className="space-y-4">
                {/* Tanggal */}
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Tanggal</label>
                  <input 
                    required
                    type="date"
                    value={txTanggal}
                    onChange={(e) => setTxTanggal(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary outline-none transition-all font-bold text-xs"
                  />
                </div>

                {/* Kategori */}
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Kategori</label>
                  <select
                    required
                    value={txKategori}
                    onChange={(e) => setTxKategori(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary outline-none transition-all font-bold text-xs"
                  >
                    <option value="" disabled>Pilih Kategori</option>
                    {txJenis === 'masuk' ? (
                      <>
                        <option value="Kas Awal">Kas Awal</option>
                        <option value="Donasi">Donasi</option>
                        <option value="Sponsor">Sponsor</option>
                        <option value="Denda">Denda</option>
                        <option value="Transfer Dana Operasional Sesi">Transfer Dana Operasional Sesi</option>
                        <option value="Pendapatan Lainnya">Pendapatan Lainnya</option>
                      </>
                    ) : (
                      <>
                        <option value="Shuttlecock">Shuttlecock</option>
                        <option value="Sewa Lapangan">Sewa Lapangan</option>
                        <option value="Konsumsi">Konsumsi</option>
                        <option value="Peralatan">Peralatan</option>
                        <option value="Turnamen">Turnamen</option>
                        <option value="Administrasi">Administrasi</option>
                        <option value="Lainnya">Lainnya</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Nominal */}
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Nominal</label>
                  <input 
                    required
                    type="number"
                    min="1"
                    placeholder="Contoh: 100000"
                    value={txNominal}
                    onChange={(e) => setTxNominal(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary outline-none transition-all font-bold text-xs"
                  />
                </div>

                {/* Keterangan */}
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Keterangan</label>
                  <textarea 
                    required
                    placeholder="Keterangan transaksi..."
                    value={txKeterangan}
                    onChange={(e) => setTxKeterangan(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary outline-none transition-all font-bold text-xs resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button 
                  type="submit" 
                  className={`w-full text-white font-extrabold py-3.5 rounded-2xl mt-4 transition-all shadow-lg active:scale-[0.98] text-xs ${
                    txJenis === 'masuk' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {editingTx 
                    ? 'Simpan Perubahan' 
                    : (txJenis === 'masuk' ? 'Simpan Pemasukan' : 'Simpan Pengeluaran')
                  }
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---
function NavItem({ icon, label, active, onClick, badge = 0 }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center pt-2 pb-1 relative transition-all duration-200 flex-1 ${
        active 
          ? 'text-accent font-extrabold scale-105' 
          : 'text-secondary hover:text-primary'
      }`}
    >
      <div className="mb-0.5 relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 shadow-sm animate-fadeIn">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
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
  isInstallable, handleInstallPWA, setActiveTab, setSelectedSessionId, showToast, setShowAddSessionModal, contributionsThisMonth, profilePhoto, session: authSession,
  readNotificationIds, markNotificationsRead, unreadCount, memberUnreadBills, onTambahKasClick, iuranKasConfig
}: any) {
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  // 5. Session Financial Summary calculations inside Dashboard
  const totalSessionIncome = React.useMemo(() => {
    // Gunakan biaya lapangan aktual per sesi (bukan hasil perkalian split cost yang sudah dibulatkan)
    // untuk menghindari rounding error. Pendapatan Operasional = total biaya lapangan dari sesi
    // yang memiliki setidaknya satu pembayaran terverifikasi.
    if (!payments || !sessions) return 0;
    const verifiedSessionIds = new Set(
      payments
        .filter((p: any) => p.status_pembayaran === 'verified')
        .map((p: any) => p.session_id)
    );
    return sessions.reduce((sum: number, s: any) => {
      if (!verifiedSessionIds.has(s.id)) return sum;
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);
  }, [payments, sessions, sessionExpenses]);

  const totalSessionExpense = React.useMemo(() => {
    // Selalu baca dari session_expenses (single source of truth)
    // Mendukung kategori 'Sewa Lapangan' dan 'Lapangan'
    return sessions.reduce((sum: number, s: any) => {
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);
  }, [sessions, sessionExpenses]);

  const sessionBalance = totalSessionIncome - totalSessionExpense;
  
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
              <span className="text-[10px] font-black uppercase tracking-wider">KAS ORGANISASI</span>
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
                <p className="text-emerald-200 text-[9px] font-black uppercase tracking-wider leading-none">KAS MASUK</p>
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
                <p className="text-emerald-200 text-[9px] font-black uppercase tracking-wider leading-none">KAS KELUAR</p>
                <p className="font-extrabold text-xs text-white mt-1">
                  {formatRp(totalExpense)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SESSION OPERATIONAL FUNDS CARD */}
        <div className="bg-gradient-to-br from-[#0B1530] to-[#1D4ED8] rounded-[24px] p-6 text-white shadow-xl relative overflow-hidden">
          {/* Watermark coins or similar */}
          <div className="absolute bottom-0 right-0 w-36 h-36 opacity-[0.10] pointer-events-none transform translate-x-4 translate-y-4">
            <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full text-white">
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M 50 20 L 50 80 M 35 35 L 65 35 M 30 50 L 70 50 M 35 65 L 65 65" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 text-blue-100">
              <Activity size={16} strokeWidth={2.2} />
              <span className="text-[10px] font-black uppercase tracking-wider">DANA OPERASIONAL SESI</span>
            </div>
            <span className="px-3 py-1 bg-white/10 border border-white/15 rounded-full text-[9px] font-black uppercase text-blue-100">
              Game Operasional
            </span>
          </div>

          <h2 className={`text-4xl font-[900] tracking-tight mb-7 ${sessionBalance < 0 ? 'text-red-300' : 'text-white'}`}>
            {sessionBalance < 0 ? '-' : ''}{formatRp(Math.abs(sessionBalance))}
            <span className="text-[10px] font-extrabold uppercase text-blue-200 ml-2">
              ({sessionBalance >= 0 ? 'Surplus' : 'Defisit'})
            </span>
          </h2>

          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-blue-800 shadow-sm flex-shrink-0">
                <TrendingUp size={16} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-blue-200 text-[9px] font-black uppercase tracking-wider leading-none">PENDAPATAN OPERASIONAL</p>
                <p className="font-extrabold text-xs text-white mt-1">
                  {formatRp(totalSessionIncome)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm flex-shrink-0">
                <TrendingUp size={16} strokeWidth={2.5} className="transform rotate-180" />
              </div>
              <div>
                <p className="text-blue-200 text-[9px] font-black uppercase tracking-wider leading-none">SEWA LAPANGAN</p>
                <p className="font-extrabold text-xs text-white mt-1">
                  {formatRp(totalSessionExpense)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTION SECTION */}
        <div className="bg-card rounded-[24px] p-3.5 shadow-theme border border-border grid grid-cols-5 divide-x divide-border transition-all duration-200">
          <div 
            onClick={() => {
              console.log('[DEBUG] Clicked "Tambah Sesi" Quick Action. isAdmin:', isAdmin, 'user.role:', user?.role);
              if (isAdmin) {
                console.log('[DEBUG] Setting activeTab to "tagihan" and showAddSessionModal to true');
                setActiveTab('tagihan');
                setShowAddSessionModal(true);
              } else {
                console.log('[DEBUG] User is not admin. Toasting warning.');
                showToast('Hanya Admin atau Bendahara yang dapat menambah sesi.', 'warning');
              }
            }} 
            className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PlusCircle size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">Tambah Sesi</span>
          </div>
          <div 
            onClick={() => { 
              if (isAdmin) {
                onTambahKasClick();
              } else {
                showToast('Akses Ditolak: Hanya Superadmin atau Bendahara yang dapat mengakses fitur ini.', 'warning');
              }
            }} 
            className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity pl-1"
          >
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Wallet size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">Tambah Kas</span>
          </div>
          <div onClick={() => setActiveTab('pengaturan')} className="flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity pl-1">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <QrCode size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[9px] font-black text-secondary text-center leading-tight">QRIS</span>
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
          <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 p-4 rounded-[20px] flex flex-col justify-between h-28 relative overflow-hidden">
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

          {/* CARD 4: KAS BERTAMBAH BULAN INI */}
          <div className="bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 p-4 rounded-[20px] flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                <Wallet size={16} />
              </div>
              <span className="text-[8px] font-black text-indigo-500 uppercase tracking-wider">Kas Bertambah Bulan Ini</span>
            </div>
            <div>
              <p className="text-lg font-black text-emerald-450 leading-none">{formatRp(contributionsThisMonth)}</p>
              <p className="text-[9px] text-secondary font-bold mt-1.5 flex items-center gap-1">
                <Receipt size={10} /> Iuran Kas bulan ini
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
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs flex-shrink-0 overflow-hidden border border-border">
                        {member?.user_id === authSession?.user?.id && profilePhoto ? (
                          <img src={profilePhoto} alt="Foto Profil" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(member?.name)
                        )}
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
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-xs flex-shrink-0 overflow-hidden border border-border">
                        {member?.user_id === authSession?.user?.id && profilePhoto ? (
                          <img src={profilePhoto} alt="Foto Profil" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(member?.name)
                        )}
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
                        🔴 Belum Bayar
                      </span>
                    ) : p.status_pembayaran === 'Menunggu Verifikasi Cash' ? (
                      <span className="bg-orange-500/15 text-orange-500 border border-orange-500/20 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                        🟠 Menunggu Konfirmasi
                      </span>
                    ) : (
                      <span className="bg-orange-500/15 text-orange-500 border border-orange-500/20 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                        🟡 Menunggu Verifikasi
                      </span>
                    )}
                    
                    {(p.status_pembayaran === 'generated' || p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'rejected') && (
                      <button 
                        onClick={() => {
                          setSelectedPayment(p);
                        }}
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
  markAsPaidCashDirectly, deleteSession, updateSession, deletePayment, deleteAttendanceRecord, setConfirmModal, iuranKasConfig, settings
}: any) {
  const [openMenuSessionId, setOpenMenuSessionId] = useState<number | null>(null);
  const [sessionPdfId, setSessionPdfId] = useState<number | null>(null);
  const [isExportingSessionPdf, setIsExportingSessionPdf] = useState(false);

  const handleExportSessionPDF = (sessionId: number) => {
    setSessionPdfId(sessionId);
    setIsExportingSessionPdf(true);
    setTimeout(() => {
      const element = document.getElementById('session-report-content');
      if (!element) {
        setIsExportingSessionPdf(false);
        setSessionPdfId(null);
        return;
      }
      const s = sessions.find((x: any) => x.id === sessionId);
      const sessionNameClean = s?.nama_sesi?.replace(/\s+/g, '-') || 'Sesi';
      const dateClean = s?.tanggal_main || 'Tanggal';
      const filename = `Laporan-Sesi-${sessionNameClean}-${dateClean}.pdf`;
      const opt = {
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };
      if (typeof (window as any).html2pdf === 'function') {
        (window as any).html2pdf().set(opt).from(element).save()
          .then(() => {
            setIsExportingSessionPdf(false);
            setSessionPdfId(null);
          })
          .catch(() => {
            setIsExportingSessionPdf(false);
            setSessionPdfId(null);
          });
      } else {
        alert('html2pdf belum termuat. Coba refresh halaman.');
        setIsExportingSessionPdf(false);
        setSessionPdfId(null);
      }
    }, 300);
  };
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);

  // States for Date & Time Pickers (Create and Edit forms)
  const [createDate, setCreateDate] = useState('');
  const [createStartTime, setCreateStartTime] = useState('');
  const [createEndTime, setCreateEndTime] = useState('');

  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState('create');
  const [tempStartTime, setTempStartTime] = useState('');
  const [tempEndTime, setTempEndTime] = useState('');
  const [timeValidationError, setTimeValidationError] = useState('');

  // Refs for Date picker triggers
  const createDateInputRef = React.useRef(null);
  const editDateInputRef = React.useRef(null);

  const triggerDatePicker = (ref) => {
    try {
      ref.current?.showPicker();
    } catch (e) {
      console.error('showPicker error, fallback click', e);
      ref.current?.click();
    }
  };

  // Sync editingSession to Edit form state
  useEffect(() => {
    if (editingSession) {
      setEditDate(editingSession.tanggal_main || '');
      const jamMain = editingSession.jam_main || '';
      const parts = jamMain.split(' - ');
      if (parts.length === 2) {
        setEditStartTime(parts[0].trim());
        setEditEndTime(parts[1].trim());
      } else {
        setEditStartTime('');
        setEditEndTime('');
      }
    } else {
      setEditDate('');
      setEditStartTime('');
      setEditEndTime('');
    }
  }, [editingSession]);

  const openTimePicker = (mode) => {
    setTimePickerMode(mode);
    if (mode === 'create') {
      setTempStartTime(createStartTime || '08:00');
      setTempEndTime(createEndTime || '10:00');
    } else {
      setTempStartTime(editStartTime || '08:00');
      setTempEndTime(editEndTime || '10:00');
    }
    setTimeValidationError('');
    setShowTimePickerModal(true);
  };

  const handleSaveTime = () => {
    if (!tempStartTime || !tempEndTime) {
      setTimeValidationError('Jam mulai dan selesai harus diisi.');
      return;
    }
    if (tempEndTime <= tempStartTime) {
      setTimeValidationError('Jam selesai harus lebih besar dari jam mulai.');
      return;
    }
    if (timePickerMode === 'create') {
      setCreateStartTime(tempStartTime);
      setCreateEndTime(tempEndTime);
    } else {
      setEditStartTime(tempStartTime);
      setEditEndTime(tempEndTime);
    }
    setShowTimePickerModal(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenuSessionId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);
  
  const handleCreateSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const tanggalMain = fd.get('tanggal_main') as string;
    const jamMain = fd.get('jam_main') as string;
    if (!tanggalMain) {
      alert('Tanggal main wajib diisi.');
      return;
    }
    if (!jamMain) {
      alert('Jam main wajib diisi. Silakan pilih jam main terlebih dahulu.');
      return;
    }
    const biayaLapanganRaw = (fd.get('biaya_lapangan') as string || '').replace(/\./g, '');
    const kasWajibRaw = (fd.get('kas_wajib_per_orang') as string || '').replace(/\./g, '');
    setIsSubmittingSession(true);
    const success = await addSession({
      nama_sesi: fd.get('nama_sesi') as string,
      tanggal_main: tanggalMain,
      jam_main: jamMain,
      lokasi: fd.get('lokasi') as string,
      catatan: fd.get('catatan') as string,
      biaya_lapangan: parseInt(biayaLapanganRaw) || 0,
      kas_wajib_per_orang: parseInt(kasWajibRaw) || 0
    });
    setIsSubmittingSession(false);
    if (success) {
      setShowAddSessionModal(false);
      setCreateDate('');
      setCreateStartTime('');
      setCreateEndTime('');
    }
  };

  const handleEditSessionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSession) return;
    const fd = new FormData(e.currentTarget);
    const biayaLapanganRaw = (fd.get('biaya_lapangan') as string || '').replace(/\./g, '');
    const kasWajibRaw = (fd.get('kas_wajib_per_orang') as string || '').replace(/\./g, '');
    updateSession(editingSession.id, {
      nama_sesi: fd.get('nama_sesi') as string,
      tanggal_main: fd.get('tanggal_main') as string,
      jam_main: fd.get('jam_main') as string,
      lokasi: fd.get('lokasi') as string,
      catatan: fd.get('catatan') as string,
      biaya_lapangan: parseInt(biayaLapanganRaw) || 0,
      kas_wajib_per_orang: parseInt(kasWajibRaw) || 0
    });
    setEditingSession(null);
  };

  const handleAddExpenseInline = (e: React.FormEvent<HTMLFormElement>, sessionId: number) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const keterangan = fd.get('keterangan') as string;
    const nominalRaw = (fd.get('nominal') as string || '').replace(/\./g, '');
    const nominal = parseInt(nominalRaw);
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
          onClick={() => {
            console.log('[DEBUG] Clicked "Sesi Baru" button. Previous showAddSessionModal:', showAddSessionModal);
            setShowAddSessionModal(true);
            console.log('[DEBUG] set showAddSessionModal to true.');
          }} 
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
                            deleteSession(s.id);
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

                  {/* 2. EXPENSES OVERVIEW */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-secondary">
                      <span>Biaya Operasional & Kas Sesi</span>
                    </h4>
                    
                    <div className="bg-background p-4 rounded-2xl border border-border flex flex-col gap-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-secondary font-semibold">Biaya Sewa Lapangan</span>
                        <span className="font-black text-primary">{formatRp(getSewaLapangan(s, sExpenses))}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border/40 pt-2.5">
                        <span className="text-secondary font-semibold">Kas Wajib per Orang</span>
                        <span className="font-black text-primary">{formatRp(s.kas_wajib_per_orang !== undefined && s.kas_wajib_per_orang !== null ? s.kas_wajib_per_orang : iuranKasConfig)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. ACTIONS MODULE */}
                  <div className="pt-2 border-t border-border">
                    {s.status_tagihan === 'draft' ? (
                      <div className="space-y-3">
                        <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl text-xs space-y-2.5">
                          <p className="font-extrabold text-[10px] text-secondary uppercase tracking-wider border-b border-emerald-500/10 pb-1.5">
                            Perhitungan Tagihan Sesi
                          </p>
                          <div className="flex justify-between font-semibold">
                            <span className="text-secondary">Biaya Sewa Lapangan:</span>
                            <span className="text-primary">{formatRp(getSewaLapangan(s, sExpenses))}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-secondary">Jumlah Hadir:</span>
                            <span className="text-primary">{sAttendees.length} orang</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-secondary">Total Kas Wajib:</span>
                            <span className="text-primary">{formatRp(sAttendees.length * (s.kas_wajib_per_orang !== undefined && s.kas_wajib_per_orang !== null ? s.kas_wajib_per_orang : iuranKasConfig))}</span>
                          </div>
                          
                          <div className="border-t border-emerald-500/10 my-2 pt-2 space-y-1.5 text-[10px] font-semibold text-secondary">
                            <div className="flex justify-between">
                              <span>Biaya Lapangan / Orang:</span>
                              <span className="text-primary">
                                {sAttendees.length > 0 ? formatRp(Math.round((getSewaLapangan(s, sExpenses)) / sAttendees.length)) : 'Rp 0'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Kas Wajib / Orang:</span>
                              <span className="text-primary">{formatRp(s.kas_wajib_per_orang !== undefined && s.kas_wajib_per_orang !== null ? s.kas_wajib_per_orang : iuranKasConfig)}</span>
                            </div>
                          </div>

                          <div className="border-t border-emerald-500/20 pt-2 flex justify-between items-center text-xs font-black">
                            <span className="text-secondary uppercase tracking-wider">Total Tagihan:</span>
                            <span className="text-emerald-500 text-sm">
                              {formatRp((getSewaLapangan(s, sExpenses)) + (sAttendees.length * (s.kas_wajib_per_orang !== undefined && s.kas_wajib_per_orang !== null ? s.kas_wajib_per_orang : iuranKasConfig)))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-black mt-1">
                            <span className="text-secondary uppercase tracking-wider">Tagihan per Orang:</span>
                            <span className="text-emerald-500 text-sm">
                              {sAttendees.length > 0 ? formatRp(Math.round(((getSewaLapangan(s, sExpenses)) + (sAttendees.length * (s.kas_wajib_per_orang !== undefined && s.kas_wajib_per_orang !== null ? s.kas_wajib_per_orang : iuranKasConfig))) / sAttendees.length)) : 'Rp 0'}
                            </span>
                          </div>
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
                        {/* EXPORT PDF BUTTON */}
                        <button
                          onClick={() => handleExportSessionPDF(s.id)}
                          disabled={isExportingSessionPdf}
                          className="w-full py-2.5 bg-card border border-border hover:bg-background text-primary font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-60"
                        >
                          {isExportingSessionPdf && sessionPdfId === s.id ? (
                            <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Menyiapkan PDF...</>
                          ) : (
                            <><FileText size={13} />Export PDF Laporan Sesi</>
                          )}
                        </button>
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
                                      className="px-2 py-1 bg-card hover:bg-background border border-border/60 text-secondary hover:text-primary text-[9px] font-extrabold rounded-md transition-all active:scale-[0.98]"
                                      title="Tandai tagihan ini sebagai Lunas secara manual"
                                    >
                                      Tandai Lunas
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
            <button onClick={() => { setShowAddSessionModal(false); setCreateDate(''); setCreateStartTime(''); setCreateEndTime(''); }} className="absolute top-5 right-5 p-2 bg-background border border-border/45 text-secondary hover:text-primary rounded-full transition-colors">
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
                  <div className="relative cursor-pointer" onClick={() => triggerDatePicker(createDateInputRef)}>
                    <input 
                      required
                      type="text" 
                      readOnly
                      value={createDate ? formatDate(createDate) : ''} 
                      placeholder="Pilih Tanggal Main" 
                      className="w-full pl-9 pr-3 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent outline-none font-bold text-xs cursor-pointer truncate"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
                    <input 
                      ref={createDateInputRef}
                      type="date" 
                      required
                      value={createDate}
                      onChange={(e) => setCreateDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <input type="hidden" name="tanggal_main" value={createDate} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Jam Main</label>
                  <div className="relative cursor-pointer" onClick={() => openTimePicker('create')}>
                    <input 
                      required
                      type="text" 
                      readOnly
                      value={createStartTime && createEndTime ? `${createStartTime} - ${createEndTime}` : ''}
                      placeholder="Pilih Jam Main" 
                      className="w-full pl-9 pr-3 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent outline-none font-bold text-xs cursor-pointer truncate"
                    />
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
                    <input type="hidden" name="jam_main" value={createStartTime && createEndTime ? `${createStartTime} - ${createEndTime}` : ''} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Lokasi</label>
                <input required name="lokasi" type="text" placeholder="GOR Badminton Utama" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Biaya Sewa Lapangan</label>
                  <input 
                    required 
                    name="biaya_lapangan" 
                    type="text" 
                    inputMode="numeric"
                    placeholder="Contoh: 150.000" 
                    onChange={(e) => {
                      const rawVal = e.target.value.replace(/\D/g, '');
                      if (!rawVal) {
                        e.target.value = '';
                        return;
                      }
                      e.target.value = new Intl.NumberFormat('id-ID').format(parseInt(rawVal));
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Kas Wajib per Orang</label>
                  <input 
                    required 
                    name="kas_wajib_per_orang" 
                    type="text" 
                    inputMode="numeric"
                    placeholder="Contoh: 5.000" 
                    defaultValue={new Intl.NumberFormat('id-ID').format(iuranKasConfig)}
                    onChange={(e) => {
                      const rawVal = e.target.value.replace(/\D/g, '');
                      if (!rawVal) {
                        e.target.value = '';
                        return;
                      }
                      e.target.value = new Intl.NumberFormat('id-ID').format(parseInt(rawVal));
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Catatan (Optional)</label>
                <textarea name="catatan" placeholder="Catatan opsional..." rows={2} className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs resize-none"></textarea>
              </div>
              <button type="submit" disabled={isSubmittingSession} className="w-full bg-accent hover:opacity-90 text-white font-extrabold py-3.5 rounded-2xl mt-4 transition-all shadow-lg active:scale-[0.98] text-xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSubmittingSession ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Menyimpan...
                  </>
                ) : 'Buat Sesi & Tandai Hadir'}
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
                  <div className="relative cursor-pointer" onClick={() => triggerDatePicker(editDateInputRef)}>
                    <input 
                      required
                      type="text" 
                      readOnly
                      value={editDate ? formatDate(editDate) : ''} 
                      placeholder="Pilih Tanggal Main" 
                      className="w-full pl-9 pr-3 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent outline-none font-bold text-xs cursor-pointer truncate"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
                    <input 
                      ref={editDateInputRef}
                      type="date" 
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <input type="hidden" name="tanggal_main" value={editDate} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Jam Main</label>
                  <div className="relative cursor-pointer" onClick={() => openTimePicker('edit')}>
                    <input 
                      required
                      type="text" 
                      readOnly
                      value={editStartTime && editEndTime ? `${editStartTime} - ${editEndTime}` : ''}
                      placeholder="Pilih Jam Main" 
                      className="w-full pl-9 pr-3 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent outline-none font-bold text-xs cursor-pointer truncate"
                    />
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
                    <input type="hidden" name="jam_main" value={editStartTime && editEndTime ? `${editStartTime} - ${editEndTime}` : ''} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Lokasi</label>
                <input required name="lokasi" defaultValue={editingSession.lokasi} type="text" placeholder="GOR Badminton Utama" className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Biaya Sewa Lapangan</label>
                  <input 
                    required 
                    name="biaya_lapangan" 
                    type="text" 
                    inputMode="numeric"
                    placeholder="Contoh: 150.000" 
                    defaultValue={editingSession.biaya_lapangan !== undefined && editingSession.biaya_lapangan !== null ? new Intl.NumberFormat('id-ID').format(editingSession.biaya_lapangan) : ''}
                    onChange={(e) => {
                      const rawVal = e.target.value.replace(/\D/g, '');
                      if (!rawVal) {
                        e.target.value = '';
                        return;
                      }
                      e.target.value = new Intl.NumberFormat('id-ID').format(parseInt(rawVal));
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1.5">Kas Wajib per Orang</label>
                  <input 
                    required 
                    name="kas_wajib_per_orang" 
                    type="text" 
                    inputMode="numeric"
                    placeholder="Contoh: 5.000" 
                    defaultValue={editingSession.kas_wajib_per_orang !== undefined && editingSession.kas_wajib_per_orang !== null ? new Intl.NumberFormat('id-ID').format(editingSession.kas_wajib_per_orang) : new Intl.NumberFormat('id-ID').format(iuranKasConfig)}
                    onChange={(e) => {
                      const rawVal = e.target.value.replace(/\D/g, '');
                      if (!rawVal) {
                        e.target.value = '';
                        return;
                      }
                      e.target.value = new Intl.NumberFormat('id-ID').format(parseInt(rawVal));
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-background border border-border text-primary placeholder:text-secondary focus:border-accent focus:ring-accent/15 outline-none transition-all font-bold text-xs" 
                  />
                </div>
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

      {/* TIME PICKER MODAL */}
      {showTimePickerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-[2rem] border border-border p-6 shadow-theme flex flex-col gap-5 animate-scaleUp">
            <div className="text-center">
              <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider">Pilih Jam Main</h3>
              <p className="text-[10px] text-secondary mt-1">Tentukan jam mulai dan jam selesai sesi</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* JAM MULAI */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider text-center">Jam Mulai</label>
                <div className="relative">
                  <input 
                    type="time" 
                    value={tempStartTime} 
                    onChange={(e) => setTempStartTime(e.target.value)} 
                    className="w-full px-3 py-3 rounded-2xl bg-background border border-border text-primary font-bold text-sm text-center outline-none focus:border-accent cursor-pointer"
                  />
                </div>
              </div>

              {/* JAM SELESAI */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider text-center">Jam Selesai</label>
                <div className="relative">
                  <input 
                    type="time" 
                    value={tempEndTime} 
                    onChange={(e) => setTempEndTime(e.target.value)} 
                    className="w-full px-3 py-3 rounded-2xl bg-background border border-border text-primary font-bold text-sm text-center outline-none focus:border-accent cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Validation warning */}
            {timeValidationError && (
              <p className="text-red-500 text-[10px] font-bold text-center animate-shake">
                ⚠️ {timeValidationError}
              </p>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button 
                type="button"
                onClick={() => setShowTimePickerModal(false)}
                className="w-full border border-border bg-background hover:bg-border/40 text-primary font-bold py-3 rounded-2xl transition-all text-xs"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleSaveTime}
                className="w-full bg-accent hover:opacity-90 text-white font-extrabold py-3 rounded-2xl transition-all text-xs active:scale-[0.98] shadow-md shadow-emerald-500/10"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    {/* HIDDEN SESSION REPORT CONTAINER FOR PDF EXPORT */}
    {sessionPdfId !== null && (() => {
      const s       = sessions.find((x: any) => x.id === sessionPdfId);
      if (!s) return null;
      const sAtt    = attendees.filter((a: any) => a.session_id === sessionPdfId);
      const sPay    = payments.filter((p: any) => p.session_id === sessionPdfId);
      const sExp    = sessionExpenses.filter((e: any) => e.session_id === sessionPdfId);
      const biaya   = getSewaLapangan(s, sExp);
      const kasWajib = s.kas_wajib_per_orang ?? iuranKasConfig;
      return (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', overflow: 'hidden', zIndex: -1 }}>
          <SessionReportTemplate
            session={s}
            attendees={sAtt}
            payments={sPay}
            members={members}
            biayaLapangan={biaya}
            kasWajibPerOrang={kasWajib}
            formatRp={formatRp}
            formatDate={formatDate}
            namaKomunitas={settings?.nama_komunitas || ''}
            sessionExpenses={sExp}
          />
        </div>
      );
    })()}
    </div>
  );
}

// --- MEMBER MY BILLS COMPONENT ---
function MyBillsMember({ 
  user, sessions, payments, setSelectedPayment 
}: any) {
  const myPayments = user ? payments.filter((p: any) => p.member_id === user.id) : [];

  return (
    <div className="space-y-4">
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
                       p.status_pembayaran === 'generated' || p.status_pembayaran === 'unpaid' ? '🔴 Belum Bayar' : 
                       p.status_pembayaran === 'Menunggu Verifikasi Cash' ? '🟠 Menunggu Konfirmasi' :
                       '🟡 Menunggu Verifikasi'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-primary leading-snug">{session?.nama_sesi}</h3>
                  
                  {/* Breakdown details */}
                  <div className="mt-3.5 space-y-1.5 border-t border-border/40 pt-3 text-[10px] font-semibold text-secondary">
                    <div className="flex justify-between">
                      <span>Biaya Sesi:</span>
                      <span className="text-primary">{formatRp(session?.biaya_per_orang || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Iuran Kas:</span>
                      <span className="text-primary">{formatRp(Math.max(0, p.nominal_tagihan - (session?.biaya_per_orang || 0)))}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-xs border-t border-border/40 pt-3">
                    <div className="flex items-center gap-1.5 text-secondary font-bold">
                      <Calendar size={13} />
                      <span>{formatDate(session?.tanggal_main || '')}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-secondary block uppercase tracking-wider">Total Tagihan</span>
                      <div className="font-black text-primary text-base">{formatRp(p.nominal_tagihan)}</div>
                    </div>
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
    </div>
  );
}

// --- MEMBER STANDALONE PAYMENT MODAL COMPONENT ---
function PaymentModal({ 
  user, memberRecord, sessions, payments, settings, selectedPayment, setSelectedPayment, submitPaymentWithProof, submitCashPayment 
}: any) {
  const currentPayment = selectedPayment 
    ? payments.find((p: any) => p.id === selectedPayment.id) 
    : null;

  const sessionDetail = currentPayment 
    ? sessions.find((s: any) => s.id === currentPayment.session_id) 
    : null;

  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'CASH'>('QRIS');
  const [showConfirmCash, setShowConfirmCash] = useState(false);
  
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [hasClickedPaid, setHasClickedPaid] = useState(false);

  const handleDownloadQRIS = async () => {
    if (!settings?.qris_image_url) return;
    
    try {
      const response = await fetch(settings.qris_image_url);
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      
      const sessionNameClean = sessionDetail?.nama_sesi
        ? sessionDetail.nama_sesi.trim().replace(/\s+/g, '-')
        : 'Sesi';
      const filename = `QRIS-${sessionNameClean}.png`;
      
      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(localUrl);
      
      setToastMessage('QRIS berhasil diunduh');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Download QRIS error:', err);
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                const sessionNameClean = sessionDetail?.nama_sesi
                  ? sessionDetail.nama_sesi.trim().replace(/\s+/g, '-')
                  : 'Sesi';
                const filename = `QRIS-${sessionNameClean}.png`;
                
                const localUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = localUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(localUrl);
                
                setToastMessage('QRIS berhasil diunduh');
                setTimeout(() => setToastMessage(''), 3000);
              } else {
                setToastError('Gagal mengunduh QRIS, silakan coba lagi');
                setTimeout(() => setToastError(''), 3000);
              }
            }, 'image/png');
          } else {
            setToastError('Gagal mengunduh QRIS, silakan coba lagi');
            setTimeout(() => setToastError(''), 3000);
          }
        };
        img.onerror = () => {
          setToastError('Gagal mengunduh QRIS, silakan coba lagi');
          setTimeout(() => setToastError(''), 3000);
        };
        img.src = settings.qris_image_url;
      } catch (canvasErr) {
        setToastError('Gagal mengunduh QRIS, silakan coba lagi');
        setTimeout(() => setToastError(''), 3000);
      }
    }
  };

  useEffect(() => {
    if (!currentPayment) {
      setHasClickedPaid(false);
      setShowBankInfo(false);
    }
  }, [currentPayment]);

  if (!currentPayment) return null;

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
      setTimeout(() => {
        setToastMessage('');
        setSelectedPayment(null);
      }, 3000);
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
    setHasClickedPaid(false);
    setShowBankInfo(false);
  };

  return (
    <>
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-card text-primary px-5 py-3.5 rounded-full shadow-theme z-55 text-xs font-bold flex items-center gap-2 border border-border animate-bounce">
          <CheckCircle size={15} className="text-emerald-400" /> {toastMessage}
        </div>
      )}
      {toastError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-655 text-white px-5 py-3.5 rounded-full shadow-2xl z-55 text-xs font-bold flex items-center gap-2 border border-red-500 animate-shake">
          <XCircle size={15} className="text-white" /> {toastError}
        </div>
      )}

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

              {/* Breakdown Display */}
              <div className="w-full bg-background border border-border/80 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-secondary uppercase tracking-wider">Biaya Sesi</span>
                  <span className="text-primary">{formatRp(sessionDetail?.biaya_per_orang || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-secondary uppercase tracking-wider">Iuran Kas</span>
                  <span className="text-primary">{formatRp(Math.max(0, currentPayment.nominal_tagihan - (sessionDetail?.biaya_per_orang || 0)))}</span>
                </div>
                <div className="border-t border-border/60 my-2 pt-2 flex justify-between items-center text-[11px] font-black">
                  <span className="text-secondary uppercase tracking-wider">Total Tagihan</span>
                  <span className="text-emerald-500 dark:text-emerald-400">{formatRp(currentPayment.nominal_tagihan)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="w-full space-y-2 border-b border-border/50 pb-4 mb-1">
                <label className="block text-[10px] font-black text-secondary uppercase tracking-wider text-left">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center justify-center gap-2 p-3 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'QRIS'
                      ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-455 font-bold'
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
                      ? 'border-orange-500 bg-orange-500/5 text-orange-600 dark:text-orange-455 font-bold'
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
                  <div className="flex flex-col items-center gap-2">
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
                    {settings?.qris_image_url && (
                      <button 
                        onClick={handleDownloadQRIS}
                        className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-455 hover:opacity-85 transition-all bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/15 active:scale-[0.97]"
                      >
                        <Download size={12} /> Unduh QRIS
                      </button>
                    )}
                  </div>

                  {(() => {
                    const parseBankInfo = (rekeningStr: string) => {
                      if (!rekeningStr) return { bank: '-', norek: '-', nama: '-' };
                      const anPattern = /(?:a\.n\.|a\/n|an)\.?\s*(.+)$/i;
                      const matchAn = rekeningStr.match(anPattern);
                      const nama = matchAn ? matchAn[1].trim() : '-';
                      
                      const mainPart = matchAn ? rekeningStr.replace(anPattern, '').trim() : rekeningStr;
                      const parts = mainPart.split(/\s+/);
                      const bank = parts[0] || '-';
                      const norek = parts.slice(1).join(' ') || mainPart;
                      
                      return { bank, norek, nama: nama !== '-' ? nama : (settings?.nama_komunitas || 'SI Badminton') };
                    };

                    return (
                      <>
                        {!hasClickedPaid ? (
                          <div className="w-full">
                            <button 
                              onClick={() => setHasClickedPaid(true)} 
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] shadow-md shadow-emerald-950/20"
                            >
                              <CheckCircle size={14} /> Saya Sudah Bayar
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-full space-y-3">
                              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="hidden" />
                              
                              {!selectedFile ? (
                                <>
                                  <button onClick={triggerFilePicker} className="w-full border border-dashed border-border hover:border-accent/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 bg-background/40 hover:bg-background transition-colors">
                                    <Upload size={20} className="text-secondary" />
                                    <span className="text-[10px] font-bold text-primary">Pilih Bukti Transfer Pembayaran</span>
                                    <span className="text-[8px] text-secondary">Format: JPG, PNG, WEBP (Maks 5MB)</span>
                                  </button>
                                  
                                  <button 
                                    onClick={() => {
                                      setHasClickedPaid(false);
                                      handleCancelFile();
                                    }}
                                    className="w-full py-3 bg-background hover:bg-border/40 text-primary font-bold rounded-2xl border border-border transition-all text-xs"
                                  >
                                    Batal
                                  </button>
                                </>
                              ) : (
                                <>
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
                                  
                                  <div className="w-full flex gap-3 mt-3">
                                    <button 
                                      onClick={handleCancelFile}
                                      disabled={isUploading}
                                      className="px-5 py-3.5 bg-background hover:bg-border/40 text-primary font-bold rounded-2xl border border-border transition-all text-xs"
                                    >
                                      Batal
                                    </button>
                                    
                                    <div className="flex-grow">
                                      {isUploading ? (
                                        <button disabled className="w-full bg-background text-secondary font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-border cursor-not-allowed text-xs">
                                          <RefreshCw size={14} className="animate-spin" /> Mengirim Bukti...
                                        </button>
                                      ) : (
                                        <button onClick={handleUpload} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.98] shadow-md shadow-emerald-950/20">
                                          <CheckCircle size={14} /> Kirim Bukti Transfer
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        )}

                        {/* Collapsible Bank details */}
                        {settings && (
                          <div className="w-full border-t border-border/50 pt-3.5 mt-3.5 space-y-3">
                            <button
                              type="button"
                              onClick={() => setShowBankInfo(!showBankInfo)}
                              className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black text-secondary hover:text-primary transition-colors py-1"
                            >
                              <span>{showBankInfo ? '▲ Sembunyikan Info Rekening' : '▼ Lihat Info Rekening'}</span>
                            </button>
                            
                            {showBankInfo && (
                              <div className="bg-background/60 rounded-2xl p-4 border border-border/80 space-y-2.5 animate-fadeIn text-xs text-left">
                                <div className="flex justify-between items-center">
                                  <span className="text-secondary font-bold uppercase tracking-wider text-[9px]">Nama Bank</span>
                                  <span className="text-primary font-bold">{parseBankInfo(settings.rekening_penerima).bank}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-secondary font-bold uppercase tracking-wider text-[9px]">Nomor Rekening</span>
                                  <span className="text-primary font-bold select-all">{parseBankInfo(settings.rekening_penerima).norek}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-secondary font-bold uppercase tracking-wider text-[9px]">Nama Rekening</span>
                                  <span className="text-primary font-bold">{parseBankInfo(settings.rekening_penerima).nama}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                <span className="font-bold text-primary">{memberRecord?.name || user?.name || 'Anggota'}</span>
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
    </>
  );
}
// --- TREASURY (KAS) COMPONENT ---
function Treasury({ 
  saldoKas, totalIncome, totalExpense, sessionExpenses, sessions, payments, members, isAdmin,
  handleEditKasTransaction, handleDeleteKasTransaction, iuranKasConfig
}: any) {
  const [subTab, setSubTab] = useState('histori'); // 'histori' | 'laporan'
  const [kasType, setKasType] = useState('organisasi'); // 'organisasi' | 'sesi'
  
  // Date filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // PDF loading states
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfLoadingMessage, setPdfLoadingMessage] = useState('');

  // Selected Grouped Iuran for detail modal
  const [selectedGroupedIuran, setSelectedGroupedIuran] = useState<any>(null);

  // Filter for member histori kas view
  const [historiFilter, setHistoriFilter] = useState<'semua' | 'masuk' | 'keluar' | 'donasi' | 'kas_wajib'>('semua');

  const monthNames = React.useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);

  const availableYears = React.useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    if (sessions) {
      sessions.forEach((s: any) => {
        if (s.tanggal_main) {
          const year = parseInt(s.tanggal_main.split('-')[0]);
          if (!isNaN(year)) {
            years.add(year);
          }
        }
      });
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [sessions]);

  // Calculations for Session Operational Funds inside Treasury
  const totalSessionIncome = React.useMemo(() => {
    // Gunakan biaya lapangan aktual per sesi (bukan hasil perkalian split cost yang sudah dibulatkan)
    // untuk menghindari rounding error. Pendapatan Operasional = total biaya lapangan dari sesi
    // yang memiliki setidaknya satu pembayaran terverifikasi.
    if (!payments || !sessions) return 0;
    const verifiedSessionIds = new Set(
      payments
        .filter((p: any) => p.status_pembayaran === 'verified')
        .map((p: any) => p.session_id)
    );
    return sessions.reduce((sum: number, s: any) => {
      if (!verifiedSessionIds.has(s.id)) return sum;
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);
  }, [payments, sessions, sessionExpenses]);

  const totalSessionExpense = React.useMemo(() => {
    // Selalu baca dari session_expenses (single source of truth)
    // Mendukung kategori 'Sewa Lapangan' dan 'Lapangan'
    return sessions.reduce((sum: number, s: any) => {
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);
  }, [sessions, sessionExpenses]);

  const sessionBalance = totalSessionIncome - totalSessionExpense;

  const orgLedger = React.useMemo(() => {
    const events: any[] = [];
    
    // Inflows (grouped by session)
    if (payments && sessions) {
      const inflowsBySession: { [key: number]: {
        sessionId: number;
        sessionName: string;
        tanggal: string;
        totalIuran: number;
        iuranPerMember: number;
        contributorNames: string[];
      } } = {};

      payments.forEach((p: any) => {
        if (p.status_pembayaran !== 'verified') return;
        const s = sessions.find((x: any) => x.id === p.session_id);
        if (s) {
          const iuran = s.kas_wajib_per_orang ?? iuranKasConfig;
          if (iuran > 0) {
            const member = members ? members.find((m: any) => m.id === p.member_id) : null;
            const memberName = member ? member.name : 'Anggota';
            if (!inflowsBySession[s.id]) {
              inflowsBySession[s.id] = {
                sessionId: s.id,
                sessionName: s.nama_sesi,
                tanggal: s.tanggal_main,
                totalIuran: 0,
                iuranPerMember: iuran,
                contributorNames: []
              };
            }
            inflowsBySession[s.id].totalIuran += iuran;
            inflowsBySession[s.id].contributorNames.push(memberName);
          }
        }
      });

      Object.values(inflowsBySession).forEach((group: any) => {
        events.push({
          id: `session-iuran-${group.sessionId}`,
          type: 'inflow',
          tanggal: group.tanggal,
          keterangan: `Iuran Kas - ${group.sessionName}`,
          nominal: group.totalIuran,
          sub: `${group.contributorNames.length} Anggota × ${formatRp(group.iuranPerMember)}`,
          isGroupedIuran: true,
          sessionName: group.sessionName,
          memberCount: group.contributorNames.length,
          iuranPerMember: group.iuranPerMember,
          contributorNames: group.contributorNames
        });
      });
    }

    // Manual Inflows (jenis_transaksi = 'masuk')
    if (sessionExpenses) {
      sessionExpenses.forEach((e: any) => {
        if (e.session_id !== null || e.jenis_transaksi !== 'masuk') return;
        events.push({
          id: `in-${e.id}`,
          type: 'inflow',
          tanggal: e.created_at ? e.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          keterangan: e.keterangan,
          nominal: e.nominal,
          sub: e.kategori,
          rawExpense: e
        });
      });
    }

    // Outflows
    if (sessionExpenses && sessions) {
      sessionExpenses.forEach((e: any) => {
        const isOrgOutflow = e.jenis_transaksi === 'keluar' && (e.session_id === null || e.kategori !== 'Sewa Lapangan');
        if (!isOrgOutflow) return;
        
        const s = sessions.find((x: any) => x.id === e.session_id);
        events.push({
          id: `e-${e.id}`,
          type: 'outflow',
          tanggal: s ? s.tanggal_main : (e.created_at ? e.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
          keterangan: e.keterangan,
          nominal: e.nominal,
          sub: e.kategori,
          rawExpense: e
        });
      });
    }

    return events.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [payments, sessions, sessionExpenses, members, iuranKasConfig]);

  const totalIuranKasTerkumpul = totalIncome;

  // Calculations for selected period (Separated Accounting Model)
  const reportData = React.useMemo(() => {
    if (!sessions || !payments || !sessionExpenses) {
      return {
        saldoAwal: 0,
        kasMasuk: 0,
        kasKeluar: 0,
        saldoAkhir: 0,
        sumberKasMasuk: [],
        pengeluaranKas: [],
        ledger: [],
        statistics: { jumlahSesi: 0, jumlahAnggotaAktif: 0, totalKehadiran: 0, totalIuranKas: 0 },
        sessionIncome: 0,
        sessionExpense: 0,
        sessionBalance: 0
      };
    }

    const sessionsBefore: any[] = [];
    const sessionsMonth: any[] = [];
    const paymentsBefore: any[] = [];
    const paymentsMonth: any[] = [];

    sessions.forEach((s: any) => {
      if (!s.tanggal_main) return;
      const [yStr, mStr] = s.tanggal_main.split('-');
      const y = parseInt(yStr);
      const m = parseInt(mStr) - 1; // 0-indexed

      if (y < selectedYear || (y === selectedYear && m < selectedMonth)) {
        sessionsBefore.push(s);
      } else if (y === selectedYear && m === selectedMonth) {
        sessionsMonth.push(s);
      }
    });

    const sessionBeforeIds = new Set(sessionsBefore.map(s => s.id));
    const sessionMonthIds = new Set(sessionsMonth.map(s => s.id));

    payments.forEach((p: any) => {
      if (p.status_pembayaran !== 'verified') return;
      if (sessionBeforeIds.has(p.session_id)) {
        paymentsBefore.push(p);
      } else if (sessionMonthIds.has(p.session_id)) {
        paymentsMonth.push(p);
      }
    });

    const calculateIuran = (pList: any[]) => {
      return pList.reduce((sum: number, p: any) => {
        const s = sessions.find((x: any) => x.id === p.session_id);
        const kasWajib = s ? (s.kas_wajib_per_orang ?? iuranKasConfig) : iuranKasConfig;
        return sum + kasWajib;
      }, 0);
    };

    const iuranBefore = calculateIuran(paymentsBefore);
    const iuranMonth = calculateIuran(paymentsMonth);

    let manualInflowBefore = 0;
    let manualOutflowBefore = 0;
    const manualInflowMonth: any[] = [];
    const manualOutflowMonth: any[] = [];
    const sessionExpenseMonthList: any[] = [];

    sessionExpenses.forEach((e: any) => {
      const isMasuk = e.session_id === null && e.jenis_transaksi === 'masuk';
      const isKeluar = e.jenis_transaksi === 'keluar' && (e.session_id === null || e.kategori !== 'Sewa Lapangan');
      
      let tgl = '';
      if (e.session_id) {
        const s = sessions.find((x: any) => x.id === e.session_id);
        tgl = s ? s.tanggal_main : (e.created_at ? e.created_at.split('T')[0] : '');
      } else {
        tgl = e.created_at ? e.created_at.split('T')[0] : '';
      }

      if (!tgl) return;
      const [yStr, mStr] = tgl.split('-');
      const y = parseInt(yStr);
      const m = parseInt(mStr) - 1;

      if (y < selectedYear || (y === selectedYear && m < selectedMonth)) {
        if (isMasuk) {
          manualInflowBefore += e.nominal;
        } else if (isKeluar) {
          manualOutflowBefore += e.nominal;
        }
      } else if (y === selectedYear && m === selectedMonth) {
        if (isMasuk) {
          manualInflowMonth.push({
            id: e.id,
            tanggal: tgl,
            keterangan: e.keterangan,
            kategori: e.kategori,
            nominal: e.nominal
          });
        } else if (isKeluar) {
          manualOutflowMonth.push({
            id: e.id,
            tanggal: tgl,
            keterangan: e.keterangan,
            kategori: e.kategori,
            nominal: e.nominal
          });
        } else {
          sessionExpenseMonthList.push(e);
        }
      }
    });

    const saldoAwal = iuranBefore + manualInflowBefore - manualOutflowBefore;
    const kasMasuk = iuranMonth + manualInflowMonth.reduce((sum, e) => sum + e.nominal, 0);
    const kasKeluar = manualOutflowMonth.reduce((sum, e) => sum + e.nominal, 0);
    const saldoAkhir = saldoAwal + kasMasuk - kasKeluar;

    const sessionInflowList = sessionsMonth
      .map((s: any) => {
        const sessionPayments = payments.filter((p: any) => {
          return p.session_id === s.id && p.status_pembayaran === 'verified';
        });
        const totalSessionIuran = sessionPayments.reduce((sum: number, p: any) => {
          const kasWajib = s.kas_wajib_per_orang ?? iuranKasConfig;
          return sum + kasWajib;
        }, 0);
        return {
          id: `session-iuran-${s.id}`,
          tanggal: s.tanggal_main,
          nama: `Iuran Kas - ${s.nama_sesi} (${sessionPayments.length} anggota)`,
          jumlah: totalSessionIuran
        };
      })
      .filter((s: any) => s.jumlah > 0);

    const manualInflowList = manualInflowMonth.map((e: any) => ({
      id: `manual-in-${e.id}`,
      tanggal: e.tanggal,
      nama: `${e.keterangan} (${e.kategori})`,
      jumlah: e.nominal
    }));

    const sumberKasMasuk = [...sessionInflowList, ...manualInflowList]
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    const pengeluaranKas = manualOutflowMonth
      .map((e: any) => ({
        id: e.id,
        tanggal: e.tanggal,
        keterangan: e.keterangan,
        kategori: e.kategori,
        nominal: e.nominal
      }))
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    const ledgerEvents: any[] = [];
    sumberKasMasuk.forEach(s => {
      if (s.jumlah > 0) {
        ledgerEvents.push({
          type: 'masuk',
          tanggal: s.tanggal,
          keterangan: s.nama,
          masuk: s.jumlah,
          keluar: 0
        });
      }
    });

    pengeluaranKas.forEach(e => {
      ledgerEvents.push({
        type: 'keluar',
        tanggal: e.tanggal,
        keterangan: e.keterangan,
        masuk: 0,
        keluar: e.nominal
      });
    });

    ledgerEvents.sort((a, b) => {
      const dateDiff = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (a.type !== b.type) {
        return a.type === 'masuk' ? -1 : 1;
      }
      return 0;
    });

    let currentBalance = saldoAwal;
    const ledger = ledgerEvents.map(event => {
      if (event.type === 'masuk') {
        currentBalance += event.masuk;
      } else {
        currentBalance -= event.keluar;
      }
      return {
        ...event,
        saldo: currentBalance
      };
    });

    const jumlahSesi = sessionsMonth.length;
    const jumlahAnggotaAktif = members ? members.filter((m: any) => m.status === 'aktif').length : 0;
    const totalKehadiran = payments.filter((p: any) => sessionMonthIds.has(p.session_id)).length;
    const totalIuranKas = kasMasuk;

    // Gunakan biaya lapangan aktual per sesi (bukan hasil perkalian split cost yang sudah dibulatkan)
    // untuk menghindari rounding error pada laporan bulanan.
    const verifiedSessionIdsMonth = new Set(paymentsMonth.map(p => p.session_id));
    const sessionIncomeMonth = sessionsMonth.reduce((sum, s) => {
      if (!verifiedSessionIdsMonth.has(s.id)) return sum;
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);

    const sessionExpenseMonth = sessionsMonth.reduce((sum, s) => {
      const sExpenses = sessionExpenses.filter((e: any) => e.session_id === s.id);
      return sum + getSewaLapangan(s, sExpenses);
    }, 0);

    return {
      saldoAwal,
      kasMasuk,
      kasKeluar,
      saldoAkhir,
      sumberKasMasuk,
      pengeluaranKas,
      ledger,
      statistics: {
        jumlahSesi,
        jumlahAnggotaAktif,
        totalKehadiran,
        totalIuranKas
      },
      sessionIncome: sessionIncomeMonth,
      sessionExpense: sessionExpenseMonth,
      sessionBalance: sessionIncomeMonth - sessionExpenseMonth
    };
  }, [sessions, sessionExpenses, payments, selectedMonth, selectedYear, members, iuranKasConfig]);

  // Format dates for period display
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthName = monthNames[selectedMonth];
  const periodStr = `01 ${monthName} ${selectedYear} - ${lastDay} ${monthName} ${selectedYear}`;
  
  const formatToday = () => {
    const today = new Date();
    const d = today.getDate();
    const m = monthNames[today.getMonth()];
    const y = today.getFullYear();
    return `${d} ${m} ${y}`;
  };

  const handleExportPDF = () => {
    // 6. If no data is available, do not generate PDF
    if (reportData.statistics.jumlahSesi === 0 && reportData.pengeluaranKas.length === 0) {
      alert('Tidak ada data pada periode yang dipilih.');
      return;
    }

    // 8. Add loading state
    setIsGeneratingPDF(true);
    setPdfLoadingMessage('Menyiapkan laporan PDF...');

    // 7. Wait for React rendering completion before generating PDF
    setTimeout(() => {
      const element = document.getElementById('report-content');
      const wrapper = document.getElementById('report-wrapper');
      
      // 5. Add debugging logs
      console.log('Export PDF');
      console.log('Element:', element);
      console.log('Report Data:', reportData);
      console.log('Summary Data:', {
        saldoAwal: reportData.saldoAwal,
        kasMasuk: reportData.kasMasuk,
        kasKeluar: reportData.kasKeluar,
        saldoAkhir: reportData.saldoAkhir
      });
      console.log('Transactions (Ledger):', reportData.ledger);
      console.log('Expenses:', reportData.pengeluaranKas);

      // 1. Verify that the HTML report container exists and has content
      if (!element) {
        alert('Gagal mengekspor: Kontainer laporan tidak ditemukan.');
        setIsGeneratingPDF(false);
        return;
      }

      if (!element.innerHTML || element.innerHTML.trim() === '') {
        alert('Gagal mengekspor: Kontainer laporan kosong.');
        setIsGeneratingPDF(false);
        return;
      }

      // Temporarily bring the wrapper into layout flow (fixed positioning at 0, 0)
      // to avoid html2canvas negative offset empty page bug, keeping it hidden
      // behind the z-[10000] loading overlay.
      if (wrapper) {
        wrapper.style.position = 'fixed';
        wrapper.style.left = '0px';
        wrapper.style.top = '0px';
        wrapper.style.zIndex = '9990';
      }

      const oldTitle = document.title;
      const filename = `Laporan-Kas-${monthName}-${selectedYear}.pdf`;
      document.title = filename.replace('.pdf', '');

      const opt = {
        margin:       0, // Use 0 margin to let HTML padding act as print margins
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      if (typeof (window as any).html2pdf === 'function') {
        (window as any).html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184); // slate-400
            
            // Draw "Page X of Y" at the bottom right corner (198mm, 288mm)
            pdf.text(
              `Page ${i} of ${totalPages}`,
              198,
              288,
              { align: 'right' }
            );
          }
        }).save().then(() => {
          // Restore wrapper positioning
          if (wrapper) {
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '-9999px';
            wrapper.style.zIndex = '';
          }
          document.title = oldTitle;
          setIsGeneratingPDF(false);
        }).catch((err: any) => {
          console.error('Error exporting PDF:', err);
          // Restore wrapper positioning on error
          if (wrapper) {
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '-9999px';
            wrapper.style.zIndex = '';
          }
          document.title = oldTitle;
          setIsGeneratingPDF(false);
        });
      } else {
        alert('Gagal memuat library PDF. Harap pastikan koneksi internet Anda aktif untuk memuat library PDF.');
        // Restore wrapper positioning
        if (wrapper) {
          wrapper.style.position = 'absolute';
          wrapper.style.left = '-9999px';
          wrapper.style.top = '-9999px';
          wrapper.style.zIndex = '';
        }
        document.title = oldTitle;
        setIsGeneratingPDF(false);
      }
    }, 800); // 800ms delay to guarantee React render cycle completes and DOM is stable
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* LOADING OVERLAY FOR PDF GENERATION */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[10000] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-t-accent border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          <p className="text-sm font-black text-primary tracking-wide animate-pulse">{pdfLoadingMessage}</p>
        </div>
      )}

      {/* SUB TABS NAVIGATION — primary, full width */}
      {isAdmin && (
        <div className="flex bg-card p-1 rounded-2xl border border-border shadow-inner">
          <button
            onClick={() => setSubTab('histori')}
            className={`flex-grow py-2 px-3 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 ${
              subTab === 'histori'
                ? 'bg-accent text-white shadow-theme'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Histori Kas
          </button>
          <button
            onClick={() => setSubTab('laporan')}
            className={`flex-grow py-2 px-3 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 ${
              subTab === 'laporan'
                ? 'bg-accent text-white shadow-theme'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Laporan Bulanan
          </button>
        </div>
      )}

      {/* DEFAULT HISTORI KAS VIEW */}
      {(subTab === 'histori' || !isAdmin) && (
        <>
          {/* Secondary segmented control — centered, 75% width, iOS-style sliding pill */}
          {isAdmin && (
            <div className="flex justify-center mt-4">
              <div
                className="relative flex bg-card border border-border/80 rounded-2xl p-1 shadow-inner"
                style={{ width: '75%' }}
              >
                {/* Animated sliding pill behind the buttons */}
                <div
                  className="absolute top-1 bottom-1 rounded-xl bg-accent shadow-theme transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    width: 'calc(50% - 4px)',
                    transform: kasType === 'sesi' ? 'translateX(calc(100% + 4px))' : 'translateX(0)',
                  }}
                />
                <button
                  onClick={() => setKasType('organisasi')}
                  className={`relative z-10 flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors duration-200 ${
                    kasType === 'organisasi' ? 'text-white' : 'text-secondary hover:text-primary'
                  }`}
                >
                  Kas Organisasi
                </button>
                <button
                  onClick={() => setKasType('sesi')}
                  className={`relative z-10 flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors duration-200 ${
                    kasType === 'sesi' ? 'text-white' : 'text-secondary hover:text-primary'
                  }`}
                >
                  Dana Operasional
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MEMBER VIEW — REDESIGNED HISTORI KAS (Fintech Modern Style)  */}
          {/* ============================================================ */}
          {!isAdmin ? (
            <div className="space-y-5">
              {/* === HERO SALDO CARD === */}
              <div
                className="relative rounded-3xl overflow-hidden p-6"
                style={{
                  background: 'linear-gradient(135deg, #00422c 0%, #005c3f 55%, #10B981 100%)',
                }}
              >
                {/* Decorative circles */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute top-4 right-12 w-12 h-12 rounded-full bg-white/5 pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                      <Wallet size={14} className="text-white" />
                    </div>
                    <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest">Saldo Kas</p>
                  </div>
                  <h2 className="text-[2rem] font-black text-white tracking-tight leading-none mb-1">
                    {formatRp(saldoKas)}
                  </h2>
                  <p className="text-white/50 text-[10px] font-semibold">Total dana kas organisasi</p>
                </div>
              </div>

              {/* === SUMMARY STRIP — 3 CARDS === */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Kas Masuk */}
                <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col gap-1 shadow-theme">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center">
                      <TrendingUp size={11} className="text-emerald-500" strokeWidth={2.5} />
                    </div>
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider leading-none">Masuk</p>
                  </div>
                  <p className="text-[13px] font-black text-emerald-500 leading-none tabular-nums">{formatRp(totalIncome)}</p>
                </div>

                {/* Kas Keluar */}
                <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col gap-1 shadow-theme">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-5 h-5 rounded-md bg-red-500/15 flex items-center justify-center">
                      <TrendingDown size={11} className="text-red-400" strokeWidth={2.5} />
                    </div>
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider leading-none">Keluar</p>
                  </div>
                  <p className="text-[13px] font-black text-red-400 leading-none tabular-nums">{formatRp(totalExpense)}</p>
                </div>

                {/* Total Transaksi */}
                <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col gap-1 shadow-theme">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-5 h-5 rounded-md bg-accent/15 flex items-center justify-center">
                      <Activity size={11} className="text-accent" strokeWidth={2.5} />
                    </div>
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider leading-none">Transaksi</p>
                  </div>
                  <p className="text-[13px] font-black text-primary leading-none tabular-nums">{orgLedger.length}</p>
                </div>
              </div>

              {/* === FILTER CHIPS (HORIZONTAL SCROLL) === */}
              <div className="-mx-4 px-4">
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {([
                    { key: 'semua',    label: 'Semua' },
                    { key: 'masuk',    label: 'Masuk' },
                    { key: 'keluar',   label: 'Keluar' },
                    { key: 'donasi',   label: 'Donasi' },
                    { key: 'kas_wajib', label: 'Kas Wajib' },
                  ] as const).map((chip) => (
                    <button
                      key={chip.key}
                      onClick={() => setHistoriFilter(chip.key)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-200 border ${
                        historiFilter === chip.key
                          ? 'bg-accent text-white border-accent shadow-md shadow-emerald-900/20'
                          : 'bg-card text-secondary border-border hover:border-accent/50 hover:text-primary'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* === TRANSACTION LIST === */}
              <div className="space-y-2.5">
                {(() => {
                  const filtered = orgLedger.filter((evt: any) => {
                    if (historiFilter === 'semua') return true;
                    if (historiFilter === 'masuk') return evt.type === 'inflow' && !evt.isGroupedIuran;
                    if (historiFilter === 'keluar') return evt.type === 'outflow';
                    if (historiFilter === 'donasi') {
                      const sub = (evt.sub || '').toLowerCase();
                      const ket = (evt.keterangan || '').toLowerCase();
                      return sub.includes('donasi') || ket.includes('donasi');
                    }
                    if (historiFilter === 'kas_wajib') return evt.isGroupedIuran === true;
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center gap-3 py-12 bg-card border border-dashed border-border rounded-3xl">
                        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                          <Receipt size={22} className="text-accent" strokeWidth={1.8} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-primary">Tidak Ada Transaksi</p>
                          <p className="text-[11px] text-secondary mt-0.5">Belum ada transaksi pada kategori ini.</p>
                        </div>
                      </div>
                    );
                  }

                  return filtered.map((evt: any) => {
                    const isInflow = evt.type === 'inflow';
                    const isKasWajib = evt.isGroupedIuran === true;

                    // Choose icon
                    let IconEl: React.ReactNode;
                    let iconBg: string;
                    if (isKasWajib) {
                      IconEl = <CheckCircle size={17} strokeWidth={2} />;
                      iconBg = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                    } else if (isInflow) {
                      IconEl = <TrendingUp size={17} strokeWidth={2.2} />;
                      iconBg = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
                    } else {
                      IconEl = <TrendingDown size={17} strokeWidth={2.2} />;
                      iconBg = 'bg-red-500/10 text-red-400 border border-red-500/20';
                    }

                    // Category badge color
                    const subLower = (evt.sub || '').toLowerCase();
                    let badgeCls = 'bg-background text-secondary';
                    if (isKasWajib) badgeCls = 'bg-emerald-500/10 text-emerald-400';
                    else if (subLower.includes('donasi')) badgeCls = 'bg-blue-500/10 text-blue-400';
                    else if (!isInflow) badgeCls = 'bg-red-500/10 text-red-400';

                    return (
                      <div
                        key={evt.id}
                        onClick={() => isKasWajib && setSelectedGroupedIuran(evt)}
                        className={`bg-card rounded-2xl border border-border shadow-theme transition-all duration-200 ${
                          isKasWajib ? 'cursor-pointer hover:border-accent/30 active:scale-[0.99]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5 p-4">
                          {/* Icon */}
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                            {IconEl}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[13px] text-primary truncate leading-tight">{evt.keterangan}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                                {isKasWajib ? 'Kas Wajib' : evt.sub}
                              </span>
                              <span className="text-[10px] text-secondary font-semibold">{formatDate(evt.tanggal)}</span>
                              {isKasWajib && (
                                <span className="text-[10px] text-secondary font-semibold flex items-center gap-0.5">
                                  <ChevronRight size={10} /> Detail
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-black tabular-nums ${
                              isInflow ? 'text-emerald-500' : 'text-red-400'
                            }`}>
                              {isInflow ? '+' : '-'}{formatRp(evt.nominal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
            /* ADMIN VIEW — preserved exactly */
            <div className="mt-5">{kasType === 'organisasi' ? (
            <div className="bg-card rounded-[2rem] p-6 text-center border border-border shadow-theme relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-secondary">
                <Wallet size={100} />
              </div>
              <p className="text-secondary text-xs font-bold uppercase tracking-wider mb-1">Saldo Kas</p>
              <h2 className="text-3xl font-black text-emerald-450 tracking-tight">{formatRp(saldoKas)}</h2>
              
              <div className="flex gap-4 border-t border-border pt-4 mt-5 text-left">
                <div className="flex-1">
                  <p className="text-secondary text-[9px] font-bold uppercase">Kas Masuk</p>
                  <p className="font-extrabold text-xs text-primary">{formatRp(totalIncome)}</p>
                </div>
                <div className="w-px bg-border"></div>
                <div className="flex-1">
                  <p className="text-secondary text-[9px] font-bold uppercase">Kas Keluar</p>
                  <p className="font-extrabold text-xs text-primary">{formatRp(totalExpense)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-[2rem] p-6 text-center border border-border shadow-theme relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-secondary">
                <Activity size={100} />
              </div>
              <p className="text-secondary text-xs font-bold uppercase tracking-wider mb-1">Surplus / Defisit</p>
              <h2 className={`text-3xl font-black tracking-tight ${sessionBalance < 0 ? 'text-red-400' : 'text-emerald-450'}`}>
                {sessionBalance < 0 ? '-' : ''}{formatRp(Math.abs(sessionBalance))}
              </h2>
              
              <div className="flex gap-4 border-t border-border pt-4 mt-5 text-left">
                <div className="flex-1">
                  <p className="text-secondary text-[9px] font-bold uppercase">Pendapatan Operasional</p>
                  <p className="font-extrabold text-xs text-primary">{formatRp(totalSessionIncome)}</p>
                </div>
                <div className="w-px bg-border"></div>
                <div className="flex-1">
                  <p className="text-secondary text-[9px] font-bold uppercase">Pengeluaran Sewa Lapangan</p>
                  <p className="font-extrabold text-xs text-primary">{formatRp(totalSessionExpense)}</p>
                </div>
              </div>
            </div>
          )}

          </div>
          )}

          {/* Admin transaction list (only shown to admins) */}
          {isAdmin && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-primary uppercase tracking-wider">
              {kasType === 'organisasi' ? 'Histori Transaksi Kas' : 'Histori Sewa Lapangan'}
            </h2>
            
            {kasType === 'organisasi' ? (
              orgLedger.length === 0 ? (
                <div className="text-center p-8 bg-card border border-dashed border-border rounded-3xl text-secondary text-xs font-bold">
                  Belum ada transaksi kas organisasi.
                </div>
              ) : (
                <div className="space-y-3">
                  {orgLedger.map((evt: any) => (
                    <div 
                      key={evt.id} 
                      onClick={() => evt.isGroupedIuran && setSelectedGroupedIuran(evt)}
                      className={`bg-card p-4 rounded-2xl border border-border flex items-center gap-3.5 shadow-theme transition-all ${
                        evt.isGroupedIuran ? 'cursor-pointer hover:bg-border/20 active:scale-[0.99] hover:shadow-md' : ''
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        evt.type === 'inflow' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {evt.type === 'inflow' ? <TrendingUp size={16} strokeWidth={2.2} /> : <Wallet size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-xs text-primary truncate">{evt.keterangan}</p>
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-secondary font-bold">
                          <span className="bg-background text-secondary px-1.5 py-0.5 rounded">{evt.sub}</span>
                          <span>{formatDate(evt.tanggal)}</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <p className={`text-xs font-black ${evt.type === 'inflow' ? 'text-emerald-500' : 'text-red-400'}`}>
                          {evt.type === 'inflow' ? '+' : '-'}{formatRp(evt.nominal)}
                        </p>
                        {isAdmin && evt.rawExpense && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEditKasTransaction(evt.rawExpense)}
                              className="p-1 text-secondary hover:text-accent rounded hover:bg-background transition-colors"
                              title="Edit Transaksi"
                            >
                              <Edit size={12} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => handleDeleteKasTransaction(evt.rawExpense)}
                              className="p-1 text-red-455 hover:text-red-600 rounded hover:bg-background transition-colors"
                              title="Hapus Transaksi"
                            >
                              <Trash2 size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              sessionExpenses.filter((e: any) => e.kategori === 'Sewa Lapangan').length === 0 ? (
                <div className="text-center p-8 bg-card border border-dashed border-border rounded-3xl text-secondary text-xs font-bold">
                  Belum ada biaya sewa lapangan dicatat.
                </div>
              ) : (
                <div className="space-y-3">
                  {[...sessionExpenses]
                    .filter((e: any) => e.kategori === 'Sewa Lapangan')
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((exp: any) => {
                      const session = sessions.find((s: any) => s.id === exp.session_id);
                      return (
                        <div key={exp.id} className="bg-card p-4 rounded-2xl border border-border flex items-center gap-3.5 shadow-theme transition-all">
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
              )
            )}
          </div>
          )}
        </>
      )}

      {/* LAPORAN BULANAN VIEW */}
      {isAdmin && subTab === 'laporan' && (
        <div className="space-y-6">
          {/* FILTER CARD */}
          <div className="bg-card rounded-[2rem] p-5 border border-border shadow-theme">
            <h3 className="text-xs font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Calendar size={14} /> Filter Periode Laporan
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Bulan</label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-primary font-bold appearance-none cursor-pointer focus:outline-none focus:border-accent"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={idx}>{name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Tahun</label>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-primary font-bold appearance-none cursor-pointer focus:outline-none focus:border-accent"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            <button
              onClick={handleExportPDF}
              disabled={reportData.statistics.jumlahSesi === 0 && reportData.pengeluaranKas.length === 0}
              className={`w-full mt-5 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-xs active:scale-[0.98] ${
                reportData.statistics.jumlahSesi === 0 && reportData.pengeluaranKas.length === 0
                  ? 'bg-border text-secondary cursor-not-allowed opacity-50'
                  : 'bg-accent hover:opacity-90 text-white shadow-md shadow-emerald-950/20'
              }`}
            >
              <Download size={15} /> Export PDF
            </button>
          </div>

          {/* 6. If no data is available, show "Tidak ada data..." */}
          {reportData.statistics.jumlahSesi === 0 && reportData.pengeluaranKas.length === 0 ? (
            <div className="bg-card rounded-[2rem] p-8 text-center border border-border shadow-theme">
              <p className="text-secondary text-sm font-bold">Tidak ada data pada periode yang dipilih.</p>
            </div>
          ) : (
            <>
              {/* RINGKASAN KEUANGAN */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-wider">Kas Organisasi</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-theme">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Saldo Awal</p>
                    <p className="text-base font-black text-primary mt-1">
                      {reportData.saldoAwal < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAwal))}
                    </p>
                  </div>
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-theme">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Kas Masuk</p>
                    <p className="text-base font-black text-accent mt-1">+{formatRp(Math.abs(reportData.kasMasuk))}</p>
                  </div>
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-theme">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Kas Keluar</p>
                    <p className="text-base font-black text-red-450 mt-1">-{formatRp(Math.abs(reportData.kasKeluar))}</p>
                  </div>
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-theme">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Saldo Akhir</p>
                    <p className="text-base font-black text-primary mt-1">
                      {reportData.saldoAkhir < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAkhir))}
                    </p>
                  </div>
                </div>
              </div>

              {/* RINGKASAN KEUANGAN OPERASIONAL SESI */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-wider">Keuangan Operasional Sesi</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-theme">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Pendapatan Operasional</p>
                    <p className="text-sm font-black text-emerald-450 mt-1">+{formatRp(Math.abs(reportData.sessionIncome))}</p>
                  </div>
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-theme">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Pengeluaran Sewa Lapangan</p>
                    <p className="text-sm font-black text-red-450 mt-1">-{formatRp(Math.abs(reportData.sessionExpense))}</p>
                  </div>
                  <div className="bg-card rounded-2xl p-4 border border-border shadow-theme">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Surplus/Defisit</p>
                    <p className={`text-sm font-black mt-1 ${reportData.sessionBalance < 0 ? 'text-red-455' : 'text-primary'}`}>
                      {reportData.sessionBalance < 0 ? '-' : ''}{formatRp(Math.abs(reportData.sessionBalance))}
                    </p>
                  </div>
                </div>
              </div>

              {/* STATISTIK */}
              <div className="bg-card rounded-[2rem] p-5 border border-border shadow-theme">
                <h3 className="text-xs font-black text-primary uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Activity size={14} /> Statistik Periode Ini
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-background rounded-xl p-3 border border-border/40">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Jumlah Sesi</p>
                    <p className="text-lg font-black text-primary mt-1">{reportData.statistics.jumlahSesi}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border/40">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Anggota Aktif</p>
                    <p className="text-lg font-black text-primary mt-1">{reportData.statistics.jumlahAnggotaAktif}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border/40">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Total Kehadiran</p>
                    <p className="text-lg font-black text-primary mt-1">{reportData.statistics.totalKehadiran}</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border/40">
                    <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Total Iuran Kas</p>
                    <p className="text-lg font-black text-primary mt-1">{formatRp(reportData.statistics.totalIuranKas)}</p>
                  </div>
                </div>
              </div>

              {/* TABEL PREVIEW */}
              <div className="space-y-6">
                {/* SUMBER KAS MASUK */}
                <div className="bg-card rounded-[2rem] p-5 border border-border shadow-theme space-y-3">
                  <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-accent" /> Sumber Kas Masuk
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-background border-b border-border text-secondary font-bold text-[9px] uppercase tracking-wider">
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Sesi</th>
                          <th className="p-3 text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.sumberKasMasuk.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-secondary">Tidak ada kas masuk periode ini.</td>
                          </tr>
                        ) : (
                          reportData.sumberKasMasuk.map((s: any) => (
                            <tr key={s.id} className="border-b border-border/40 hover:bg-background/40">
                              <td className="p-3 text-secondary font-bold whitespace-nowrap">{formatDate(s.tanggal)}</td>
                              <td className="p-3 text-primary font-extrabold">{s.nama}</td>
                              <td className="p-3 text-right font-black text-accent">+{formatRp(s.jumlah)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PENGELUARAN KAS */}
                <div className="bg-card rounded-[2rem] p-5 border border-border shadow-theme space-y-3">
                  <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet size={14} className="text-red-400" /> Pengeluaran Kas
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-background border-b border-border text-secondary font-bold text-[9px] uppercase tracking-wider">
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Keterangan</th>
                          <th className="p-3">Kategori</th>
                          <th className="p-3 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.pengeluaranKas.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-secondary">Tidak ada pengeluaran periode ini.</td>
                          </tr>
                        ) : (
                          reportData.pengeluaranKas.map((e: any) => (
                            <tr key={e.id} className="border-b border-border/40 hover:bg-background/40">
                              <td className="p-3 text-secondary font-bold whitespace-nowrap">{formatDate(e.tanggal)}</td>
                              <td className="p-3 text-primary font-extrabold">{e.keterangan}</td>
                              <td className="p-3 text-secondary"><span className="bg-background px-2 py-0.5 rounded text-[10px] font-bold border border-border/50">{e.kategori}</span></td>
                              <td className="p-3 text-right font-black text-red-450">-{formatRp(e.nominal)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SALDO BERJALAN LEDGER */}
                <div className="bg-card rounded-[2rem] p-5 border border-border shadow-theme space-y-3">
                  <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Activity size={14} className="text-blue-400" /> Saldo Berjalan (Ledger)
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-background border-b border-border text-secondary font-bold text-[9px] uppercase tracking-wider">
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Keterangan</th>
                          <th className="p-3 text-right">Masuk</th>
                          <th className="p-3 text-right">Keluar</th>
                          <th className="p-3 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/40 bg-background/20 text-secondary italic font-semibold">
                          <td className="p-3">-</td>
                          <td className="p-3">Saldo Awal Periode</td>
                          <td className="p-3 text-right">-</td>
                          <td className="p-3 text-right">-</td>
                          <td className="p-3 text-right text-primary font-black">{formatRp(reportData.saldoAwal)}</td>
                        </tr>
                        {reportData.ledger.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-secondary">Tidak ada transaksi tercatat periode ini.</td>
                          </tr>
                        ) : (
                          reportData.ledger.map((row: any, idx: number) => (
                            <tr key={idx} className="border-b border-border/40 hover:bg-background/40">
                              <td className="p-3 text-secondary font-bold whitespace-nowrap">{formatDate(row.tanggal)}</td>
                              <td className="p-3 text-primary font-extrabold">{row.keterangan}</td>
                              <td className={`p-3 text-right font-black ${row.masuk > 0 ? 'text-accent' : 'text-secondary/40'}`}>
                                {row.masuk > 0 ? `+${formatRp(row.masuk)}` : '-'}
                              </td>
                              <td className={`p-3 text-right font-black ${row.keluar > 0 ? 'text-red-455' : 'text-secondary/40'}`}>
                                {row.keluar > 0 ? `-${formatRp(row.keluar)}` : '-'}
                              </td>
                              <td className="p-3 text-right text-primary font-black">{formatRp(row.saldo)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. & 4. DEDICATED HIDDEN CONTAINER FOR PDF EXPORT POSITIONED OFF-SCREEN */}
      <div id="report-wrapper" style={{ position: 'absolute', left: '-9999px', top: '-9999px', overflow: 'hidden' }}>
        <div id="report-content" className="bg-white text-slate-800 p-12 w-[794px] font-sans" style={{ boxSizing: 'border-box', minHeight: '1123px' }}>
          
          {/* HEADER */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap">SI-PATRA</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">Sistem Informasi Badminton & Kas</p>
              </div>
              <div className="text-right pl-4">
                <h1 className="text-xl font-bold text-slate-900 whitespace-nowrap">Laporan Kas Bulanan</h1>
                <p className="text-xs font-bold text-slate-600 mt-1 whitespace-nowrap">Periode: {periodStr}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">Tanggal Cetak: {formatToday()}</p>
              </div>
            </div>
          </div>

          {reportData.statistics.jumlahSesi === 0 && reportData.pengeluaranKas.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-slate-500 text-sm font-bold my-10">
              Tidak ada data pada periode yang dipilih.
            </div>
          ) : (
            <>
              {/* RINGKASAN KEUANGAN */}
              <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 border-l-4 border-slate-800 pl-2">Ringkasan Keuangan Kas Organisasi</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Saldo Awal</p>
                    <p className="text-sm font-black text-slate-800 mt-1 whitespace-nowrap">
                      {reportData.saldoAwal < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAwal))}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Kas Masuk</p>
                    <p className="text-sm font-black text-emerald-600 mt-1 whitespace-nowrap">
                      +{formatRp(Math.abs(reportData.kasMasuk))}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Kas Keluar</p>
                    <p className="text-sm font-black text-red-650 mt-1 whitespace-nowrap">
                      -{formatRp(Math.abs(reportData.kasKeluar))}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Saldo Akhir</p>
                    <p className="text-sm font-black text-slate-800 mt-1 whitespace-nowrap">
                      {reportData.saldoAkhir < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAkhir))}
                    </p>
                  </div>
                </div>
              </div>

              {/* RINGKASAN KEUANGAN SESI */}
              <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 border-l-4 border-slate-800 pl-2">Keuangan Operasional Sesi</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Pendapatan Operasional</p>
                    <p className="text-sm font-black text-emerald-600 mt-1 whitespace-nowrap">
                      +{formatRp(Math.abs(reportData.sessionIncome))}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Pengeluaran Sewa Lapangan</p>
                    <p className="text-sm font-black text-red-650 mt-1 whitespace-nowrap">
                      -{formatRp(Math.abs(reportData.sessionExpense))}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Surplus / Defisit</p>
                    <p className={`text-sm font-black mt-1 whitespace-nowrap ${reportData.sessionBalance < 0 ? 'text-red-650' : 'text-slate-800'}`}>
                      {reportData.sessionBalance < 0 ? '-' : ''}{formatRp(Math.abs(reportData.sessionBalance))}
                    </p>
                  </div>
                </div>
              </div>

              {/* STATISTIK */}
              <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 border-l-4 border-slate-800 pl-2">Statistik Sesi & Kas</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Jumlah Sesi</p>
                    <p className="text-base font-black text-slate-800 mt-0.5">{reportData.statistics.jumlahSesi}</p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Anggota Aktif</p>
                    <p className="text-base font-black text-slate-800 mt-0.5">{reportData.statistics.jumlahAnggotaAktif}</p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total Kehadiran</p>
                    <p className="text-base font-black text-slate-800 mt-0.5">{reportData.statistics.totalKehadiran}</p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total Iuran Kas</p>
                    <p className="text-base font-black text-slate-800 mt-0.5 whitespace-nowrap">
                      {reportData.statistics.totalIuranKas < 0 ? '-' : ''}{formatRp(Math.abs(reportData.statistics.totalIuranKas))}
                    </p>
                  </div>
                </div>
              </div>

              {/* SUMBER KAS MASUK */}
              <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-l-4 border-slate-800 pl-2">Sumber Kas Masuk</h3>
                <table className="w-full text-left border-collapse border border-slate-200 text-xs" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold">
                      <th style={{ width: '20%' }} className="p-2.5 border border-slate-300">Tanggal</th>
                      <th style={{ width: '55%' }} className="p-2.5 border border-slate-300">Sesi</th>
                      <th style={{ width: '25%' }} className="p-2.5 border border-slate-300 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.sumberKasMasuk.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400 font-medium border border-slate-200">Tidak ada kas masuk periode ini.</td>
                      </tr>
                    ) : (
                      reportData.sumberKasMasuk.map((s: any, idx: number) => (
                        <tr key={s.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                          <td className="p-2.5 border border-slate-200 whitespace-nowrap">{formatDate(s.tanggal)}</td>
                          <td className="p-2.5 border border-slate-200 break-words font-semibold text-slate-800">{s.nama}</td>
                          <td className="p-2.5 border border-slate-200 text-right font-bold text-emerald-600 whitespace-nowrap">+{formatRp(Math.abs(s.jumlah))}</td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-slate-100/80 font-bold">
                      <td colSpan={2} className="p-2.5 border border-slate-200 text-right">Subtotal:</td>
                      <td className="p-2.5 border border-slate-200 text-right text-emerald-700 whitespace-nowrap">+{formatRp(Math.abs(reportData.kasMasuk))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PENGELUARAN KAS */}
              <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-l-4 border-slate-800 pl-2">Pengeluaran Kas</h3>
                <table className="w-full text-left border-collapse border border-slate-200 text-xs" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold">
                      <th style={{ width: '20%' }} className="p-2.5 border border-slate-300">Tanggal</th>
                      <th style={{ width: '40%' }} className="p-2.5 border border-slate-300">Keterangan</th>
                      <th style={{ width: '20%' }} className="p-2.5 border border-slate-300">Kategori</th>
                      <th style={{ width: '20%' }} className="p-2.5 border border-slate-300 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.pengeluaranKas.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 font-medium border border-slate-200">Tidak ada pengeluaran periode ini.</td>
                      </tr>
                    ) : (
                      reportData.pengeluaranKas.map((e: any, idx: number) => (
                        <tr key={e.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                          <td className="p-2.5 border border-slate-200 whitespace-nowrap">{formatDate(e.tanggal)}</td>
                          <td className="p-2.5 border border-slate-200 break-words font-semibold text-slate-800">{e.keterangan}</td>
                          <td className="p-2.5 border border-slate-200"><span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap font-medium border border-slate-200">{e.kategori}</span></td>
                          <td className="p-2.5 border border-slate-200 text-right font-bold text-red-600 whitespace-nowrap">-{formatRp(Math.abs(e.nominal))}</td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-slate-100/80 font-bold">
                      <td colSpan={3} className="p-2.5 border border-slate-200 text-right">Subtotal:</td>
                      <td className="p-2.5 border border-slate-200 text-right text-red-750 whitespace-nowrap">-{formatRp(Math.abs(reportData.kasKeluar))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SALDO BERJALAN LEDGER */}
              <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-l-4 border-slate-800 pl-2">Saldo Berjalan (Ledger)</h3>
                <table className="w-full text-left border-collapse border border-slate-200 text-xs" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold">
                      <th style={{ width: '18%' }} className="p-2.5 border border-slate-300">Tanggal</th>
                      <th style={{ width: '38%' }} className="p-2.5 border border-slate-300">Keterangan</th>
                      <th style={{ width: '14.5%' }} className="p-2.5 border border-slate-300 text-right">Masuk</th>
                      <th style={{ width: '14.5%' }} className="p-2.5 border border-slate-300 text-right">Keluar</th>
                      <th style={{ width: '15%' }} className="p-2.5 border border-slate-300 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-slate-100/50 italic text-slate-500 font-medium">
                      <td className="p-2.5 border border-slate-200 whitespace-nowrap">-</td>
                      <td className="p-2.5 border border-slate-200">Saldo Awal Periode</td>
                      <td className="p-2.5 border border-slate-200 text-right">-</td>
                      <td className="p-2.5 border border-slate-200 text-right">-</td>
                      <td className="p-2.5 border border-slate-200 text-right font-bold text-slate-750 whitespace-nowrap">
                        {reportData.saldoAwal < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAwal))}
                      </td>
                    </tr>
                    {reportData.ledger.length === 0 ? (
                      <tr className="border-b border-slate-200">
                        <td colSpan={5} className="p-4 text-center text-slate-400 font-medium border border-slate-200">Tidak ada transaksi tercatat periode ini.</td>
                      </tr>
                    ) : (
                      reportData.ledger.map((row: any, idx: number) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                          <td className="p-2.5 border border-slate-200 whitespace-nowrap">{formatDate(row.tanggal)}</td>
                          <td className="p-2.5 border border-slate-200 break-words font-semibold text-slate-800">{row.keterangan}</td>
                          <td className={`p-2.5 border border-slate-200 text-right font-bold whitespace-nowrap ${row.masuk > 0 ? 'text-emerald-600' : 'text-slate-450'}`}>
                            {row.masuk > 0 ? `+${formatRp(Math.abs(row.masuk))}` : '-'}
                          </td>
                          <td className={`p-2.5 border border-slate-200 text-right font-bold whitespace-nowrap ${row.keluar > 0 ? 'text-red-600' : 'text-slate-450'}`}>
                            {row.keluar > 0 ? `-${formatRp(Math.abs(row.keluar))}` : '-'}
                          </td>
                          <td className={`p-2.5 border border-slate-200 text-right font-black whitespace-nowrap ${row.saldo >= 0 ? 'text-slate-800' : 'text-red-650'}`}>
                            {row.saldo < 0 ? '-' : ''}{formatRp(Math.abs(row.saldo))}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-slate-100/80 font-bold">
                      <td colSpan={4} className="p-2.5 border border-slate-200 text-right">Saldo Akhir Periode:</td>
                      <td className={`p-2.5 border border-slate-200 text-right font-black whitespace-nowrap ${reportData.saldoAkhir >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {reportData.saldoAkhir < 0 ? '-' : ''}{formatRp(Math.abs(reportData.saldoAkhir))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* FOOTER */}
          <div className="mt-10 border-t border-slate-200 pt-3 text-[9px] text-slate-400 flex justify-between">
            <span>Generated by SI-PATRA v1.0.0 • Sistem Informasi UNPAM • Badminton & Kas</span>
            <span>&nbsp;</span>
          </div>

        </div>
      </div>

      {/* GROUPED IURAN DETAILS MODAL */}
      {selectedGroupedIuran && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card border border-border rounded-[2.5rem] p-6 w-full max-w-sm shadow-theme relative overflow-hidden space-y-4 animate-scaleUp">
            <button 
              onClick={() => setSelectedGroupedIuran(null)}
              className="absolute top-4 right-4 p-2 text-secondary hover:text-primary hover:bg-border/40 rounded-full transition-all"
            >
              <X size={16} />
            </button>

            <div className="text-center pb-2 border-b border-border">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={20} strokeWidth={2.2} />
              </div>
              <h3 className="text-xs font-black text-secondary uppercase tracking-widest">Detail Iuran Kas</h3>
              <p className="text-sm font-extrabold text-primary mt-1">{selectedGroupedIuran.sessionName}</p>
              <p className="text-[10px] text-secondary font-semibold mt-0.5">{formatDate(selectedGroupedIuran.tanggal)}</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-secondary font-bold">Nama Sesi</span>
                <span className="text-primary font-extrabold">{selectedGroupedIuran.sessionName}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-secondary font-bold">Jumlah Anggota</span>
                <span className="text-primary font-extrabold">{selectedGroupedIuran.memberCount} Orang</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-secondary font-bold">Iuran per Anggota</span>
                <span className="text-primary font-extrabold">{formatRp(selectedGroupedIuran.iuranPerMember)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-secondary font-black">Total Kas Masuk</span>
                <span className="text-emerald-500 font-black text-sm">{formatRp(selectedGroupedIuran.nominal)}</span>
              </div>
              
              <div className="pt-2">
                <span className="text-secondary font-bold block mb-2">Daftar Kontributor:</span>
                <div className="max-h-36 overflow-y-auto bg-background/50 border border-border rounded-2xl p-3 space-y-1.5 scrollbar-thin">
                  {selectedGroupedIuran.contributorNames.map((name: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-primary font-extrabold text-[11px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedGroupedIuran(null)}
              className="w-full py-3 bg-accent hover:opacity-90 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-theme"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
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
  createAccountBySuperadmin,
  session,
  profilePhoto,
  setShowAddModal
}: any) {
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // States for managing an existing user
  const [manageRole, setManageRole] = useState('');
  const [manageStatus, setManageStatus] = useState('');

  // States for reset password dialogs
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(false);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

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
        {[...members].sort((a: any, b: any) => {
          const roleOrder: any = { superadmin: 1, admin: 2, member: 3 };
          const orderA = roleOrder[a.role] || 99;
          const orderB = roleOrder[b.role] || 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        }).map((m: any) => {
          const canManage = isSuperAdmin || (isAdmin && m.role === 'member');
          
          return (
            <div key={m.id} className="bg-card p-4 rounded-2xl border border-border flex items-center gap-3.5 shadow-theme transition-all">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm overflow-hidden flex-shrink-0 ${
                m.role === 'superadmin'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : m.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {/* Show avatar from profiles.avatar_url if available, otherwise initials */}
                {(m.user_id === session?.user?.id && profilePhoto) || m.avatar_url ? (
                  <img
                    src={m.user_id === session?.user?.id && profilePhoto ? profilePhoto : m.avatar_url}
                    alt={`Foto ${m.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(m.name)
                )}
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

              {isSuperAdmin && (
                <div className="pt-2 border-t border-border space-y-2.5">
                  <p className="text-[9px] font-black text-secondary uppercase tracking-wider">Tindakan Khusus Superadmin</p>
                  
                  {selectedUser.user_id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setResetErrorMsg(null);
                        setShowResetConfirm(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs rounded-xl transition-all"
                    >
                      <Key size={14} /> Reset Password ke Bawaan
                    </button>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-1.5 py-2.5 border border-slate-500/20 bg-slate-500/10 text-slate-400 font-bold text-xs rounded-xl">
                      <div className="flex items-center gap-2">
                        <Key size={14} /> Reset Password ke Bawaan
                      </div>
                      <p className="text-[9px] font-semibold text-slate-500 px-3 text-center">Anggota ini belum memiliki akun (belum register). Tidak bisa reset password.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      // Close manage modal first, then open confirm modal on next tick
                      // so React can fully unmount the manage modal before the
                      // confirm dialog mounts — prevents state collision.
                      const userToDelete = selectedUser;
                      setShowManageModal(false);
                      setSelectedUser(null);
                      setTimeout(() => {
                        deleteMember(userToDelete.id, userToDelete.user_id);
                      }, 150);
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

      {/* DIALOG KONFIRMASI RESET PASSWORD */}
      {showResetConfirm && selectedUser && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-card rounded-[24px] p-6 max-w-sm w-full shadow-theme border border-border flex flex-col gap-4 animate-scaleUp"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Key size={22} className="text-amber-400" />
              </div>
              <h3 className="text-primary font-extrabold text-base tracking-tight uppercase">Reset Password</h3>
              <p className="text-secondary font-bold text-xs leading-relaxed px-1">
                Apakah Anda yakin ingin mereset password pengguna ini?
              </p>
              <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 flex flex-col gap-1">
                <p className="text-[10px] text-secondary font-black uppercase tracking-wider">Password akan diubah menjadi:</p>
                <p className="text-amber-300 font-black text-sm tracking-widest">sisteminformasi</p>
              </div>
              <p className="text-[11px] font-extrabold text-primary">{selectedUser.name}</p>
            </div>

            {resetErrorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-[11px] text-red-400 font-bold leading-relaxed">❌ {resetErrorMsg}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                onClick={() => { setShowResetConfirm(false); setResetErrorMsg(null); }}
                disabled={isResettingPassword}
                className="w-full border border-border bg-background text-secondary hover:text-primary font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] hover:bg-border/60 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                disabled={isResettingPassword}
                onClick={async () => {
                  setIsResettingPassword(true);
                  setResetErrorMsg(null);
                  const result = await resetUserPassword(selectedUser.user_id, selectedUser.name);
                  setIsResettingPassword(false);
                  if (result.success) {
                    setShowResetConfirm(false);
                    setShowManageModal(false);
                    setShowResetSuccess(true);
                  } else {
                    setResetErrorMsg(result.error || 'Terjadi kesalahan tidak diketahui.');
                  }
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-white font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-wait"
              >
                {isResettingPassword ? 'Memproses...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP BERHASIL RESET PASSWORD */}
      {showResetSuccess && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowResetSuccess(false)}
        >
          <div
            className="bg-card rounded-[24px] p-6 max-w-sm w-full shadow-theme border border-border flex flex-col gap-4 animate-scaleUp"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <h3 className="text-primary font-extrabold text-base tracking-tight uppercase">Password Berhasil Direset</h3>
              <p className="text-secondary font-bold text-xs leading-relaxed px-1">
                Password pengguna berhasil diubah menjadi:
              </p>
              <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
                <p className="text-emerald-400 font-black text-sm tracking-widest">sisteminformasi</p>
              </div>
              <p className="text-[11px] text-secondary font-bold leading-relaxed">
                Silakan informasikan password baru kepada pengguna.
              </p>
            </div>

            <button
              onClick={() => { setShowResetSuccess(false); setSelectedUser(null); }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold py-3 rounded-xl transition-all text-xs active:scale-[0.98] shadow-md"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const compressImageToBlob = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal mendapatkan canvas context.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Gagal kompres gambar.'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
};

// --- PROFILE MEMBER COMPONENT ---
function ProfileMember({ 
  profile, 
  updateProfile, 
  profilePhoto,
  showToast,
  memberRecord,
  payments = [],
  attendees = [],
  sessions = []
}: { 
  profile: any; 
  updateProfile: (nama: string, nomor_hp: string, fileToUpload: File | Blob | null, isPhotoRemoved?: boolean) => Promise<void>; 
  profilePhoto: string | null; 
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  memberRecord: any;
  payments?: any[];
  attendees?: any[];
  sessions?: any[];
}) {
  const [nama, setNama] = useState(profile.nama);
  const [nomorHp, setNomorHp] = useState(profile.nomor_hp || '');
  const [photo, setPhoto] = useState<string | null>(profilePhoto);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [editingField, setEditingField] = useState<'nama' | 'nomor_hp' | null>(null);
  const [editNama, setEditNama] = useState(profile.nama);
  const [editNomorHp, setEditNomorHp] = useState(profile.nomor_hp || '');

  useEffect(() => {
    setPhoto(profilePhoto);
  }, [profilePhoto]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Format file harus JPG, JPEG, PNG, atau WEBP.', 'error');
        return;
      }

      setIsSubmitting(true);
      try {
        const localPreviewUrl = URL.createObjectURL(file);
        setPhoto(localPreviewUrl);
        setIsPhotoRemoved(false);

        let fileToUpload: File | Blob = file;
        if (file.size > 2 * 1024 * 1024) {
          fileToUpload = await compressImageToBlob(file);
        }

        // Auto-save: upload immediately so no separate "Save" button is needed
        await updateProfile(nama, nomorHp, fileToUpload, false);
        setSelectedFile(null);
        setIsPhotoRemoved(false);
      } catch (err: any) {
        console.error(err);
        showToast('Gagal memproses gambar.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setSelectedFile(null);
    setIsPhotoRemoved(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProfile(nama, nomorHp, selectedFile, isPhotoRemoved);
      setSelectedFile(null);
      setIsPhotoRemoved(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveField = async (field: 'nama' | 'nomor_hp') => {
    setIsSubmitting(true);
    try {
      const newNama = field === 'nama' ? editNama : nama;
      const newHp = field === 'nomor_hp' ? editNomorHp : nomorHp;
      await updateProfile(newNama, newHp, selectedFile, isPhotoRemoved);
      if (field === 'nama') setNama(editNama);
      if (field === 'nomor_hp') setNomorHp(editNomorHp);
      setSelectedFile(null);
      setIsPhotoRemoved(false);
      setEditingField(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const idDosen = profile.email ? (profile.email.match(/dosen(\d{5})@/i)?.[1] || '-') : '-';
  const idAnggota = idDosen !== '-' ? `#${idDosen}` : '-';

  // ── Ringkasan Stats ──────────────────────────────────────────────
  const memberId = memberRecord?.id;

  const sesiHadir = memberId
    ? attendees.filter((a: any) => a.member_id === memberId).length
    : 0;

  const totalIuranVerified = memberId
    ? payments
        .filter((p: any) => p.member_id === memberId && p.status_pembayaran === 'verified')
        .reduce((sum: number, p: any) => sum + (p.nominal_tagihan || 0), 0)
    : 0;

  const tunggakanCount = memberId
    ? payments.filter(
        (p: any) =>
          p.member_id === memberId &&
          (p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'generated')
      ).length
    : 0;

  const tunggakanTotal = memberId
    ? payments
        .filter(
          (p: any) =>
            p.member_id === memberId &&
            (p.status_pembayaran === 'unpaid' || p.status_pembayaran === 'generated')
        )
        .reduce((sum: number, p: any) => sum + (p.nominal_tagihan || 0), 0)
    : 0;

  const formatRpShort = (num: number) => {
    if (num >= 1_000_000) return `Rp ${(num / 1_000_000).toFixed(1)}jt`;
    if (num >= 1_000) return `Rp ${(num / 1_000).toFixed(0)}rb`;
    return `Rp ${num}`;
  };

  const joinedDate = profile.created_at
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(profile.created_at))
    : '-';

  const roleLabel = profile.role === 'superadmin' ? 'SUPERADMIN' : profile.role === 'admin' ? 'BENDAHARA' : 'ANGGOTA';

  return (
    <div className="space-y-5 animate-fadeIn pb-4">


      {/* ── HERO PROFILE CARD — horizontal layout ── */}
      <div className="relative rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(16,185,129,0.22)]">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#059669] via-[#10B981] to-[#34D399]" />
        {/* Decorative subtle blob */}
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/8 rounded-full blur-md pointer-events-none" />
        <div className="absolute -bottom-6 left-1/2 w-24 h-24 bg-black/8 rounded-full blur-lg pointer-events-none" />

        <div className="relative px-4 py-4 flex flex-row items-center gap-4">

          {/* LEFT — Avatar column */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="relative">
              <div className="w-[72px] h-[72px] rounded-full border-[2.5px] border-white/60 shadow-[0_4px_14px_rgba(0,0,0,0.25)] overflow-hidden bg-white/20 flex items-center justify-center">
                {photo ? (
                  <img src={photo} alt="Foto Profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-xl select-none">{getInitials(nama)}</span>
                )}
              </div>
              {/* Camera button */}
              <label className="absolute bottom-0 right-0 w-6 h-6 bg-white text-emerald-700 rounded-full shadow-md border-[1.5px] border-white cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                <Camera size={11} strokeWidth={2.5} />
                <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            {/* Hapus Foto — hanya muncul jika ada foto, sangat kecil */}
            {photo && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-white/50 hover:text-white/80 text-[8px] font-semibold uppercase tracking-wide transition-colors flex items-center gap-0.5"
              >
                <Trash2 size={8} />
                Hapus
              </button>
            )}
          </div>

          {/* RIGHT — Info column */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Name + Badge */}
            <div>
              <h2 className="text-xl font-black text-white leading-tight drop-shadow-sm truncate">
                {nama || 'Anggota Baru'}
              </h2>
              <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-md bg-white/25 border border-white/30 text-white text-[9px] font-black uppercase tracking-widest">
                {roleLabel}
              </span>
            </div>

            {/* Email + ID Anggota pills — side by side */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-black/20 backdrop-blur-sm rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                <Mail size={10} className="text-white/65 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[7px] text-white/55 font-bold uppercase tracking-wider leading-none">Email</p>
                  <p className="text-[9px] text-white font-bold truncate leading-tight mt-0.5">{profile.email}</p>
                </div>
              </div>
              <div className="bg-black/20 backdrop-blur-sm rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                <UserIcon size={10} className="text-white/65 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[7px] text-white/55 font-bold uppercase tracking-wider leading-none">ID Anggota</p>
                  <p className="text-[9px] text-white font-black leading-tight mt-0.5">{idAnggota}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── RINGKASAN SAYA ── */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-secondary uppercase tracking-widest px-1 flex items-center gap-1.5">
          <Activity size={12} className="text-accent" />
          Ringkasan Saya
        </h3>
        <div className="grid grid-cols-3 gap-2.5">

          {/* ── Sesi Hadir ── */}
          <div className="relative rounded-[18px] overflow-hidden border border-emerald-500/20 shadow-[0_2px_12px_rgba(16,185,129,0.08)] bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.12)_0%,transparent_70%)] bg-card transition-all hover:border-emerald-500/40">
            {/* Top row: icon | divider | title */}
            <div className="flex items-center gap-0 px-3.5 pt-3.5 pb-2">
              <div className="w-9 h-9 rounded-[10px] bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <Calendar size={17} className="text-emerald-400" />
              </div>
              <div className="w-px h-6 bg-emerald-500/20 mx-2.5 flex-shrink-0" />
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-tight">Sesi<br/>Hadir</p>
            </div>
            {/* Value */}
            <div className="px-3.5 pb-3.5">
              <p className="text-2xl font-black text-primary leading-none">{sesiHadir}</p>
            </div>
          </div>

          {/* ── Total Iuran ── */}
          <div className="relative rounded-[18px] overflow-hidden border border-blue-500/20 shadow-[0_2px_12px_rgba(59,130,246,0.08)] bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.12)_0%,transparent_70%)] bg-card transition-all hover:border-blue-500/40">
            {/* Top row: icon | divider | title */}
            <div className="flex items-center gap-0 px-3.5 pt-3.5 pb-2">
              <div className="w-9 h-9 rounded-[10px] bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Wallet size={17} className="text-blue-400" />
              </div>
              <div className="w-px h-6 bg-blue-500/20 mx-2.5 flex-shrink-0" />
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-tight">Total<br/>Iuran</p>
            </div>
            {/* Value */}
            <div className="px-3.5 pb-3.5">
              <p className="text-base font-black text-primary leading-none">{formatRpShort(totalIuranVerified)}</p>
            </div>
          </div>

          {/* ── Tunggakan ── */}
          <div className="relative rounded-[18px] overflow-hidden border border-red-500/20 shadow-[0_2px_12px_rgba(239,68,68,0.08)] bg-[radial-gradient(ellipse_at_top_left,rgba(239,68,68,0.12)_0%,transparent_70%)] bg-card transition-all hover:border-red-500/40">
            {/* Top row: icon | divider | title */}
            <div className="flex items-center gap-0 px-3.5 pt-3.5 pb-2">
              <div className="w-9 h-9 rounded-[10px] bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={17} className="text-red-400" />
              </div>
              <div className="w-px h-6 bg-red-500/20 mx-2.5 flex-shrink-0" />
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest leading-tight">Tung-<br/>gakan</p>
            </div>
            {/* Value */}
            <div className="px-3.5 pb-3.5">
              <p className="text-2xl font-black text-primary leading-none">{tunggakanCount}</p>
            </div>
          </div>

        </div>
      </div>

      {/* ── INFORMASI AKUN ── */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-secondary uppercase tracking-widest px-1 flex items-center gap-1.5">
          <UserIcon size={12} className="text-accent" />
          Informasi Akun
        </h3>
        <div className="bg-card border border-border rounded-[24px] overflow-hidden shadow-theme divide-y divide-border">

          {/* Nama Lengkap — Editable */}
          <div className="px-4 py-3.5">
            {editingField === 'nama' ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <UserIcon size={13} className="text-emerald-500" />
                  </div>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-wider">Nama Lengkap</p>
                </div>
                <input
                  type="text"
                  value={editNama}
                  onChange={e => setEditNama(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent/50 outline-none text-primary font-bold text-xs transition-all"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveField('nama')}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingField(null); setEditNama(nama); }}
                    className="px-4 py-2 border border-border text-secondary hover:text-primary font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => { setEditNama(nama); setEditingField('nama'); }}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <UserIcon size={13} className="text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Nama Lengkap</p>
                  <p className="text-xs font-extrabold text-primary mt-0.5 truncate">{nama || '—'}</p>
                </div>
                <div className="w-6 h-6 rounded-lg bg-background border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Edit size={11} className="text-accent" />
                </div>
              </div>
            )}
          </div>

          {/* ID Dosen — Readonly */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <Key size={13} className="text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">ID Dosen</p>
              <p className="text-xs font-extrabold text-primary mt-0.5">{idDosen !== '-' ? idDosen : '—'}</p>
            </div>
            <Lock size={12} className="text-secondary/40 flex-shrink-0" />
          </div>

          {/* Email — Readonly */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
              <Mail size={13} className="text-sky-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Email</p>
              <p className="text-xs font-extrabold text-primary mt-0.5 truncate">{profile.email}</p>
            </div>
            <Lock size={12} className="text-secondary/40 flex-shrink-0" />
          </div>

          {/* Nomor HP — Editable */}
          <div className="px-4 py-3.5">
            {editingField === 'nomor_hp' ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone size={13} className="text-violet-500" />
                  </div>
                  <p className="text-[9px] font-black text-secondary uppercase tracking-wider">Nomor HP</p>
                </div>
                <input
                  type="text"
                  value={editNomorHp}
                  onChange={e => setEditNomorHp(e.target.value)}
                  placeholder="08123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent/50 outline-none text-primary font-bold text-xs transition-all"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveField('nomor_hp')}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingField(null); setEditNomorHp(nomorHp); }}
                    className="px-4 py-2 border border-border text-secondary hover:text-primary font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => { setEditNomorHp(nomorHp); setEditingField('nomor_hp'); }}
              >
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Smartphone size={13} className="text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Nomor HP</p>
                  <p className="text-xs font-extrabold text-primary mt-0.5">{nomorHp || '— Belum diatur'}</p>
                </div>
                <div className="w-6 h-6 rounded-lg bg-background border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Edit size={11} className="text-accent" />
                </div>
              </div>
            )}
          </div>

          {/* Peran — Readonly */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Shield size={13} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Peran</p>
              <div className="mt-1">
                <span className={`inline-flex items-center text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  profile.role === 'superadmin'
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : profile.role === 'admin'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {roleLabel}
                </span>
              </div>
            </div>
            <Lock size={12} className="text-secondary/40 flex-shrink-0" />
          </div>

          {/* Bergabung Sejak — Readonly */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
              <Calendar size={13} className="text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-secondary uppercase tracking-wider">Bergabung Sejak</p>
              <p className="text-xs font-extrabold text-primary mt-0.5">{joinedDate}</p>
            </div>
            <Lock size={12} className="text-secondary/40 flex-shrink-0" />
          </div>
        </div>

        {/* Helper hint */}
        <p className="text-[9px] text-secondary/60 text-center font-medium px-2">
          Ketuk nama atau nomor HP untuk mengedit
        </p>
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
  executeHardDeleteFromTrash,
  iuranKasConfig,
  setIuranKasConfig,
  showToast
}: any) {
  const [namaKomunitas, setNamaKomunitas] = useState(settings?.nama_komunitas || '');
  const [rekeningPenerima, setRekeningPenerima] = useState(settings?.rekening_penerima || '');
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisPreview, setQrisPreview] = useState<string | null>(settings?.qris_image_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTrashTab, setActiveTrashTab] = useState<'session' | 'payment' | 'member'>('session');
  const [settingsSubTab, setSettingsSubTab] = useState<'komunitas' | 'keuangan'>('komunitas');
  const [iuranKas, setIuranKas] = useState(iuranKasConfig);

  useEffect(() => {
    setIuranKas(iuranKasConfig);
  }, [iuranKasConfig]);

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
        <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
          <h2 className="text-sm font-black text-primary uppercase tracking-wider">Pengaturan</h2>
          <div className="flex gap-1.5 bg-background p-1 rounded-xl border border-border">
            <button 
              type="button"
              onClick={() => setSettingsSubTab('komunitas')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                settingsSubTab === 'komunitas' 
                  ? 'bg-accent text-white shadow-sm' 
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Komunitas
            </button>
            <button 
              type="button"
              onClick={() => setSettingsSubTab('keuangan')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                settingsSubTab === 'keuangan' 
                  ? 'bg-accent text-white shadow-sm' 
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Keuangan
            </button>
          </div>
        </div>
        
        {settingsSubTab === 'komunitas' ? (
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
        ) : (
          <form onSubmit={(e) => {
            e.preventDefault();
            localStorage.setItem('sipatra_iuran_kas', iuranKas.toString());
            setIuranKasConfig(iuranKas);
            if (showToast) showToast('Pengaturan keuangan berhasil disimpan!', 'success');
          }} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black text-secondary uppercase tracking-wider mb-2.5">
                Iuran Kas Per Kehadiran
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[0, 2000, 5000, 10000, 15000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setIuranKas(val)}
                    className={`py-3 px-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                      iuranKas === val
                        ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-450 font-black'
                        : 'border-border bg-background text-secondary hover:bg-background/80 font-bold'
                    }`}
                  >
                    <span className="text-xs">{formatRp(val)}</span>
                    {val === 5000 && (
                      <span className="text-[7px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded uppercase font-black">Default</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={14} />
              <span>Simpan Pengaturan Keuangan</span>
            </button>
          </form>
        )}
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
function ChangePasswordScreen({ 
  session, 
  onPasswordChanged, 
  isRecovery = false, 
  onCancel 
}: { 
  session: any; 
  onPasswordChanged: () => void; 
  isRecovery?: boolean; 
  onCancel?: () => void; 
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

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

    if (!isRecovery && newPassword === 'sisteminformasi') {
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
      setErrorMsg(mapSupabaseError(err));
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
              <h2 className="text-xl font-[800] text-primary text-center mb-2">
                {isRecovery ? 'Buat Password Baru' : 'Ganti Password'}
              </h2>
              <p className="text-xs text-secondary text-center mb-6 leading-relaxed">
                {isRecovery 
                  ? 'Silakan masukkan password baru Anda untuk memulihkan akun.' 
                  : 'Demi keamanan akun, silakan ubah password bawaan Anda sebelum melanjutkan.'}
              </p>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-800/50 mb-4 animate-fadeIn">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className="flex-shrink-0 text-red-500" />
                      <span className="font-[700] text-[11px]">Login Gagal</span>
                    </div>
                    <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors p-0.5 -mr-1" aria-label="Tutup">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed ml-[20px] opacity-90">{errorMsg}</p>
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
                  disabled={isSubmitting || newPassword.length < 8 || confirmPassword.length < 8}
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
                      <span>{isRecovery ? 'Simpan Password Baru' : 'Simpan Password'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Logout/Cancel Footer Button */}
            <div className="mt-6 flex justify-center w-full">
              <button
                type="button"
                onClick={isRecovery && onCancel ? onCancel : handleLogout}
                className="py-2 px-4 text-center text-secondary hover:text-red-500 text-xs font-[700] uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
              >
                {isRecovery ? (
                  <>
                    <XCircle size={14} /> Kembali ke Login
                  </>
                ) : (
                  <>
                    <LogOut size={14} /> Keluar dari Akun
                  </>
                )}
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
  const [showRegSuccessModal, setShowRegSuccessModal] = useState(false);

  // Load saved ID Dosen on mount if rememberMe was previously active
  useEffect(() => {
    const savedIdDosen = localStorage.getItem('sipatra_remember_iddosen');
    if (savedIdDosen) {
      setIdDosen(savedIdDosen);
      setRememberMe(true);
    }
  }, []);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

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
      setErrorMsg(mapSupabaseError(err));
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
      sessionStorage.setItem('sipatra_is_registering', 'true');
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
      
      sessionStorage.removeItem('sipatra_is_registering');
      
      // If a session was automatically created, clear it by signing out immediately
      if (data.session) {
        await supabase.auth.signOut();
      }
      
      setShowRegSuccessModal(true);
    } catch (err: any) {
      sessionStorage.removeItem('sipatra_is_registering');
      console.error(err);
      setErrorMsg(mapSupabaseError(err));
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
        redirectTo: `${window.location.origin}/#recovery`
      });

      if (error) throw error;
      setSuccessMsg('Tautan reset password telah dikirim');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(mapSupabaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };



  const renderHeader = (compact = false) => {
    return (
      <div className="relative w-full flex flex-col items-center justify-center text-center z-10">
        {/* Logo with Ambient Glow */}
        <div className="relative mb-[12px]">
          <div className={`absolute inset-0 bg-accent/${compact ? '8' : '10'} blur-2xl rounded-full pointer-events-none transform scale-75`} />
          <img 
            src="/logo.png" 
            alt="Logo SI-PATRA" 
            className={`${compact ? 'w-[82px] h-[82px]' : 'w-[125px] h-[125px]'} object-contain mx-auto select-none relative z-10 drop-shadow-[0_4px_12px_rgba(16,185,129,0.08)]`}
            style={{ imageRendering: 'crisp-edges', WebkitImageRendering: 'crisp-edges' } as any}
          />
        </div>

        {/* Title */}
        <h1 className={`${compact ? 'text-[32px] mt-[6px]' : 'text-[44px] mt-[10px]'} font-[800] text-primary leading-none tracking-tight font-sans bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent`}>
          SI-PATRA
        </h1>

        {/* Subtitle */}
        <p className="text-accent text-[10px] font-[700] uppercase tracking-[4px] mt-[8px]">
          SI BADMINTON & KAS
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full md:bg-gradient-to-tr md:from-background md:via-card md:to-emerald-950/30 flex items-center justify-center p-0 md:p-8 font-sans overflow-hidden transition-colors duration-200">
      {/* Simulated Mobile Mockup Container */}
      <div className="w-full h-screen md:h-[844px] md:w-[390px] md:rounded-[40px] md:shadow-theme md:border-[8px] md:border-border overflow-hidden flex flex-col relative transition-all justify-center items-center" style={{ background: 'var(--login-bg)' }}>
        
        {/* Court background lines with 4% opacity (Premium branding accent) */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none z-0">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="stroke-accent stroke-[0.6] fill-none">
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

        {/* Subtle green glow at top right */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-accent opacity-[0.04] blur-3xl pointer-events-none z-0" />

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

        {/* Floating racket outline: Top Right, Opacity 4% (Subtle Accent) */}
        {/* Content View Area */}
        <div className="flex-1 flex flex-col justify-start pt-[48px] md:pt-[56px] items-center overflow-hidden w-full h-full relative z-10">
          
          {authMode === 'login' && (
            <div className="w-full flex flex-col items-center justify-center animate-fadeIn">
              {/* Branding Section */}
              {renderHeader(false)}
              
              {/* Card Section */}
              <div className="bg-card rounded-[28px] border border-border shadow-theme p-[32px] mt-[28px] flex flex-col w-[86%] max-w-[420px] mx-auto transition-all duration-200">
                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-800/50 mb-2 animate-fadeIn">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={14} className="flex-shrink-0 text-red-500" />
                        <span className="font-[700] text-[11px]">Login Gagal</span>
                      </div>
                      <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors p-0.5 -mr-1" aria-label="Tutup">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] leading-relaxed ml-[20px] opacity-90">{errorMsg}</p>
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
                <div className="mt-8 flex flex-col items-center gap-0.5 select-none opacity-65 text-center">
                  <p className="text-[10px] text-secondary font-[600] tracking-wider">
                    @2026 SI-PATRA v1.0.0
                  </p>
                </div>
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
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-800/50 mb-2 animate-fadeIn">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={14} className="flex-shrink-0 text-red-500" />
                        <span className="font-[700] text-[11px]">Login Gagal</span>
                      </div>
                      <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors p-0.5 -mr-1" aria-label="Tutup">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] leading-relaxed ml-[20px] opacity-90">{errorMsg}</p>
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
              <div className="bg-card rounded-[28px] border border-border shadow-theme p-[32px] mt-[28px] flex flex-col w-[86%] max-w-[420px] mx-auto transition-all duration-200">
                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-800/50 mb-2 animate-fadeIn">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={14} className="flex-shrink-0 text-red-500" />
                        <span className="font-[700] text-[11px]">Login Gagal</span>
                      </div>
                      <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors p-0.5 -mr-1" aria-label="Tutup">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] leading-relaxed ml-[20px] opacity-90">{errorMsg}</p>
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

          {showRegSuccessModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-card rounded-[24px] p-6 max-w-sm w-full shadow-theme border border-border flex flex-col gap-4 animate-scaleUp" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-605 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle size={24} className="text-emerald-605 dark:text-emerald-450 animate-pulse-gentle" />
                  </div>
                  <h3 className="text-primary font-extrabold text-base tracking-tight uppercase">
                    ✅ Pendaftaran Berhasil
                  </h3>
                  <p className="text-secondary font-bold text-xs leading-relaxed px-1 whitespace-pre-line">
                    Akun Anda berhasil dibuat.
                    
                    Silakan masuk menggunakan ID Dosen dan password yang telah didaftarkan.
                  </p>
                </div>
                <div className="mt-2">
                  <button 
                    onClick={() => {
                      setShowRegSuccessModal(false);
                      setIdDosen('');
                      setPassword('');
                      setConfirmPassword('');
                      setFullName('');
                      setPhone('');
                      setErrorMsg('');
                      setSuccessMsg('');
                      setAuthMode('login');
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl transition-all text-xs active:scale-[0.98] shadow-md shadow-emerald-950/20"
                  >
                    Masuk ke Login
                  </button>
                </div>
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