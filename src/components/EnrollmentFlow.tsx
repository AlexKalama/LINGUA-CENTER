import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { Program, Course, Teacher } from '../types';
import { dataService } from '../services/dataService';
import { getLevelFeeItems, getLevelFeeTotal, hasLevelFeeConfig } from '../lib/feeStructure';

interface EnrollmentFlowProps {
  onClose: () => void;
}

export default function EnrollmentFlow({ onClose }: EnrollmentFlowProps) {
  const [step, setStep] = useState(1);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    idType: 'National ID',
    idNumber: '',
    dob: '',
    kinName: '',
    kinPhone: '',
    programId: '',
    courseId: '',
    level: '',
    teacherId: '',
    paymentReference: '',
    paymentAmount: 0,
    paymentMethod: 'MPESA' as 'MPESA' | 'BANK' | 'CASH'
  });
  
  const totalSteps = 5;

  const getProgramLevels = (programId: string) => {
    const selectedProgram = programs.find(program => program.id === programId);
    return selectedProgram?.defaultLevels || [];
  };

  const getCourseLevels = (course?: Course, programId?: string) => {
    if (!course) return [];
    const fromProgram = programId ? getProgramLevels(programId) : [];
    const fromCourse = Array.isArray(course.levels) ? course.levels : [];
    const fromFees = Object.keys(course.levelFees || {});
    return Array.from(new Set([...fromProgram, ...fromCourse, ...fromFees].filter(Boolean)));
  };

  useEffect(() => {
    async function fetchPrograms() {
      try {
        const fetchedPrograms = await dataService.getPrograms();
        setPrograms(fetchedPrograms);
        if (fetchedPrograms.length > 0) {
          setFormData(prev => ({ ...prev, programId: fetchedPrograms[0].id }));
        }
      } catch (error) {
        console.error('Error fetching programs:', error);
      }
    }
    fetchPrograms();
  }, []);

  useEffect(() => {
    async function fetchTeachers() {
      try {
        const fetchedTeachers = await dataService.getTeachers();
        setTeachers(fetchedTeachers.filter(teacher => teacher.active));
      } catch (error) {
        console.error('Error fetching teachers:', error);
      }
    }
    fetchTeachers();
  }, []);

  useEffect(() => {
    async function fetchCourses() {
      if (formData.programId) {
        try {
          const allCourses = await dataService.getCourses();
          const filteredCourses = allCourses.filter(c => c.programType === formData.programId);
          setCourses(filteredCourses);
          if (filteredCourses.length > 0) {
            const initialLevels = getCourseLevels(filteredCourses[0], formData.programId);
            setFormData(prev => ({ 
              ...prev, 
              courseId: filteredCourses[0].id,
              level: initialLevels[0] || ''
            }));
          } else {
            setFormData(prev => ({ ...prev, courseId: '', level: '' }));
          }
        } catch (error) {
          console.error('Error fetching courses:', error);
        }
      }
    }
    fetchCourses();
  }, [formData.programId]);

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

  useEffect(() => {
    if (formData.teacherId && !teachers.some(teacher => teacher.id === formData.teacherId)) {
      setFormData(prev => ({ ...prev, teacherId: '' }));
    }
  }, [formData.teacherId, teachers]);

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.fullName && formData.email && formData.phone && formData.idNumber && formData.dob && formData.kinName && formData.kinPhone;
      case 2:
        const selected = courses.find(course => course.id === formData.courseId);
        const hasFeeConfigured = selected ? hasLevelFeeConfig(selected.levelFees, formData.level) : false;
        return formData.programId && formData.courseId && formData.level && hasFeeConfigured;
      case 3:
        return formData.teacherId;
      case 4:
        const isReferenceRequired = formData.paymentMethod !== 'CASH';
        return (
          formData.paymentAmount >= 0 &&
          formData.paymentAmount <= totalFee &&
          (!isReferenceRequired || formData.paymentAmount === 0 || Boolean(formData.paymentReference.trim()))
        );
      default:
        return true;
    }
  };

  const handleFinalize = async () => {
    const selectedCourse = courses.find(c => c.id === formData.courseId);
    const selectedTeacher = teachers.find(teacher => teacher.id === formData.teacherId);
    if (!selectedCourse || !selectedTeacher) return;

    const levelFee = selectedCourse.levelFees[formData.level];
    if (!hasLevelFeeConfig(selectedCourse.levelFees, formData.level)) return;
    const totalFee = getLevelFeeTotal(levelFee);
    const paidAmount = Math.max(0, Math.min(Number(formData.paymentAmount) || 0, totalFee));
    const paymentReference = String(formData.paymentReference || '').trim();
    const enrollmentDate = new Date().toISOString().split('T')[0];

    try {
      const newStudent = await dataService.addStudent({
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        identification: {
          type: formData.idType as any,
          number: formData.idNumber
        },
        nextOfKin: {
          name: formData.kinName,
          phone: formData.kinPhone
        }
      });

      const enrollment = await dataService.addEnrollmentToStudent(newStudent.id, {
        studentId: newStudent.id,
        programType: formData.programId,
        courseId: formData.courseId,
        courseName: selectedCourse.name,
        level: formData.level,
        teacherId: formData.teacherId,
        teacherName: selectedTeacher.name,
        status: 'ACTIVE',
        totalFee: totalFee,
        feeBalance: totalFee,
        enrollmentDate,
        paymentStatus: 'PENDING'
      });

      // Record initial payment if any
      if (paidAmount > 0) {
        await dataService.recordPayment(enrollment.id, {
          enrollmentId: enrollment.id,
          amount: paidAmount,
          date: enrollmentDate,
          reference: paymentReference,
          method: formData.paymentMethod
        });
      }

      onClose();
    } catch (error) {
      console.error('Error finalizing enrollment:', error);
    }
  };

  const nextStep = () => {
    if (isStepValid()) {
      setStep(prev => Math.min(prev + 1, totalSteps));
    }
  };
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const steps = [
    { id: 1, title: 'Personal Info' },
    { id: 2, title: 'Program & Level' },
    { id: 3, title: 'Teacher Assignment' },
    { id: 4, title: 'Initial Payment' },
    { id: 5, title: 'Confirmation' },
  ];

  const selectedCourse = courses.find(c => c.id === formData.courseId);
  const availableLevels = getCourseLevels(selectedCourse, formData.programId);
  const hasSelectedLevelFee = selectedCourse
    ? hasLevelFeeConfig(selectedCourse.levelFees, formData.level)
    : false;
  const availableTeachers = teachers.filter(teacher => {
    if (teacher.courses.length === 0) return true;
    const courseName = selectedCourse?.name || '';
    const level = formData.level || '';
    return teacher.courses.some(assignment =>
      assignment.includes(courseName) && assignment.includes(level)
    );
  });
  const feeItems = selectedCourse && hasSelectedLevelFee
    ? getLevelFeeItems(selectedCourse.levelFees[formData.level])
    : [];
  const tuitionFee = selectedCourse && hasSelectedLevelFee
    ? getLevelFeeTotal(selectedCourse.levelFees[formData.level])
    : 0;
  const totalFee = tuitionFee;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl modal-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-charcoal/5 flex justify-between items-center bg-charcoal/[0.02]">
          <div>
            <h2 className="text-2xl font-serif text-charcoal">New Student Enrollment</h2>
            <p className="text-xs text-charcoal/40 uppercase tracking-widest font-bold mt-1">Step {step} of {totalSteps}: {steps[step-1].title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-charcoal/5 rounded-full text-charcoal/40 transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-charcoal/5">
          <motion.div 
            className="h-full bg-sage"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="John Doe" 
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Email Address</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    placeholder="john@example.com" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Telephone Number</label>
                  <input 
                    type="tel" 
                    className="input-field" 
                    placeholder="+254 700 000 000" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Identification Type</label>
                  <select 
                    className="input-field"
                    value={formData.idType}
                    onChange={e => setFormData({...formData, idType: e.target.value})}
                  >
                    <option>National ID</option>
                    <option>Birth Certificate</option>
                    <option>Passport</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">ID / Certificate / Passport Number</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter number" 
                    value={formData.idNumber}
                    onChange={e => setFormData({...formData, idNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Date of Birth</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formData.dob}
                    onChange={e => setFormData({...formData, dob: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Next of Kin Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Kin Name" 
                    value={formData.kinName}
                    onChange={e => setFormData({...formData, kinName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Next of Kin Telephone</label>
                  <input 
                    type="tel" 
                    className="input-field" 
                    placeholder="+254 700 000 000" 
                    value={formData.kinPhone}
                    onChange={e => setFormData({...formData, kinPhone: e.target.value})}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Select Program</label>
                <select 
                  className="input-field" 
                  value={formData.programId} 
                  onChange={(e) => setFormData({...formData, programId: e.target.value})}
                >
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Course</label>
                <select 
                  className="input-field"
                  value={formData.courseId}
                  onChange={(e) => {
                    const courseId = e.target.value;
                    const course = courses.find(c => c.id === courseId);
                    const levels = getCourseLevels(course, formData.programId);
                    setFormData({
                      ...formData,
                      courseId,
                      level: levels[0] || ''
                    });
                  }}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Level / Category</label>
                <div className="grid grid-cols-3 gap-4">
                  {availableLevels.map(level => (
                    <button 
                      key={level} 
                      onClick={() => setFormData({...formData, level})}
                      className={`p-4 border rounded-xl transition-all text-sm font-bold ${
                        formData.level === level 
                        ? 'border-navy bg-navy/5 text-navy' 
                        : 'border-charcoal/10 text-charcoal/60 hover:border-sage hover:bg-sage/5'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                {formData.level && !hasSelectedLevelFee && (
                  <p className="text-xs text-warning-muted">
                    No fee is configured for this level in the selected course. Set the level fee in Programs.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <p className="text-sm text-charcoal/50 mb-4">Available teachers for this selection:</p>
              <div className="space-y-3">
                {availableTeachers.map(teacher => (
                  <button 
                    key={teacher.id} 
                    onClick={() => setFormData({...formData, teacherId: teacher.id})}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${
                      formData.teacherId === teacher.id
                      ? 'border-navy bg-navy/5'
                      : 'border-charcoal/10 hover:border-navy hover:bg-navy/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold">
                        {teacher.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-charcoal">{teacher.name}</p>
                        <p className="text-xs text-charcoal/40">{teacher.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-sage">{teacher.courses.length} Course Assignments</p>
                    </div>
                  </button>
                ))}
                {availableTeachers.length === 0 && (
                  <p className="text-sm text-warning-muted">No active teacher is assigned to this course and level yet.</p>
                )}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="glass-card p-6 bg-navy text-white">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-white/60">Total Fee ({formData.level})</span>
                  <span className="text-2xl font-serif">Ksh {totalFee.toLocaleString()}.00</span>
                </div>
                <div className="h-px bg-white/10 mb-4"></div>
                <div className="space-y-2">
                  {feeItems.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex justify-between text-xs">
                      <span className="text-white/60">{item.name}</span>
                      <span>Ksh {(item.amount * Math.max(item.quantity || 1, 1)).toLocaleString()}.00</span>
                    </div>
                  ))}
                  {feeItems.length === 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">Course Fee</span>
                      <span>Ksh {tuitionFee.toLocaleString()}.00</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Amount Paid (Ksh)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      placeholder="0.00" 
                      value={formData.paymentAmount}
                      min={0}
                      max={totalFee}
                      onChange={e => {
                        const value = Number(e.target.value);
                        const normalized = Number.isFinite(value) ? Math.max(value, 0) : 0;
                        const capped = totalFee > 0 ? Math.min(normalized, totalFee) : normalized;
                        setFormData({...formData, paymentAmount: capped});
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Payment Method</label>
                    <select 
                      className="input-field"
                      value={formData.paymentMethod}
                      onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})}
                    >
                      <option value="MPESA">Mpesa</option>
                      <option value="BANK">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Reference Code (Mpesa/Bank)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter reference code" 
                    value={formData.paymentReference}
                    onChange={e => setFormData({...formData, paymentReference: e.target.value})}
                  />
                  <p className="text-[11px] text-charcoal/40">
                    Required only when amount paid is greater than zero and method is Mpesa or Bank.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-20 h-20 rounded-full bg-success-muted/10 text-success-muted flex items-center justify-center mb-6">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-3xl font-serif text-charcoal mb-2">Ready to Enroll</h3>
              <p className="text-charcoal/50 max-w-md mb-8">Please review all information before finalizing the enrollment.</p>
              
              <div className="w-full space-y-3 text-left bg-charcoal/5 p-6 rounded-xl">
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/40">Student</span>
                  <span className="font-semibold">{formData.fullName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/40">Program</span>
                  <span className="font-semibold">{programs.find(p => p.id === formData.programId)?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/40">Course</span>
                  <span className="font-semibold">{selectedCourse?.name} ({formData.level})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/40">Total Fee</span>
                  <span className="font-semibold">Ksh {totalFee.toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/40">Amount Paid</span>
                  <span className="font-semibold text-success-muted">Ksh {formData.paymentAmount.toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal/40">Remaining Balance</span>
                  <span className="font-semibold text-warning-muted">Ksh {Math.max(totalFee - formData.paymentAmount, 0).toLocaleString()}.00</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-charcoal/5 bg-charcoal/[0.02] flex justify-between items-center">
          <button 
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-2 text-charcoal/40 hover:text-charcoal transition-all disabled:opacity-0"
          >
            <ChevronLeft size={20} />
            Back
          </button>
          
          {step < totalSteps ? (
            <button 
              onClick={nextStep}
              disabled={!isStepValid()}
              className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight size={20} />
            </button>
          ) : (
            <button 
              onClick={handleFinalize}
              className="btn-secondary flex items-center gap-2 px-8"
            >
              Finalize Enrollment
              <CheckCircle2 size={20} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
