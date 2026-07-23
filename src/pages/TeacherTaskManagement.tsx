// src/pages/TeacherTaskManagement.tsx
// Fixed: courseService.getCoursesByInstructor, class grade dropdown, student picker, dashboard-matched styling

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Edit2, Trash2, Eye, ChevronDown, X, Loader2,
  BookOpen, FolderOpen, Beaker, MessageSquare, Users, Link2, GraduationCap,
  Calendar, Clock, Award, AlertCircle, CheckCircle, Upload, FileText,
  BarChart2, Filter, RefreshCw, Send, ArrowLeft, Layers, Check,
  Unlock, Lock, AlertTriangle, Paperclip, Star,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import {
  taskService, TaskGroup, Task, Submission, TaskType, TaskGroupStatus,
  AssignmentScope, AssignmentScopeAll, AssignmentScopeCourse,
  AssignmentScopeClass, AssignmentScopeStudents,
  RubricItem, Milestone, TaskAttachment, RubricScore,
} from '../services/taskService';
import { courseService, Course } from '../services/courseService';
import courseEnrollmentService from '../services/courseEnrollmentService';
import { contentService, Content } from '../services/contentService';
import { userService, User as AppUser } from '../services/userService';
import { courseAssignmentService } from '../services/courseAssignmentService';
import { notificationService } from '../services/notificationService';

// ─── Constants ────────────────────────────────────────────────────────────────


const TASK_TYPES: { type: TaskType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'homework',        label: 'Homework',    icon: BookOpen,      color: '#3b82f6' },
  { type: 'project',         label: 'Project',     icon: FolderOpen,    color: '#8b5cf6' },
  { type: 'practical',       label: 'Lab / Practical', icon: Beaker,    color: '#10b981' },
  { type: 'discussion',      label: 'Discussion',  icon: MessageSquare, color: '#f59e0b' },
  { type: 'peer_review',     label: 'Peer Review', icon: Users,         color: '#ef4444' },
  { type: 'link_submission', label: 'Link Submit', icon: Link2,         color: '#06b6d4' },
  { type: 'exam',            label: 'Exam',        icon: GraduationCap, color: '#6366f1' },
];

const FILE_FORMATS = ['pdf', 'docx', 'doc', 'pptx', 'xlsx', 'jpg', 'jpeg', 'png', 'zip', 'mp4', 'mp3'];

const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: Date | null) => {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};
const fmtBytes = (b?: number) => {
  if (!b) return '';
  return b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
};

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

const Spinner = ({ sm }: { sm?: boolean }) => (
  <Loader2 className={`animate-spin ${sm ? 'w-4 h-4' : 'w-5 h-5'}`} />
);

const StatusDot = ({ status }: { status: TaskGroupStatus }) => {
  const colors = { draft: '#9ca3af', published: '#10b981', closed: '#ef4444' };
  return <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: colors[status] }} />;
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-secondary, #9ca3af)' }}>
    {children}
  </label>
);

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm border outline-none transition-colors focus:ring-2 focus:ring-blue-500/40 bg-transparent';
const inputStyle = { borderColor: 'var(--color-border, rgba(255,255,255,0.1))', color: 'var(--color-text, #f3f4f6)' };

// ─── Rubric Builder ───────────────────────────────────────────────────────────

