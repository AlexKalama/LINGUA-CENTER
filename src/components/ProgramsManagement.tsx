import { useState, useEffect } from 'react';
import { 
  Plus, 
  Settings, 
  ChevronRight, 
  Languages, 
  Monitor, 
  Car,
  Trash2,
  Edit2,
  Calculator,
  X,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { Course, Program, LevelFeeValue } from '../types';
import { createDefaultLevelFee, getLevelFeeItems, getLevelFeeTotal, normalizeLevelFee } from '../lib/feeStructure';

const iconMap: Record<string, any> = {
  Languages: Languages,
  Monitor: Monitor,
  Car: Car,
  Calculator: Calculator,
};

export default function ProgramsManagement() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string>('LANGUAGE');
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [componentDrafts, setComponentDrafts] = useState<Record<string, { name: string; amount: string }>>({});
  const [courseFormData, setCourseFormData] = useState<Omit<Course, 'id'>>({
    name: '',
    programType: '',
    levels: [],
    levelFees: {},
    active: true
  });

  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [programFormData, setProgramFormData] = useState<Omit<Program, 'id'>>({
    label: '',
    iconName: 'Languages',
    color: 'text-navy',
    defaultLevels: ['Basic', 'Advanced']
  });

  const fetchCurriculum = async () => {
    try {
      setLoading(true);
      const [p, c] = await Promise.all([
        dataService.getPrograms(),
        dataService.getCourses()
      ]);
      setPrograms(p);
      setAllCourses(c);
      if (p.length > 0 && !activeProgramId) {
        setActiveProgramId(p[0].id);
      }
      setCourses(c.filter(course => course.programType === activeProgramId));
    } catch (error) {
      console.error('Error fetching curriculum:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurriculum();
  }, [activeProgramId]);

  const buildComponentDrafts = (levels: string[]) =>
    levels.reduce((acc, level) => {
      acc[level] = { name: '', amount: '' };
      return acc;
    }, {} as Record<string, { name: string; amount: string }>);

  const normalizeCourseLevelFees = (levels: string[], levelFees: Record<string, LevelFeeValue>) =>
    levels.reduce((acc, level) => {
      const existing = levelFees?.[level];
      acc[level] = existing === undefined ? createDefaultLevelFee(10000) : normalizeLevelFee(existing);
      return acc;
    }, {} as Record<string, LevelFeeValue>);

  const handleAddProgram = () => {
    setEditingProgram(null);
    setProgramFormData({
      label: '',
      iconName: 'Languages',
      color: 'text-navy',
      defaultLevels: ['Basic', 'Advanced']
    });
    setIsProgramModalOpen(true);
  };

  const handleEditProgram = (program: Program) => {
    setEditingProgram(program);
    setProgramFormData({
      label: program.label,
      iconName: program.iconName,
      color: program.color,
      defaultLevels: program.defaultLevels && program.defaultLevels.length > 0 ? [...program.defaultLevels] : ['Basic', 'Advanced']
    });
    setIsProgramModalOpen(true);
  };

  const handleDeleteProgram = async (id: string) => {
    if (confirm('Are you sure you want to delete this program? All associated courses will be removed.')) {
      try {
        await dataService.deleteProgram(id);
        await fetchCurriculum();
      } catch (error) {
        console.error('Error deleting program:', error);
      }
    }
  };

  const handleSaveProgram = async () => {
    try {
      if (editingProgram) {
        await dataService.updateProgram(editingProgram.id, programFormData);
      } else {
        await dataService.addProgram(programFormData);
      }
      await fetchCurriculum();
      setIsProgramModalOpen(false);
    } catch (error) {
      console.error('Error saving program:', error);
    }
  };

  const handleAddCourse = () => {
    setEditingCourse(null);
    const defaultLevels = activeProgram?.defaultLevels && activeProgram.defaultLevels.length > 0
      ? [...activeProgram.defaultLevels]
      : ['Basic', 'Advanced'];
    const levelFees = defaultLevels.reduce((acc, level) => {
      acc[level] = createDefaultLevelFee(10000);
      return acc;
    }, {} as Record<string, LevelFeeValue>);
    setCourseFormData({
      name: '',
      programType: activeProgramId,
      levels: defaultLevels,
      levelFees,
      active: true
    });
    setComponentDrafts(buildComponentDrafts(defaultLevels));
    setIsCourseModalOpen(true);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    const normalizedLevelFees = normalizeCourseLevelFees(course.levels, course.levelFees);
    setCourseFormData({
      name: course.name,
      programType: course.programType,
      levels: [...course.levels],
      levelFees: normalizedLevelFees,
      active: course.active
    });
    setComponentDrafts(buildComponentDrafts(course.levels));
    setIsCourseModalOpen(true);
  };

  const handleDeleteCourse = async (id: string) => {
    if (confirm('Are you sure you want to delete this course?')) {
      try {
        await dataService.deleteCourse(id);
        await fetchCurriculum();
      } catch (error) {
        console.error('Error deleting course:', error);
      }
    }
  };

  const handleSaveCourse = async () => {
    const preparedLevelFees = courseFormData.levels.reduce((acc, level) => {
      const normalized = normalizeLevelFee(courseFormData.levelFees[level]);
      const items = normalized.items
        .filter(item => item.name.trim() || item.amount > 0)
        .map((item, index) => ({
          id: String(index + 1),
          name: item.name.trim() || `Fee Item ${index + 1}`,
          amount: Math.max(Number(item.amount) || 0, 0),
          quantity: Math.max(Number(item.quantity || 1), 1),
          optional: Boolean(item.optional),
          code: item.code ? String(item.code).trim() : undefined
        }));
      const finalItems = items.length ? items : [{ id: '1', name: 'Course Fee', amount: 0, quantity: 1 }];
      const total = (finalItems as Array<{ amount: number; quantity?: number }>).reduce(
        (sum, item) => sum + item.amount * Math.max(item.quantity || 1, 1),
        0
      );
      acc[level] = { total, items: finalItems };
      return acc;
    }, {} as Record<string, LevelFeeValue>);

    const payload = {
      ...courseFormData,
      levelFees: preparedLevelFees
    };

    try {
      if (editingCourse) {
        await dataService.updateCourse(editingCourse.id, payload);
      } else {
        await dataService.addCourse(payload);
      }
      await fetchCurriculum();
      setIsCourseModalOpen(false);
    } catch (error) {
      console.error('Error saving course:', error);
    }
  };

  const [newLevelName, setNewLevelName] = useState('');

  const addLevel = () => {
    if (newLevelName && !courseFormData.levels.includes(newLevelName)) {
      setCourseFormData(prev => ({
        ...prev,
        levels: [...prev.levels, newLevelName],
        levelFees: { ...prev.levelFees, [newLevelName]: createDefaultLevelFee(10000) }
      }));
      setComponentDrafts(prev => ({ ...prev, [newLevelName]: { name: '', amount: '' } }));
      setNewLevelName('');
    }
  };

  const removeLevel = (level: string) => {
    setCourseFormData(prev => {
      const newLevels = prev.levels.filter(l => l !== level);
      const newFees = { ...prev.levelFees };
      delete newFees[level];
      return { ...prev, levels: newLevels, levelFees: newFees };
    });
    setComponentDrafts(prev => {
      const next = { ...prev };
      delete next[level];
      return next;
    });
  };

  const updateLevelItems = (level: string, updater: (items: any[]) => any[]) => {
    setCourseFormData(prev => {
      const current = normalizeLevelFee(prev.levelFees[level]);
      const updated = updater(current.items.map(item => ({ ...item })));
      const normalizedItems = updated.length
        ? updated.map((item, index) =>
            ({
              ...item,
              id: String(index + 1),
              amount: Math.max(Number(item.amount) || 0, 0),
              quantity: Math.max(Number(item.quantity || 1), 1)
            })
          )
        : [{ id: '1', name: 'Course Fee', amount: 0, quantity: 1 }];
      const total = normalizedItems.reduce((sum, item) => sum + item.amount * Math.max(item.quantity || 1, 1), 0);
      return {
        ...prev,
        levelFees: {
          ...prev.levelFees,
          [level]: { ...current, items: normalizedItems, total }
        }
      };
    });
  };

  const addComponentToLevel = (level: string) => {
    const draft = componentDrafts[level] || { name: '', amount: '' };
    const name = draft.name.trim();
    if (!name) return;
    const amount = Math.max(Number(draft.amount) || 0, 0);
    updateLevelItems(level, items => [...items, { name, amount, quantity: 1 }]);
    setComponentDrafts(prev => ({ ...prev, [level]: { name: '', amount: '' } }));
  };

  const updateComponentInLevel = (level: string, index: number, patch: { name?: string; amount?: number }) => {
    updateLevelItems(level, items =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  };

  const removeComponentFromLevel = (level: string, index: number) => {
    updateLevelItems(level, items => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const activeProgram = programs.find(p => p.id === activeProgramId);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif text-charcoal mb-2">Curriculum Management</h1>
          <p className="text-charcoal/50">Configure programs, courses, levels, and fee structures.</p>
        </div>
        <button 
          onClick={handleAddProgram}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Program
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Program List */}
        <div className="lg:col-span-1 space-y-4">
          {programs.map(program => {
            const Icon = iconMap[program.iconName] || Languages;
            return (
              <div key={program.id} className="relative group">
                <button
                  onClick={() => setActiveProgramId(program.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    activeProgramId === program.id 
                    ? 'bg-navy/10 border-navy shadow-lg shadow-navy/5' 
                    : 'border-charcoal/5 bg-transparent hover:bg-charcoal/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${program.color} bg-opacity-10`}>
                      <Icon size={20} />
                    </div>
                    <div className="text-left">
                      <p className={`font-semibold ${activeProgramId === program.id ? 'text-navy' : 'text-charcoal/70'}`}>
                        {program.label}
                      </p>
                      <p className="text-xs text-charcoal/40">
                        {allCourses.filter(c => c.programType === program.id).length} Courses
                      </p>
                      <p className="text-[10px] text-charcoal/30 mt-1">
                        Levels: {(program.defaultLevels && program.defaultLevels.length > 0 ? program.defaultLevels : ['Basic', 'Advanced']).join(', ')}
                      </p>
                    </div>
                  </div>
                  {activeProgramId === program.id && <ChevronRight size={18} className="text-navy" />}
                </button>
                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button onClick={() => handleEditProgram(program)} className="p-1 text-charcoal/20 hover:text-navy transition-all"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteProgram(program.id)} className="p-1 text-charcoal/20 hover:text-danger-muted transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Course Configuration */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-serif text-charcoal">
                {activeProgram?.label} Courses
              </h3>
              <button 
                onClick={handleAddCourse}
                className="btn-secondary text-xs flex items-center gap-2"
              >
                <Plus size={14} /> Add Course
              </button>
            </div>

            <div className="space-y-4">
              {courses.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-charcoal/10 rounded-2xl">
                  <p className="text-charcoal/40">No courses configured for this program.</p>
                </div>
              ) : (
                courses.map(course => (
                  <div key={course.id} className="p-6 rounded-xl border border-charcoal/5 hover:border-charcoal/10 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-xl ${course.active ? 'bg-navy text-white' : 'bg-charcoal/10 text-charcoal/40'}`}>
                          {course.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-lg font-serif text-charcoal">{course.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${course.active ? 'bg-success-muted/10 text-success-muted' : 'bg-charcoal/10 text-charcoal/40'}`}>
                              {course.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditCourse(course)}
                          className="p-2 text-charcoal/20 hover:text-navy hover:bg-navy/5 rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCourse(course.id)}
                          className="p-2 text-charcoal/20 hover:text-danger-muted hover:bg-danger-muted/5 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {course.levels.map(level => (
                        <div key={level} className="p-3 rounded-xl bg-charcoal/5 border border-charcoal/5 flex justify-between items-center">
                          <span className="text-xs font-bold text-charcoal/60">{level}</span>
                          <div className="text-right">
                            <p className="text-xs font-mono font-bold text-navy">Ksh {getLevelFeeTotal(course.levelFees[level]).toLocaleString()}</p>
                            <p className="text-[10px] text-charcoal/40">{getLevelFeeItems(course.levelFees[level]).length} items</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Course Modal */}
      <AnimatePresence>
        {isCourseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCourseModalOpen(false)} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl modal-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-charcoal/5 flex justify-between items-center bg-charcoal/[0.02]">
                <h2 className="text-2xl font-serif text-charcoal">{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
                <button onClick={() => setIsCourseModalOpen(false)} className="p-2 hover:bg-charcoal/5 rounded-full text-charcoal/40 transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Course Name</label>
                  <input type="text" value={courseFormData.name} onChange={e => setCourseFormData({...courseFormData, name: e.target.value})} className="input-field" placeholder="e.g. Advanced German" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Levels & Fees</label>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newLevelName} 
                      onChange={e => setNewLevelName(e.target.value)} 
                      className="input-field flex-1" 
                      placeholder="New Level Name (e.g. B1)" 
                    />
                    <button 
                      onClick={addLevel}
                      disabled={!newLevelName}
                      className="btn-secondary px-4 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-3">
                    {courseFormData.levels.map(level => (
                      <div key={level} className="space-y-3 p-4 rounded-xl border border-charcoal/10 bg-charcoal/[0.03]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-charcoal">{level}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-navy">
                              Total: Ksh {getLevelFeeTotal(courseFormData.levelFees[level]).toLocaleString()}
                            </span>
                            <button onClick={() => removeLevel(level)} className="p-2 text-charcoal/20 hover:text-danger-muted transition-all"><Trash2 size={16} /></button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {getLevelFeeItems(courseFormData.levelFees[level]).map((component, index) => (
                            <div key={`${level}-component-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                              <input
                                type="text"
                                value={component.name}
                                onChange={e => updateComponentInLevel(level, index, { name: e.target.value })}
                                className="input-field"
                                placeholder="Fee item name (e.g. Registration)"
                              />
                              <input
                                type="number"
                                value={component.amount}
                                min={0}
                                onChange={e => updateComponentInLevel(level, index, { amount: Math.max(Number(e.target.value) || 0, 0) })}
                                className="input-field text-sm font-mono"
                                placeholder="Amount"
                              />
                              <button
                                onClick={() => removeComponentFromLevel(level, index)}
                                className="p-2 text-charcoal/20 hover:text-danger-muted transition-all"
                                title="Remove item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                          <input
                            type="text"
                            value={componentDrafts[level]?.name || ''}
                            onChange={e =>
                              setComponentDrafts(prev => ({
                                ...prev,
                                [level]: { ...(prev[level] || { name: '', amount: '' }), name: e.target.value }
                              }))
                            }
                            className="input-field"
                            placeholder="Add item (e.g. Books)"
                          />
                          <input
                            type="number"
                            min={0}
                            value={componentDrafts[level]?.amount || ''}
                            onChange={e =>
                              setComponentDrafts(prev => ({
                                ...prev,
                                [level]: { ...(prev[level] || { name: '', amount: '' }), amount: e.target.value }
                              }))
                            }
                            className="input-field text-sm font-mono"
                            placeholder="Amount"
                          />
                          <button
                            onClick={() => addComponentToLevel(level)}
                            className="btn-secondary px-3 py-2 text-xs"
                            disabled={!componentDrafts[level]?.name?.trim()}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-charcoal/5 bg-charcoal/[0.02] flex justify-end gap-4">
                <button onClick={() => setIsCourseModalOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveCourse} className="btn-primary flex items-center gap-2"><Save size={18} /> Save Course</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Program Modal */}
      <AnimatePresence>
        {isProgramModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProgramModalOpen(false)} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-charcoal/5 flex justify-between items-center bg-charcoal/[0.02]">
                <h2 className="text-2xl font-serif text-charcoal">{editingProgram ? 'Edit Program' : 'Add New Program'}</h2>
                <button onClick={() => setIsProgramModalOpen(false)} className="p-2 hover:bg-charcoal/5 rounded-full text-charcoal/40 transition-all"><X size={24} /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Program Label</label>
                  <input type="text" value={programFormData.label} onChange={e => setProgramFormData({...programFormData, label: e.target.value})} className="input-field" placeholder="e.g. Music School" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Icon</label>
                  <select value={programFormData.iconName} onChange={e => setProgramFormData({...programFormData, iconName: e.target.value})} className="input-field">
                    <option value="Languages">Languages</option>
                    <option value="Monitor">Computer</option>
                    <option value="Car">Driving</option>
                    <option value="Calculator">Accounting</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Color Theme</label>
                  <select value={programFormData.color} onChange={e => setProgramFormData({...programFormData, color: e.target.value})} className="input-field">
                    <option value="text-navy">Navy</option>
                    <option value="text-sage">Sage</option>
                    <option value="text-warning-muted">Warning</option>
                    <option value="text-success-muted">Success</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-charcoal/50 uppercase tracking-wider">Default Levels</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Basic', 'Intermediate', 'Advanced'].map(level => {
                      const selected = (programFormData.defaultLevels || []).includes(level);
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => {
                            const next = new Set(programFormData.defaultLevels || []);
                            if (next.has(level)) {
                              next.delete(level);
                            } else {
                              next.add(level);
                            }
                            setProgramFormData({
                              ...programFormData,
                              defaultLevels: Array.from(next)
                            });
                          }}
                          className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                            selected
                              ? 'border-navy bg-navy/10 text-navy'
                              : 'border-charcoal/10 text-charcoal/50 hover:border-charcoal/20'
                          }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-charcoal/40">
                    These levels auto-fill when adding new courses under this program.
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-charcoal/5 bg-charcoal/[0.02] flex justify-end gap-4">
                <button onClick={() => setIsProgramModalOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveProgram} className="btn-primary flex items-center gap-2"><Save size={18} /> Save Program</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
