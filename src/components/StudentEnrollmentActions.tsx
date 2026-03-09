import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Download, Upload } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Enrollment, GradeRecord, StudentInsight, User } from '../types';

interface StudentEnrollmentActionsProps {
  user: User;
}

type TabKey = 'grades' | 'insights' | 'certificates';

interface PageData {
  studentName: string;
  studentEmail: string;
  enrollment: Enrollment;
}

interface AcademicBundleEntry {
  grades: GradeRecord[];
  insights: StudentInsight[];
  certificates: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
  }>;
  overallGrade: number;
}

const EMPTY_BUNDLE: AcademicBundleEntry = {
  grades: [],
  insights: [],
  certificates: [],
  overallGrade: 0
};

export default function StudentEnrollmentActions({ user }: StudentEnrollmentActionsProps) {
  const { studentId, enrollmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('grades');
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [bundle, setBundle] = useState<AcademicBundleEntry>(EMPTY_BUNDLE);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [gradeForm, setGradeForm] = useState({
    assessmentName: '',
    assessmentType: 'TEST' as GradeRecord['assessmentType'],
    score: 0,
    maxScore: 100,
    weight: 1,
    remarks: ''
  });
  const [insightText, setInsightText] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [editGradeForm, setEditGradeForm] = useState({
    assessmentName: '',
    assessmentType: 'TEST' as GradeRecord['assessmentType'],
    score: 0,
    maxScore: 100,
    weight: 1,
    remarks: ''
  });

  const actingTeacherId = useMemo(() => {
    if (!pageData) return '';
    return user.teacherId || pageData.enrollment.teacherId || '';
  }, [user.teacherId, pageData]);

  const canMutate = user.role === 'TEACHER' && !!actingTeacherId;

  const load = async () => {
    if (!studentId || !enrollmentId) {
      setError('Invalid route parameters.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setFeedback(null);

      const students = await dataService.getStudents(user);
      const student = students.find(item => item.id === studentId);
      const enrollment = student?.enrollments.find(item => item.id === enrollmentId);

      if (!student || !enrollment) {
        setPageData(null);
        setError('Student enrollment not found or not accessible.');
        return;
      }

      setPageData({
        studentName: student.name,
        studentEmail: student.email,
        enrollment
      });

      const academicBundle = await dataService.getEnrollmentAcademicBundle([enrollmentId]);
      setBundle(academicBundle[enrollmentId] || EMPTY_BUNDLE);
    } catch (err: any) {
      setError(err?.message || 'Failed to load enrollment management details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [studentId, enrollmentId, user.id, user.role, user.teacherId]);

  const addGrade = async () => {
    if (!pageData || !canMutate) return;
    try {
      setSaving(true);
      setError(null);
      setFeedback(null);
      if (!gradeForm.assessmentName.trim()) throw new Error('Assessment name is required.');
      if (gradeForm.maxScore <= 0) throw new Error('Max score must be greater than 0.');
      await dataService.addGrade({
        enrollmentId: pageData.enrollment.id,
        teacherId: actingTeacherId,
        assessmentName: gradeForm.assessmentName.trim(),
        assessmentType: gradeForm.assessmentType,
        score: Number(gradeForm.score),
        maxScore: Number(gradeForm.maxScore),
        weight: Number(gradeForm.weight),
        gradedAt: new Date().toISOString().split('T')[0],
        remarks: gradeForm.remarks.trim()
      });
      setGradeForm({
        assessmentName: '',
        assessmentType: 'TEST',
        score: 0,
        maxScore: 100,
        weight: 1,
        remarks: ''
      });
      setFeedback('Grade saved.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save grade.');
    } finally {
      setSaving(false);
    }
  };

  const startEditGrade = (grade: GradeRecord) => {
    setEditingGradeId(grade.id);
    setEditGradeForm({
      assessmentName: grade.assessmentName || '',
      assessmentType: grade.assessmentType,
      score: Number(grade.score || 0),
      maxScore: Number(grade.maxScore || 100),
      weight: Number(grade.weight || 1),
      remarks: grade.remarks || ''
    });
    setError(null);
    setFeedback(null);
  };

  const cancelEditGrade = () => {
    setEditingGradeId(null);
    setEditGradeForm({
      assessmentName: '',
      assessmentType: 'TEST',
      score: 0,
      maxScore: 100,
      weight: 1,
      remarks: ''
    });
  };

  const saveEditedGrade = async () => {
    if (!pageData || !canMutate || !editingGradeId) return;
    try {
      setSaving(true);
      setError(null);
      setFeedback(null);
      if (!editGradeForm.assessmentName.trim()) throw new Error('Assessment name is required.');
      if (editGradeForm.maxScore <= 0) throw new Error('Max score must be greater than 0.');
      if (editGradeForm.weight <= 0) throw new Error('Weight must be greater than 0.');

      await dataService.updateGrade(editingGradeId, actingTeacherId, {
        assessmentName: editGradeForm.assessmentName.trim(),
        assessmentType: editGradeForm.assessmentType,
        score: Number(editGradeForm.score),
        maxScore: Number(editGradeForm.maxScore),
        weight: Number(editGradeForm.weight),
        remarks: editGradeForm.remarks.trim()
      });

      setFeedback('Grade updated.');
      cancelEditGrade();
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to update grade.');
    } finally {
      setSaving(false);
    }
  };

  const addInsight = async () => {
    if (!pageData || !canMutate) return;
    try {
      setSaving(true);
      setError(null);
      setFeedback(null);
      if (!insightText.trim()) throw new Error('Insight text is required.');
      await dataService.addStudentInsight({
        enrollmentId: pageData.enrollment.id,
        teacherId: actingTeacherId,
        insight: insightText.trim()
      });
      setInsightText('');
      setFeedback('Insight saved.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save insight.');
    } finally {
      setSaving(false);
    }
  };

  const uploadCertificate = async () => {
    if (!pageData || !canMutate) return;
    try {
      setSaving(true);
      setError(null);
      setFeedback(null);
      if (!certificateFile) throw new Error('Select a certificate file first.');
      await dataService.uploadCertificate(pageData.enrollment.id, actingTeacherId, certificateFile);
      setCertificateFile(null);
      setFeedback('Certificate uploaded.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload certificate.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy" />
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="space-y-4">
        <Link to="/students" className="inline-flex items-center gap-2 text-sm text-charcoal/60 hover:text-charcoal">
          <ChevronLeft size={16} />
          Back to Enrollment Directory
        </Link>
        <div className="glass-card p-8">
          <h2 className="text-2xl font-serif text-charcoal mb-2">Record not available</h2>
          <p className="text-charcoal/60">{error || 'This enrollment could not be found.'}</p>
        </div>
      </div>
    );
  }

  const { enrollment, studentName, studentEmail } = pageData;
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'grades', label: 'Grades' },
    { key: 'insights', label: 'Insights' },
    { key: 'certificates', label: 'Certificates' }
  ];

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-2 text-sm text-charcoal/60 hover:text-charcoal">
        <ChevronLeft size={16} />
        Back to Enrollment Directory
      </Link>

      <div className="glass-card p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-serif text-charcoal">Student Academic Management</h1>
            <p className="text-sm text-charcoal/55 mt-1">
              {studentName} ({studentEmail}) - {enrollment.courseName} - {enrollment.level}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-charcoal/40 uppercase tracking-wider">Overall Grade</p>
            <p className="text-2xl font-serif text-navy">{bundle.overallGrade}%</p>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-danger-muted/10 text-danger-muted text-xs">{error}</div>}
        {feedback && <div className="p-3 rounded-lg bg-success-muted/10 text-success-muted text-xs">{feedback}</div>}

        {user.role === 'ADMIN' && (
          <div className="p-3 rounded-lg bg-charcoal/5 text-charcoal/60 text-xs">
            Admin mode: you can review records here. Grade/insight/certificate submissions are teacher-managed.
          </div>
        )}

        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.key ? 'bg-navy text-white' : 'bg-charcoal/5 text-charcoal/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'grades' && (
          <div className="space-y-4">
            {canMutate && (
              <div className="p-4 rounded-xl border border-charcoal/10 space-y-3">
                <h3 className="text-lg font-serif text-charcoal">Add Grade</h3>
                <input
                  className="input-field"
                  placeholder="Assessment Name"
                  value={gradeForm.assessmentName}
                  onChange={e => setGradeForm({ ...gradeForm, assessmentName: e.target.value })}
                />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    className="input-field"
                    value={gradeForm.assessmentType}
                    onChange={e => setGradeForm({ ...gradeForm, assessmentType: e.target.value as GradeRecord['assessmentType'] })}
                  >
                    {['ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM', 'PROJECT'].map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Score"
                    value={gradeForm.score}
                    onChange={e => setGradeForm({ ...gradeForm, score: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Max Score"
                    value={gradeForm.maxScore}
                    onChange={e => setGradeForm({ ...gradeForm, maxScore: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    placeholder="Weight"
                    value={gradeForm.weight}
                    onChange={e => setGradeForm({ ...gradeForm, weight: Number(e.target.value) })}
                  />
                </div>
                <textarea
                  className="input-field min-h-[90px]"
                  placeholder="Remarks (optional)"
                  value={gradeForm.remarks}
                  onChange={e => setGradeForm({ ...gradeForm, remarks: e.target.value })}
                />
                <button onClick={addGrade} disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Grade'}
                </button>
              </div>
            )}

            <div className="p-4 rounded-xl border border-charcoal/10">
              <h3 className="text-lg font-serif text-charcoal mb-3">Saved Grades</h3>
              {bundle.grades.length === 0 && <p className="text-sm text-charcoal/50">No grades recorded yet.</p>}
              <div className="space-y-2">
                {bundle.grades.map(grade => (
                  <div key={grade.id} className="p-3 rounded-lg bg-charcoal/5">
                    {editingGradeId === grade.id ? (
                      <div className="space-y-3">
                        <input
                          className="input-field"
                          placeholder="Assessment Name"
                          value={editGradeForm.assessmentName}
                          onChange={e => setEditGradeForm({ ...editGradeForm, assessmentName: e.target.value })}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <select
                            className="input-field"
                            value={editGradeForm.assessmentType}
                            onChange={e => setEditGradeForm({ ...editGradeForm, assessmentType: e.target.value as GradeRecord['assessmentType'] })}
                          >
                            {['ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM', 'PROJECT'].map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className="input-field"
                            placeholder="Score"
                            value={editGradeForm.score}
                            onChange={e => setEditGradeForm({ ...editGradeForm, score: Number(e.target.value) })}
                          />
                          <input
                            type="number"
                            className="input-field"
                            placeholder="Max Score"
                            value={editGradeForm.maxScore}
                            onChange={e => setEditGradeForm({ ...editGradeForm, maxScore: Number(e.target.value) })}
                          />
                          <input
                            type="number"
                            step="0.1"
                            className="input-field"
                            placeholder="Weight"
                            value={editGradeForm.weight}
                            onChange={e => setEditGradeForm({ ...editGradeForm, weight: Number(e.target.value) })}
                          />
                        </div>
                        <textarea
                          className="input-field min-h-[80px]"
                          placeholder="Remarks (optional)"
                          value={editGradeForm.remarks}
                          onChange={e => setEditGradeForm({ ...editGradeForm, remarks: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <button onClick={saveEditedGrade} disabled={saving} className="btn-primary disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button onClick={cancelEditGrade} disabled={saving} className="btn-secondary disabled:opacity-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-charcoal text-sm">
                            {grade.assessmentName} ({grade.assessmentType})
                          </p>
                          <p className="text-xs text-charcoal/45">{grade.gradedAt}</p>
                          {grade.remarks && (
                            <p className="text-xs text-charcoal/55 mt-1">{grade.remarks}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-charcoal">
                            {grade.score}/{grade.maxScore}
                          </p>
                          {canMutate && grade.teacherId === actingTeacherId && (
                            <button
                              onClick={() => startEditGrade(grade)}
                              className="text-xs font-bold text-navy hover:underline mt-1"
                            >
                              Edit Grade
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-4">
            {canMutate && (
              <div className="p-4 rounded-xl border border-charcoal/10 space-y-3">
                <h3 className="text-lg font-serif text-charcoal">Add Insight</h3>
                <textarea
                  className="input-field min-h-[120px]"
                  placeholder="Write learner insight..."
                  value={insightText}
                  onChange={e => setInsightText(e.target.value)}
                />
                <button onClick={addInsight} disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Insight'}
                </button>
              </div>
            )}

            <div className="p-4 rounded-xl border border-charcoal/10">
              <h3 className="text-lg font-serif text-charcoal mb-3">Saved Insights</h3>
              {bundle.insights.length === 0 && <p className="text-sm text-charcoal/50">No insights recorded yet.</p>}
              <div className="space-y-2">
                {bundle.insights.map(insight => (
                  <div key={insight.id} className="p-3 rounded-lg bg-charcoal/5">
                    <p className="text-sm text-charcoal">{insight.insight}</p>
                    <p className="text-xs text-charcoal/45 mt-1">{insight.createdAt?.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'certificates' && (
          <div className="space-y-4">
            {canMutate && (
              <div className="p-4 rounded-xl border border-charcoal/10 space-y-3">
                <h3 className="text-lg font-serif text-charcoal">Upload Certificate</h3>
                <input
                  type="file"
                  className="input-field"
                  onChange={e => setCertificateFile(e.target.files?.[0] || null)}
                />
                <button onClick={uploadCertificate} disabled={saving || !certificateFile} className="btn-primary disabled:opacity-50">
                  <Upload size={16} className="inline mr-2" />
                  {saving ? 'Uploading...' : 'Upload Certificate'}
                </button>
              </div>
            )}

            <div className="p-4 rounded-xl border border-charcoal/10">
              <h3 className="text-lg font-serif text-charcoal mb-3">Uploaded Certificates</h3>
              {bundle.certificates.length === 0 && <p className="text-sm text-charcoal/50">No certificate uploaded yet.</p>}
              <div className="space-y-2">
                {bundle.certificates.map(certificate => (
                  <div key={certificate.id} className="flex items-center justify-between p-3 rounded-lg bg-charcoal/5">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{certificate.fileName}</p>
                      <p className="text-xs text-charcoal/45">{certificate.uploadedAt?.slice(0, 10)}</p>
                    </div>
                    <a
                      href={certificate.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-navy/10 text-navy hover:bg-navy/20"
                    >
                      <Download size={14} className="inline mr-1" />
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
