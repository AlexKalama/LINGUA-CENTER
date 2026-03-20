import { useEffect, useState } from 'react';
import { User, Student } from '../types';
import {
  Search,
  Filter,
  MoreHorizontal,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  GraduationCap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import EnrollmentFlow from './EnrollmentFlow';
import { AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';

interface StudentManagementProps {
  user: User;
}

export default function StudentManagement({ user }: StudentManagementProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [graduatingEnrollmentId, setGraduatingEnrollmentId] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const data = await dataService.getStudents(user);
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [user, isEnrollmentOpen]);

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (user.role !== 'ADMIN') return;

    const confirmed = window.confirm(
      `Delete "${studentName}" permanently?\n\nThis will also remove all enrollments, payments, and attendance records for this student.`
    );
    if (!confirmed) return;

    try {
      setDeletingStudentId(studentId);
      await dataService.deleteStudent(studentId);
      setOpenActionsFor(null);
      await fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      window.alert('Failed to delete student. Please try again.');
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleMarkGraduate = async (enrollmentId: string) => {
    if (user.role !== 'ADMIN') return;
    const confirmed = window.confirm(
      'Mark this enrollment as graduated?\n\nThe system will only allow this if the fee balance is fully paid.'
    );
    if (!confirmed) return;

    try {
      setGraduatingEnrollmentId(enrollmentId);
      await dataService.markEnrollmentAsGraduated(enrollmentId);
      setOpenActionsFor(null);
      await fetchStudents();
      window.alert('Enrollment marked as graduated.');
    } catch (error: any) {
      console.error('Error graduating enrollment:', error);
      window.alert(error?.message || 'Failed to mark enrollment as graduated.');
    } finally {
      setGraduatingEnrollmentId(null);
    }
  };

  const allEnrollments = students.flatMap(student =>
    student.enrollments.map(enrollment => ({ ...enrollment, studentName: student.name }))
  );

  const filteredEnrollments = allEnrollments.filter(enrollment =>
    enrollment.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(enrollment.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-success-muted/10 text-success-muted';
      case 'GRADUATED': return 'bg-sage/10 text-sage';
      case 'DROPOUT': return 'bg-danger-muted/10 text-danger-muted';
      default: return 'bg-charcoal/5 text-charcoal/50';
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-success-muted';
      case 'PARTIAL': return 'bg-warning-muted';
      case 'PENDING': return 'bg-danger-muted';
      default: return 'bg-charcoal/20';
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-charcoal mb-2">Enrollment Directory</h1>
          <p className="text-charcoal/50">Independent academic records for all programs and courses.</p>
        </div>
        {user.role === 'ADMIN' && (
          <button
            onClick={() => setIsEnrollmentOpen(true)}
            className="btn-primary flex items-center gap-2 self-start"
          >
            <UserPlus size={18} />
            New Enrollment
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-charcoal/5 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" size={18} />
            <input
              type="text"
              placeholder="Search by name or course..."
              className="pl-10 pr-4 py-2 bg-charcoal/5 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-sage/20 focus:border-sage w-full transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-charcoal/60 hover:bg-charcoal/5 rounded-lg transition-all">
              <Filter size={18} />
              Filter
            </button>
            <div className="h-6 w-px bg-charcoal/10 mx-2" />
            <p className="text-sm text-charcoal/40 font-medium">Showing {filteredEnrollments.length} records</p>
          </div>
        </div>

        <div className="md:hidden divide-y divide-charcoal/5">
          {filteredEnrollments.map((enrollment) => (
            <div key={enrollment.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal">{enrollment.studentName}</p>
                  <p className="text-xs text-charcoal/40">{enrollment.registrationNumber || '—'}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${getStatusColor(enrollment.status)}`}>
                  {enrollment.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-charcoal/60">
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Course</p>
                  <p className="font-semibold text-charcoal">{enrollment.courseName}</p>
                  <p className="text-[10px] text-charcoal/40 uppercase tracking-tight">{enrollment.programType} - {enrollment.level}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Teacher</p>
                  <p className="font-medium text-charcoal">{enrollment.teacherName}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Fee Balance</p>
                  <p className="font-semibold text-charcoal">Ksh {enrollment.feeBalance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Enrollment Date</p>
                  <p className="font-medium text-charcoal">{enrollment.enrollmentDate}</p>
                </div>
              </div>
              <div className="flex items-center justify-between relative">
                <Link
                  to={`/students/${enrollment.studentId}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-navy hover:bg-navy/5 rounded transition-all"
                >
                  <Eye size={14} />
                  View
                </Link>
                {user.role === 'TEACHER' ? (
                  <button
                    onClick={() => navigate(`/students/${enrollment.studentId}/enrollments/${enrollment.id}/manage`)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-charcoal hover:bg-charcoal/5 rounded transition-all"
                  >
                    <MoreHorizontal size={14} />
                    Manage
                  </button>
                ) : (
                  <button
                    onClick={() => setOpenActionsFor(openActionsFor === enrollment.id ? null : enrollment.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-charcoal hover:bg-charcoal/5 rounded transition-all"
                  >
                    <MoreHorizontal size={14} />
                    Actions
                  </button>
                )}

                {user.role === 'ADMIN' && openActionsFor === enrollment.id && (
                  <div className="absolute right-0 top-10 z-20 min-w-[220px] rounded-lg popover-surface shadow-xl p-1">
                    <button
                      onClick={() => {
                        setOpenActionsFor(null);
                        navigate(`/students/${enrollment.studentId}/enrollments/${enrollment.id}/manage`);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-charcoal hover:bg-charcoal/5 rounded-md transition-all"
                    >
                      View Academic Records
                    </button>
                    <button
                      onClick={() => handleMarkGraduate(enrollment.id)}
                      disabled={graduatingEnrollmentId === enrollment.id || enrollment.status === 'GRADUATED'}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sage hover:bg-sage/10 rounded-md transition-all disabled:opacity-50"
                    >
                      <GraduationCap size={14} />
                      {enrollment.status === 'GRADUATED'
                        ? 'Already Graduated'
                        : graduatingEnrollmentId === enrollment.id
                          ? 'Updating...'
                          : 'Mark as Graduated'}
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(enrollment.studentId, enrollment.studentName)}
                      disabled={deletingStudentId === enrollment.studentId}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-muted hover:bg-danger-muted/10 rounded-md transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {deletingStudentId === enrollment.studentId ? 'Deleting...' : 'Delete Student'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredEnrollments.length === 0 && (
            <div className="p-4 text-center text-sm text-charcoal/40">
              No enrollments match your search.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-charcoal/[0.02]">
                <th className="table-header">Student</th>
                <th className="table-header">Program & Course</th>
                <th className="table-header">Reg No</th>
                <th className="table-header">Teacher</th>
                <th className="table-header">Status</th>
                <th className="table-header">Fee Balance</th>
                <th className="table-header">Enrollment Date</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-charcoal/[0.01] transition-colors group">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy/5 text-navy flex items-center justify-center font-bold text-xs">
                        {enrollment.studentName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-semibold text-charcoal">{enrollment.studentName}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="text-charcoal font-medium">{enrollment.courseName}</span>
                      <span className="text-[10px] text-charcoal/40 uppercase tracking-tighter font-bold">
                        {enrollment.programType} - {enrollment.level}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell text-xs font-mono text-charcoal/50">
                    {enrollment.registrationNumber || '—'}
                  </td>
                  <td className="table-cell text-charcoal/70">{enrollment.teacherName}</td>
                  <td className="table-cell">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${getStatusColor(enrollment.status)}`}>
                      {enrollment.status}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getPaymentColor(enrollment.paymentStatus)}`} />
                      <span className={`font-mono font-medium ${enrollment.feeBalance > 0 ? 'text-charcoal' : 'text-charcoal/30'}`}>
                        Ksh {enrollment.feeBalance.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell text-charcoal/50 font-mono text-xs">
                    {enrollment.enrollmentDate}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-2 relative">
                      <Link
                        to={`/students/${enrollment.studentId}`}
                        className="p-2 text-charcoal/30 hover:text-navy hover:bg-navy/5 rounded-lg transition-all"
                      >
                        <Eye size={18} />
                      </Link>

                      {user.role === 'TEACHER' ? (
                        <button
                          onClick={() => navigate(`/students/${enrollment.studentId}/enrollments/${enrollment.id}/manage`)}
                          className="p-2 text-charcoal/30 hover:text-charcoal hover:bg-charcoal/5 rounded-lg transition-all"
                          title="Open student academic management"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setOpenActionsFor(openActionsFor === enrollment.id ? null : enrollment.id)}
                            className="p-2 text-charcoal/30 hover:text-charcoal hover:bg-charcoal/5 rounded-lg transition-all"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {openActionsFor === enrollment.id && (
                            <div className="absolute right-0 top-10 z-20 min-w-[220px] rounded-lg popover-surface shadow-xl p-1">
                              <button
                                onClick={() => {
                                  setOpenActionsFor(null);
                                  navigate(`/students/${enrollment.studentId}/enrollments/${enrollment.id}/manage`);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-charcoal hover:bg-charcoal/5 rounded-md transition-all"
                              >
                                View Academic Records
                              </button>
                              <button
                                onClick={() => handleMarkGraduate(enrollment.id)}
                                disabled={graduatingEnrollmentId === enrollment.id || enrollment.status === 'GRADUATED'}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sage hover:bg-sage/10 rounded-md transition-all disabled:opacity-50"
                              >
                                <GraduationCap size={14} />
                                {enrollment.status === 'GRADUATED'
                                  ? 'Already Graduated'
                                  : graduatingEnrollmentId === enrollment.id
                                    ? 'Updating...'
                                    : 'Mark as Graduated'}
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(enrollment.studentId, enrollment.studentName)}
                                disabled={deletingStudentId === enrollment.studentId}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-muted hover:bg-danger-muted/10 rounded-md transition-all disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                {deletingStudentId === enrollment.studentId ? 'Deleting...' : 'Delete Student'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-charcoal/5 flex justify-between items-center">
          <p className="text-xs text-charcoal/40 font-medium">Page 1 of 1</p>
          <div className="flex items-center gap-2">
            <button className="p-2 text-charcoal/30 hover:text-charcoal hover:bg-charcoal/5 rounded-lg transition-all disabled:opacity-30" disabled>
              <ChevronLeft size={20} />
            </button>
            <button className="p-2 text-charcoal/30 hover:text-charcoal hover:bg-charcoal/5 rounded-lg transition-all disabled:opacity-30" disabled>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEnrollmentOpen && (
          <EnrollmentFlow onClose={() => setIsEnrollmentOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
