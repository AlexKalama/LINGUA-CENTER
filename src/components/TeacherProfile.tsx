import { useEffect, useState } from 'react';
import { Mail, Phone, IdCard, BookOpen, ShieldCheck } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Teacher, User } from '../types';

interface TeacherProfileProps {
  user: User;
}

export default function TeacherProfile({ user }: TeacherProfileProps) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeacher() {
      try {
        setLoading(true);
        let profile: Teacher | null = null;
        if (user.teacherId) {
          profile = await dataService.getTeacherById(user.teacherId);
        }
        if (!profile && user.email) {
          profile = await dataService.getTeacherByEmail(user.email);
        }
        setTeacher(profile);
      } catch (error) {
        console.error('Error fetching teacher profile:', error);
        setTeacher(null);
      } finally {
        setLoading(false);
      }
    }
    fetchTeacher();
  }, [user.teacherId, user.email]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-serif text-charcoal">Profile not found</h2>
        <p className="text-charcoal/50 mt-2">We could not load your teacher profile details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif text-charcoal">My Profile</h1>
        <p className="text-charcoal/50">Personal details and assigned courses.</p>
      </div>

      <div className="glass-card p-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="flex flex-col items-center text-center md:text-left md:items-start">
            <div className="w-24 h-24 rounded-full bg-sage/20 text-sage flex items-center justify-center text-3xl font-serif font-bold">
              {teacher.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-serif text-charcoal">{teacher.name}</h2>
              <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-navy/10 text-navy uppercase tracking-widest">
                <ShieldCheck size={12} />
                Teacher
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-charcoal/5 bg-charcoal/[0.02]">
                <div className="flex items-center gap-2 text-xs text-charcoal/50 uppercase tracking-widest mb-2">
                  <Mail size={14} />
                  Email
                </div>
                <p className="text-sm font-semibold text-charcoal">{teacher.email}</p>
              </div>
              <div className="p-4 rounded-xl border border-charcoal/5 bg-charcoal/[0.02]">
                <div className="flex items-center gap-2 text-xs text-charcoal/50 uppercase tracking-widest mb-2">
                  <Phone size={14} />
                  Phone
                </div>
                <p className="text-sm font-semibold text-charcoal">{teacher.phone || '—'}</p>
              </div>
              <div className="p-4 rounded-xl border border-charcoal/5 bg-charcoal/[0.02]">
                <div className="flex items-center gap-2 text-xs text-charcoal/50 uppercase tracking-widest mb-2">
                  <IdCard size={14} />
                  ID Number
                </div>
                <p className="text-sm font-semibold text-charcoal">{teacher.idNumber || '—'}</p>
              </div>
              <div className="p-4 rounded-xl border border-charcoal/5 bg-charcoal/[0.02]">
                <div className="flex items-center gap-2 text-xs text-charcoal/50 uppercase tracking-widest mb-2">
                  <BookOpen size={14} />
                  Status
                </div>
                <p className="text-sm font-semibold text-charcoal">{teacher.active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-3">Assigned Courses</p>
              <div className="flex flex-wrap gap-2">
                {(teacher.courses || []).length === 0 ? (
                  <span className="text-sm text-charcoal/40">No courses assigned yet.</span>
                ) : (
                  teacher.courses.map(course => (
                    <span
                      key={course}
                      className="px-3 py-1 rounded-full bg-navy/5 text-navy text-[11px] font-bold uppercase tracking-wider"
                    >
                      {course}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
