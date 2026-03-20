import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole } from './types';
import Layout from './components/Layout';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentManagement from './components/StudentManagement';
import StudentProfile from './components/StudentProfile';
import StudentEnrollmentActions from './components/StudentEnrollmentActions';
import ProgramsManagement from './components/ProgramsManagement';
import TeacherManagement from './components/TeacherManagement';
import Financials from './components/Financials';
import TeacherProfile from './components/TeacherProfile';
import { AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';

const ADMIN_EMAIL_ALLOWLIST = [
  'linguavocational@gmail.com',
  'linguacentre2013@gmail.com'
];
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_KEY = 'lingua-last-activity';
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isAdminEmailAllowed = (value: string) => ADMIN_EMAIL_ALLOWLIST.includes(normalizeEmail(value));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isConfigured]);

  useEffect(() => {
    if (!user) return;

    const recordActivity = () => {
      try {
        sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      } catch {
        // Ignore storage errors (private mode or disabled storage).
      }
    };

    recordActivity();

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));

    const interval = window.setInterval(async () => {
      const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
      if (!last) return;
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        await supabase.auth.signOut();
        setUser(null);
      }
    }, 60 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.clearInterval(interval);
    };
  }, [user]);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      // Auto-provision teacher profile if this auth user email exists in teachers table.
      if (!data && email) {
        const { data: teacher, error: teacherError } = await supabase
          .from('teachers')
          .select('id, name, email, active')
          .ilike('email', email)
          .eq('active', true)
          .maybeSingle();

        if (!teacherError && teacher) {
          const createdProfile = await supabase
            .from('profiles')
            .upsert([{
              id: userId,
              name: teacher.name,
              role: 'TEACHER',
              teacher_id: teacher.id
            }], { onConflict: 'id' })
            .select('*')
            .single();

          if (!createdProfile.error) {
            data = createdProfile.data;
          }
        }
      }

      if (!data) {
        await supabase.auth.signOut();
        setUser(null);
        return;
      }

      if (data) {
        const role = data.role as UserRole | null;
        if (role !== 'ADMIN' && role !== 'TEACHER') {
          console.error('Profile role is missing or invalid. Sign in is blocked until an ADMIN sets a valid role.');
          await supabase.auth.signOut();
          setUser(null);
          return;
        }
        if (role === 'ADMIN' && !isAdminEmailAllowed(email)) {
          console.error('This email is not authorized for admin access.');
          await supabase.auth.signOut();
          setUser(null);
          return;
        }

        // Teacher access is only valid while a matching active teacher record exists.
        if (role === 'TEACHER') {
          let teacherRecord: { id: string; active: boolean } | null = null;

          if (data.teacher_id) {
            const byId = await supabase
              .from('teachers')
              .select('id, active')
              .eq('id', data.teacher_id)
              .maybeSingle();
            if (!byId.error && byId.data) {
              teacherRecord = byId.data;
            }
          }

          if (!teacherRecord && email) {
            const byEmail = await supabase
              .from('teachers')
              .select('id, active')
              .ilike('email', email)
              .maybeSingle();
            if (!byEmail.error && byEmail.data) {
              teacherRecord = byEmail.data;
              // Heal older teacher profiles that may not have teacher_id set.
              if (teacherRecord.active && !data.teacher_id) {
                await supabase.from('profiles').update({ teacher_id: teacherRecord.id }).eq('id', userId);
                data.teacher_id = teacherRecord.id;
              }
            }
          }

          if (!teacherRecord || !teacherRecord.active) {
            await supabase.auth.signOut();
            setUser(null);
            return;
          }
        }

        setUser({
          id: data.id,
          name: data.name || 'User',
          email,
          role,
          teacherId: data.teacher_id || null,
          avatar: data.avatar_url
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-warning-muted/10 text-warning-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-serif text-charcoal mb-4">Configuration Required</h1>
          <p className="text-charcoal/60 mb-8">
            Please set your Supabase credentials in the environment variables to continue.
          </p>
          <div className="space-y-4 text-left bg-charcoal/5 p-4 rounded-xl font-mono text-xs">
            <p>VITE_SUPABASE_URL=your_url</p>
            <p>VITE_SUPABASE_ANON_KEY=your_key</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={logout}>
        <Routes>
          {user.role === 'ADMIN' ? (
            <>
              <Route path="/" element={<AdminDashboard user={user} />} />
              <Route path="/students" element={<StudentManagement user={user} />} />
              <Route path="/students/:id" element={<StudentProfile user={user} />} />
              <Route path="/students/:studentId/enrollments/:enrollmentId/manage" element={<StudentEnrollmentActions user={user} />} />
              <Route path="/programs" element={<ProgramsManagement />} />
              <Route path="/teachers" element={<TeacherManagement />} />
              <Route path="/financials" element={<Financials />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<TeacherDashboard user={user} />} />
              <Route path="/students" element={<StudentManagement user={user} />} />
              <Route path="/students/:id" element={<StudentProfile user={user} />} />
              <Route path="/students/:studentId/enrollments/:enrollmentId/manage" element={<StudentEnrollmentActions user={user} />} />
              <Route path="/profile" element={<TeacherProfile user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </Router>
  );
}