const RubricBuilder = ({ rubric, onChange }: { rubric: RubricItem[]; onChange: (r: RubricItem[]) => void }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <SectionLabel>Grading Rubric</SectionLabel>
      <button onClick={() => onChange([...rubric, { id: uid(), criterion: '', description: '', maxPoints: 10 }])}
        className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add criterion
      </button>
    </div>
    {rubric.map(r => (
      <div key={r.id} className="grid grid-cols-12 gap-1.5 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <input className={`col-span-4 ${inputCls} text-xs`} style={inputStyle} placeholder="Criterion"
          value={r.criterion} onChange={e => onChange(rubric.map(x => x.id === r.id ? { ...x, criterion: e.target.value } : x))} />
        <input className={`col-span-5 ${inputCls} text-xs`} style={inputStyle} placeholder="Description"
          value={r.description} onChange={e => onChange(rubric.map(x => x.id === r.id ? { ...x, description: e.target.value } : x))} />
        <input type="number" min={1} max={100} className={`col-span-2 ${inputCls} text-xs text-center`} style={inputStyle}
          value={r.maxPoints} onChange={e => onChange(rubric.map(x => x.id === r.id ? { ...x, maxPoints: Number(e.target.value) } : x))} />
        <button onClick={() => onChange(rubric.filter(x => x.id !== r.id))} className="col-span-1 flex items-center justify-center text-gray-500 hover:text-red-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    {rubric.length > 0 && (
      <p className="text-right text-xs text-gray-500">Total: <strong className="text-gray-300">{rubric.reduce((s, r) => s + r.maxPoints, 0)} pts</strong></p>
    )}
  </div>
);

// ─── File Uploader ────────────────────────────────────────────────────────────

const FileUploader = ({ files, onAdd, onRemove, label = 'Upload files', bucket = 'teacher', folder = 'general' }:
  { files: TaskAttachment[]; onAdd: (f: TaskAttachment[]) => void; onRemove: (i: number) => void; label?: string; bucket?: 'teacher' | 'student'; folder?: string }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);

  const handle = async (fl: FileList | null) => {
    if (!fl?.length) return;
    setUploading(true);
    const results: TaskAttachment[] = [];
    for (const f of Array.from(fl)) {
      try {
        const att = bucket === 'teacher'
          ? await taskService.uploadTeacherFile(f, folder, p => setProgress(x => ({ ...x, [f.name]: p })))
          : await taskService.uploadStudentFile(f, folder, p => setProgress(x => ({ ...x, [f.name]: p })));
        results.push(att);
      } catch (e: any) { alert(`Failed: ${e.message}`); }
    }
    setUploading(false); setProgress({});
    if (results.length) onAdd(results);
  };

  return (
    <div className="space-y-2">
      <div onClick={() => inputRef.current?.click()}
        className="border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors hover:border-blue-500/50"
        style={{ borderColor: 'var(--color-border, rgba(255,255,255,0.15))' }}>
        {uploading ? <div className="flex items-center justify-center gap-2 text-sm text-gray-400"><Spinner sm /> Uploading...</div> :
          <><Upload className="w-4 h-4 mx-auto mb-1 text-gray-500" />
            <span className="text-xs text-gray-400">{label}</span></>}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => handle(e.target.files)} />
      </div>
      {Object.entries(progress).map(([name, pct]) => (
        <div key={name} className="text-xs p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
          <div className="flex justify-between mb-1"><span className="truncate text-blue-400">{name}</span><span className="text-blue-400">{pct}%</span></div>
          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-lg group" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="flex-1 text-xs truncate text-gray-300">{f.name}</span>
          {f.size && <span className="text-xs text-gray-500">{fmtBytes(f.size)}</span>}
          <button onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
};

// ─── Student Picker ───────────────────────────────────────────────────────────

const StudentPicker = ({ selected, students, onChange }: {
  selected: string[]; students: AppUser[]; onChange: (ids: string[], names: string[]) => void
}) => {
  const [search, setSearch] = useState('');
  const filtered = students.filter(s => {
    const name = `${s.name} ${s.surname || ''} ${s.userId || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const toggle = (s: AppUser) => {
    const newSelected = selected.includes(s.uid)
      ? selected.filter(id => id !== s.uid)
      : [...selected, s.uid];
    const newNames = students.filter(u => newSelected.includes(u.uid)).map(u => `${u.name} ${u.surname || ''}`.trim());
    onChange(newSelected, newNames);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input className={`${inputCls} pl-8 text-xs`} style={inputStyle} placeholder="Search students..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {filtered.length === 0 ? (
          <p className="text-xs text-center text-gray-500 py-4">No students found</p>
        ) : filtered.map(s => (
          <button key={s.uid} onClick={() => toggle(s)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(s.uid) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
              {selected.includes(s.uid) && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-200 block truncate">{s.name} {s.surname}</span>
              <span className="text-xs text-gray-500">{s.userId || s.uid.slice(0, 8)}</span>
            </div>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-blue-400">{selected.length} student{selected.length > 1 ? 's' : ''} selected</p>
      )}
    </div>
  );
};

// ─── Task Group Form Modal ────────────────────────────────────────────────────

interface GroupFormState {
  title: string; description: string;
  assignType: 'all' | 'course' | 'class' | 'students';
  courseId: string; courseName: string;
  classGrade: string;
  studentIds: string[]; studentNames: string[];
  dueDateStr: string; startDateStr: string;
  lateAllowed: boolean; lateDeadlineStr: string;
  status: TaskGroupStatus;
}

const TaskGroupModal = ({ courses, students, availableClasses, editGroup, teacherId, teacherName, onClose, onSaved }: {
  courses: Course[]; students: AppUser[]; availableClasses: string[]; editGroup?: TaskGroup | null;
  teacherId: string; teacherName: string;
  onClose: () => void; onSaved: (id: string) => void;
}) => {
  const [f, setF] = useState<GroupFormState>(() => {
    if (editGroup) {
      const at = editGroup.assignedTo;
      return {
        title: editGroup.title, description: editGroup.description,
        assignType: at.type,
        courseId: at.type === 'course' ? (at as AssignmentScopeCourse).courseId : '',
        courseName: at.type === 'course' ? ((at as AssignmentScopeCourse).courseName ?? '') : '',
        classGrade: at.type === 'class' ? (at as AssignmentScopeClass).classGrade : '',
        studentIds: at.type === 'students' ? ((at as AssignmentScopeStudents).studentIds ?? []) : [],
        studentNames: at.type === 'students' ? ((at as AssignmentScopeStudents).studentNames ?? []) : [],
        dueDateStr: editGroup.dueDate.toISOString().slice(0, 16),
        startDateStr: editGroup.startDate ? editGroup.startDate.toISOString().slice(0, 16) : '',
        lateAllowed: editGroup.lateSubmissionAllowed,
        lateDeadlineStr: editGroup.lateSubmissionDeadline ? editGroup.lateSubmissionDeadline.toISOString().slice(0, 16) : '',
        status: editGroup.status,
      };
    }
    return { title: '', description: '', assignType: 'all', courseId: '', courseName: '', classGrade: '',
      studentIds: [], studentNames: [], dueDateStr: '', startDateStr: '',
      lateAllowed: false, lateDeadlineStr: '', status: 'draft' };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof GroupFormState, v: any) => setF(x => ({ ...x, [k]: v }));

  const buildScope = (): AssignmentScope => {
    if (f.assignType === 'course') return { type: 'course', courseId: f.courseId, courseName: f.courseName };
    if (f.assignType === 'class') return { type: 'class', classGrade: f.classGrade };
    if (f.assignType === 'students') return { type: 'students', studentIds: f.studentIds, studentNames: f.studentNames };
    return { type: 'all' };
  };

  const save = async () => {
    if (!f.title.trim()) { setError('Title is required'); return; }
    if (!f.dueDateStr) { setError('Due date is required'); return; }
    if (f.assignType === 'course' && !f.courseId) { setError('Please select a course'); return; }
    if (f.assignType === 'class' && !f.classGrade) { setError('Please select a class'); return; }
    if (f.assignType === 'students' && !f.studentIds.length) { setError('Select at least one student'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: f.title.trim(), description: f.description.trim(),
        teacherId, teacherName, assignedTo: buildScope(),
        dueDate: new Date(f.dueDateStr),
        lateSubmissionAllowed: f.lateAllowed,
        lateSubmissionDeadline: f.lateAllowed && f.lateDeadlineStr ? new Date(f.lateDeadlineStr) : undefined,
        startDate: f.startDateStr ? new Date(f.startDateStr) : undefined,
        status: f.status,
      };
      const id = editGroup ? (await taskService.updateTaskGroup(editGroup.id, payload), editGroup.id) : await taskService.createTaskGroup(payload);
      onSaved(id);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const modalBg: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))' };
  const secBg: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" style={modalBg}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="text-base font-semibold text-white">{editGroup ? 'Edit Task Group' : 'New Task Group'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <SectionLabel>Group Title *</SectionLabel>
            <input className={inputCls} style={inputStyle} placeholder="e.g., Week 5 Assignment Bundle"
              value={f.title} onChange={e => set('title', e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <SectionLabel>Description</SectionLabel>
            <textarea rows={2} className={inputCls} style={inputStyle} placeholder="Brief description..."
              value={f.description} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Assign To */}
          <div>
            <SectionLabel>Assign To</SectionLabel>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {([['all', 'Everyone'], ['course', 'Course'], ['class', 'Class'], ['students', 'Students']] as const).map(([val, lbl]) => (
                <button key={val} onClick={() => set('assignType', val)}
                  className="py-2 rounded-lg text-xs font-medium transition-all border"
                  style={f.assignType === val
                    ? { background: 'var(--color-primary, #6366f1)', borderColor: 'transparent', color: '#fff' }
                    : { background: 'transparent', borderColor: 'var(--color-border, rgba(255,255,255,0.1))', color: '#9ca3af' }}>
                  {lbl}
                </button>
              ))}
            </div>

            {f.assignType === 'course' && (
              <div style={secBg} className="rounded-xl p-3">
                <SectionLabel>Select Course</SectionLabel>
                <select className={inputCls} style={inputStyle} value={f.courseId}
                  onChange={e => { const c = courses.find(x => x.id === e.target.value); set('courseId', e.target.value); if (c) set('courseName', c.title); }}>
                  <option value="">— Select a course —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                {courses.length === 0 && <p className="text-xs text-gray-500 mt-1">No courses found. Create a course first.</p>}
              </div>
            )}

            {f.assignType === 'class' && (
              <div style={secBg} className="rounded-xl p-3">
                <SectionLabel>Select Class / Grade</SectionLabel>
                <select className={inputCls} style={inputStyle} value={f.classGrade}
                  onChange={e => set('classGrade', e.target.value)}>
                  <option value="">— Select class —</option>
                  {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {availableClasses.length === 0 && <p className="text-xs text-gray-500 mt-1">No classes found from published courses.</p>}
              </div>
            )}

            {f.assignType === 'students' && (
              <div style={secBg} className="rounded-xl p-3">
                <SectionLabel>Select Students</SectionLabel>
                <StudentPicker selected={f.studentIds} students={students}
                  onChange={(ids, names) => { set('studentIds', ids); set('studentNames', names); }} />
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel>Available From</SectionLabel>
              <input type="datetime-local" className={inputCls} style={inputStyle}
                value={f.startDateStr} onChange={e => set('startDateStr', e.target.value)} />
            </div>
            <div>
              <SectionLabel>Due Date *</SectionLabel>
              <input type="datetime-local" className={inputCls} style={inputStyle}
                value={f.dueDateStr} onChange={e => set('dueDateStr', e.target.value)} />
            </div>
          </div>

          {/* Late submission */}
          <div style={secBg} className="rounded-xl p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5 rounded"
                checked={f.lateAllowed} onChange={e => set('lateAllowed', e.target.checked)} />
              <span className="text-sm text-gray-300">Allow late submissions</span>
            </label>
            {f.lateAllowed && (
              <div>
                <SectionLabel>Late Submission Deadline</SectionLabel>
                <input type="datetime-local" className={inputCls} style={inputStyle}
                  value={f.lateDeadlineStr} onChange={e => set('lateDeadlineStr', e.target.value)} />
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <SectionLabel>Status</SectionLabel>
            <div className="flex gap-2">
              {(['draft', 'published', 'closed'] as TaskGroupStatus[]).map(s => (
                <button key={s} onClick={() => set('status', s)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all"
                  style={f.status === s
                    ? { background: 'var(--color-primary, #6366f1)', borderColor: 'transparent', color: '#fff' }
                    : { background: 'transparent', borderColor: 'var(--color-border, rgba(255,255,255,0.1))', color: '#9ca3af' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl hover:bg-white/5 text-gray-400">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary, #6366f1)' }}>
            {saving ? <><Spinner sm />Saving...</> : <><Check className="w-4 h-4" />{editGroup ? 'Update' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Task Form Modal ──────────────────────────────────────────────────────────

interface TaskFormState {
  title: string; description: string; type: TaskType; points: number; order: number;
  rubric: RubricItem[]; gradingCriteria: string; attachments: TaskAttachment[];
  allowResubmission: boolean; maxSubmissions: number;
  // Homework
  allowedFormats: string[]; maxFileSizeMB: number; allowRichText: boolean;
  // Project
  milestones: Milestone[]; allowLinks: boolean; allowedLinkTypes: string[]; stepBased: boolean;
  // Practical
  experimentSteps: string[]; requiredSubmissionTypes: string[];
  // Discussion
  prompt: string; wordLimit: number; allowPeerComments: boolean;
  // Peer Review
  sourceTaskId: string; peersToReview: number; anonymous: boolean; reviewDeadlineStr: string;
  // Link
  validateLinks: boolean;
  // Exam
  contentId: string;
}

const defForm = (existingTasks: Task[]): TaskFormState => ({
  title: '', description: '', type: 'homework', points: 10, order: existingTasks.length,
  rubric: [], gradingCriteria: '', attachments: [],
  allowResubmission: false, maxSubmissions: 1,
  allowedFormats: ['pdf', 'docx'], maxFileSizeMB: 10, allowRichText: true,
  milestones: [], allowLinks: true, allowedLinkTypes: ['github', 'website'], stepBased: false,
  experimentSteps: [''], requiredSubmissionTypes: ['image', 'file'],
  prompt: '', wordLimit: 500, allowPeerComments: true,
  sourceTaskId: '', peersToReview: 2, anonymous: false, reviewDeadlineStr: '',
  validateLinks: true, contentId: '',
});

const TaskModal = ({ groupId, teacherId, existingTasks, editTask, onClose, onSaved }: {
  groupId: string; teacherId: string; existingTasks: Task[];
  editTask?: Task | null; onClose: () => void; onSaved: () => void;
}) => {
  const [f, setF] = useState<TaskFormState>(() => {
    if (editTask) return {
      title: editTask.title, description: editTask.description, type: editTask.type,
      points: editTask.points, order: editTask.order,
      rubric: editTask.rubric ?? [], gradingCriteria: editTask.gradingCriteria ?? '',
      attachments: editTask.attachments ?? [],
      allowResubmission: editTask.allowResubmission ?? false, maxSubmissions: editTask.maxSubmissions ?? 1,
      allowedFormats: editTask.allowedFormats ?? ['pdf', 'docx'],
      maxFileSizeMB: editTask.maxFileSizeMB ?? 10, allowRichText: editTask.allowRichText ?? true,
      milestones: editTask.milestones ?? [], allowLinks: editTask.allowLinks ?? true,
      allowedLinkTypes: editTask.allowedLinkTypes ?? [], stepBased: editTask.stepBasedSubmission ?? false,
      experimentSteps: editTask.experimentSteps ?? [''],
      requiredSubmissionTypes: editTask.requiredSubmissionTypes ?? [],
      prompt: editTask.prompt ?? '', wordLimit: editTask.wordLimit ?? 500,
      allowPeerComments: editTask.allowPeerComments ?? true,
      sourceTaskId: editTask.sourceTaskId ?? '', peersToReview: editTask.peersToReview ?? 2,
      anonymous: editTask.anonymous ?? false,
      reviewDeadlineStr: editTask.reviewDeadline ? editTask.reviewDeadline.toISOString().slice(0, 16) : '',
      validateLinks: editTask.validateLinks ?? true, contentId: editTask.contentId ?? '',
    };
    return defForm(existingTasks);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [examContents, setExamContents] = useState<Content[]>([]);
  const [loadingExamContents, setLoadingExamContents] = useState(false);
  const set = (k: keyof TaskFormState, v: any) => setF(x => ({ ...x, [k]: v }));

  // Fetch exam-type contents when the modal mounts or when type switches to exam
  useEffect(() => {
    if (f.type !== 'exam') return;
    setLoadingExamContents(true);
    contentService.getContentByType('exam')
      .then(list => setExamContents(list))
      .catch(() => setExamContents([]))
      .finally(() => setLoadingExamContents(false));
  }, [f.type]);

  const toggleFmt = (fmt: string) =>
    set('allowedFormats', f.allowedFormats.includes(fmt) ? f.allowedFormats.filter(x => x !== fmt) : [...f.allowedFormats, fmt]);
  const toggleSubType = (t: string) =>
    set('requiredSubmissionTypes', f.requiredSubmissionTypes.includes(t) ? f.requiredSubmissionTypes.filter(x => x !== t) : [...f.requiredSubmissionTypes, t]);
  const toggleLinkType = (t: string) =>
    set('allowedLinkTypes', f.allowedLinkTypes.includes(t) ? f.allowedLinkTypes.filter(x => x !== t) : [...f.allowedLinkTypes, t]);

  const save = async () => {
    if (!f.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
        taskGroupId: groupId, title: f.title.trim(), description: f.description.trim(),
        type: f.type, points: f.points, order: f.order, teacherId,
        rubric: f.rubric.filter(r => r.criterion), gradingCriteria: f.gradingCriteria,
        attachments: f.attachments, allowResubmission: f.allowResubmission,
        maxSubmissions: f.allowResubmission ? f.maxSubmissions : 1,
        allowedFormats: f.allowedFormats, maxFileSizeMB: f.maxFileSizeMB, allowRichText: f.allowRichText,
        milestones: f.milestones.filter(m => m.title),
        allowLinks: f.allowLinks, allowedLinkTypes: f.allowedLinkTypes,
        stepBasedSubmission: f.stepBased,
        experimentSteps: f.experimentSteps.filter(Boolean),
        requiredSubmissionTypes: f.requiredSubmissionTypes,
        prompt: f.prompt, wordLimit: f.wordLimit, allowPeerComments: f.allowPeerComments,
        sourceTaskId: f.sourceTaskId, peersToReview: f.peersToReview, anonymous: f.anonymous,
        reviewDeadline: f.reviewDeadlineStr ? new Date(f.reviewDeadlineStr) : undefined,
        validateLinks: f.validateLinks, contentId: f.contentId,
      };
      if (editTask) await taskService.updateTask(editTask.id, payload);
      else await taskService.createTask(payload);
      onSaved();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const modalBg: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))' };
  const secBg: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' };
  const pillActive: React.CSSProperties = { background: 'var(--color-primary, #6366f1)', color: '#fff', borderColor: 'transparent' };
  const pillIdle: React.CSSProperties = { background: 'transparent', borderColor: 'var(--color-border, rgba(255,255,255,0.1))', color: '#9ca3af' };

  const typeMeta = TASK_TYPES.find(t => t.type === f.type)!;
  const TypeIcon = typeMeta.icon;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={modalBg}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${typeMeta.color}22` }}>
              <TypeIcon className="w-4 h-4" style={{ color: typeMeta.color }} />
            </div>
            <h2 className="text-base font-semibold text-white">{editTask ? 'Edit Task' : 'Add Task'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Task Type */}
          <div>
            <SectionLabel>Task Type</SectionLabel>
            <div className="grid grid-cols-4 gap-1.5">
              {TASK_TYPES.map(({ type, label, icon: Icon, color }) => (
                <button key={type} onClick={() => set('type', type)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs font-medium border transition-all"
                  style={f.type === type
                    ? { background: `${color}22`, borderColor: `${color}44`, color }
                    : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                  <Icon className="w-4 h-4" />{label.split('/')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Basic */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <SectionLabel>Title *</SectionLabel>
              <input className={inputCls} style={inputStyle} placeholder="Task title"
                value={f.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className="col-span-2">
              <SectionLabel>Instructions</SectionLabel>
              <textarea rows={2} className={inputCls} style={inputStyle} placeholder="Describe the task..."
                value={f.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div>
              <SectionLabel>Points</SectionLabel>
              {f.type === 'exam' ? (
                <div className={`${inputCls} flex items-center gap-1.5`} style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }}>
                  <span>{f.points > 0 ? f.points : '—'}</span>
                  <span className="text-xs text-gray-500 ml-1">(auto from exam)</span>
                </div>
              ) : (
                <input type="number" min={0} className={inputCls} style={inputStyle}
                  value={f.points} onChange={e => set('points', Number(e.target.value))} />
              )}
            </div>
            <div>
              <SectionLabel>Order</SectionLabel>
              <input type="number" min={0} className={inputCls} style={inputStyle}
                value={f.order} onChange={e => set('order', Number(e.target.value))} />
            </div>
          </div>

          {/* Type-specific settings */}
          {f.type === 'homework' && (
            <div style={secBg} className="rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-400">Homework Settings</p>
              <div>
                <SectionLabel>Allowed Formats</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {FILE_FORMATS.map(fmt => (
                    <button key={fmt} onClick={() => toggleFmt(fmt)}
                      className="px-2 py-1 rounded text-xs font-medium border transition-all"
                      style={f.allowedFormats.includes(fmt) ? pillActive : pillIdle}>.{fmt}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><SectionLabel>Max File Size (MB)</SectionLabel>
                  <input type="number" min={1} max={500} className={inputCls} style={inputStyle}
                    value={f.maxFileSizeMB} onChange={e => set('maxFileSizeMB', Number(e.target.value))} /></div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="rte" className="w-3.5 h-3.5 rounded"
                    checked={f.allowRichText} onChange={e => set('allowRichText', e.target.checked)} />
                  <label htmlFor="rte" className="text-sm text-gray-300 cursor-pointer">Rich text answer</label>
                </div>
              </div>
            </div>
          )}

          {f.type === 'project' && (
            <div style={secBg} className="rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-400">Project Settings</p>
              {/* Milestones */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <SectionLabel>Milestones</SectionLabel>
                  <button onClick={() => set('milestones', [...f.milestones, { id: uid(), title: '', description: '', dueDate: new Date(), order: f.milestones.length }])}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {f.milestones.map((m, i) => (
                  <div key={m.id} className="flex gap-2 mb-1.5">
                    <span className="w-5 text-xs text-gray-500 font-bold pt-2">{i + 1}.</span>
                    <input className={`flex-1 ${inputCls} text-xs`} style={inputStyle} placeholder="Milestone title"
                      value={m.title} onChange={e => set('milestones', f.milestones.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                    <input type="datetime-local" className={`w-40 ${inputCls} text-xs`} style={inputStyle}
                      value={m.dueDate instanceof Date ? m.dueDate.toISOString().slice(0, 16) : ''}
                      onChange={e => set('milestones', f.milestones.map((x, j) => j === i ? { ...x, dueDate: new Date(e.target.value) } : x))} />
                    <button onClick={() => set('milestones', f.milestones.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={f.allowLinks} onChange={e => set('allowLinks', e.target.checked)} />External links
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={f.stepBased} onChange={e => set('stepBased', e.target.checked)} />Step-based
                </label>
              </div>
              {f.allowLinks && (
                <div className="flex flex-wrap gap-1.5">
                  {['github', 'website', 'gdrive', 'figma', 'notion'].map(l => (
                    <button key={l} onClick={() => toggleLinkType(l)}
                      className="px-2 py-1 rounded text-xs border transition-all" style={f.allowedLinkTypes.includes(l) ? pillActive : pillIdle}>{l}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {f.type === 'practical' && (
            <div style={secBg} className="rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-green-400">Lab / Practical Settings</p>
              <div>
                <SectionLabel>Experiment Steps</SectionLabel>
                {f.experimentSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 mb-1.5">
                    <span className="w-5 text-xs text-gray-500 font-bold pt-2">{i + 1}.</span>
                    <input className={`flex-1 ${inputCls} text-xs`} style={inputStyle} placeholder={`Step ${i + 1}`}
                      value={step} onChange={e => { const s = [...f.experimentSteps]; s[i] = e.target.value; set('experimentSteps', s); }} />
                    <button onClick={() => set('experimentSteps', f.experimentSteps.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => set('experimentSteps', [...f.experimentSteps, ''])} className="text-xs text-green-400 hover:text-green-300 font-medium">+ Add step</button>
              </div>
              <div>
                <SectionLabel>Required Evidence Types</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {['image', 'video', 'file', 'screenshot'].map(t => (
                    <button key={t} onClick={() => toggleSubType(t)}
                      className="px-2 py-1 rounded text-xs border transition-all" style={f.requiredSubmissionTypes.includes(t) ? pillActive : pillIdle}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {f.type === 'discussion' && (
            <div style={secBg} className="rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-400">Discussion Settings</p>
              <div><SectionLabel>Discussion Prompt</SectionLabel>
                <textarea rows={3} className={inputCls} style={inputStyle} placeholder="Enter the discussion prompt or reflection question..."
                  value={f.prompt} onChange={e => set('prompt', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><SectionLabel>Word Limit (0 = unlimited)</SectionLabel>
                  <input type="number" min={0} className={inputCls} style={inputStyle}
                    value={f.wordLimit} onChange={e => set('wordLimit', Number(e.target.value))} /></div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={f.allowPeerComments} onChange={e => set('allowPeerComments', e.target.checked)} />
                    Peer comments
                  </label>
                </div>
              </div>
            </div>
          )}

          {f.type === 'peer_review' && (
            <div style={secBg} className="rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-red-400">Peer Review Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div><SectionLabel>Source Task (to review)</SectionLabel>
                  <select className={inputCls} style={inputStyle} value={f.sourceTaskId} onChange={e => set('sourceTaskId', e.target.value)}>
                    <option value="">— Select task —</option>
                    {existingTasks.filter(t => t.type !== 'peer_review').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select></div>
                <div><SectionLabel>Peers to Review Each</SectionLabel>
                  <input type="number" min={1} max={10} className={inputCls} style={inputStyle}
                    value={f.peersToReview} onChange={e => set('peersToReview', Number(e.target.value))} /></div>
                <div><SectionLabel>Review Deadline</SectionLabel>
                  <input type="datetime-local" className={inputCls} style={inputStyle}
                    value={f.reviewDeadlineStr} onChange={e => set('reviewDeadlineStr', e.target.value)} /></div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={f.anonymous} onChange={e => set('anonymous', e.target.checked)} />
                    Anonymous reviewers
                  </label>
                </div>
              </div>
            </div>
          )}

          {f.type === 'link_submission' && (
            <div style={secBg} className="rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-cyan-400">Link Submission Settings</p>
              <div>
                <SectionLabel>Allowed Link Types</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {['github', 'gdrive', 'website', 'youtube', 'figma', 'notion'].map(l => (
                    <button key={l} onClick={() => toggleLinkType(l)}
                      className="px-2 py-1 rounded text-xs border transition-all" style={f.allowedLinkTypes.includes(l) ? pillActive : pillIdle}>{l}</button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={f.validateLinks} onChange={e => set('validateLinks', e.target.checked)} />
                Validate URL format
              </label>
            </div>
          )}

          {f.type === 'exam' && (
            <div style={secBg} className="rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-400">Exam Settings</p>
              <div>
                <SectionLabel>Select Exam Content *</SectionLabel>
                {loadingExamContents ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-gray-400"><Spinner sm /> Loading exam contents...</div>
                ) : (
                  <select
                    className={inputCls} style={inputStyle}
                    value={f.contentId}
                    onChange={e => {
                      const selected = examContents.find(c => c.id === e.target.value);
                      set('contentId', e.target.value);
                      // Auto-fill points from exam's totalMarks
                      if (selected?.totalMarks) set('points', selected.totalMarks);
                      else if (!e.target.value) set('points', 0);
                    }}
                  >
                    <option value="">— Select an exam —</option>
                    {examContents.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}{c.customId ? ` (${c.customId})` : ''}{c.totalMarks ? ` — ${c.totalMarks} marks` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {examContents.length === 0 && !loadingExamContents && (
                  <p className="text-xs text-gray-500 mt-1">No exam content found. Upload exam content first.</p>
                )}
                {f.contentId && (() => {
                  const sel = examContents.find(c => c.id === f.contentId);
                  if (!sel) return null;
                  return (
                    <div className="mt-2 p-2 rounded-lg text-xs space-y-0.5" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {sel.subject && <p className="text-gray-400">Subject: <span className="text-gray-200">{sel.subject}</span></p>}
                      {sel.examType && <p className="text-gray-400">Exam type: <span className="text-gray-200">{sel.examType}</span></p>}
                      {sel.totalMarks !== undefined && <p className="text-gray-400">Total marks: <span className="text-indigo-300 font-semibold">{sel.totalMarks}</span></p>}
                      {sel.duration && <p className="text-gray-400">Duration: <span className="text-gray-200">{sel.duration} min</span></p>}
                    </div>
                  );
                })()}
                <p className="text-xs text-gray-500 mt-1">Students will be taken to ExamViewer for this content.</p>
              </div>
            </div>
          )}

          {/* Resubmission */}
          {f.type !== 'exam' && (
            <div style={secBg} className="rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                <input type="checkbox" className="w-3.5 h-3.5 rounded" checked={f.allowResubmission} onChange={e => set('allowResubmission', e.target.checked)} />
                Allow resubmissions / revisions
              </label>
              {f.allowResubmission && (
                <div className="ml-5">
                  <SectionLabel>Max attempts</SectionLabel>
                  <input type="number" min={2} max={10} className={`w-20 ${inputCls}`} style={inputStyle}
                    value={f.maxSubmissions} onChange={e => set('maxSubmissions', Number(e.target.value))} />
                </div>
              )}
            </div>
          )}

          {/* Rubric */}
          <RubricBuilder rubric={f.rubric} onChange={r => set('rubric', r)} />

          {/* Grading notes */}
          <div>
            <SectionLabel>Grading Notes (for evaluators)</SectionLabel>
            <textarea rows={2} className={inputCls} style={inputStyle} placeholder="Additional grading guidance..."
              value={f.gradingCriteria} onChange={e => set('gradingCriteria', e.target.value)} />
          </div>

          {/* Reference files */}
          <div>
            <SectionLabel>Reference Files (visible to students)</SectionLabel>
            <FileUploader files={f.attachments}
              onAdd={files => set('attachments', [...f.attachments, ...files])}
              onRemove={i => set('attachments', f.attachments.filter((_, j) => j !== i))}
              label="Upload templates / reference materials"
              bucket="teacher" folder={groupId} />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl hover:bg-white/5 text-gray-400">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary, #6366f1)' }}>
            {saving ? <><Spinner sm />Saving...</> : <><Check className="w-4 h-4" />{editTask ? 'Update' : 'Add Task'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Grading Modal ────────────────────────────────────────────────────────────

const GradingModal = ({ sub, task, teacherId, teacherName, onClose, onGraded }: {
  sub: Submission; task: Task; teacherId: string; teacherName: string;
  onClose: () => void; onGraded: () => void;
}) => {
  const [grade, setGrade] = useState(sub.grade ?? 0);
  const [feedback, setFeedback] = useState(sub.feedback ?? '');
  const [feedbackFiles, setFeedbackFiles] = useState<TaskAttachment[]>(sub.feedbackFiles ?? []);
  const [rubricScores, setRubricScores] = useState<RubricScore[]>(
    (task.rubric ?? []).map(r => ({
      criterion: r.criterion, maxPoints: r.maxPoints,
      score: sub.rubricScores?.find(s => s.criterion === r.criterion)?.score ?? 0,
      comment: sub.rubricScores?.find(s => s.criterion === r.criterion)?.comment ?? '',
    }))
  );
  const [saving, setSaving] = useState(false);

  const rubricTotal = rubricScores.reduce((s, r) => s + r.score, 0);
  useEffect(() => {
    if (task.rubric?.length && task.points) setGrade(Math.min(rubricTotal, task.points));
  }, [rubricTotal]);

  const save = async () => {
    setSaving(true);
    try {
      await taskService.gradeSubmission(sub.id, { grade, feedback, feedbackFiles, rubricScores, gradedBy: teacherId, gradedByName: teacherName });
      notificationService.createNotification({
        userId: sub.studentId,
        title: 'Task Evaluated',
        message: task.title,
        type: 'grade',
        priority: 'high',
        isPermanent: true,
        relatedId: sub.taskId,
        relatedType: 'task',
        metadata: { taskTitle: task.title, grade, maxPoints: task.points },
      });
      onGraded();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const modalBg: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))' };
  const secBg: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" style={modalBg}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-base font-semibold text-white">Grade Submission</h2>
            <p className="text-xs text-gray-400 mt-0.5">{sub.studentName} — {task.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Submission content */}
          <div style={secBg} className="rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400">Submitted Content</p>
            {sub.textContent && <div className="text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: sub.textContent }} />}
            {sub.discussionText && <p className="text-sm text-gray-300">{sub.discussionText}</p>}
            {sub.files?.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg text-xs text-blue-400 hover:text-blue-300"
                style={{ background: 'rgba(59,130,246,0.08)' }}>
                <Paperclip className="w-3.5 h-3.5" />{f.name}
              </a>
            ))}
            {sub.links?.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg text-xs text-blue-400"
                style={{ background: 'rgba(59,130,246,0.08)' }}>
                <Link2 className="w-3.5 h-3.5" />{l.label || l.url}
              </a>
            ))}
            <div className="flex gap-3 text-xs text-gray-500">
              <span>Submitted: {fmtDate(sub.submittedAt)}</span>
              <span>Attempt #{sub.attemptNumber}</span>
              {sub.isLate && <span className="text-amber-400">⚠ Late</span>}
            </div>
          </div>

          {/* Rubric */}
          {rubricScores.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400">Rubric Scoring</p>
              {rubricScores.map((rs, i) => (
                <div key={i} style={secBg} className="rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-200">{rs.criterion}</span>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={0} max={rs.maxPoints}
                        className="w-14 text-center rounded-lg px-2 py-1 text-sm border bg-transparent"
                        style={{ borderColor: 'var(--color-border, rgba(255,255,255,0.15))', color: '#fff' }}
                        value={rs.score}
                        onChange={e => setRubricScores(s => s.map((x, j) => j === i ? { ...x, score: Math.min(Number(e.target.value), x.maxPoints) } : x))} />
                      <span className="text-xs text-gray-500">/ {rs.maxPoints}</span>
                    </div>
                  </div>
                  <input className="w-full rounded-lg px-2 py-1 text-xs border bg-transparent"
                    style={{ borderColor: 'var(--color-border, rgba(255,255,255,0.1))', color: '#9ca3af' }}
                    placeholder="Comment (optional)"
                    value={rs.comment ?? ''} onChange={e => setRubricScores(s => s.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))} />
                </div>
              ))}
              <p className="text-xs text-right text-gray-400">Rubric total: <strong className="text-gray-200">{rubricTotal}</strong> / {task.rubric?.reduce((s, r) => s + r.maxPoints, 0)}</p>
            </div>
          )}

          {/* Grade */}
          <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div className="flex-1">
              <SectionLabel>Final Grade</SectionLabel>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={task.points}
                  className="w-20 text-center rounded-xl px-3 py-2 text-sm font-bold border"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc' }}
                  value={grade} onChange={e => setGrade(Math.min(Number(e.target.value), task.points))} />
                <span className="text-gray-400 text-sm">/ {task.points} pts</span>
              </div>
            </div>
            <div className="text-3xl font-bold" style={{ color: 'var(--color-primary, #6366f1)' }}>
              {task.points ? Math.round((grade / task.points) * 100) : 0}%
            </div>
          </div>

          {/* Feedback */}
          <div>
            <SectionLabel>Feedback to Student</SectionLabel>
            <textarea rows={3} className={inputCls} style={inputStyle} placeholder="Write detailed feedback..."
              value={feedback} onChange={e => setFeedback(e.target.value)} />
          </div>
          <div>
            <SectionLabel>Feedback Attachments</SectionLabel>
            <FileUploader files={feedbackFiles}
              onAdd={f => setFeedbackFiles(x => [...x, ...f])}
              onRemove={i => setFeedbackFiles(x => x.filter((_, j) => j !== i))}
              bucket="teacher" folder="feedback" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl hover:bg-white/5 text-gray-400">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary, #6366f1)' }}>
            {saving ? <><Spinner sm />Saving...</> : <><Award className="w-4 h-4" />Submit Grade</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

type TabKey = 'manage' | 'evaluate';

const TeacherTaskManagement: React.FC = () => {
  const { user, theme } = useDashboard();
  const isLight = theme === 'light';
  const [tab, setTab] = useState<TabKey>('manage');

  // Data
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskGroupStatus>('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  // courseId → Set<allowedSubject> for teacher permission checks (empty set = all subjects)
  const [teacherTaskPerms, setTeacherTaskPerms] = useState<
    Array<{ courseId: string; courseTitle: string; allowedSubjects: string[]; subjects?: string[]; class?: string; canCreate?: boolean; canEdit?: boolean; canEvaluate?: boolean; hasGlobalTaskCreation?: boolean }>
  >([]);
  const [globalTaskCreation, setGlobalTaskCreation] = useState(false);
  const isAdminMgr = user?.role === 'admin' || user?.role === 'manager';
  // "New Task Group" button: visible only if admin/manager OR global task_creation_global is ON
  const canCreateTasks = isAdminMgr || globalTaskCreation;

  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [gradingData, setGradingData] = useState<{ sub: Submission; task: Task } | null>(null);

  // Detail view
  const [selectedGroup, setSelectedGroup] = useState<TaskGroup | null>(null);
  const [groupTasks, setGroupTasks] = useState<Task[]>([]);
  const [groupSubs, setGroupSubs] = useState<Submission[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Evaluate tab
  const [evalGroupId, setEvalGroupId] = useState('');
  const [evalTaskFilter, setEvalTaskFilter] = useState('all');
  const [evalStatusFilter, setEvalStatusFilter] = useState('all');
  const [evalSubs, setEvalSubs] = useState<Submission[]>([]);
  const [evalTasks, setEvalTasks] = useState<Task[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);

  // Courses where teacher has course-specific task_creation permission (for modal dropdown)
  const [creatableCourses, setCreatableCourses] = useState<Course[]>([]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (
    taskPerms?: Array<{ courseId: string; courseTitle: string; allowedSubjects: string[]; subjects?: string[]; class?: string; canCreate?: boolean; canEdit?: boolean; canEvaluate?: boolean; hasGlobalTaskCreation?: boolean }>,
    globalTaskCreation?: boolean
  ) => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const isTeacher = user.role === 'teacher';
      const activePerms = taskPerms ?? teacherTaskPerms;
      // Resolve global flag: prefer explicit argument, then derive from perms entries
      const globalCreate = globalTaskCreation !== undefined
        ? globalTaskCreation
        : activePerms.some(p => p.hasGlobalTaskCreation);

      const u = await userService.getAllUsers().catch(() => [] as AppUser[]);

      // Build permMap: courseId → Set<allowedSubject> (empty = all subjects allowed)
      const permMap = new Map<string, Set<string>>();
      if (isTeacher) {
        activePerms.forEach(({ courseId, allowedSubjects }) => {
          permMap.set(courseId, new Set(allowedSubjects));
        });
      }

      // ── Fetch task groups by role ─────────────────────────────────────────
      let allGroups: TaskGroup[];
      if (isAdminMgr) {
        allGroups = await taskService.getAllTaskGroups();
      } else if (isTeacher) {
        if (activePerms.length === 0 && !globalCreate) {
          // No task assignments at all — show empty
          setGroups([]); setCourses([]); setAvailableClasses([]); setCreatableCourses([]);
          setStudents(u.filter((u: AppUser) => u.role === 'student' && u.status === 'active'));
          setLoading(false);
          return;
        }
        // Own groups + all published groups, then filter to assigned courses
        const [ownGroups, publishedGroups] = await Promise.all([
          taskService.getTaskGroupsByTeacher(user.uid),
          taskService.getTaskGroupsForStudent('', '').catch(() => [] as TaskGroup[]),
        ]);
        const ownIds = new Set(ownGroups.map(g => g.id));
        const merged = [...ownGroups, ...publishedGroups.filter(g => !ownIds.has(g.id))];
        allGroups = merged.filter(g => {
          if (ownIds.has(g.id)) return true; // always show own groups
          const at = g.assignedTo;
          if (at.type === 'course') return permMap.has((at as any).courseId);
          return false;
        });
      } else {
        allGroups = await taskService.getTaskGroupsByTeacher(user.uid);
      }

      setGroups(allGroups);

      // ── Build courses list for the modal dropdown ─────────────────────────
      // For teachers: build directly from assignments (courseTitle is stored on the assignment),
      //   so it works regardless of whether the course is published or not.
      // For admin/manager: fetch ALL courses (not just published) so nothing is missing.
      let visibleCourses: Course[];
      if (isTeacher) {
        visibleCourses = activePerms.map(p => ({
          id: p.courseId,
          title: p.courseTitle || p.courseId,
          subjects: p.subjects || [],
          class: p.class || '',
          contentStructure: [],
          isPublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any as Course));
      } else {
        // Admin/manager: use getAllCourses so unpublished courses are also available
        visibleCourses = await courseService.getAllCourses().catch(
          () => courseEnrollmentService.getPublishedCourses().catch(() => [] as Course[])
        );
      }

      setCourses(visibleCourses);
      const clsSet = new Set<string>();
      visibleCourses.forEach(c => { if ((c as any).class) clsSet.add((c as any).class); });
      setAvailableClasses(Array.from(clsSet).sort());

      // Build creatableCourses: only courses where canCreate===true (course-specific task_creation)
      // These are the only courses that appear in the "Assign To → Course" dropdown for teachers.
      if (isTeacher) {
        const creatablePerms = activePerms.filter(p => p.canCreate);
        setCreatableCourses(creatablePerms.map(p => ({
          id: p.courseId,
          title: p.courseTitle || p.courseId,
          subjects: p.subjects || [],
          class: p.class || '',
          contentStructure: [],
          isPublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any as Course)));
      } else {
        // Admin/manager: all courses are creatable
        setCreatableCourses(visibleCourses);
      }

      setStudents(u.filter((u: AppUser) => u.role === 'student' && u.status === 'active'));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [user, teacherTaskPerms]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'teacher') {
      courseAssignmentService.getTeacherAssignments(user.uid)
        .then(assignments => {
          // Global task creation: read from ANY active assignment's globalPermissions
          // (the sentinel __global__ record also carries this flag)
          const hasGlobalTaskCreation = assignments.some(
            a => a.isActive && (a.globalPermissions || []).includes('task_creation_global')
          );

          // Build per-course perm entries — include ALL courses that have at least one
          // task-related permission (create / edit / evaluate), so visibility and
          // editing still work independently. Filter out the __global__ sentinel.
          const taskPerms = assignments
            .filter(a => a.isActive && a.courseId !== '__global__' && (
              a.permissions.includes('task_creation') ||
              a.permissions.includes('task_editing') ||
              a.permissions.includes('task_evaluation')
            ))
            .map(a => ({
              courseId: a.courseId,
              courseTitle: a.courseTitle || a.courseId,
              allowedSubjects: a.allowedSubjects || [],
              subjects: (a as any).subjects || [],
              class: (a as any).class || '',
              canCreate: a.permissions.includes('task_creation'),
              canEdit: a.permissions.includes('task_editing'),
              canEvaluate: a.permissions.includes('task_evaluation'),
              hasGlobalTaskCreation,
            }));

          setTeacherTaskPerms(taskPerms);
          setGlobalTaskCreation(hasGlobalTaskCreation);
          load(taskPerms, hasGlobalTaskCreation);
        })
        .catch(() => { setGlobalTaskCreation(false); load([], false); });
    } else {
      load();
    }
  }, [user]);

  const loadDetail = useCallback(async (group: TaskGroup) => {
    setLoadingDetail(true); setSelectedGroup(group);
    try {
      const [tasks, subs] = await Promise.all([
        taskService.getTasksByGroup(group.id),
        taskService.getGroupSubmissions(group.id),
      ]);
      setGroupTasks(tasks); setGroupSubs(subs);
    } finally { setLoadingDetail(false); }
  }, []);

  const loadEval = useCallback(async (groupId: string) => {
    if (!groupId) return;
    setEvalLoading(true);
    try {
      const [tasks, subs] = await Promise.all([
        taskService.getTasksByGroup(groupId),
        taskService.getGroupSubmissions(groupId),
      ]);
      setEvalTasks(tasks); setEvalSubs(subs);
    } finally { setEvalLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'evaluate' && !evalGroupId && groups.length > 0) {
      setEvalGroupId(groups[0].id); loadEval(groups[0].id);
    }
  }, [tab, groups]);

  useEffect(() => { if (evalGroupId) loadEval(evalGroupId); }, [evalGroupId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGroupSaved = async (id: string) => {
    setShowGroupModal(false); setEditingGroup(null); await load();
    if (selectedGroup?.id === id) { const g = await taskService.getTaskGroupById(id); if (g) loadDetail(g); }
  };

  const handleTaskSaved = async () => {
    setShowTaskModal(false); setEditingTask(null);
    if (selectedGroup) await loadDetail(selectedGroup);
    await load();
  };

  const handleDeleteGroup = async (g: TaskGroup) => {
    if (!confirm(`Delete "${g.title}" and all its tasks? This cannot be undone.`)) return;
    try { await taskService.deleteTaskGroup(g.id); if (selectedGroup?.id === g.id) setSelectedGroup(null); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleDeleteTask = async (t: Task) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    try { await taskService.deleteTask(t.id); if (selectedGroup) await loadDetail(selectedGroup); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handlePublish = async (g: TaskGroup) => {
    try {
      await taskService.publishTaskGroup(g.id);
      // Notify directly-targeted students immediately
      if (g.assignedTo.type === 'students') {
        const { studentIds } = g.assignedTo as AssignmentScopeStudents;
        (studentIds ?? []).forEach(userId => {
          notificationService.createNotification({
            userId,
            title: 'New Task Assigned',
            message: g.title,
            type: 'assignment',
            priority: 'medium',
            isPermanent: true,
            relatedId: g.id,
            relatedType: 'taskGroup',
            metadata: { groupTitle: g.title },
          });
        });
      }
      await load();
      if (selectedGroup?.id === g.id) { const updated = await taskService.getTaskGroupById(g.id); if (updated) setSelectedGroup(updated); }
    }
    catch (e: any) { alert(e.message); }
  };

  // ── Derived filter lists ──────────────────────────────────────────────────

  // Build course list from loaded groups (assignedTo.courseId → courseName)
  // also include courses from the courses state (teacher's permitted / admin's all)
  const coursesInGroups = (() => {
    const seen = new Map<string, string>();
    groups.forEach(g => {
      const at = g.assignedTo;
      if (at.type === 'course') {
        const cId = (at as any).courseId as string;
        const title = (at as any).courseName || cId;
        if (cId && !seen.has(cId)) seen.set(cId, title);
      }
    });
    courses.forEach(c => { if (!seen.has(c.id)) seen.set(c.id, c.title); });
    return Array.from(seen.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  })();

  // Build subject list from courses state (courses store subjects array)
  const subjectsInGroups = (() => {
    const seen = new Set<string>();
    courses.forEach(c => { ((c as any).subjects || []).forEach((s: string) => seen.add(s)); });
    return Array.from(seen).sort();
  })();

  // ── Filtered ──────────────────────────────────────────────────────────────

  const filtered = groups.filter(g => {
    if (!g.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && g.status !== statusFilter) return false;
    if (courseFilter !== 'all') {
      const at = g.assignedTo;
      if (at.type !== 'course' || (at as any).courseId !== courseFilter) return false;
    }
    if (subjectFilter !== 'all') {
      const at = g.assignedTo;
      if (at.type !== 'course') return false;
      const course = courses.find(c => c.id === (at as any).courseId);
      if (!course || !((course as any).subjects || []).includes(subjectFilter)) return false;
    }
    return true;
  });

  const filteredEvalSubs = evalSubs.filter(s =>
    (evalTaskFilter === 'all' || s.taskId === evalTaskFilter) &&
    (evalStatusFilter === 'all' || s.status === evalStatusFilter)
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  const statusColors: Record<TaskGroupStatus, string> = {
    draft: '#9ca3af', published: '#10b981', closed: '#ef4444'
  };
  const subStatusBg = (s: string) => ({
    reviewed: 'rgba(16,185,129,0.12)', late: 'rgba(245,158,11,0.12)',
    submitted: 'rgba(59,130,246,0.12)', resubmitted: 'rgba(99,102,241,0.12)',
  }[s] || 'rgba(156,163,175,0.1)');
  const subStatusColor = (s: string) => ({
    reviewed: '#6ee7b7', late: '#fcd34d', submitted: '#93c5fd', resubmitted: '#a5b4fc',
  }[s] || '#9ca3af');

  const cardStyle: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))', borderRadius: '1rem' };
  const inputBtnStyle = (active: boolean): React.CSSProperties => active
    ? { background: 'var(--color-primary, #6366f1)', color: '#fff', border: '1px solid transparent' }
    : { background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Task Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Create, assign and evaluate student tasks</p>
        </div>
        {tab === 'manage' && !selectedGroup && canCreateTasks && (
          <button onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-primary, #6366f1)' }}>
            <Plus className="w-4 h-4" /> New Task Group
          </button>
        )}
        {tab === 'manage' && selectedGroup && (
          <button onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-primary, #6366f1)' }}>
            <Plus className="w-4 h-4" /> Add Task
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 w-fit p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {(['manage', 'evaluate'] as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
            style={tab === t
              ? { background: 'var(--color-primary, #6366f1)', color: '#fff' }
              : { color: '#9ca3af' }}>
            {t === 'manage' ? <Layers className="w-4 h-4" /> : <Award className="w-4 h-4" />}
            {t === 'manage' ? 'Manage' : 'Evaluate'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── MANAGE TAB ──────────────────────────────────────────────────────── */}
      {tab === 'manage' && (
        <>
          {selectedGroup ? (
            /* ── Group detail ── */
            <div className="space-y-5">
              {/* Back + group header */}
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedGroup(null)}
                  className="p-2 rounded-xl hover:bg-white/5 text-gray-400" title="Back">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{selectedGroup.title}</h2>
                    <span className="flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColors[selectedGroup.status]}22`, color: statusColors[selectedGroup.status] }}>
                      <StatusDot status={selectedGroup.status} />{selectedGroup.status}
                    </span>
                  </div>
                  {selectedGroup.description && <p className="text-sm text-gray-400">{selectedGroup.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingGroup(selectedGroup); setShowGroupModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:bg-white/5 border"
                    style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)' }}>
                    <Edit2 className="w-3.5 h-3.5" /> Edit Group
                  </button>
                  {selectedGroup.status === 'draft' && (
                    <button onClick={() => handlePublish(selectedGroup)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white"
                      style={{ background: '#059669' }}>
                      <Unlock className="w-3.5 h-3.5" /> Publish
                    </button>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Tasks', value: groupTasks.length, color: '#6366f1' },
                  { label: 'Total Points', value: selectedGroup.totalPoints, color: '#f59e0b' },
                  { label: 'Submissions', value: groupSubs.length, color: '#10b981' },
                  { label: 'Reviewed', value: groupSubs.filter(s => s.status === 'reviewed').length, color: '#8b5cf6' },
                ].map(s => (
                  <div key={s.label} style={cardStyle} className="p-4">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Task list */}
              {loadingDetail ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : groupTasks.length === 0 ? (
                <div style={cardStyle} className="p-12 text-center text-gray-500">
                  <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No tasks yet. Click "Add Task" to create the first one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupTasks.map((task, idx) => {
                    const meta = TASK_TYPES.find(t => t.type === task.type)!;
                    const TIcon = meta.icon;
                    const taskSubs = groupSubs.filter(s => s.taskId === task.id);
                    return (
                      <div key={task.id} style={cardStyle} className="flex items-center gap-4 p-4 group hover:border-white/20 transition-all">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${meta.color}18` }}>
                          <TIcon className="w-4 h-4" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">#{idx + 1}</span>
                            <span className="font-semibold text-gray-100 truncate">{task.title}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span><Award className="w-3 h-3 inline mr-0.5" />{task.points} pts</span>
                            <span><Send className="w-3 h-3 inline mr-0.5" />{taskSubs.length} submissions</span>
                            <span style={{ color: '#6ee7b7' }}><CheckCircle className="w-3 h-3 inline mr-0.5" />{taskSubs.filter(s => s.status === 'reviewed').length} reviewed</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingTask(task); setShowTaskModal(true); }}
                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-blue-400"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteTask(task)}
                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recent submissions in this group */}
              {groupSubs.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-300 mb-3">Recent Submissions</p>
                  <div className="space-y-2">
                    {groupSubs.slice(0, 8).map(sub => {
                      const task = groupTasks.find(t => t.id === sub.taskId);
                      return (
                        <div key={sub.id} style={cardStyle} className="flex items-center gap-3 p-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'var(--color-primary, #6366f1)' }}>
                            {sub.studentName[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-200">{sub.studentName}</span>
                            {task && <span className="text-xs text-gray-500 ml-2">{task.title}</span>}
                            <div className="text-xs text-gray-500">{fmtDate(sub.submittedAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{ background: subStatusBg(sub.status), color: subStatusColor(sub.status) }}>
                              {sub.isLate ? 'late' : sub.status}
                            </span>
                            {sub.grade !== undefined && task && (
                              <span className="text-xs font-bold text-blue-400">{sub.grade}/{task.points}</span>
                            )}
                            {task && (
                              <button onClick={() => setGradingData({ sub, task })}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                                style={{ background: sub.status === 'reviewed' ? 'rgba(255,255,255,0.08)' : 'var(--color-primary, #6366f1)' }}>
                                {sub.status === 'reviewed' ? 'Re-grade' : 'Grade'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Groups list ── */
            <div className="space-y-4">
              {/* Search + filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-white/20"
                    style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)', color: isLight ? '#374151' : '#e5e7eb' }}
                    placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {coursesInGroups.length > 0 && (
                  <select
                    className="rounded-xl px-3 py-2 text-sm border outline-none"
                    style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)', color: isLight ? '#374151' : '#e5e7eb', background: 'var(--color-surface, #1f2937)' }}
                    value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                    <option value="all">All Courses</option>
                    {coursesInGroups.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                )}
                {subjectsInGroups.length > 0 && (
                  <select
                    className="rounded-xl px-3 py-2 text-sm border outline-none"
                    style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)', color: isLight ? '#374151' : '#e5e7eb', background: 'var(--color-surface, #1f2937)' }}
                    value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                    <option value="all">All Subjects</option>
                    {subjectsInGroups.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <div className="flex items-center gap-1">
                  {(['all', 'draft', 'published', 'closed'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all"
                      style={inputBtnStyle(statusFilter === s)}>{s}</button>
                  ))}
                </div>
                <button onClick={() => load()} className="p-2 rounded-xl hover:bg-white/5 text-gray-400" title="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
              ) : filtered.length === 0 ? (
                <div style={cardStyle} className="p-16 text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 font-medium">No task groups yet</p>
                  <p className="text-gray-500 text-sm mt-1">Create your first group to start assigning tasks</p>
                  {canCreateTasks && (
                    <button onClick={() => setShowGroupModal(true)}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                      style={{ background: 'var(--color-primary, #6366f1)' }}>
                      <Plus className="w-4 h-4" /> Create Group
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map(group => {
                    const at = group.assignedTo;
                    const assignLabel = at.type === 'all' ? 'All Students'
                      : at.type === 'course' ? `Course: ${(at as any).courseName || 'Selected'}`
                      : at.type === 'class' ? `Class: ${(at as any).classGrade}`
                      : `${(at as any).studentIds?.length ?? 0} students`;
                    const overdue = new Date() > group.dueDate && group.status === 'published';

                    return (
                      <div key={group.id} style={cardStyle} className="flex flex-col hover:border-white/20 transition-all group">
                        <div className="p-4 flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColors[group.status] }} />
                              <span className="text-xs font-medium capitalize" style={{ color: statusColors[group.status] }}>{group.status}</span>
                              {overdue && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>Overdue</span>}
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingGroup(group); setShowGroupModal(true); }}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteGroup(group)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          <h3 className="font-semibold text-gray-100 mb-1 line-clamp-2">{group.title}</h3>
                          {group.description && <p className="text-xs text-gray-400 line-clamp-2 mb-3">{group.description}</p>}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                              <Layers className="w-3 h-3 inline mr-1" />{group.taskIds.length} tasks
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                              <Award className="w-3 h-3 inline mr-1" />{group.totalPoints} pts
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                              <Users className="w-3 h-3 inline mr-1" />{assignLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>Due: {fmtDate(group.dueDate)}</span>
                          </div>
                        </div>
                        <div className="px-4 pb-4 flex items-center gap-2">
                          <button onClick={() => loadDetail(group)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white transition-colors border"
                            style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)' }}>
                            <Eye className="w-3.5 h-3.5" /> View Tasks
                          </button>
                          {group.status === 'draft' && (
                            <button onClick={() => handlePublish(group)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white"
                              style={{ background: '#059669' }}>
                              <Unlock className="w-3.5 h-3.5" /> Publish
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── EVALUATE TAB ─────────────────────────────────────────────────────── */}
      {tab === 'evaluate' && (
        <div className="space-y-5">
          {/* Filters */}
          <div style={cardStyle} className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <SectionLabel>Task Group</SectionLabel>
                <select className="rounded-xl px-3 py-2 text-sm border bg-transparent outline-none min-w-48"
                  style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)', color: isLight ? '#374151' : '#e5e7eb', background: 'var(--color-surface, #1f2937)' }}
                  value={evalGroupId} onChange={e => setEvalGroupId(e.target.value)}>
                  <option value="">— Select group —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
              {evalTasks.length > 0 && (
                <div>
                  <SectionLabel>Task</SectionLabel>
                  <select className="rounded-xl px-3 py-2 text-sm border bg-transparent outline-none"
                    style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)', color: isLight ? '#374151' : '#e5e7eb', background: 'var(--color-surface, #1f2937)' }}
                    value={evalTaskFilter} onChange={e => setEvalTaskFilter(e.target.value)}>
                    <option value="all">All Tasks</option>
                    {evalTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <SectionLabel>Status</SectionLabel>
                <select className="rounded-xl px-3 py-2 text-sm border bg-transparent outline-none"
                  style={{ borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)', color: isLight ? '#374151' : '#e5e7eb', background: 'var(--color-surface, #1f2937)' }}
                  value={evalStatusFilter} onChange={e => setEvalStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="late">Late</option>
                  <option value="resubmitted">Resubmitted</option>
                  <option value="reviewed">Reviewed</option>
                </select>
              </div>
              <div className="ml-auto text-sm text-gray-400">{filteredEvalSubs.length} submission{filteredEvalSubs.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {/* Stats cards */}
          {evalSubs.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { l: 'Total', v: evalSubs.length, c: '#6366f1' },
                { l: 'Pending Review', v: evalSubs.filter(s => s.status !== 'reviewed').length, c: '#f59e0b' },
                { l: 'Reviewed', v: evalSubs.filter(s => s.status === 'reviewed').length, c: '#10b981' },
                { l: 'Late', v: evalSubs.filter(s => s.isLate).length, c: '#ef4444' },
              ].map(s => (
                <div key={s.l} style={cardStyle} className="p-4">
                  <p className="text-xs text-gray-400 mb-1">{s.l}</p>
                  <p className="text-2xl font-bold" style={{ color: s.c }}>{s.v}</p>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          {evalLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !evalGroupId ? (
            <div style={cardStyle} className="p-12 text-center text-gray-500">
              <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Select a task group to view submissions</p>
            </div>
          ) : filteredEvalSubs.length === 0 ? (
            <div style={cardStyle} className="p-12 text-center text-gray-500">
              <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No submissions found</p>
            </div>
          ) : (
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <tr>
                      {['Student', 'Task', 'Submitted', 'Status', 'Grade', 'Action'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvalSubs.map((sub, i) => {
                      const task = evalTasks.find(t => t.id === sub.taskId);
                      const taskMeta = task ? TASK_TYPES.find(t => t.type === task.type) : null;
                      const TIcon = taskMeta?.icon ?? FileText;
                      return (
                        <tr key={sub.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          className="hover:bg-white/2 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ background: 'var(--color-primary, #6366f1)' }}>
                                {sub.studentName[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="text-gray-200 font-medium text-xs">{sub.studentName}</p>
                                {sub.studentEmail && <p className="text-gray-500 text-xs">{sub.studentEmail}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {taskMeta && <TIcon className="w-3.5 h-3.5 shrink-0" style={{ color: taskMeta.color }} />}
                              <span className="text-xs text-gray-300">{task?.title ?? '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(sub.submittedAt)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{ background: subStatusBg(sub.status), color: subStatusColor(sub.status) }}>
                              {sub.isLate && sub.status !== 'reviewed' ? 'late' : sub.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {sub.grade !== undefined && task
                              ? <><span className="font-bold text-blue-400">{sub.grade}</span><span className="text-gray-500">/{task.points}</span></>
                              : <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {task && (
                              <button onClick={() => setGradingData({ sub, task })}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                                style={{ background: sub.status === 'reviewed' ? 'rgba(255,255,255,0.08)' : 'var(--color-primary, #6366f1)', color: sub.status === 'reviewed' ? '#9ca3af' : '#fff' }}>
                                {sub.status === 'reviewed' ? 'Re-grade' : 'Grade'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {showGroupModal && user && (
        <TaskGroupModal
          courses={creatableCourses} students={students}
          availableClasses={availableClasses}
          editGroup={editingGroup}
          teacherId={user.uid} teacherName={user.name ?? user.displayName ?? 'Teacher'}
          onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
          onSaved={handleGroupSaved}
        />
      )}

      {showTaskModal && selectedGroup && user && (
        <TaskModal
          groupId={selectedGroup.id} teacherId={user.uid}
          existingTasks={groupTasks} editTask={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSaved={handleTaskSaved}
        />
      )}

      {gradingData && user && (
        <GradingModal
          sub={gradingData.sub} task={gradingData.task}
          teacherId={user.uid} teacherName={user.name ?? user.displayName ?? 'Teacher'}
          onClose={() => setGradingData(null)}
          onGraded={async () => {
            setGradingData(null);
            if (selectedGroup) await loadDetail(selectedGroup);
            if (evalGroupId) await loadEval(evalGroupId);
          }}
        />
      )}
    </div>
  );
};

export default TeacherTaskManagement;
