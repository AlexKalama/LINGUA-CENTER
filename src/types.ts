export type UserRole = 'ADMIN' | 'TEACHER';

export type ProgramType = string;

export interface Program {
  id: string;
  label: string;
  iconName: string; // Store icon name as string to look up in a map
  color: string;
  defaultLevels?: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teacherId?: string | null;
  avatar?: string;
}

export interface Payment {
  id: string;
  enrollmentId: string;
  amount: number;
  date: string;
  reference: string;
  method: 'MPESA' | 'BANK' | 'CASH';
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  enrollmentId: string;
  enrollmentFeeItemId: string;
  amount: number;
}

export interface Attendance {
  id: string;
  enrollmentId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
}

export interface TeacherAttendance {
  id: string;
  teacherId: string;
  courseId: string;
  level: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  notes?: string;
}

export interface GradeRecord {
  id: string;
  enrollmentId: string;
  teacherId: string;
  assessmentName: string;
  assessmentType: 'ASSIGNMENT' | 'QUIZ' | 'TEST' | 'EXAM' | 'PROJECT';
  score: number;
  maxScore: number;
  weight: number;
  gradedAt: string;
  remarks?: string;
}

export interface StudentInsight {
  id: string;
  enrollmentId: string;
  teacherId: string;
  insight: string;
  createdAt: string;
}

export interface Certificate {
  id: string;
  enrollmentId: string;
  teacherId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface FeeComponent {
  id?: string;
  code?: string;
  name: string;
  amount: number;
  quantity?: number;
  optional?: boolean;
}

export interface LevelFeeStructure {
  total: number;
  items: FeeComponent[];
  durationMonths?: number;
  notes?: string;
}

export type LevelFeeValue = number | LevelFeeStructure;

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  targetRole: 'ADMIN' | 'TEACHER' | 'ALL';
  createdBy?: string | null;
  createdAt: string;
  active: boolean;
}

export interface Enrollment {
  id: string;
  studentId: string;
  programType: ProgramType;
  courseId: string;
  courseName: string;
  level: string; // CEFR or Category
  teacherId: string;
  teacherName: string;
  status: 'ACTIVE' | 'GRADUATED' | 'DROPOUT';
  feeBalance: number;
  totalFee: number;
  enrollmentDate: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  registrationNumber?: string;
  payments: Payment[];
  feeItems?: EnrollmentFeeItem[];
  attendance: Attendance[];
}

export interface EnrollmentFeeItem {
  id: string;
  enrollmentId: string;
  category: string;
  code?: string;
  label: string;
  amount: number;
  sortOrder: number;
  amountPaid: number;
  balance: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING';
  meta?: Record<string, any>;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  identification: {
    type: 'National ID' | 'Birth Certificate' | 'Passport';
    number: string;
  };
  nextOfKin: {
    name: string;
    phone: string;
  };
  gender?: 'M' | 'F' | '';
  healthConditions?: {
    conditions: string[];
    other?: string;
  };
  enrollments: Enrollment[];
}

export interface Course {
  id: string;
  name: string;
  programType: ProgramType;
  levels: string[];
  levelFees: Record<string, LevelFeeValue>; // Map level name to fee or itemized structure
  active: boolean;
}

export interface TeacherStats {
  totalStudents: number;
  graduates: number;
  dropouts: number;
  activeClasses: number;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  courses: string[];
  active: boolean;
  stats: TeacherStats;
}
