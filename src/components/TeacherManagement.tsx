import { useState, useEffect } from 'react';
import { 
  Plus, 
  Mail, 
  Trash2,
  Edit2,
  Phone,
  IdCard,
  X,
  CheckCircle2,
  ChevronRight,
  KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { Teacher, Student } from '../types';

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [viewingStudents, setViewingStudents] = useState<Teacher | null>(null);
  const [accessTeacher, setAccessTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const data = await dataService.getTeachers();
      setTeachers(data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleAddTeacher = () => {
    setSelectedTeacher(null);
    setShowModal(true);
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowModal(true);
  };

  const handleDeleteTeacher = async (id: string) => {
    if (confirm('Are you sure you want to delete this teacher?')) {
      try {
        await dataService.deleteTeacher(id);
        await fetchTeachers();
      } catch (error) {
        console.error('Error deleting teacher:', error);
        alert((error as any)?.message || 'Failed to delete teacher.');
      }
    }
  };

  const handleSave = async (teacherData: any) => {
    try {
      const { loginPassword, confirmLoginPassword, ...payload } = teacherData;
      let savedTeacher: Teacher;
      if (selectedTeacher) {
        savedTeacher = await dataService.updateTeacher(selectedTeacher.id, payload);
      } else {
        if (!loginPassword || !confirmLoginPassword) {
          throw new Error('Password and confirm password are required for a new teacher.');
        }
        if (String(loginPassword) !== String(confirmLoginPassword)) {
          throw new Error('Passwords do not match.');
        }
        savedTeacher = await dataService.addTeacher({
          ...payload,
          courses: Array.isArray(payload.courses) ? payload.courses : [],
          active: payload.active ?? true
        });
        await dataService.adminUpsertTeacherAuth({
          teacherId: savedTeacher.id,
          email: String(payload.email || '').trim().toLowerCase(),
          name: String(payload.name || '').trim(),
          password: String(loginPassword).trim()
        });
      }

      await fetchTeachers();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving teacher:', error);
      alert((error as any)?.message || 'Failed to save teacher.');
    }
  };

  if (loading && teachers.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif text-charcoal mb-2">Faculty Directory</h1>
          <p className="text-charcoal/50">Manage teacher assignments, performance metrics, and course loads.</p>
        </div>
        <button onClick={handleAddTeacher} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Teacher
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {teachers.map(teacher => (
          <motion.div 
            key={teacher.id}
            whileHover={{ y: -4 }}
            className="glass-card p-8 flex flex-col md:flex-row gap-8 relative overflow-hidden"
          >
            {!teacher.active && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-charcoal/10 text-charcoal/40 text-[10px] font-bold uppercase tracking-widest rounded-full">
                Inactive
              </div>
            )}
            
            <div className="flex flex-col items-center text-center md:items-start md:text-left min-w-[200px]">
              <div className="w-20 h-20 rounded-full bg-sage/20 text-sage flex items-center justify-center text-2xl font-serif font-bold mb-4">
                {teacher.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h3 className="text-xl font-serif text-charcoal mb-1">{teacher.name}</h3>
              <div className="space-y-1 mb-4">
                <div className="flex items-center gap-2 text-xs text-charcoal/40">
                  <Mail size={12} />
                  <span>{teacher.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-charcoal/40">
                  <Phone size={12} />
                  <span>{teacher.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-charcoal/40">
                  <IdCard size={12} />
                  <span>ID: {teacher.idNumber}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {teacher.courses.map(course => (
                  <span key={course} className="px-2 py-1 rounded bg-navy/5 text-navy text-[10px] font-bold uppercase tracking-wider">
                    {course}
                  </span>
                ))}
              </div>

              <button 
                onClick={() => setViewingStudents(teacher)}
                className="mt-6 text-xs font-bold text-sage hover:underline flex items-center gap-1"
              >
                View Assigned Students <ChevronRight size={14} />
              </button>
            </div>

            <div className="absolute bottom-4 right-4 flex gap-2">
              <button 
                onClick={() => setAccessTeacher(teacher)}
                className="p-2 text-charcoal/20 hover:text-sage hover:bg-sage/5 rounded-lg transition-all"
                title="Manage login access"
              >
                <KeyRound size={18} />
              </button>
              <button 
                onClick={() => handleEditTeacher(teacher)}
                className="p-2 text-charcoal/20 hover:text-navy hover:bg-navy/5 rounded-lg transition-all"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => handleDeleteTeacher(teacher.id)}
                className="p-2 text-charcoal/20 hover:text-danger-muted hover:bg-danger-muted/5 rounded-lg transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <TeacherModal 
            teacher={selectedTeacher} 
            onClose={() => setShowModal(false)} 
            onSave={handleSave} 
          />
        )}
        {viewingStudents && (
          <StudentsListModal 
            teacher={viewingStudents} 
            onClose={() => setViewingStudents(null)} 
          />
        )}
        {accessTeacher && (
          <TeacherAccessModal
            teacher={accessTeacher}
            onClose={() => setAccessTeacher(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TeacherModal({ teacher, onClose, onSave }: { teacher: Teacher | null, onClose: () => void, onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: teacher?.name || '',
    email: teacher?.email || '',
    phone: teacher?.phone || '',
    idNumber: teacher?.idNumber || '',
    active: teacher?.active ?? true,
    courses: teacher?.courses || [],
    loginPassword: '',
    confirmLoginPassword: ''
  });

  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [programs, courses] = await Promise.all([
          dataService.getPrograms(),
          dataService.getCourses()
        ]);
        setAllPrograms(programs);
        setAllCourses(courses);
        if (programs.length > 0) setSelectedProgram(programs[0].id);
      } catch (error) {
        console.error('Error fetching modal data:', error);
      }
    }
    fetchData();
  }, []);

  const filteredCourses = allCourses.filter(c => c.programType === selectedProgram);

  useEffect(() => {
    if (filteredCourses.length > 0) {
      setSelectedCourse(filteredCourses[0].id);
      setSelectedLevel(filteredCourses[0].levels[0] || '');
    } else {
      setSelectedCourse('');
      setSelectedLevel('');
    }
  }, [selectedProgram, allCourses]); // Added allCourses to dependencies

  useEffect(() => {
    const course = allCourses.find(c => c.id === selectedCourse);
    if (course) {
      setSelectedLevel(course.levels[0] || '');
    }
  }, [selectedCourse]);

  const addAssignedCourse = () => {
    const course = allCourses.find(c => c.id === selectedCourse);
    if (!course) return;
    
    const assignment = `${course.name} ${selectedLevel}`.trim();
    if (!formData.courses.includes(assignment)) {
      setFormData({
        ...formData,
        courses: [...formData.courses, assignment]
      });
    }
  };

  const removeAssignedCourse = (courseStr: string) => {
    setFormData({
      ...formData,
      courses: formData.courses.filter(c => c !== courseStr)
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl modal-surface rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">{teacher ? 'Edit Teacher' : 'Add New Teacher'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-charcoal/40 uppercase tracking-widest border-b border-charcoal/5 pb-2">Personal Information</h4>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Full Name</label>
              <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Email Address</label>
              <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Phone Number</label>
                <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">ID Number</label>
                <input type="text" className="input-field" value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="rounded text-sage focus:ring-sage" />
              <span className="text-sm text-charcoal/60">Active Faculty Member</span>
            </div>
            {!teacher ? (
              <>
                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Initial Login Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Minimum 6 characters"
                    value={formData.loginPassword}
                    onChange={e => setFormData({...formData, loginPassword: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Confirm Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Re-enter password"
                    value={formData.confirmLoginPassword}
                    onChange={e => setFormData({...formData, confirmLoginPassword: e.target.value})}
                  />
                  <p className="text-[11px] text-charcoal/40">
                    Teacher uses this email/password to sign in. Admin can reset later from the key icon.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-charcoal/40 pt-2">
                Password resets are handled from Teacher Access (key icon) on the teacher card.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-charcoal/40 uppercase tracking-widest border-b border-charcoal/5 pb-2">Course Assignments</h4>
            
            <div className="space-y-3 p-4 bg-charcoal/5 rounded-xl">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Program</label>
                <select className="input-field text-xs" value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)}>
                  {allPrograms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Course</label>
                <select className="input-field text-xs" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                  {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Level</label>
                <select className="input-field text-xs" value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}>
                  {allCourses.find(c => c.id === selectedCourse)?.levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <button 
                onClick={addAssignedCourse}
                disabled={!selectedCourse}
                className="w-full py-2 bg-navy text-white text-xs font-bold rounded-lg hover:bg-navy/90 transition-all disabled:opacity-50"
              >
                Assign Course
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Current Assignments</label>
              <div className="flex flex-wrap gap-2">
                {formData.courses.map(course => (
                  <div key={course} className="flex items-center gap-2 px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold">
                    {course}
                    <button onClick={() => removeAssignedCourse(course)} className="hover:text-danger-muted"><Trash2 size={12} /></button>
                  </div>
                ))}
                {formData.courses.length === 0 && <p className="text-xs text-charcoal/30 italic">No courses assigned yet.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-charcoal/5 flex justify-end gap-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSave(formData)}
            disabled={
              !formData.name ||
              !formData.email ||
              (!teacher && (!formData.loginPassword || !formData.confirmLoginPassword || formData.loginPassword !== formData.confirmLoginPassword))
            }
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            {teacher ? 'Update Teacher' : 'Create Teacher'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TeacherAccessModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runReset = async () => {
    try {
      if (!password.trim()) throw new Error('Enter the new password first.');
      if (password.trim().length < 6) throw new Error('Password must be at least 6 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      setLoadingAction(true);
      setError(null);
      setMessage(null);
      try {
        await dataService.adminResetTeacherPassword({
          teacherId: teacher.id,
          newPassword: password.trim()
        });
      } catch (err: any) {
        const text = String(err?.message || '');
        if (text.toLowerCase().includes('no auth user exists')) {
          await dataService.adminUpsertTeacherAuth({
            teacherId: teacher.id,
            email: teacher.email.toLowerCase(),
            name: teacher.name,
            password: password.trim()
          });
        } else {
          throw err;
        }
      }
      setMessage('Teacher password has been set successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-serif">Teacher Access</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>
        <p className="text-sm text-charcoal/60 mb-4">
          {teacher.name} ({teacher.email})
        </p>
        <p className="text-xs text-charcoal/50 mb-3">
          Set a new password for this teacher. They will use it to sign in normally.
        </p>
        {error && <div className="mb-3 p-3 rounded-lg bg-danger-muted/10 text-danger-muted text-xs">{error}</div>}
        {message && <div className="mb-3 p-3 rounded-lg bg-success-muted/10 text-success-muted text-xs">{message}</div>}
        <div className="space-y-3">
          <input
            type="password"
            className="input-field"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <input
            type="password"
            className="input-field"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
          <button onClick={runReset} disabled={loadingAction} className="btn-primary w-full disabled:opacity-50">
            {loadingAction ? 'Saving...' : 'Reset Password'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StudentsListModal({ teacher, onClose }: { teacher: Teacher, onClose: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    async function fetchAssignedStudents() {
      try {
        const allStudents = await dataService.getStudents();
        const assigned = allStudents.filter(s => s.enrollments.some(e => e.teacherId === teacher.id));
        setStudents(assigned);
      } catch (error) {
        console.error('Error fetching assigned students:', error);
      }
    }
    fetchAssignedStudents();
  }, [teacher.id]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl modal-surface rounded-2xl shadow-2xl p-8 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-serif">Assigned Students</h3>
            <p className="text-sm text-charcoal/40">Students currently taught by {teacher.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {students.map(student => (
            <div key={student.id} className="p-4 rounded-xl border border-charcoal/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-charcoal">{student.name}</p>
                  <div className="flex gap-2 mt-1">
                    {student.enrollments.filter(e => e.teacherId === teacher.id).map(e => (
                      <span key={e.id} className="text-[10px] bg-charcoal/5 px-2 py-0.5 rounded text-charcoal/50">
                        {e.courseName} ({e.level})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-charcoal/40">{student.phone}</p>
                <p className="text-xs text-charcoal/40">{student.email}</p>
              </div>
            </div>
          ))}
          {students.length === 0 && (
            <div className="text-center py-12 text-charcoal/30 italic">
              No students currently assigned to this teacher.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
