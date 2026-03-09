import { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  TrendingUp, 
  AlertCircle, 
  UserPlus,
  X,
  Trash2
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { motion } from 'motion/react';
import { dataService } from '../services/dataService';
import { AppNotification, User } from '../types';
import { supabase } from '../lib/supabase';

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="glass-card p-6 flex flex-col justify-between"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-opacity-100`}>
        <Icon size={24} />
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-success-muted/10 text-success-muted' : 'bg-danger-muted/10 text-danger-muted'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-sm font-medium text-charcoal/50 uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-serif font-bold text-charcoal">{value}</h3>
    </div>
  </motion.div>
);

interface AdminDashboardProps {
  user: User;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showManageAnnouncementsModal, setShowManageAnnouncementsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [s, r, e] = await Promise.all([
          dataService.getGlobalStats(),
          dataService.getRevenueData(),
          dataService.getEnrollmentData()
        ]);
        setStats(s);
        setRevenueData(r);
        setEnrollmentData(e);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !stats) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
      </div>
    );
  }

  const runGenerateMonthlyReport = async () => {
    try {
      setActionLoading('report');
      setActionError(null);
      setActionMessage(null);

      const [globalStats, transactions, students] = await Promise.all([
        dataService.getGlobalStats(),
        dataService.getRecentTransactions(500),
        dataService.getStudents(user)
      ]);

      const now = new Date();
      const monthKey = now.toISOString().slice(0, 7);
      const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const generatedAt = now.toLocaleString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const monthTransactions = transactions.filter((tx: any) => String(tx.date || '').startsWith(monthKey));
      const monthEnrollments = students
        .flatMap(student => student.enrollments.map(enrollment => ({ student: student.name, ...enrollment })))
        .filter(enrollment => String(enrollment.enrollmentDate || '').startsWith(monthKey));

      const escapeHtml = (value: unknown) =>
        String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const safeCell = (value: unknown) => {
        const text = String(value ?? '').trim();
        if (!text) return '';
        return ['=', '+', '-', '@'].includes(text[0]) ? `'${text}` : text;
      };

      const currency = (amount: number) => `Ksh ${Number(amount || 0).toLocaleString('en-KE')}`;
      const statusClass = (status: string) => {
        if (status === 'PAID') return 'status-paid';
        if (status === 'PARTIAL') return 'status-partial';
        return 'status-pending';
      };
      const enrollmentStatusClass = (status: string) => {
        if (status === 'GRADUATED') return 'status-paid';
        if (status === 'ACTIVE') return 'status-partial';
        return 'status-pending';
      };

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #1f2937; margin: 24px; }
    h1 { margin: 0; font-size: 26px; color: #0f172a; }
    h2 { margin: 26px 0 10px; font-size: 18px; color: #0f172a; }
    .muted { color: #6b7280; font-size: 12px; }
    .summary { border-collapse: collapse; margin-top: 14px; width: 100%; max-width: 720px; }
    .summary th, .summary td { border: 1px solid #d1d5db; padding: 9px 12px; text-align: left; }
    .summary th { background: #f3f4f6; width: 260px; font-weight: 700; color: #111827; }
    .sheet { border-collapse: collapse; width: 100%; }
    .sheet th, .sheet td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; }
    .sheet th { background: #0f172a; color: #ffffff; text-transform: uppercase; letter-spacing: .03em; }
    .sheet tr:nth-child(even) td { background: #f8fafc; }
    .amount { text-align: right; font-weight: 600; }
    .center { text-align: center; }
    .status-pill { font-weight: 700; padding: 2px 6px; border-radius: 999px; display: inline-block; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-partial { background: #ffedd5; color: #9a3412; }
    .status-pending { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>Lingua Center Monthly Report</h1>
  <div class="muted">Period: ${escapeHtml(monthLabel)} | Generated: ${escapeHtml(generatedAt)}</div>

  <table class="summary">
    <tr><th>Active Students</th><td>${globalStats.totalActiveStudents}</td></tr>
    <tr><th>Graduates</th><td>${globalStats.totalGraduates}</td></tr>
    <tr><th>Total Revenue</th><td>${escapeHtml(currency(globalStats.totalRevenue))}</td></tr>
    <tr><th>Outstanding Balances</th><td>${escapeHtml(currency(globalStats.totalOutstanding))}</td></tr>
    <tr><th>New Enrollments (This Month)</th><td>${globalStats.newEnrollmentsThisMonth}</td></tr>
  </table>

  <h2>Enrollments (${monthEnrollments.length})</h2>
  <table class="sheet">
    <thead>
      <tr>
        <th>Student</th>
        <th>Program</th>
        <th>Course</th>
        <th>Level</th>
        <th>Status</th>
        <th>Total Fee</th>
        <th>Fee Balance</th>
        <th>Enrollment Date</th>
      </tr>
    </thead>
    <tbody>
      ${monthEnrollments.length === 0
        ? '<tr><td colspan="8" class="center">No enrollments recorded for this month.</td></tr>'
        : monthEnrollments.map(item => `
            <tr>
              <td>${escapeHtml(safeCell(item.student))}</td>
              <td>${escapeHtml(safeCell(item.programType || ''))}</td>
              <td>${escapeHtml(safeCell(item.courseName || ''))}</td>
              <td>${escapeHtml(safeCell(item.level || ''))}</td>
              <td class="center"><span class="status-pill ${enrollmentStatusClass(String(item.status || 'ACTIVE'))}">${escapeHtml(item.status || 'ACTIVE')}</span></td>
              <td class="amount">${escapeHtml(currency(item.totalFee || 0))}</td>
              <td class="amount">${escapeHtml(currency(item.feeBalance || 0))}</td>
              <td>${escapeHtml(item.enrollmentDate || '')}</td>
            </tr>
          `).join('')
      }
    </tbody>
  </table>

  <h2>Transactions (${monthTransactions.length})</h2>
  <table class="sheet">
    <thead>
      <tr>
        <th>Date</th>
        <th>Student</th>
        <th>Course</th>
        <th>Method</th>
        <th>Reference</th>
        <th>Amount</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${monthTransactions.length === 0
        ? '<tr><td colspan="7" class="center">No transactions recorded for this month.</td></tr>'
        : monthTransactions.map((tx: any) => `
            <tr>
              <td>${escapeHtml(tx.date || '')}</td>
              <td>${escapeHtml(safeCell(tx.student || ''))}</td>
              <td>${escapeHtml(safeCell(tx.courseName || ''))}</td>
              <td>${escapeHtml(tx.method || '')}</td>
              <td>${escapeHtml(safeCell(tx.reference || '-'))}</td>
              <td class="amount">${escapeHtml(currency(tx.amount || 0))}</td>
              <td class="center"><span class="status-pill ${statusClass(String(tx.status || 'PENDING'))}">${escapeHtml(tx.status || 'PENDING')}</span></td>
            </tr>
          `).join('')
      }
    </tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lingua-monthly-report-${monthKey}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setActionMessage('Monthly report downloaded successfully.');
    } catch (error: any) {
      setActionError(error?.message || 'Failed to generate monthly report.');
    } finally {
      setActionLoading(null);
    }
  };

  const runArchiveGraduatedStudents = async () => {
    try {
      setActionLoading('archive');
      setActionError(null);
      setActionMessage(null);

      const result = await dataService.autoGraduateEligibleEnrollments();
      setActionMessage(
        result.graduatedCount > 0
          ? `Archived ${result.graduatedCount} eligible enrollment(s) as graduated (reviewed ${result.reviewedCount}).`
          : `No eligible active enrollments met graduation requirements (reviewed ${result.reviewedCount}).`
      );

      const refreshedStats = await dataService.getGlobalStats();
      setStats(refreshedStats);
    } catch (error: any) {
      setActionError(error?.message || 'Failed to archive graduated students.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif text-charcoal mb-2">Academic Overview</h1>
          <p className="text-charcoal/50">Welcome back. Here is what's happening at Lingua Center today.</p>
        </div>
      </div>
      {actionError && (
        <div className="p-3 rounded-xl bg-danger-muted/10 text-danger-muted text-sm">
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div className="p-3 rounded-xl bg-success-muted/10 text-success-muted text-sm">
          {actionMessage}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard title="Active Students" value={stats.totalActiveStudents} icon={Users} color="text-navy" />
        <StatCard title="Graduates" value={stats.totalGraduates} icon={GraduationCap} color="text-sage" />
        <StatCard title="Revenue" value={`Ksh ${stats.totalRevenue.toLocaleString()}`} icon={TrendingUp} color="text-success-muted" />
        <StatCard title="Balances" value={`Ksh ${stats.totalOutstanding.toLocaleString()}`} icon={AlertCircle} color="text-warning-muted" />
        <StatCard title="New This Month" value={stats.newEnrollmentsThisMonth} icon={UserPlus} color="text-navy" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-serif text-charcoal">Revenue Growth (Ksh)</h3>
            <select className="text-sm bg-transparent border-none focus:ring-0 text-charcoal/50 font-medium">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E293B" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1E293B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#1A1A1A', opacity: 0.5, fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#1A1A1A', opacity: 0.5, fontSize: 12 }}
                  tickFormatter={(value) => `Ksh ${value / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
                  }} 
                  formatter={(value: number) => [`Ksh ${value.toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#1E293B" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-serif text-charcoal">Student Enrollment</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sage"></div>
                <span className="text-xs font-medium text-charcoal/50">Active</span>
              </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrollmentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#1A1A1A', opacity: 0.5, fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#1A1A1A', opacity: 0.5, fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
                  }} 
                />
                <Bar 
                  dataKey="students" 
                  fill="#7A8B82" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity / Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8">
          <h3 className="text-xl font-serif text-charcoal mb-6">Payment Status Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-success-muted/5 border border-success-muted/10">
              <div className="w-10 h-10 rounded-full bg-success-muted text-white flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="font-bold text-success-muted">Fully Paid</p>
                <p className="text-xs text-charcoal/50">No outstanding balance</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-warning-muted/5 border border-warning-muted/10">
              <div className="w-10 h-10 rounded-full bg-warning-muted text-white flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="font-bold text-warning-muted">Partial</p>
                <p className="text-xs text-charcoal/50">Installments remaining</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-danger-muted/5 border border-danger-muted/10">
              <div className="w-10 h-10 rounded-full bg-danger-muted text-white flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="font-bold text-danger-muted">Pending</p>
                <p className="text-xs text-charcoal/50">Payment overdue</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-8">
          <h3 className="text-xl font-serif text-charcoal mb-6">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={runGenerateMonthlyReport}
              disabled={actionLoading === 'report'}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-charcoal/5 hover:bg-charcoal/5 transition-all group disabled:opacity-50"
            >
              <span className="font-medium text-charcoal/70">Generate Monthly Report</span>
              <TrendingUp size={18} className="text-charcoal/30 group-hover:text-navy" />
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-charcoal/5 hover:bg-charcoal/5 transition-all group"
            >
              <span className="font-medium text-charcoal/70">Reset Password (OTP)</span>
              <AlertCircle size={18} className="text-charcoal/30 group-hover:text-warning-muted" />
            </button>
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-charcoal/5 hover:bg-charcoal/5 transition-all group"
            >
              <span className="font-medium text-charcoal/70">Post Teacher Announcement</span>
              <UserPlus size={18} className="text-charcoal/30 group-hover:text-navy" />
            </button>
            <button
              onClick={() => setShowManageAnnouncementsModal(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-charcoal/5 hover:bg-charcoal/5 transition-all group"
            >
              <span className="font-medium text-charcoal/70">Manage Announcements</span>
              <AlertCircle size={18} className="text-charcoal/30 group-hover:text-warning-muted" />
            </button>
            <button
              onClick={runArchiveGraduatedStudents}
              disabled={actionLoading === 'archive'}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-charcoal/5 hover:bg-charcoal/5 transition-all group disabled:opacity-50"
            >
              <span className="font-medium text-charcoal/70">Archive Graduated Students</span>
              <GraduationCap size={18} className="text-charcoal/30 group-hover:text-sage" />
            </button>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <PasswordResetModal
          email={user.email}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
      {showAnnouncementModal && (
        <AnnouncementModal
          createdBy={user.id}
          onClose={() => setShowAnnouncementModal(false)}
        />
      )}
      {showManageAnnouncementsModal && (
        <ManageAnnouncementsModal
          adminId={user.id}
          onClose={() => setShowManageAnnouncementsModal(false)}
        />
      )}
    </div>
  );
}

function AnnouncementModal({ createdBy, onClose }: { createdBy: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    setLoading(true);
    setFeedback(null);
    setError(null);
    try {
      if (!title.trim() || !message.trim()) throw new Error('Title and message are required.');
      await dataService.createNotification({
        title: title.trim(),
        message: message.trim(),
        targetRole: 'TEACHER',
        createdBy
      });
      setFeedback('Announcement posted for all teachers.');
      setTitle('');
      setMessage('');
    } catch (err: any) {
      setError(err?.message || 'Failed to post announcement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg modal-surface rounded-2xl shadow-2xl p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">Post Announcement</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        {feedback && <p className="mb-3 text-xs text-success-muted">{feedback}</p>}
        {error && <p className="mb-3 text-xs text-danger-muted">{error}</p>}

        <div className="space-y-3">
          <input
            className="input-field"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="input-field min-h-[120px]"
            placeholder="Message for teachers..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <button onClick={publish} disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PasswordResetModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sendOtp = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });
      if (sendError) throw sendError;
      setOtpSent(true);
      setMessage(`A verification code has been sent to ${email}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const updatePasswordWithOtp = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!otp.trim()) throw new Error('Enter the OTP code from your email.');
      if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match.');

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'email'
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setMessage('Password updated successfully.');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">Reset Password</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-charcoal/60 mb-4">
          Send an OTP to <span className="font-semibold">{email}</span>, verify it, then set a new password.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-muted/10 text-danger-muted text-xs">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-success-muted/10 text-success-muted text-xs">
            {message}
          </div>
        )}

        <div className="space-y-3">
          {!otpSent ? (
            <button
              onClick={sendOtp}
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          ) : (
            <>
              <input
                type="text"
                className="input-field"
                placeholder="Enter OTP code"
                value={otp}
                onChange={e => setOtp(e.target.value)}
              />
              <input
                type="password"
                className="input-field"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                className="input-field"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <button
                onClick={updatePasswordWithOtp}
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Verify OTP & Update Password'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ManageAnnouncementsModal({ adminId, onClose }: { adminId: string; onClose: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = items.find(item => item.id === selectedId) || null;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await dataService.getAdminSentNotifications(adminId);
      setItems(list);
      if (list.length > 0) {
        setSelectedId(list[0].id);
        setTitle(list[0].title);
        setMessage(list[0].message);
        setActive(list[0].active);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [adminId]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setMessage(selected.message);
    setActive(selected.active);
  }, [selected]);

  const save = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      setError(null);
      setFeedback(null);
      if (!title.trim() || !message.trim()) throw new Error('Title and message are required.');
      const updated = await dataService.updateNotification(selected.id, {
        title: title.trim(),
        message: message.trim(),
        active
      });
      setItems(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setFeedback('Announcement updated.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update announcement.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    const confirmed = window.confirm(`Delete announcement "${selected.title}"?`);
    if (!confirmed) return;
    try {
      setSaving(true);
      setError(null);
      setFeedback(null);
      await dataService.deleteNotification(selected.id);

      const remaining = items.filter(item => item.id !== selected.id);
      setItems(remaining);

      if (remaining.length > 0) {
        const next = remaining[0];
        setSelectedId(next.id);
        setTitle(next.title);
        setMessage(next.message);
        setActive(next.active);
      } else {
        setSelectedId('');
        setTitle('');
        setMessage('');
        setActive(true);
      }
      setFeedback('Announcement deleted.');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete announcement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-5xl modal-surface rounded-2xl shadow-2xl p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">Manage Teacher Announcements</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        {error && <p className="mb-3 text-xs text-danger-muted">{error}</p>}
        {feedback && <p className="mb-3 text-xs text-success-muted">{feedback}</p>}

        {loading ? (
          <div className="h-60 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 border border-charcoal/10 rounded-xl max-h-[420px] overflow-auto">
              {items.length === 0 ? (
                <p className="p-4 text-sm text-charcoal/50">No announcements sent yet.</p>
              ) : (
                items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-4 border-b border-charcoal/5 last:border-b-0 transition-all ${
                      selectedId === item.id ? 'bg-navy/5' : 'hover:bg-charcoal/5'
                    }`}
                  >
                    <p className="text-sm font-semibold text-charcoal">{item.title}</p>
                    <p className="text-xs text-charcoal/50 mt-1">{item.createdAt?.slice(0, 10)}</p>
                    <p className={`text-[10px] font-bold uppercase mt-2 ${item.active ? 'text-success-muted' : 'text-warning-muted'}`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="lg:col-span-2 border border-charcoal/10 rounded-xl p-4">
              {selected ? (
                <div className="space-y-3">
                  <input
                    className="input-field"
                    placeholder="Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  <textarea
                    className="input-field min-h-[180px]"
                    placeholder="Message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm text-charcoal/70">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={e => setActive(e.target.checked)}
                    />
                    Active (show in teacher notifications)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={remove}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-danger-muted/10 text-danger-muted hover:bg-danger-muted/20 transition-all font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete Announcement
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-charcoal/50">Select an announcement to edit.</p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
