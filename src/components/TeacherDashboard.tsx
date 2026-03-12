import { useMemo, useState, useEffect } from 'react';
import { Users, AlertCircle, Clock, X, CheckCircle2, Calendar, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { User, Student, Enrollment, Course, Teacher } from '../types';

interface TeacherDashboardProps {
  user: User;
}

interface CourseGroup {
  key: string;
  courseId: string;
  courseName: string;
  level: string;
  programType: string;
  rows: Array<{ student: Student; enrollment: Enrollment }>;
}

type AcademicBundle = Record<string, {
  grades: any[];
  insights: any[];
  certificates: any[];
  overallGrade: number;
}>;

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <motion.div whileHover={{ y: -4 }} className="glass-card p-6 flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-opacity-100`}>
        <Icon size={24} />
      </div>
    </div>
    <div>
      <p className="text-sm font-medium text-charcoal/50 uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-serif font-bold text-charcoal">{value}</h3>
    </div>
  </motion.div>
);

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacherProfile, setTeacherProfile] = useState<Teacher | null>(null);
  const [bundle, setBundle] = useState<AcademicBundle>({});
  const [loading, setLoading] = useState(true);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string>('');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  const refreshAcademicBundle = async (enrollmentIds: string[]) => {
    try {
      const data = await dataService.getEnrollmentAcademicBundle(enrollmentIds);
      setBundle(data);
    } catch (error) {
      console.error('Error fetching grade/insight/certificate bundle:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await dataService.getStudents(user);
      setStudents(data);
      const enrollmentIds = data.flatMap(student => student.enrollments.map(enrollment => enrollment.id));
      await refreshAcademicBundle(enrollmentIds);
    } catch (error) {
      console.error('Error fetching teacher dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id, user.teacherId]);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const list = await dataService.getCourses();
        setCourses(list);
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
    }
    fetchCourses();
  }, []);

  useEffect(() => {
    async function fetchTeacherProfile() {
      try {
        let profile: Teacher | null = null;
        if (user.teacherId) {
          profile = await dataService.getTeacherById(user.teacherId);
        }
        if (!profile && user.email) {
          profile = await dataService.getTeacherByEmail(user.email);
        }
        setTeacherProfile(profile);
      } catch (error) {
        console.error('Error fetching teacher profile:', error);
      }
    }
    fetchTeacherProfile();
  }, [user.teacherId, user.email]);

  const courseGroups = useMemo<CourseGroup[]>(() => {
    const map = new Map<string, CourseGroup>();
    const assignments = Array.isArray(teacherProfile?.courses) ? teacherProfile!.courses : [];

    const resolveAssignment = (assignment: string) => {
      const normalized = String(assignment || '').trim();
      if (!normalized) return null;
      const match = courses.find(course => normalized.toLowerCase().startsWith(course.name.toLowerCase()));
      let courseName = match?.name || normalized;
      let level = '';
      if (match) {
        level = normalized.slice(match.name.length).trim();
      }
      if (!level) {
        const parts = normalized.split(' ');
        if (parts.length > 1) {
          level = parts.pop() || '';
          courseName = parts.join(' ');
        }
      }
      return {
        courseId: match?.id || '',
        courseName,
        level,
        programType: match?.programType || ''
      };
    };

    assignments.forEach(assignment => {
      const resolved = resolveAssignment(assignment);
      if (!resolved) return;
      const key = `${resolved.courseId || resolved.courseName}::${resolved.level || 'LEVEL'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          courseId: resolved.courseId,
          courseName: resolved.courseName,
          level: resolved.level,
          programType: resolved.programType,
          rows: []
        });
      }
    });

    for (const student of students) {
      for (const enrollment of student.enrollments) {
        const key = `${enrollment.courseId || enrollment.courseName}::${enrollment.level}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            courseId: enrollment.courseId,
            courseName: enrollment.courseName,
            level: enrollment.level,
            programType: enrollment.programType,
            rows: []
          });
        }
        map.get(key)!.rows.push({ student, enrollment });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.courseName.localeCompare(b.courseName));
  }, [students, courses, teacherProfile]);

  useEffect(() => {
    if (!selectedCourseKey && courseGroups.length > 0) {
      setSelectedCourseKey(courseGroups[0].key);
      return;
    }
    if (selectedCourseKey && !courseGroups.some(group => group.key === selectedCourseKey)) {
      setSelectedCourseKey(courseGroups[0]?.key || '');
    }
  }, [selectedCourseKey, courseGroups]);

  const selectedCourse = courseGroups.find(group => group.key === selectedCourseKey) || null;
  const enrollments = students.flatMap(student => student.enrollments);
  const pendingBalancesCount = enrollments.filter(enrollment => enrollment.paymentStatus !== 'PAID').length;

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-charcoal mb-2">My Classroom</h1>
        <p className="text-charcoal/50">Manage attendance here, and open My Students for grades, insights, and certificates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Courses I Teach" value={courseGroups.length} icon={BookOpen} color="text-navy" />
        <StatCard title="My Students" value={students.length} icon={Users} color="text-sage" />
        <StatCard title="Pending Balances" value={pendingBalancesCount} icon={AlertCircle} color="text-warning-muted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 glass-card p-6">
          <h3 className="text-xl font-serif text-charcoal mb-4">My Courses</h3>
          <div className="space-y-3">
            {courseGroups.map(group => (
              <button
                key={group.key}
                onClick={() => setSelectedCourseKey(group.key)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedCourseKey === group.key
                    ? 'border-navy bg-navy/5'
                    : 'border-charcoal/10 hover:border-charcoal/30'
                }`}
              >
                <p className="font-semibold text-charcoal">{group.courseName}</p>
                <p className="text-xs text-charcoal/50 mt-1">{group.programType || 'Program'} - {group.level || 'Level'}</p>
                <p className="text-xs text-charcoal/40 mt-2">{group.rows.length} student(s)</p>
              </button>
            ))}
            {courseGroups.length === 0 && (
              <p className="text-sm text-charcoal/40">No courses assigned to you yet.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 glass-card p-6">
          {selectedCourse ? (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-serif text-charcoal">{selectedCourse.courseName}</h3>
                  <p className="text-sm text-charcoal/50">{selectedCourse.level} - {selectedCourse.rows.length} learners</p>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(true)}
                  className="btn-primary flex items-center gap-2 self-start disabled:opacity-50"
                  disabled={selectedCourse.rows.length === 0}
                >
                  <Clock size={18} />
                  Mark Attendance
                </button>
              </div>

              <div className="mb-5 p-3 rounded-lg bg-charcoal/5 text-xs text-charcoal/60">
                To add grades, insights, or certificates, open{' '}
                <Link to="/students" className="font-semibold text-navy hover:underline">
                  My Students
                </Link>{' '}
                and click the three-dots action on the learner row.
              </div>

              <div className="space-y-4">
                {selectedCourse.rows.length === 0 && (
                  <div className="p-4 rounded-xl bg-charcoal/5 text-sm text-charcoal/50">
                    No enrolled students for this course yet.
                  </div>
                )}
                {selectedCourse.rows.map(({ student, enrollment }) => {
                  const data = bundle[enrollment.id] || { grades: [], insights: [], certificates: [], overallGrade: 0 };
                  return (
                    <div key={enrollment.id} className="p-4 rounded-xl border border-charcoal/10">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-semibold text-charcoal">{student.name}</p>
                          <p className="text-xs text-charcoal/50">{student.email} - Overall Grade: {data.overallGrade}%</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-charcoal/5">Assessments: {data.grades.length}</div>
                        <div className="p-2 rounded-lg bg-charcoal/5">Insights: {data.insights.length}</div>
                        <div className="p-2 rounded-lg bg-charcoal/5">Certificates: {data.certificates.length}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-charcoal/40">Select a course to view enrolled students.</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAttendanceModal && selectedCourse && (
          <AttendanceModal
            teacherId={user.teacherId || ''}
            course={selectedCourse}
            onClose={() => setShowAttendanceModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AttendanceModal({ teacherId, course, onClose }: { teacherId: string; course: CourseGroup; onClose: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [teacherStatus, setTeacherStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE'>('PRESENT');
  const [attendanceData, setAttendanceData] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE'>>(() => {
    const initial: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'> = {};
    course.rows.forEach(row => {
      initial[row.enrollment.id] = 'PRESENT';
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await dataService.markTeacherAttendance({
        teacherId,
        courseId: course.courseId,
        level: course.level,
        date,
        status: teacherStatus,
        notes: ''
      });

      await Promise.all(
        Object.entries(attendanceData).map(([enrollmentId, status]) =>
          dataService.markAttendance(enrollmentId, {
            enrollmentId,
            date,
            status: status as 'PRESENT' | 'ABSENT' | 'LATE'
          })
        )
      );
      onClose();
    } catch (error) {
      console.error('Error marking attendance:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl modal-surface rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sage/10 text-sage rounded-lg"><Calendar size={20} /></div>
            <h3 className="text-2xl font-serif">Attendance - {course.courseName} ({course.level})</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-charcoal/5 rounded-xl flex items-center justify-between">
            <span className="text-sm text-charcoal/60">Date</span>
            <input type="date" className="bg-transparent border-none focus:ring-0 text-sm" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="p-4 bg-charcoal/5 rounded-xl">
            <p className="text-sm text-charcoal/60 mb-2">Teacher Attendance</p>
            <div className="flex gap-2">
              {(['PRESENT', 'ABSENT', 'LATE'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setTeacherStatus(status)}
                    className={`px-3 py-1 rounded text-[10px] font-bold ${
                      teacherStatus === status ? 'bg-navy text-white' : 'bg-charcoal/5 text-charcoal/60'
                    }`}
                  >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {course.rows.map(({ student, enrollment }) => (
            <div key={enrollment.id} className="flex items-center justify-between p-3 rounded-xl border border-charcoal/10">
              <div>
                <p className="font-semibold text-charcoal">{student.name}</p>
                <p className="text-xs text-charcoal/40">{enrollment.courseName} - {enrollment.level}</p>
              </div>
              <div className="flex gap-2">
                {(['PRESENT', 'ABSENT', 'LATE'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setAttendanceData({ ...attendanceData, [enrollment.id]: status })}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
                      attendanceData[enrollment.id] === status ? 'bg-sage text-white' : 'bg-charcoal/5 text-charcoal/40'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 px-6 py-3 rounded-xl border border-charcoal/10 font-bold text-charcoal/40 hover:bg-charcoal/5 transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
            <CheckCircle2 size={18} />
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
