import React, { useState } from 'react';
import { BookOpen, Loader2, Mail, ShieldCheck, GraduationCap, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

type AccessRole = 'ADMIN' | 'TEACHER';

const ADMIN_EMAIL_ALLOWLIST = [
  'linguavocational@gmail.com',
  'linguacentre2013@gmail.com'
];
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isAdminEmailAllowed = (value: string) => ADMIN_EMAIL_ALLOWLIST.includes(normalizeEmail(value));

export default function Login() {
  const [role, setRole] = useState<AccessRole>('ADMIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showForgot, setShowForgot] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const handleSwitchRole = (nextRole: AccessRole) => {
    setRole(nextRole);
    setShowForgot(false);
    setOtpSent(false);
    setOtpCode('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    resetFeedback();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetFeedback();

    try {
      if (!email.trim()) throw new Error('Enter your email address first.');
      if (!password) throw new Error('Enter your password.');
      if (role === 'ADMIN' && !isAdminEmailAllowed(email)) {
        throw new Error('This email is not authorized for admin access.');
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password
      });

      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const sendForgotOtp = async () => {
    setLoading(true);
    resetFeedback();

    try {
      if (!email.trim()) throw new Error('Enter your email address first.');
      if (role === 'ADMIN' && !isAdminEmailAllowed(email)) {
        throw new Error('This email is not authorized for admin access.');
      }

      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: normalizeEmail(email),
        options: { shouldCreateUser: false }
      });

      if (sendError) throw sendError;
      setOtpSent(true);
      setMessage('OTP sent to your email. Enter it below to reset your password.');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndResetPassword = async () => {
    setLoading(true);
    resetFeedback();

    try {
      if (!email.trim()) throw new Error('Enter your email address first.');
      if (role === 'ADMIN' && !isAdminEmailAllowed(email)) {
        throw new Error('This email is not authorized for admin access.');
      }
      if (!otpCode.trim()) throw new Error('Enter OTP code.');
      if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match.');

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizeEmail(email),
        token: otpCode.trim(),
        type: 'email'
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      await supabase.auth.signOut();

      setShowForgot(false);
      setOtpSent(false);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
      setMessage('Password reset complete. Sign in using your new password.');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-navy text-white mb-3">
            <BookOpen size={26} />
          </div>
          <h1 className="text-2xl font-serif text-charcoal mb-1">Lingua Center</h1>
          <p className="text-charcoal/60 font-sans text-sm">Academic Management System</p>
        </div>

        <div className="glass-card p-5 shadow-xl border-charcoal/10">
          <h2 className="text-lg font-serif text-charcoal mb-4 text-center">Internal Access</h2>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => handleSwitchRole('ADMIN')}
              className={`px-2.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                role === 'ADMIN' ? 'bg-navy text-white' : 'bg-charcoal/5 text-charcoal/60'
              }`}
            >
              <ShieldCheck size={14} />
              Administrator
            </button>
            <button
              type="button"
              onClick={() => handleSwitchRole('TEACHER')}
              className={`px-2.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                role === 'TEACHER' ? 'bg-navy text-white' : 'bg-charcoal/5 text-charcoal/60'
              }`}
            >
              <GraduationCap size={14} />
              Teacher
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-danger-muted/10 border border-danger-muted/20 text-danger-muted text-xs rounded-lg text-center">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 mb-4 bg-success-muted/10 border border-success-muted/20 text-success-muted text-xs rounded-lg text-center">
              {message}
            </div>
          )}

          {!showForgot ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-wider mb-2">
                  {role === 'ADMIN' ? 'Admin Email' : 'Teacher Email'}
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder={role === 'ADMIN' ? 'admin@linguacenter.com' : 'teacher@linguacenter.com'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="********"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-2.5 text-sm mt-2 shadow-lg shadow-navy/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
              </button>

              {role === 'ADMIN' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(true);
                    setOtpSent(false);
                    setOtpCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    resetFeedback();
                  }}
                  className="w-full text-sm text-navy hover:underline pt-1"
                >
                  Forgot password?
                </button>
              ) : (
                <p className="text-center text-[11px] text-charcoal/50 pt-1">
                  Password changes are managed by the administrator.
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-wider mb-2">Admin Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="admin@linguacenter.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {otpSent && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-wider mb-2">OTP Code</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Enter OTP from email"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-wider mb-2">New Password</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-charcoal/50 uppercase tracking-wider mb-2">Confirm Password</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={otpSent ? verifyOtpAndResetPassword : sendForgotOtp}
                disabled={loading}
                className="w-full btn-primary py-2.5 text-sm mt-2 shadow-lg shadow-navy/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : otpSent ? (
                  <>
                    <KeyRound size={18} />
                    Verify OTP & Reset
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    Send Reset OTP
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgot(false);
                  setOtpSent(false);
                  setOtpCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  resetFeedback();
                }}
                className="w-full text-[11px] text-charcoal/60 hover:text-charcoal pt-1"
              >
                Back to sign in
              </button>
            </div>
          )}

          <p className="text-center text-[11px] text-charcoal/40 mt-6">
            Protected by Lingua Center Security. <br />
            Unauthorized access is prohibited.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
