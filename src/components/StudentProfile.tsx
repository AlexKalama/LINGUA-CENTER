import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  Mail, 
  Phone, 
  Calendar, 
  BookOpen, 
  User as UserIcon, 
  Wallet, 
  Clock, 
  Download,
  Award,
  Plus,
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { User, Enrollment, Payment, Course, Program, Teacher } from '../types';
import { getLevelFeeTotal, hasLevelFeeConfig } from '../lib/feeStructure';
import { buildReceiptNumber, downloadReceiptPdf } from '../lib/receiptPdf';

const feeCategoryLabel: Record<string, string> = {
  REGISTRATION: 'Registration',
  TUITION: 'Tuition',
  BOOKS: 'Books',
  EXAM: 'Exam Fees',
  EXAM_PREP: 'Exam Preparation',
  CONSULTATION: 'Consultation',
  TRANSLATION: 'Translation',
  OTHER: 'Other'
};

interface StudentProfileProps {
  user: User;
}

export default function StudentProfile({ user }: StudentProfileProps) {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('personal');
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showReallocateModal, setShowReallocateModal] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [selectedPaymentTx, setSelectedPaymentTx] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [academicBundle, setAcademicBundle] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchStudent = async () => {
    try {
      setLoading(true);
      const data = await dataService.getStudentById(id || '', user);
      setStudent(data);
      if (data?.enrollments?.length) {
        const bundle = await dataService.getEnrollmentAcademicBundle(data.enrollments.map((e: any) => e.id));
        setAcademicBundle(bundle);
      } else {
        setAcademicBundle({});
      }
    } catch (error) {
      console.error('Error fetching student:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, [id, user]);

  const openPaymentModal = (enrollmentId = '') => {
    setSelectedEnrollmentId(enrollmentId);
    setShowPaymentModal(true);
  };
  const openChargeModal = (enrollmentId = '') => {
    setSelectedEnrollmentId(enrollmentId);
    setShowChargeModal(true);
  };
  const openReallocateModal = (tx: any) => {
    setSelectedPaymentTx(tx);
    setShowReallocateModal(true);
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-serif text-charcoal">Student not found</h2>
        <p className="text-charcoal/50 mt-2">You may not have permission to view this record.</p>
        <Link to="/students" className="btn-primary inline-block mt-6">Back to Directory</Link>
      </div>
    );
  }

  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: UserIcon },
    { id: 'academic', label: 'Academic History', icon: BookOpen },
    { id: 'grades', label: 'Grades & Insights', icon: Award },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'attendance', label: 'Attendance', icon: Clock },
  ];

  const totalDue = student.enrollments.reduce((acc:any, e:any) => acc + Number(e.totalFee || 0), 0);
  const totalBalance = student.enrollments.reduce((acc:any, e:any) => acc + Math.max(Number(e.feeBalance || 0), 0), 0);
  const totalPaid = Math.max(totalDue - totalBalance, 0);
  const attendanceRecords = student.enrollments.flatMap(e => e.attendance).length;
  const activeEnrollments = student.enrollments.filter(e => e.status === 'ACTIVE').length;
  const paymentCompletion = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
  const feeItemLabelById = new Map<string, string>();
  student.enrollments.forEach((enrollment: any) => {
    (enrollment.feeItems || []).forEach((item: any) => {
      feeItemLabelById.set(item.id, item.label || feeCategoryLabel[item.category] || 'Fee Item');
    });
  });
  const paymentTransactions = student.enrollments
    .flatMap((enrollment: any) =>
      enrollment.payments.map((payment: any) => ({
        ...payment,
        enrollmentId: enrollment.id,
        courseName: enrollment.courseName,
        level: enrollment.level,
        programType: enrollment.programType,
        teacherName: enrollment.teacherName,
        enrollmentTotalFee: enrollment.totalFee,
        enrollmentBalance: Math.max(Number(enrollment.feeBalance || 0), 0),
        paymentStatus: enrollment.paymentStatus || 'PENDING',
        allocations: (payment.allocations || []).map((allocation: any) => ({
          ...allocation,
          feeItemLabel: feeItemLabelById.get(allocation.enrollmentFeeItemId) || 'Fee Item'
        }))
      }))
    )
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const enrollmentPaymentSummaries = student.enrollments.map((enrollment: any) => {
    const totalFee = Number(enrollment.totalFee || 0);
    const balanceForEnrollment = Math.max(Number(enrollment.feeBalance || 0), 0);
    const paidForEnrollment = Math.max(totalFee - balanceForEnrollment, 0);
    const paymentStatus = enrollment.paymentStatus || (balanceForEnrollment === 0 ? 'PAID' : paidForEnrollment > 0 ? 'PARTIAL' : 'PENDING');
    return {
      ...enrollment,
      totalFee,
      paidForEnrollment,
      balanceForEnrollment,
      paymentStatus
    };
  });
  const hasOutstandingBalances = enrollmentPaymentSummaries.some((enrollment: any) => enrollment.balanceForEnrollment > 0);

  const downloadTransactionReceipt = (tx: any) => {
    const enrollment = student.enrollments.find((item: any) => item.id === tx.enrollmentId);
    const enrollmentTotalFee = Number(enrollment?.totalFee || tx.enrollmentTotalFee || 0);
    const enrollmentBalance = Math.max(Number(enrollment?.feeBalance || tx.enrollmentBalance || 0), 0);
    const paidForEnrollment = Math.max(enrollmentTotalFee - enrollmentBalance, 0);
    const enrollmentPaymentStatus = enrollment?.paymentStatus || tx.paymentStatus || (enrollmentBalance === 0 ? 'PAID' : paidForEnrollment > 0 ? 'PARTIAL' : 'PENDING');
    downloadReceiptPdf({
      receiptNumber: buildReceiptNumber(tx.date, tx.id),
      studentName: String(student.name || 'Unknown Student'),
      studentEmail: String(student.email || ''),
      programName: String(tx.programType || ''),
      courseName: String(tx.courseName || ''),
      level: String(tx.level || ''),
      enrollmentId: String(tx.enrollmentId || enrollment?.id || ''),
      transactionId: String(tx.id || ''),
      transactionDate: String(tx.date || ''),
      paymentMethod: String(tx.method || ''),
      reference: String(tx.reference || ''),
      amountPaid: Number(tx.amount || 0),
      totalFee: enrollmentTotalFee,
      totalPaidToDate: paidForEnrollment,
      outstandingBalance: enrollmentBalance,
      paymentStatus: String(enrollmentPaymentStatus || 'PENDING')
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/students" className="p-2 hover:bg-charcoal/5 rounded-lg text-charcoal/40 transition-all">
          <ChevronLeft size={24} />
        </Link>
        <div>
          <h1 className="text-3xl font-serif text-charcoal">Student Profile</h1>
          <p className="text-charcoal/50 text-sm">ID: #LC-2024-{student.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-navy text-white flex items-center justify-center text-3xl font-serif font-bold mx-auto mb-4 shadow-xl">
              {student.name.split(' ').map(n => n[0]).join('')}
            </div>
            <h2 className="text-2xl font-serif text-charcoal mb-1">{student.name}</h2>
            <p className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-6 ${
              activeEnrollments > 0
                ? 'text-success-muted bg-success-muted/10'
                : 'text-charcoal/50 bg-charcoal/10'
            }`}>
              {activeEnrollments > 0 ? 'Active Student' : 'Inactive Student'}
            </p>
            
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3 text-sm text-charcoal/60">
                <Mail size={16} />
                <span className="truncate">{student.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-charcoal/60">
                <Phone size={16} />
                <span>{student.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-charcoal/60">
                <Calendar size={16} />
                <span>Joined {student.enrollments[0]?.enrollmentDate}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-charcoal/40 uppercase tracking-widest mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-charcoal/60">Attendance Records</span>
                <span className="text-sm font-bold text-sage">{attendanceRecords}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-charcoal/60">Payment Completion</span>
                <span className="text-sm font-bold text-navy">{paymentCompletion}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-charcoal/60">Active Enrollments</span>
                <span className="text-sm font-bold text-charcoal">{activeEnrollments}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex border-b border-charcoal/10 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative whitespace-nowrap ${
                  activeTab === tab.id ? 'text-navy' : 'text-charcoal/40 hover:text-charcoal'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="glass-card p-8 min-h-[400px]">
            {activeTab === 'personal' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section>
                    <h4 className="text-xs font-bold text-charcoal/30 uppercase tracking-widest mb-4">Contact Details</h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-charcoal/40 mb-1">Primary Email</p>
                        <p className="font-medium">{student.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-charcoal/40 mb-1">Telephone Number</p>
                        <p className="font-medium">{student.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-charcoal/40 mb-1">Next of Kin</p>
                        <p className="font-medium">{student.nextOfKin.name}</p>
                        <p className="text-sm text-charcoal/60">{student.nextOfKin.phone}</p>
                      </div>
                    </div>
                  </section>
                  <section>
                    <h4 className="text-xs font-bold text-charcoal/30 uppercase tracking-widest mb-4">Identification & Background</h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-charcoal/40 mb-1">{student.identification.type}</p>
                        <p className="font-medium">{student.identification.number}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'academic' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-serif">Academic Instances</h4>
                  {user.role === 'ADMIN' && (
                    <button 
                      onClick={() => setShowEnrollmentModal(true)}
                      className="btn-secondary text-xs flex items-center gap-2"
                    >
                      <Plus size={14} /> New Enrollment
                    </button>
                  )}
                </div>
	                <div className="space-y-4">
	                  {student.enrollments.map(enrollment => {
	                    const totalFee = Number(enrollment.totalFee || 0);
	                    const balanceForEnrollment = Math.max(Number(enrollment.feeBalance || 0), 0);
	                    const paidForEnrollment = Math.max(totalFee - balanceForEnrollment, 0);
	                    return (
	                    <div key={enrollment.id} className="p-6 rounded-xl border border-charcoal/5 bg-charcoal/[0.01]">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h5 className="font-bold text-lg">{enrollment.courseName} - {enrollment.level}</h5>
                          <p className="text-sm text-charcoal/50">Instructor: {enrollment.teacherName} • {enrollment.programType}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                            enrollment.status === 'ACTIVE' ? 'bg-success-muted/10 text-success-muted' : 'bg-charcoal/10 text-charcoal/40'
                          }`}>
                            {enrollment.status}
                          </span>
                          {user.role === 'ADMIN' && balanceForEnrollment > 0 && (
                            <button 
                              onClick={() => openPaymentModal(enrollment.id)}
                              className="text-[10px] font-bold text-navy hover:underline"
                            >
                              Record Payment
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
	                        <div className="p-3 rounded-lg bg-charcoal/5">
	                          <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Total Fee</p>
	                          <p className="font-semibold">Ksh {totalFee.toLocaleString()}</p>
	                        </div>
                        <div className="p-3 rounded-lg bg-success-muted/5">
                          <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Paid</p>
                          <p className="font-semibold text-success-muted">
                            Ksh {paidForEnrollment.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-warning-muted/5">
                          <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Balance</p>
                          <p className="font-semibold text-warning-muted">Ksh {balanceForEnrollment.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>

                <div className="mt-8 p-6 rounded-xl border border-charcoal/10 bg-charcoal/[0.01]">
                  <h4 className="text-lg font-serif mb-2">Assessments</h4>
                  <p className="text-sm text-charcoal/50">
                    No assessment records are stored in the database yet.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'payments' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="p-4 rounded-xl bg-charcoal/5 border border-charcoal/5">
                    <p className="text-xs text-charcoal/40 uppercase tracking-widest mb-1">Total Due</p>
                    <p className="text-xl font-serif">Ksh {totalDue.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-success-muted/5 border border-success-muted/10">
                    <p className="text-xs text-success-muted uppercase tracking-widest mb-1">Paid</p>
                    <p className="text-xl font-serif text-success-muted">Ksh {totalPaid.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-charcoal/5 border border-charcoal/5">
                    <p className="text-xs text-charcoal/40 uppercase tracking-widest mb-1">Balance</p>
                    <p className="text-xl font-serif text-charcoal/30">Ksh {totalBalance.toLocaleString()}</p>
                  </div>
                </div>

	                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
	                  <h4 className="text-lg font-serif">Transaction History</h4>
	                  {user.role === 'ADMIN' && (
	                    <div className="flex items-center gap-2">
	                      <button
	                        onClick={() => openChargeModal()}
	                        className="btn-secondary text-xs flex items-center gap-2"
	                      >
	                        <Plus size={14} />
	                        Add Charge Item
	                      </button>
	                      <button
	                        onClick={() => openPaymentModal()}
	                        disabled={!hasOutstandingBalances}
	                        className="btn-secondary text-xs flex items-center gap-2 disabled:opacity-50"
	                      >
	                        <Plus size={14} />
	                        {hasOutstandingBalances ? 'Record Payment' : 'No Balance Due'}
	                      </button>
	                    </div>
	                  )}
	                </div>

                {user.role === 'ADMIN' && (
                  <div className="space-y-2">
	                    {enrollmentPaymentSummaries.map((enrollment: any) => (
	                      <div key={enrollment.id} className="p-3 rounded-xl border border-charcoal/5 space-y-3">
	                        <div className="flex items-center justify-between gap-4">
	                        <div>
	                          <p className="font-semibold text-sm text-charcoal">{enrollment.courseName} - {enrollment.level}</p>
	                          <p className="text-[11px] text-charcoal/40">
	                            Paid: Ksh {enrollment.paidForEnrollment.toLocaleString()} | Balance: Ksh {enrollment.balanceForEnrollment.toLocaleString()}
	                          </p>
	                        </div>
	                        <div className="flex items-center gap-3">
	                          <button
	                            onClick={() => openChargeModal(enrollment.id)}
	                            className="text-[11px] font-bold text-charcoal/60 hover:text-navy hover:underline"
	                          >
	                            Add Charge
	                          </button>
	                          {enrollment.balanceForEnrollment > 0 ? (
	                            <button
	                              onClick={() => openPaymentModal(enrollment.id)}
	                              className="text-[11px] font-bold text-navy hover:underline"
	                            >
	                              Add Payment
	                            </button>
	                          ) : (
	                            <span className="text-[10px] font-bold uppercase tracking-widest text-success-muted">Fully Paid</span>
	                          )}
	                        </div>
	                        </div>
	                        {(enrollment.feeItems || []).length > 0 && (
	                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                            {(enrollment.feeItems || []).map((item: any) => (
	                              <div key={item.id} className="rounded-lg border border-charcoal/10 p-2 bg-white/40">
	                                <div className="flex items-center justify-between text-xs">
	                                  <p className="font-semibold text-charcoal">{item.label || feeCategoryLabel[item.category] || item.category}</p>
	                                  <p className="text-charcoal/50">{feeCategoryLabel[item.category] || item.category}</p>
	                                </div>
	                                <div className="flex items-center justify-between text-[11px] mt-1">
	                                  <p className="text-success-muted">Paid: Ksh {Number(item.amountPaid || 0).toLocaleString()}</p>
	                                  <p className="text-warning-muted">Bal: Ksh {Number(item.balance || 0).toLocaleString()}</p>
	                                </div>
	                              </div>
	                            ))}
	                          </div>
	                        )}
	                      </div>
	                    ))}
	                  </div>
	                )}

                <div className="space-y-3">
	                  {paymentTransactions.map((tx: any) => {
	                    const paymentStatus = tx.paymentStatus || 'PENDING';
                    const statusClass =
                      paymentStatus === 'PAID'
                        ? 'text-success-muted'
                        : paymentStatus === 'PARTIAL'
                          ? 'text-warning-muted'
                          : 'text-danger-muted';
                    return (
                    <div key={tx.id} className="p-4 rounded-xl border border-charcoal/5 hover:bg-charcoal/5 transition-all space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-charcoal/5 flex items-center justify-center text-charcoal/40">
                            <Wallet size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-charcoal">{tx.courseName} Payment</p>
                            <p className="text-xs text-charcoal/40">{tx.method} - {tx.date} - Ref: {tx.reference}</p>
                          </div>
                        </div>
	                        <div className="text-right flex items-center gap-6">
	                          <div>
	                            <p className="font-bold text-charcoal">Ksh {tx.amount.toLocaleString()}</p>
	                            <p className={`text-[10px] font-bold uppercase tracking-widest ${statusClass}`}>{paymentStatus}</p>
	                          </div>
	                          {user.role === 'ADMIN' && (
	                            <button
	                              onClick={() => openReallocateModal(tx)}
	                              className="text-[11px] font-bold text-navy hover:underline"
	                              title="Edit payment category"
	                            >
	                              Edit Category
	                            </button>
	                          )}
	                          <button
	                            onClick={() => downloadTransactionReceipt(tx)}
	                            className="p-2 hover:bg-charcoal/10 rounded-lg text-charcoal/30 transition-all"
	                            title="Download receipt"
	                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </div>
                      {(tx.allocations || []).length > 0 && (
                        <div className="rounded-lg border border-charcoal/10 p-2 bg-white/40">
                          <p className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest mb-1">Allocation</p>
                          <div className="space-y-1">
                            {(tx.allocations || []).map((allocation: any) => (
                              <div key={allocation.id} className="flex items-center justify-between text-xs">
                                <span className="text-charcoal/70">{allocation.feeItemLabel}</span>
                                <span className="font-semibold text-charcoal">Ksh {Number(allocation.amount || 0).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                  {paymentTransactions.length === 0 && (
                    <p className="text-center py-10 text-charcoal/30 italic">No transactions found.</p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'grades' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {student.enrollments.map((enrollment: any) => {
                  const data = academicBundle[enrollment.id] || { grades: [], insights: [], certificates: [], overallGrade: 0 };
                  return (
                    <div key={enrollment.id} className="p-5 rounded-xl border border-charcoal/10">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                        <div>
                          <h5 className="font-bold text-charcoal">{enrollment.courseName} - {enrollment.level}</h5>
                          <p className="text-xs text-charcoal/50">Overall Grade: {data.overallGrade}%</p>
                        </div>
                        {data.certificates[0] && (
                          <a
                            href={data.certificates[0].fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-navy hover:underline flex items-center gap-1"
                          >
                            <Download size={14} />
                            Download Certificate
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-charcoal/5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-2">Assessments</p>
                          {data.grades.length === 0 && <p className="text-xs text-charcoal/40">No grades yet.</p>}
                          {data.grades.slice(0, 8).map((grade: any) => (
                            <div key={grade.id} className="flex items-center justify-between text-xs py-1 border-b border-charcoal/5 last:border-b-0">
                              <span className="text-charcoal/70">{grade.assessmentName} ({grade.assessmentType})</span>
                              <span className="font-semibold text-charcoal">{grade.score}/{grade.maxScore}</span>
                            </div>
                          ))}
                        </div>

                        <div className="p-4 rounded-lg bg-charcoal/5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/40 mb-2">Teacher Insights</p>
                          {data.insights.length === 0 && <p className="text-xs text-charcoal/40">No insights yet.</p>}
                          {data.insights.slice(0, 5).map((insight: any) => (
                            <div key={insight.id} className="text-xs py-2 border-b border-charcoal/5 last:border-b-0">
                              <p className="text-charcoal/70">{insight.insight}</p>
                              <p className="text-[10px] text-charcoal/40 mt-1">{insight.createdAt?.slice(0, 10)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {activeTab === 'attendance' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-lg font-serif">Attendance Overview</h4>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-success-muted"></div>
                      <span className="text-xs text-charcoal/50">Present</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-danger-muted"></div>
                      <span className="text-xs text-charcoal/50">Absent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-warning-muted"></div>
                      <span className="text-xs text-charcoal/50">Late</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-8">
                  {student.enrollments.map(enrollment => (
                    <div key={enrollment.id} className="space-y-4">
                      <h5 className="text-sm font-bold text-charcoal/40 uppercase tracking-widest">{enrollment.courseName} - {enrollment.level}</h5>
                      <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-15 gap-2">
                        {enrollment.attendance.map((att, i) => (
                          <div 
                            key={att.id} 
                            title={`${att.date}: ${att.status}`}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center border ${
                              att.status === 'PRESENT' ? 'bg-success-muted/5 border-success-muted/10' : 
                              att.status === 'ABSENT' ? 'bg-danger-muted/5 border-danger-muted/10' : 
                              'bg-warning-muted/5 border-warning-muted/10'
                            }`}
                          >
                            <span className="text-[8px] font-bold text-charcoal/30">{new Date(att.date).getDate()}</span>
                            <div className={`w-1.5 h-1.5 rounded-full mt-1 ${
                              att.status === 'PRESENT' ? 'bg-success-muted' : 
                              att.status === 'ABSENT' ? 'bg-danger-muted' : 
                              'bg-warning-muted'
                            }`}></div>
                          </div>
                        ))}
                        {enrollment.attendance.length === 0 && (
                          <p className="col-span-full text-xs text-charcoal/30 italic">No attendance records for this instance.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showEnrollmentModal && (
          <EnrollmentModal 
            studentId={student.id} 
            onClose={() => setShowEnrollmentModal(false)} 
            onRefresh={fetchStudent}
          />
        )}
        {showPaymentModal && (
          <PaymentModal 
            enrollmentId={selectedEnrollmentId} 
            enrollments={student.enrollments}
            onClose={() => setShowPaymentModal(false)} 
            onRefresh={fetchStudent}
          />
        )}
        {showChargeModal && (
          <ChargeModal
            enrollmentId={selectedEnrollmentId}
            enrollments={student.enrollments}
            onClose={() => setShowChargeModal(false)}
            onRefresh={fetchStudent}
          />
        )}
        {showReallocateModal && selectedPaymentTx && (
          <ReallocatePaymentModal
            paymentTx={selectedPaymentTx}
            enrollments={student.enrollments}
            onClose={() => {
              setShowReallocateModal(false);
              setSelectedPaymentTx(null);
            }}
            onRefresh={fetchStudent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EnrollmentModal({
  studentId,
  onClose,
  onRefresh
}: {
  studentId: string,
  onClose: () => void,
  onRefresh: () => void
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [formData, setFormData] = useState({
    programId: '',
    courseId: '',
    level: '',
    teacherId: '',
    amountPaid: 0,
    reference: '',
    method: 'MPESA' as 'MPESA' | 'BANK' | 'CASH'
  });

  const getProgramLevels = (programId: string) => {
    const program = programs.find(item => item.id === programId);
    return program?.defaultLevels || [];
  };

  const getCourseLevels = (course?: Course, programId?: string) => {
    if (!course) return [];
    const fromProgram = programId ? getProgramLevels(programId) : [];
    const fromCourse = Array.isArray(course.levels) ? course.levels : [];
    const fromFees = Object.keys(course.levelFees || {});
    return Array.from(new Set([...fromProgram, ...fromCourse, ...fromFees].filter(Boolean)));
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [p, c, t] = await Promise.all([
          dataService.getPrograms(),
          dataService.getCourses(),
          dataService.getTeachers()
        ]);
        setPrograms(p);
        setTeachers(t.filter(teacher => teacher.active));

        if (p.length > 0) {
          setFormData(prev => ({ ...prev, programId: p[0].id }));
          const filtered = c.filter(course => course.programType === p[0].id);
          setCourses(filtered);
          const levels = getCourseLevels(filtered[0], p[0].id);
          setFormData(prev => ({
            ...prev,
            courseId: filtered[0]?.id || '',
            level: levels[0] || '',
            teacherId: t.find(teacher => teacher.active)?.id || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching enrollment data:', error);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.teacherId && !teachers.some(teacher => teacher.id === formData.teacherId)) {
      setFormData(prev => ({ ...prev, teacherId: '' }));
    }
  }, [formData.teacherId, teachers]);

  const handleProgramChange = async (id: string) => {
    const allCourses = await dataService.getCourses();
    const filtered = allCourses.filter(c => c.programType === id);
    setCourses(filtered);
    const levels = getCourseLevels(filtered[0], id);
    setFormData({
      ...formData,
      programId: id,
      courseId: filtered[0]?.id || '',
      level: levels[0] || ''
    });
  };

  useEffect(() => {
    if (!formData.courseId) return;
    const selected = courses.find(course => course.id === formData.courseId);
    const levels = getCourseLevels(selected, formData.programId);
    if (levels.length === 0) {
      if (formData.level) {
        setFormData(prev => ({ ...prev, level: '' }));
      }
      return;
    }
    if (!levels.includes(formData.level)) {
      setFormData(prev => ({ ...prev, level: levels[0] }));
    }
  }, [formData.courseId, formData.level, formData.programId, courses, programs]);

  const handleSubmit = async () => {
    const course = courses.find(c => c.id === formData.courseId);
    const teacher = teachers.find(t => t.id === formData.teacherId);
    if (!course || !teacher) return;

    const levelFee = course.levelFees[formData.level];
    if (!hasLevelFeeConfig(course.levelFees, formData.level)) return;
    const totalFee = getLevelFeeTotal(levelFee);
    const paidAmount = Math.max(0, Math.min(Number(formData.amountPaid) || 0, totalFee));
    const reference = String(formData.reference || '').trim();
    const enrollmentDate = new Date().toISOString().split('T')[0];

    try {
      const enrollment = await dataService.addEnrollmentToStudent(studentId, {
        studentId,
        programType: formData.programId,
        courseId: formData.courseId,
        courseName: course.name,
        level: formData.level,
        teacherId: formData.teacherId,
        teacherName: teacher.name,
        status: 'ACTIVE',
        totalFee,
        feeBalance: totalFee,
        enrollmentDate,
        paymentStatus: 'PENDING'
      });

      if (paidAmount > 0) {
        await dataService.recordPayment(enrollment.id, {
          enrollmentId: enrollment.id,
          amount: paidAmount,
          date: enrollmentDate,
          reference,
          method: formData.method
        });
      }

      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error creating enrollment:', error);
    }
  };

  const selectedCourse = courses.find(course => course.id === formData.courseId);
  const availableLevels = getCourseLevels(selectedCourse, formData.programId);
  const hasSelectedLevelFee = selectedCourse
    ? hasLevelFeeConfig(selectedCourse.levelFees, formData.level)
    : false;
  const selectedLevelFeeAmount = hasSelectedLevelFee ? getLevelFeeTotal(selectedCourse?.levelFees?.[formData.level]) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">New Enrollment</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Program</label>
            <select className="input-field" value={formData.programId} onChange={e => handleProgramChange(e.target.value)}>
              {programs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Course</label>
            <select
              className="input-field"
              value={formData.courseId}
              onChange={e => {
                const courseId = e.target.value;
                const course = courses.find(item => item.id === courseId);
                const levels = getCourseLevels(course, formData.programId);
                setFormData({ ...formData, courseId, level: levels[0] || '' });
              }}
            >
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Level</label>
            <select className="input-field" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
              {availableLevels.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
            {formData.level && !hasSelectedLevelFee && (
              <p className="text-[11px] text-warning-muted">
                No fee is configured for this level in the selected course. Set it in Programs before enrolling.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Teacher</label>
            <select className="input-field" value={formData.teacherId} onChange={e => setFormData({...formData, teacherId: e.target.value})}>
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Initial Payment</label>
              <input
                type="number"
                min={0}
                max={selectedLevelFeeAmount > 0 ? selectedLevelFeeAmount : undefined}
                className="input-field"
                value={formData.amountPaid}
                onChange={e => {
                  const value = Number(e.target.value);
                  const normalized = Number.isFinite(value) ? Math.max(value, 0) : 0;
                  const capped = selectedLevelFeeAmount > 0 ? Math.min(normalized, selectedLevelFeeAmount) : normalized;
                  setFormData({...formData, amountPaid: capped});
                }}
              />
              {selectedLevelFeeAmount > 0 && (
                <p className="text-[11px] text-charcoal/40">Maximum initial payment: Ksh {selectedLevelFeeAmount.toLocaleString()}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Method</label>
              <select className="input-field" value={formData.method} onChange={e => setFormData({...formData, method: e.target.value as any})}>
                <option value="MPESA">Mpesa</option>
                <option value="BANK">Bank Transfer</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Reference {formData.method !== 'CASH' && '*'}</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder={formData.method === 'CASH' ? 'Optional for cash' : 'Required for Mpesa/Bank'}
              value={formData.reference} 
              onChange={e => setFormData({...formData, reference: e.target.value})} 
            />
          </div>
          <button 
            onClick={handleSubmit} 
            disabled={
              !formData.programId || 
              !formData.courseId || 
              !formData.teacherId ||
              !formData.level || 
              !hasSelectedLevelFee ||
              formData.amountPaid < 0 ||
              (selectedLevelFeeAmount > 0 && formData.amountPaid > selectedLevelFeeAmount) ||
              (formData.amountPaid > 0 && formData.method !== 'CASH' && !formData.reference.trim())
            }
            className="btn-primary w-full mt-4 disabled:opacity-50"
          >
            Create Enrollment
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ChargeModal({
  enrollmentId,
  enrollments,
  onClose,
  onRefresh
}: {
  enrollmentId?: string,
  enrollments: Enrollment[],
  onClose: () => void,
  onRefresh: () => void
}) {
  const defaultEnrollmentId =
    (enrollmentId && enrollments.some((enrollment) => enrollment.id === enrollmentId) ? enrollmentId : '') ||
    enrollments[0]?.id ||
    '';
  const [targetEnrollmentId, setTargetEnrollmentId] = useState<string>(defaultEnrollmentId);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    label: '',
    amount: 0,
    category: 'OTHER',
    code: ''
  });

  const selectedEnrollment = enrollments.find((enrollment) => enrollment.id === targetEnrollmentId) || null;

  const handleSubmit = async () => {
    const label = formData.label.trim();
    const amount = Number(formData.amount || 0);
    if (!selectedEnrollment) {
      setErrorMessage('Select an enrollment to continue.');
      return;
    }
    if (!label) {
      setErrorMessage('Charge item name is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Charge amount must be greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      await dataService.addEnrollmentFeeItem(targetEnrollmentId, {
        label,
        amount,
        category: formData.category,
        code: formData.code.trim() || undefined
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error adding charge item:', error);
      setErrorMessage((error as Error)?.message || 'Failed to add charge item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">Add Charge Item</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Enrollment</label>
            <select className="input-field" value={targetEnrollmentId} onChange={e => setTargetEnrollmentId(e.target.value)}>
              {enrollments.map((enrollment) => (
                <option key={enrollment.id} value={enrollment.id}>
                  {enrollment.courseName} - {enrollment.level}
                </option>
              ))}
            </select>
          </div>
          {selectedEnrollment && (
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl border border-charcoal/5 bg-charcoal/[0.02]">
              <div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Total</p>
                <p className="text-sm font-semibold">Ksh {Number(selectedEnrollment.totalFee || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Paid</p>
                <p className="text-sm font-semibold text-success-muted">Ksh {Math.max(Number(selectedEnrollment.totalFee || 0) - Math.max(Number(selectedEnrollment.feeBalance || 0), 0), 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Balance</p>
                <p className="text-sm font-semibold text-warning-muted">Ksh {Math.max(Number(selectedEnrollment.feeBalance || 0), 0).toLocaleString()}</p>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Charge Item</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Consultation / Books / Translation"
              value={formData.label}
              onChange={e => {
                setFormData({ ...formData, label: e.target.value });
                setErrorMessage('');
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Amount (Ksh)</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={formData.amount}
                onChange={e => {
                  const rawAmount = Number(e.target.value);
                  const normalized = Number.isFinite(rawAmount) ? Math.max(rawAmount, 0) : 0;
                  setFormData({ ...formData, amount: normalized });
                  setErrorMessage('');
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Category</label>
              <select
                className="input-field"
                value={formData.category}
                onChange={e => {
                  setFormData({ ...formData, category: e.target.value });
                  setErrorMessage('');
                }}
              >
                {Object.entries(feeCategoryLabel).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Internal Code (optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. CONS-001"
              value={formData.code}
              onChange={e => {
                setFormData({ ...formData, code: e.target.value });
                setErrorMessage('');
              }}
            />
          </div>
          {errorMessage && <p className="text-xs text-danger-muted">{errorMessage}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !targetEnrollmentId || !formData.label.trim() || formData.amount <= 0}
            className="btn-primary w-full mt-4 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Add Charge Item'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ReallocatePaymentModal({
  paymentTx,
  enrollments,
  onClose,
  onRefresh
}: {
  paymentTx: any,
  enrollments: Enrollment[],
  onClose: () => void,
  onRefresh: () => void
}) {
  const enrollment = enrollments.find((item) => item.id === paymentTx?.enrollmentId) || null;
  const paymentAmount = Math.max(Number(paymentTx?.amount || 0), 0);
  const currentAllocationMap = new Map<string, number>();
  (paymentTx?.allocations || []).forEach((allocation: any) => {
    const key = String(allocation.enrollmentFeeItemId || '');
    currentAllocationMap.set(key, (currentAllocationMap.get(key) || 0) + Math.max(Number(allocation.amount || 0), 0));
  });
  const feeItemOptions = ((enrollment as any)?.feeItems || [])
    .map((item: any) => {
      const amount = Math.max(Number(item.amount || 0), 0);
      const amountPaid = Math.max(Number(item.amountPaid || 0), 0);
      const currentAllocatedToItem = currentAllocationMap.get(item.id) || 0;
      const paidExcludingThisPayment = Math.max(amountPaid - currentAllocatedToItem, 0);
      const maxAssignable = Math.max(amount - paidExcludingThisPayment, 0);
      return {
        ...item,
        maxAssignable,
        currentAllocatedToItem
      };
    })
    .filter((item: any) => item.maxAssignable > 0 || item.currentAllocatedToItem > 0)
    .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const defaultTargetId =
    feeItemOptions.find((item: any) => item.currentAllocatedToItem > 0)?.id ||
    feeItemOptions[0]?.id ||
    '';

  const [targetFeeItemId, setTargetFeeItemId] = useState<string>(defaultTargetId);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setTargetFeeItemId(defaultTargetId);
    setErrorMessage('');
  }, [defaultTargetId]);

  const selectedTarget = feeItemOptions.find((item: any) => item.id === targetFeeItemId) || null;

  const handleSubmit = async () => {
    if (!paymentTx?.id || !paymentTx?.enrollmentId) {
      setErrorMessage('Invalid payment record.');
      return;
    }
    if (!selectedTarget) {
      setErrorMessage('Select a category to continue.');
      return;
    }
    if (paymentAmount <= 0) {
      setErrorMessage('Payment amount must be greater than zero.');
      return;
    }
    if (paymentAmount > Math.max(Number(selectedTarget.maxAssignable || 0), 0)) {
      setErrorMessage(`Amount exceeds "${selectedTarget.label}" capacity (Ksh ${Number(selectedTarget.maxAssignable || 0).toLocaleString()}).`);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      await dataService.reallocatePaymentToFeeItem(paymentTx.id, paymentTx.enrollmentId, selectedTarget.id);
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error reallocating payment:', error);
      setErrorMessage((error as Error)?.message || 'Failed to update payment category.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">Edit Payment Category</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          {enrollment && (
            <div className="p-3 rounded-xl border border-charcoal/5 bg-charcoal/[0.02]">
              <p className="text-sm font-semibold text-charcoal">{enrollment.courseName} - {enrollment.level}</p>
              <p className="text-[11px] text-charcoal/50">Payment Amount: Ksh {paymentAmount.toLocaleString()}</p>
              <p className="text-[11px] text-charcoal/40">{paymentTx.method} - {paymentTx.date} - Ref: {paymentTx.reference || '-'}</p>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Category</label>
            <select
              className="input-field"
              value={targetFeeItemId}
              onChange={e => {
                setTargetFeeItemId(e.target.value);
                setErrorMessage('');
              }}
            >
              {feeItemOptions.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {(item.label || feeCategoryLabel[item.category] || item.category)} (Max: Ksh {Number(item.maxAssignable || 0).toLocaleString()})
                </option>
              ))}
            </select>
            {selectedTarget && (
              <p className="text-[11px] text-charcoal/40">
                This payment can allocate up to Ksh {Number(selectedTarget.maxAssignable || 0).toLocaleString()} to the selected category.
              </p>
            )}
          </div>
          {errorMessage && <p className="text-xs text-danger-muted">{errorMessage}</p>}
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !enrollment ||
              !selectedTarget ||
              paymentAmount <= 0 ||
              paymentAmount > Math.max(Number(selectedTarget?.maxAssignable || 0), 0)
            }
            className="btn-primary w-full mt-4 disabled:opacity-50"
          >
            {submitting ? 'Updating...' : 'Update Category'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PaymentModal({
  enrollmentId,
  enrollments,
  onClose,
  onRefresh
}: {
  enrollmentId?: string,
  enrollments: Enrollment[],
  onClose: () => void,
  onRefresh: () => void
}) {
  const enrollmentOptions = enrollments.map((enrollment) => {
    const totalFee = Number(enrollment.totalFee || 0);
    const balanceForEnrollment = Math.max(Number(enrollment.feeBalance || 0), 0);
    const paidForEnrollment = Math.max(totalFee - balanceForEnrollment, 0);
    const paymentStatus = enrollment.paymentStatus || (balanceForEnrollment === 0 ? 'PAID' : paidForEnrollment > 0 ? 'PARTIAL' : 'PENDING');
    return {
      ...enrollment,
      totalFee,
      paidForEnrollment,
      balanceForEnrollment,
      paymentStatus
    };
  });

  const defaultEnrollmentId =
    (enrollmentId && enrollmentOptions.some((enrollment) => enrollment.id === enrollmentId) ? enrollmentId : '') ||
    enrollmentOptions.find((enrollment) => enrollment.balanceForEnrollment > 0)?.id ||
    enrollmentOptions[0]?.id ||
    '';

  const [targetEnrollmentId, setTargetEnrollmentId] = useState<string>(defaultEnrollmentId);
  const [selectedFeeItemId, setSelectedFeeItemId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    amount: 0,
    reference: '',
    method: 'MPESA' as 'MPESA' | 'BANK' | 'CASH'
  });

  useEffect(() => {
    setTargetEnrollmentId(defaultEnrollmentId);
  }, [defaultEnrollmentId]);

  const selectedEnrollment = enrollmentOptions.find((enrollment) => enrollment.id === targetEnrollmentId) || null;
  const outstandingFeeItems = ((selectedEnrollment as any)?.feeItems || [])
    .filter((item: any) => Number(item.balance || 0) > 0)
    .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const selectedFeeItem = outstandingFeeItems.find((item: any) => item.id === selectedFeeItemId) || null;
  const outstandingBalance = selectedEnrollment?.balanceForEnrollment || 0;
  const selectedFeeItemBalance = selectedFeeItem ? Math.max(Number(selectedFeeItem.balance || 0), 0) : outstandingBalance;
  const isReferenceRequired = formData.method !== 'CASH';

  useEffect(() => {
    setSelectedFeeItemId('');
    setErrorMessage('');
  }, [targetEnrollmentId]);

  useEffect(() => {
    const maxAmount = selectedFeeItem ? selectedFeeItemBalance : outstandingBalance;
    if (formData.amount > maxAmount) {
      setFormData((prev) => ({ ...prev, amount: maxAmount }));
    }
  }, [outstandingBalance, selectedFeeItem, selectedFeeItemBalance, formData.amount]);

  const handleSubmit = async () => {
    if (!selectedEnrollment) {
      setErrorMessage('Select an enrollment to continue.');
      return;
    }
    if (outstandingBalance <= 0) {
      setErrorMessage('Selected enrollment is already fully paid.');
      return;
    }
    if (formData.amount <= 0) {
      setErrorMessage('Enter a payment amount greater than zero.');
      return;
    }
    if (formData.amount > outstandingBalance) {
      setErrorMessage(`Amount exceeds outstanding balance (Ksh ${outstandingBalance.toLocaleString()}).`);
      return;
    }
    if (selectedFeeItem && formData.amount > selectedFeeItemBalance) {
      setErrorMessage(`Amount exceeds "${selectedFeeItem.label}" balance (Ksh ${selectedFeeItemBalance.toLocaleString()}).`);
      return;
    }
    const cleanedReference = formData.reference.trim();
    if (isReferenceRequired && !cleanedReference) {
      setErrorMessage('Reference code is required for M-Pesa and bank transfer.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      await dataService.recordPayment(targetEnrollmentId, {
        enrollmentId: targetEnrollmentId,
        amount: formData.amount,
        date: new Date().toISOString().split('T')[0],
        reference: cleanedReference,
        method: formData.method,
        targetFeeItemId: selectedFeeItem?.id
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      setErrorMessage((error as Error)?.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif">Record Payment</h3>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Enrollment</label>
            <select
              className="input-field"
              value={targetEnrollmentId}
              onChange={e => {
                setTargetEnrollmentId(e.target.value);
                setErrorMessage('');
              }}
            >
              {enrollmentOptions.map((enrollment) => (
                <option key={enrollment.id} value={enrollment.id}>
                  {enrollment.courseName} - {enrollment.level} (Balance: Ksh {enrollment.balanceForEnrollment.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          {selectedEnrollment && (
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl border border-charcoal/5 bg-charcoal/[0.02]">
              <div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Total</p>
                <p className="text-sm font-semibold">Ksh {selectedEnrollment.totalFee.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Paid</p>
                <p className="text-sm font-semibold text-success-muted">Ksh {selectedEnrollment.paidForEnrollment.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest">Balance</p>
                <p className="text-sm font-semibold text-warning-muted">Ksh {selectedEnrollment.balanceForEnrollment.toLocaleString()}</p>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Allocate To Category</label>
            <select
              className="input-field"
              value={selectedFeeItemId}
              onChange={e => {
                setSelectedFeeItemId(e.target.value);
                setErrorMessage('');
              }}
            >
              <option value="">Auto Allocate (By Priority)</option>
              {outstandingFeeItems.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {(item.label || feeCategoryLabel[item.category] || item.category)} (Bal: Ksh {Number(item.balance || 0).toLocaleString()})
                </option>
              ))}
            </select>
            {selectedFeeItem && (
              <p className="text-[11px] text-charcoal/40">
                Selected category balance: Ksh {selectedFeeItemBalance.toLocaleString()}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Amount (Ksh)</label>
            <input
              type="number"
              min={0}
              max={selectedFeeItem ? selectedFeeItemBalance : outstandingBalance}
              className="input-field"
              value={formData.amount}
              onChange={e => {
                const rawAmount = Number(e.target.value);
                const normalized = Number.isFinite(rawAmount) ? Math.max(rawAmount, 0) : 0;
                const maxAmount = selectedFeeItem ? selectedFeeItemBalance : outstandingBalance;
                const capped = maxAmount > 0 ? Math.min(normalized, maxAmount) : 0;
                setFormData({ ...formData, amount: capped });
                setErrorMessage('');
              }}
            />
            <p className="text-[11px] text-charcoal/40">
              Maximum payable now: Ksh {(selectedFeeItem ? selectedFeeItemBalance : outstandingBalance).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Method</label>
            <select
              className="input-field"
              value={formData.method}
              onChange={e => {
                setFormData({ ...formData, method: e.target.value as any });
                setErrorMessage('');
              }}
            >
              <option value="MPESA">Mpesa</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CASH">Cash</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Reference Code {formData.method !== 'CASH' && '*'}</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder={formData.method === 'CASH' ? 'Optional for cash' : 'Required for Mpesa/Bank'}
              value={formData.reference} 
              onChange={e => {
                setFormData({...formData, reference: e.target.value});
                setErrorMessage('');
              }} 
            />
          </div>
          {errorMessage && <p className="text-xs text-danger-muted">{errorMessage}</p>}
          <button 
            onClick={handleSubmit} 
            disabled={
              submitting ||
              !selectedEnrollment ||
              outstandingBalance <= 0 ||
              formData.amount <= 0 ||
              formData.amount > outstandingBalance ||
              (selectedFeeItem && formData.amount > selectedFeeItemBalance) ||
              (isReferenceRequired && !formData.reference.trim())
            }
            className="btn-primary w-full mt-4 disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record Transaction'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
