// src/pages/TeacherTaskManagement.tsx
// Production-grade Teacher Task Management System
// Features: Task Groups, 7 Task Types, Grading/Evaluation, File Uploads, Stats

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Edit2, Trash2, Eye, ChevronDown, ChevronUp, ChevronRight,
  BookOpen, FolderOpen, ClipboardList, Beaker, MessageSquare, Users, Link2,
  GraduationCap, Calendar, Clock, Award, Target, AlertCircle, CheckCircle,
  XCircle, Loader2, Upload, X, FileText, Image, Video, Globe, Github,
  BarChart2, Star, Filter, RefreshCw, Send, ArrowLeft, ArrowRight,
  AlignLeft, Layers, Milestone, PlusCircle, Settings, Lock, Unlock,
  TrendingUp, Download, Paperclip, AlertTriangle, Info, Check, HelpCircle,
  ChevronLeft, MoreVertical, Copy, Archive,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import {
  taskService,
  TaskGroup,
  Task,
  Submission,
  TaskType,
  TaskGroupStatus,
  AssignmentScope,
  RubricItem,
  Milestone,
  TaskAttachment,
  RubricScore,
  TaskGroupStats,
} from '../services/taskService';
import { courseService } from '../services/courseService';

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_TYPE_META: Record<TaskType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  homework:       { label: 'Homework / Written',   icon: BookOpen,      color: 'text-blue-600',   bg: 'bg-blue-50' },
  project:        { label: 'Project / Capstone',   icon: FolderOpen,    color: 'text-purple-600', bg: 'bg-purple-50' },
  practical:      { label: 'Practical / Lab',      icon: Beaker,        color: 'text-green-600',  bg: 'bg-green-50' },
  discussion:     { label: 'Discussion / Reflect', icon: MessageSquare, color: 'text-amber-600',  bg: 'bg-amber-50' },
  peer_review:    { label: 'Peer Review',          icon: Users,         color: 'text-rose-600',   bg: 'bg-rose-50' },
  link_submission:{ label: 'Link Submission',      icon: Link2,         color: 'text-cyan-600',   bg: 'bg-cyan-50' },
  exam:           { label: 'Exam',                 icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
};

const STATUS_META: Record<TaskGroupStatus, { label: string; color: string; dot: string }> = {
  draft:     { label: 'Draft',     color: 'text-gray-500',  dot: 'bg-gray-400' },
  published: { label: 'Published', color: 'text-green-600', dot: 'bg-green-500' },
  closed:    { label: 'Closed',    color: 'text-red-500',   dot: 'bg-red-500' },
};

const FILE_FORMATS = ['pdf', 'docx', 'doc', 'pptx', 'xlsx', 'jpg', 'jpeg', 'png', 'zip', 'rar', 'mp4', 'mp3'];

// ─── Utility ──────────────────────────────────────────────────────────────────

const formatDate = (d: Date | null | undefined) => {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const uniqueId = () => Math.random().toString(36).slice(2, 9);

// ─── Sub-components ───────────────────────────────────────────────────────────

const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' | 'info' }> = ({ children, variant = 'default' }) => {
  const colors = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error:   'bg-red-100 text-red-700',
    info:    'bg-blue-100 text-blue-700',
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}>{children}</span>;
};

const Spinner = () => <Loader2 className="w-5 h-5 animate-spin" />;

const ProgressBar: React.FC<{ value: number; color?: string }> = ({ value, color = 'bg-blue-500' }) => (
  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

// ─── Rubric Builder ───────────────────────────────────────────────────────────

const RubricBuilder: React.FC<{
  rubric: RubricItem[];
  onChange: (rubric: RubricItem[]) => void;
}> = ({ rubric, onChange }) => {
  const add = () => onChange([...rubric, { id: uniqueId(), criterion: '', description: '', maxPoints: 10 }]);
  const remove = (id: string) => onChange(rubric.filter((r) => r.id !== id));
  const update = (id: string, field: keyof RubricItem, value: any) =>
    onChange(rubric.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Grading Rubric</span>
        <button onClick={add} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-3.5 h-3.5" /> Add Criterion
        </button>
      </div>
      {rubric.map((item) => (
        <div key={item.id} className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <input
            className="col-span-4 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Criterion (e.g., Code Quality)"
            value={item.criterion}
            onChange={(e) => update(item.id, 'criterion', e.target.value)}
          />
          <input
            className="col-span-5 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Description"
            value={item.description}
            onChange={(e) => update(item.id, 'description', e.target.value)}
          />
          <div className="col-span-2 flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={100}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={item.maxPoints}
              onChange={(e) => update(item.id, 'maxPoints', Number(e.target.value))}
            />
            <span className="text-xs text-gray-400">pts</span>
          </div>
          <button onClick={() => remove(item.id)} className="col-span-1 flex justify-center items-center text-gray-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {rubric.length > 0 && (
        <div className="text-right text-xs text-gray-500">
          Total: <strong>{rubric.reduce((s, r) => s + r.maxPoints, 0)} pts</strong>
        </div>
      )}
    </div>
  );
};

// ─── Milestone Builder ────────────────────────────────────────────────────────

const MilestoneBuilder: React.FC<{
  milestones: Milestone[];
  onChange: (milestones: Milestone[]) => void;
}> = ({ milestones, onChange }) => {
  const add = () => onChange([...milestones, { id: uniqueId(), title: '', description: '', dueDate: new Date(), order: milestones.length }]);
  const remove = (id: string) => onChange(milestones.filter((m) => m.id !== id));
  const update = (id: string, field: keyof Milestone, value: any) =>
    onChange(milestones.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Milestones</span>
        <button onClick={add} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium">
          <Plus className="w-3.5 h-3.5" /> Add Milestone
        </button>
      </div>
      {milestones.map((m, i) => (
        <div key={m.id} className="p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
            <input
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              placeholder="Milestone title"
              value={m.title}
              onChange={(e) => update(m.id, 'title', e.target.value)}
            />
            <input
              type="datetime-local"
              className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              value={m.dueDate instanceof Date ? m.dueDate.toISOString().slice(0, 16) : ''}
              onChange={(e) => update(m.id, 'dueDate', e.target.value ? new Date(e.target.value) : new Date())}
            />
            <button onClick={() => remove(m.id)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
          <input
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            placeholder="Milestone description (optional)"
            value={m.description}
            onChange={(e) => update(m.id, 'description', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
};

// ─── File Uploader ────────────────────────────────────────────────────────────

const FileUploader: React.FC<{
  files: TaskAttachment[];
  onAdd: (files: TaskAttachment[]) => void;
  onRemove: (idx: number) => void;
  label?: string;
  accept?: string;
  isUploading?: boolean;
  bucket?: 'teacher' | 'student';
  folder?: string;
}> = ({ files, onAdd, onRemove, label = 'Attach files', accept, isUploading, bucket = 'teacher', folder = 'general' }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return;
    setUploading(true);
    const newAttachments: TaskAttachment[] = [];
    for (const file of Array.from(selectedFiles)) {
      try {
        const uploaded = bucket === 'teacher'
          ? await taskService.uploadTeacherFile(file, folder, (pct) => setUploadProgress((p) => ({ ...p, [file.name]: pct })))
          : await taskService.uploadStudentFile(file, folder, (pct) => setUploadProgress((p) => ({ ...p, [file.name]: pct })));
        newAttachments.push(uploaded);
      } catch (e: any) {
        alert(`Failed to upload ${file.name}: ${e.message}`);
      }
    }
    setUploading(false);
    setUploadProgress({});
    if (newAttachments.length) onAdd(newAttachments);
  };

  return (
    <div className="space-y-2">
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <Upload className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500">{label}</span>
          <span className="text-xs text-gray-400">Click or drag & drop</span>
        </div>
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* Upload progress */}
      {Object.entries(uploadProgress).map(([name, pct]) => (
        <div key={name} className="p-2 bg-blue-50 rounded-lg text-xs">
          <div className="flex justify-between mb-1"><span className="truncate">{name}</span><span>{pct}%</span></div>
          <ProgressBar value={pct} />
        </div>
      ))}

      {/* Uploaded files */}
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 group">
          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm truncate block">{f.name}</span>
            {f.size && <span className="text-xs text-gray-400">{formatBytes(f.size)}</span>}
          </div>
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100">
            <Eye className="w-4 h-4" />
          </a>
          <button onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Task Form Modal ──────────────────────────────────────────────────────────

interface TaskFormState {
  title: string;
  description: string;
  type: TaskType;
  points: number;
  order: number;
  rubric: RubricItem[];
  gradingCriteria: string;
  attachments: TaskAttachment[];
  allowResubmission: boolean;
  maxSubmissions: number;
  // Homework
  allowedFormats: string[];
  maxFileSizeMB: number;
  allowRichText: boolean;
  // Project
  milestones: Milestone[];
  allowLinks: boolean;
  allowedLinkTypes: string[];
  stepBasedSubmission: boolean;
  // Practical
  experimentSteps: string[];
  requiredSubmissionTypes: string[];
  // Discussion
  prompt: string;
  wordLimit: number;
  allowPeerComments: boolean;
  // Peer Review
  sourceTaskId: string;
  peersToReview: number;
  anonymous: boolean;
  reviewDeadlineStr: string;
  // Link
  validateLinks: boolean;
  // Exam
  contentId: string;
  examTitle: string;
}

const defaultTaskForm = (): TaskFormState => ({
  title: '', description: '', type: 'homework', points: 10, order: 0,
  rubric: [], gradingCriteria: '', attachments: [], allowResubmission: false, maxSubmissions: 1,
  allowedFormats: ['pdf', 'docx'], maxFileSizeMB: 10, allowRichText: true,
  milestones: [], allowLinks: true, allowedLinkTypes: ['github', 'website'], stepBasedSubmission: false,
  experimentSteps: [], requiredSubmissionTypes: ['image', 'file'],
  prompt: '', wordLimit: 500, allowPeerComments: true,
  sourceTaskId: '', peersToReview: 2, anonymous: false, reviewDeadlineStr: '',
  validateLinks: true,
  contentId: '', examTitle: '',
});

const TaskFormModal: React.FC<{
  groupId: string;
  teacherId: string;
  existingTasks: Task[];
  editTask?: Task | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ groupId, teacherId, existingTasks, editTask, onClose, onSaved }) => {
  const [form, setForm] = useState<TaskFormState>(() => {
    if (editTask) {
      return {
        title: editTask.title,
        description: editTask.description,
        type: editTask.type,
        points: editTask.points,
        order: editTask.order,
        rubric: editTask.rubric ?? [],
        gradingCriteria: editTask.gradingCriteria ?? '',
        attachments: editTask.attachments ?? [],
        allowResubmission: editTask.allowResubmission ?? false,
        maxSubmissions: editTask.maxSubmissions ?? 1,
        allowedFormats: editTask.allowedFormats ?? ['pdf', 'docx'],
        maxFileSizeMB: editTask.maxFileSizeMB ?? 10,
        allowRichText: editTask.allowRichText ?? true,
        milestones: editTask.milestones ?? [],
        allowLinks: editTask.allowLinks ?? true,
        allowedLinkTypes: editTask.allowedLinkTypes ?? [],
        stepBasedSubmission: editTask.stepBasedSubmission ?? false,
        experimentSteps: editTask.experimentSteps ?? [],
        requiredSubmissionTypes: editTask.requiredSubmissionTypes ?? [],
        prompt: editTask.prompt ?? '',
        wordLimit: editTask.wordLimit ?? 500,
        allowPeerComments: editTask.allowPeerComments ?? true,
        sourceTaskId: editTask.sourceTaskId ?? '',
        peersToReview: editTask.peersToReview ?? 2,
        anonymous: editTask.anonymous ?? false,
        reviewDeadlineStr: editTask.reviewDeadline ? editTask.reviewDeadline.toISOString().slice(0, 16) : '',
        validateLinks: editTask.validateLinks ?? true,
        contentId: editTask.contentId ?? '',
        examTitle: editTask.examTitle ?? '',
      };
    }
    return { ...defaultTaskForm(), order: existingTasks.length };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof TaskFormState>(k: K, v: TaskFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleFormat = (fmt: string) =>
    set('allowedFormats', form.allowedFormats.includes(fmt)
      ? form.allowedFormats.filter((f) => f !== fmt)
      : [...form.allowedFormats, fmt]);

  const toggleSubType = (t: string) =>
    set('requiredSubmissionTypes', form.requiredSubmissionTypes.includes(t)
      ? form.requiredSubmissionTypes.filter((f) => f !== t)
      : [...form.requiredSubmissionTypes, t]);

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
        taskGroupId: groupId,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        points: form.points,
        order: form.order,
        teacherId,
        rubric: form.rubric.filter((r) => r.criterion),
        gradingCriteria: form.gradingCriteria,
        attachments: form.attachments,
        allowResubmission: form.allowResubmission,
        maxSubmissions: form.allowResubmission ? form.maxSubmissions : 1,
        allowedFormats: form.allowedFormats,
        maxFileSizeMB: form.maxFileSizeMB,
        allowRichText: form.allowRichText,
        milestones: form.milestones.filter((m) => m.title),
        allowLinks: form.allowLinks,
        allowedLinkTypes: form.allowedLinkTypes,
        stepBasedSubmission: form.stepBasedSubmission,
        experimentSteps: form.experimentSteps.filter(Boolean),
        requiredSubmissionTypes: form.requiredSubmissionTypes,
        prompt: form.prompt,
        wordLimit: form.wordLimit,
        allowPeerComments: form.allowPeerComments,
        sourceTaskId: form.sourceTaskId,
        peersToReview: form.peersToReview,
        anonymous: form.anonymous,
        reviewDeadline: form.reviewDeadlineStr ? new Date(form.reviewDeadlineStr) : undefined,
        validateLinks: form.validateLinks,
        contentId: form.contentId,
        examTitle: form.examTitle,
      };
      if (editTask) {
        await taskService.updateTask(editTask.id, payload);
      } else {
        await taskService.createTask(payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const TypeIcon = TASK_TYPE_META[form.type].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${TASK_TYPE_META[form.type].bg} flex items-center justify-center`}>
              <TypeIcon className={`w-5 h-5 ${TASK_TYPE_META[form.type].color}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editTask ? 'Edit Task' : 'Create Task'}</h2>
              <p className="text-sm text-gray-500">{TASK_TYPE_META[form.type].label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Task Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Task Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(TASK_TYPE_META) as [TaskType, typeof TASK_TYPE_META[TaskType]][]).map(([type, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    onClick={() => set('type', type)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                      form.type === type ? `${meta.bg} border-current ${meta.color}` : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {meta.label.split('/')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description / Instructions</label>
              <textarea
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Describe the task in detail..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Points</label>
              <input
                type="number" min={0} max={1000}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.points}
                onChange={(e) => set('points', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Order</label>
              <input
                type="number" min={0}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.order}
                onChange={(e) => set('order', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Type-specific fields */}
          {form.type === 'homework' && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-xl">
              <h4 className="text-sm font-semibold text-blue-800">Homework Settings</h4>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Allowed File Formats</label>
                <div className="flex flex-wrap gap-2">
                  {FILE_FORMATS.map((fmt) => (
                    <button key={fmt} onClick={() => toggleFormat(fmt)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      form.allowedFormats.includes(fmt) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>.{fmt}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Max File Size (MB)</label>
                  <input type="number" min={1} max={500} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form.maxFileSizeMB} onChange={(e) => set('maxFileSizeMB', Number(e.target.value))} />
                </div>
                <div className="flex flex-col gap-2 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={form.allowRichText} onChange={(e) => set('allowRichText', e.target.checked)} />
                    <span className="text-sm text-gray-700">Allow rich text answer</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {form.type === 'project' && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-xl">
              <h4 className="text-sm font-semibold text-purple-800">Project Settings</h4>
              <MilestoneBuilder milestones={form.milestones} onChange={(m) => set('milestones', m)} />
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded text-purple-600" checked={form.allowLinks} onChange={(e) => set('allowLinks', e.target.checked)} />
                  <span className="text-sm text-gray-700">Allow external links</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded text-purple-600" checked={form.stepBasedSubmission} onChange={(e) => set('stepBasedSubmission', e.target.checked)} />
                  <span className="text-sm text-gray-700">Step-based submission</span>
                </label>
              </div>
              {form.allowLinks && (
                <div className="flex gap-2">
                  {['github', 'website', 'gdrive', 'portfolio'].map((l) => (
                    <button key={l} onClick={() => set('allowedLinkTypes', form.allowedLinkTypes.includes(l) ? form.allowedLinkTypes.filter((x) => x !== l) : [...form.allowedLinkTypes, l])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.allowedLinkTypes.includes(l) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.type === 'practical' && (
            <div className="space-y-4 p-4 bg-green-50 rounded-xl">
              <h4 className="text-sm font-semibold text-green-800">Practical / Lab Settings</h4>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Experiment Steps</label>
                {form.experimentSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <span className="w-5 h-7 text-xs text-green-700 font-bold flex items-center">{i + 1}.</span>
                    <input className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                      value={step} onChange={(e) => { const s = [...form.experimentSteps]; s[i] = e.target.value; set('experimentSteps', s); }} />
                    <button onClick={() => set('experimentSteps', form.experimentSteps.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => set('experimentSteps', [...form.experimentSteps, ''])} className="text-xs text-green-700 font-medium hover:underline">+ Add Step</button>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Required Submission Types</label>
                <div className="flex gap-2 flex-wrap">
                  {['image', 'video', 'file', 'screenshot'].map((t) => (
                    <button key={t} onClick={() => toggleSubType(t)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      form.requiredSubmissionTypes.includes(t) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {form.type === 'discussion' && (
            <div className="space-y-4 p-4 bg-amber-50 rounded-xl">
              <h4 className="text-sm font-semibold text-amber-800">Discussion Settings</h4>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Discussion Prompt</label>
                <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Enter the discussion prompt or reflection question..."
                  value={form.prompt} onChange={(e) => set('prompt', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Word Limit (0 = unlimited)</label>
                  <input type="number" min={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={form.wordLimit} onChange={(e) => set('wordLimit', Number(e.target.value))} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded text-amber-600" checked={form.allowPeerComments} onChange={(e) => set('allowPeerComments', e.target.checked)} />
                    <span className="text-sm text-gray-700">Enable peer comments</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {form.type === 'peer_review' && (
            <div className="space-y-4 p-4 bg-rose-50 rounded-xl">
              <h4 className="text-sm font-semibold text-rose-800">Peer Review Settings</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Source Task (to review)</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={form.sourceTaskId} onChange={(e) => set('sourceTaskId', e.target.value)}>
                    <option value="">— Select task —</option>
                    {existingTasks.filter((t) => t.type !== 'peer_review').map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Peers to Review</label>
                  <input type="number" min={1} max={10} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={form.peersToReview} onChange={(e) => set('peersToReview', Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Review Deadline</label>
                  <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                    value={form.reviewDeadlineStr} onChange={(e) => set('reviewDeadlineStr', e.target.value)} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded text-rose-600" checked={form.anonymous} onChange={(e) => set('anonymous', e.target.checked)} />
                    <span className="text-sm text-gray-700">Anonymous reviewers</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {form.type === 'link_submission' && (
            <div className="space-y-4 p-4 bg-cyan-50 rounded-xl">
              <h4 className="text-sm font-semibold text-cyan-800">Link Submission Settings</h4>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Allowed Link Types</label>
                <div className="flex gap-2 flex-wrap">
                  {['github', 'gdrive', 'website', 'youtube', 'figma', 'notion'].map((l) => (
                    <button key={l} onClick={() => set('allowedLinkTypes', form.allowedLinkTypes.includes(l) ? form.allowedLinkTypes.filter((x) => x !== l) : [...form.allowedLinkTypes, l])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.allowedLinkTypes.includes(l) ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-cyan-600" checked={form.validateLinks} onChange={(e) => set('validateLinks', e.target.checked)} />
                <span className="text-sm text-gray-700">Validate link URL format</span>
              </label>
            </div>
          )}

          {form.type === 'exam' && (
            <div className="space-y-4 p-4 bg-indigo-50 rounded-xl">
              <h4 className="text-sm font-semibold text-indigo-800">Exam Settings</h4>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Content ID (from Content Library)</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Enter the exam content ID..."
                  value={form.contentId} onChange={(e) => set('contentId', e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">Students will be directed to the ExamViewer for this content.</p>
              </div>
            </div>
          )}

          {/* Resubmission */}
          {form.type !== 'exam' && (
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-blue-600" checked={form.allowResubmission} onChange={(e) => set('allowResubmission', e.target.checked)} />
                <span className="text-sm font-medium text-gray-700">Allow resubmissions / revisions</span>
              </label>
              {form.allowResubmission && (
                <div className="ml-6">
                  <label className="text-sm text-gray-600 mb-1 block">Maximum attempts</label>
                  <input type="number" min={2} max={10} className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form.maxSubmissions} onChange={(e) => set('maxSubmissions', Number(e.target.value))} />
                </div>
              )}
            </div>
          )}

          {/* Rubric */}
          <RubricBuilder rubric={form.rubric} onChange={(r) => set('rubric', r)} />

          {/* Grading notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Grading Criteria / Notes</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Additional grading notes for evaluators..."
              value={form.gradingCriteria} onChange={(e) => set('gradingCriteria', e.target.value)} />
          </div>

          {/* Reference attachments */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Reference Files (private — for students to download)</label>
            <FileUploader
              files={form.attachments}
              onAdd={(newFiles) => set('attachments', [...form.attachments, ...newFiles])}
              onRemove={(i) => set('attachments', form.attachments.filter((_, idx) => idx !== i))}
              label="Upload reference / template files"
              bucket="teacher"
              folder={groupId}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
            {saving ? <><Spinner /> Saving...</> : <><Check className="w-4 h-4" />{editTask ? 'Update Task' : 'Create Task'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Task Group Form Modal ────────────────────────────────────────────────────

interface GroupFormState {
  title: string;
  description: string;
  assignType: 'all' | 'course' | 'class' | 'students';
  courseId: string;
  courseName: string;
  classId: string;
  className: string;
  studentIds: string;
  dueDateStr: string;
  startDateStr: string;
  lateSubmissionAllowed: boolean;
  lateDeadlineStr: string;
  status: TaskGroupStatus;
}

const TaskGroupFormModal: React.FC<{
  courses: { id: string; name: string }[];
  editGroup?: TaskGroup | null;
  teacherId: string;
  teacherName: string;
  onClose: () => void;
  onSaved: (groupId: string) => void;
}> = ({ courses, editGroup, teacherId, teacherName, onClose, onSaved }) => {
  const [form, setForm] = useState<GroupFormState>(() => {
    if (editGroup) {
      const at = editGroup.assignedTo;
      return {
        title: editGroup.title,
        description: editGroup.description,
        assignType: at.type,
        courseId: at.type === 'course' ? at.courseId : '',
        courseName: at.type === 'course' ? (at.courseName ?? '') : '',
        classId: at.type === 'class' ? at.classId : '',
        className: at.type === 'class' ? (at.className ?? '') : '',
        studentIds: at.type === 'students' ? (at.studentIds ?? []).join(', ') : '',
        dueDateStr: editGroup.dueDate.toISOString().slice(0, 16),
        startDateStr: editGroup.startDate ? editGroup.startDate.toISOString().slice(0, 16) : '',
        lateSubmissionAllowed: editGroup.lateSubmissionAllowed,
        lateDeadlineStr: editGroup.lateSubmissionDeadline ? editGroup.lateSubmissionDeadline.toISOString().slice(0, 16) : '',
        status: editGroup.status,
      };
    }
    return {
      title: '', description: '', assignType: 'all', courseId: '', courseName: '',
      classId: '', className: '', studentIds: '',
      dueDateStr: '', startDateStr: '', lateSubmissionAllowed: false, lateDeadlineStr: '',
      status: 'draft',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof GroupFormState>(k: K, v: GroupFormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const buildAssignedTo = (): AssignmentScope => {
    if (form.assignType === 'course') return { type: 'course', courseId: form.courseId, courseName: form.courseName };
    if (form.assignType === 'class') return { type: 'class', classId: form.classId, className: form.className };
    if (form.assignType === 'students') return { type: 'students', studentIds: form.studentIds.split(',').map((s) => s.trim()).filter(Boolean) };
    return { type: 'all' };
  };

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.dueDateStr) { setError('Due date is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        teacherId,
        teacherName,
        assignedTo: buildAssignedTo(),
        dueDate: new Date(form.dueDateStr),
        lateSubmissionAllowed: form.lateSubmissionAllowed,
        lateSubmissionDeadline: form.lateSubmissionAllowed && form.lateDeadlineStr ? new Date(form.lateDeadlineStr) : undefined,
        startDate: form.startDateStr ? new Date(form.startDateStr) : undefined,
        status: form.status,
      };
      if (editGroup) {
        await taskService.updateTaskGroup(editGroup.id, payload);
        onSaved(editGroup.id);
      } else {
        const id = await taskService.createTaskGroup(payload);
        onSaved(id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{editGroup ? 'Edit Task Group' : 'Create Task Group'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Group Title *</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Week 3 Assignment Bundle" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe this task group..." value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          {/* Assignment Scope */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Assign To</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {(['all', 'course', 'class', 'students'] as const).map((t) => (
                <button key={t} onClick={() => set('assignType', t)} className={`py-2 rounded-xl text-xs font-medium border-2 transition-all capitalize ${
                  form.assignType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {t === 'all' ? 'Everyone' : t}
                </button>
              ))}
            </div>
            {form.assignType === 'course' && (
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.courseId} onChange={(e) => { const c = courses.find((x) => x.id === e.target.value); set('courseId', e.target.value); if (c) set('courseName', c.name); }}>
                <option value="">— Select Course —</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {form.assignType === 'class' && (
              <div className="grid grid-cols-2 gap-2">
                <input className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Class ID" value={form.classId} onChange={(e) => set('classId', e.target.value)} />
                <input className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Class Name" value={form.className} onChange={(e) => set('className', e.target.value)} />
              </div>
            )}
            {form.assignType === 'students' && (
              <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Student UIDs (comma-separated)" value={form.studentIds} onChange={(e) => set('studentIds', e.target.value)} />
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Available From</label>
              <input type="datetime-local" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.startDateStr} onChange={(e) => set('startDateStr', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Due Date *</label>
              <input type="datetime-local" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.dueDateStr} onChange={(e) => set('dueDateStr', e.target.value)} />
            </div>
          </div>

          {/* Late submission */}
          <div className="space-y-3 p-4 bg-amber-50 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-amber-600" checked={form.lateSubmissionAllowed} onChange={(e) => set('lateSubmissionAllowed', e.target.checked)} />
              <span className="text-sm font-medium text-gray-700">Allow late submissions</span>
            </label>
            {form.lateSubmissionAllowed && (
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Late Submission Deadline</label>
                <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.lateDeadlineStr} onChange={(e) => set('lateDeadlineStr', e.target.value)} />
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
            <div className="flex gap-2">
              {(['draft', 'published', 'closed'] as TaskGroupStatus[]).map((s) => (
                <button key={s} onClick={() => set('status', s)} className={`px-4 py-2 rounded-xl text-sm font-medium border-2 capitalize transition-all ${
                  form.status === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? <><Spinner /> Saving...</> : <><Check className="w-4 h-4" />{editGroup ? 'Update' : 'Create Group'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Grading Modal ────────────────────────────────────────────────────────────

const GradingModal: React.FC<{
  submission: Submission;
  task: Task;
  teacherId: string;
  teacherName: string;
  onClose: () => void;
  onGraded: () => void;
}> = ({ submission, task, teacherId, teacherName, onClose, onGraded }) => {
  const [grade, setGrade] = useState(submission.grade ?? 0);
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [feedbackFiles, setFeedbackFiles] = useState<TaskAttachment[]>(submission.feedbackFiles ?? []);
  const [rubricScores, setRubricScores] = useState<RubricScore[]>(() =>
    (task.rubric ?? []).map((r) => ({
      criterion: r.criterion,
      maxPoints: r.maxPoints,
      score: submission.rubricScores?.find((s) => s.criterion === r.criterion)?.score ?? 0,
      comment: submission.rubricScores?.find((s) => s.criterion === r.criterion)?.comment ?? '',
    }))
  );
  const [saving, setSaving] = useState(false);

  const rubricTotal = rubricScores.reduce((s, r) => s + r.score, 0);

  useEffect(() => {
    if (task.rubric?.length) setGrade(Math.min(rubricTotal, task.points));
  }, [rubricScores]);

  const save = async () => {
    setSaving(true);
    try {
      await taskService.gradeSubmission(submission.id, { grade, feedback, feedbackFiles, rubricScores, gradedBy: teacherId, gradedByName: teacherName });
      onGraded();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'reviewed') return <Badge variant="success">Reviewed</Badge>;
    if (s === 'late') return <Badge variant="warning">Late</Badge>;
    return <Badge>Submitted</Badge>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Grade Submission</h2>
            <p className="text-sm text-gray-500 mt-0.5">{submission.studentName} — {task.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(submission.status)}
            {submission.isLate && <Badge variant="warning">Late</Badge>}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Submission content */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Submission Content</h3>
            {submission.textContent && (
              <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-100" dangerouslySetInnerHTML={{ __html: submission.textContent }} />
            )}
            {submission.discussionText && <p className="text-sm text-gray-700">{submission.discussionText}</p>}
            {submission.files?.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-blue-300 text-sm text-blue-600">
                <Paperclip className="w-4 h-4" />{f.name} {f.size && <span className="text-gray-400 text-xs">({formatBytes(f.size)})</span>}
              </a>
            ))}
            {submission.links?.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-blue-300 text-sm text-blue-600">
                <Link2 className="w-4 h-4" />{l.label || l.url}
              </a>
            ))}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Submitted: {formatDate(submission.submittedAt)}</span>
              <span>Attempt #{submission.attemptNumber}</span>
            </div>
          </div>

          {/* Rubric scoring */}
          {task.rubric && task.rubric.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Rubric Scoring</h3>
              {rubricScores.map((rs, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{rs.criterion}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={rs.maxPoints} className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={rs.score} onChange={(e) => setRubricScores((s) => s.map((x, j) => j === i ? { ...x, score: Math.min(Number(e.target.value), x.maxPoints) } : x))} />
                      <span className="text-xs text-gray-400">/ {rs.maxPoints}</span>
                    </div>
                  </div>
                  <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Comment (optional)"
                    value={rs.comment ?? ''} onChange={(e) => setRubricScores((s) => s.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))} />
                </div>
              ))}
              <div className="text-sm text-right text-gray-600">Rubric Total: <strong>{rubricTotal}</strong> / {task.rubric.reduce((s, r) => s + r.maxPoints, 0)}</div>
            </div>
          )}

          {/* Final grade */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Final Grade</label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={task.points} className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center font-bold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={grade} onChange={(e) => setGrade(Math.min(Number(e.target.value), task.points))} />
                <span className="text-gray-500">/ {task.points} points</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-700">{task.points ? Math.round((grade / task.points) * 100) : 0}%</div>
          </div>

          {/* Feedback */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Feedback to Student</label>
            <textarea rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Write detailed feedback..."
              value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>

          {/* Feedback files */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Feedback Attachments</label>
            <FileUploader
              files={feedbackFiles}
              onAdd={(f) => setFeedbackFiles((x) => [...x, ...f])}
              onRemove={(i) => setFeedbackFiles((x) => x.filter((_, j) => j !== i))}
              label="Attach annotated files / feedback"
              bucket="teacher"
              folder="feedback"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? <><Spinner /> Saving...</> : <><Award className="w-4 h-4" /> Submit Grade</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Group Card ───────────────────────────────────────────────────────────────

const GroupCard: React.FC<{
  group: TaskGroup;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  onPublish: () => void;
}> = ({ group, onEdit, onDelete, onView, onPublish }) => {
  const meta = STATUS_META[group.status];
  const overdue = new Date() > group.dueDate;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
            <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
            {overdue && group.status === 'published' && <Badge variant="error">Overdue</Badge>}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit"><Edit2 className="w-3.5 h-3.5 text-gray-500" /></button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{group.title}</h3>
        {group.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{group.description}</p>}

        <div className="flex flex-wrap gap-2 mb-3">
          {group.taskIds.length > 0 && <Badge><Layers className="w-3 h-3" />{group.taskIds.length} tasks</Badge>}
          <Badge><Award className="w-3 h-3" />{group.totalPoints} pts</Badge>
          <Badge variant={group.assignedTo.type === 'all' ? 'info' : 'default'}>
            {group.assignedTo.type === 'all' ? 'All Students' :
             group.assignedTo.type === 'course' ? `Course: ${(group.assignedTo as any).courseName || (group.assignedTo as any).courseId}` :
             group.assignedTo.type === 'class' ? `Class: ${(group.assignedTo as any).className || (group.assignedTo as any).classId}` :
             `${(group.assignedTo as any).studentIds?.length ?? 0} students`}
          </Badge>
        </div>

        <div className="text-xs text-gray-400 flex items-center gap-1 mb-4">
          <Calendar className="w-3.5 h-3.5" />
          Due: {formatDate(group.dueDate)}
          {group.lateSubmissionAllowed && group.lateSubmissionDeadline && (
            <span className="ml-1">(Late until {formatDate(group.lateSubmissionDeadline)})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onView} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-xl transition-colors">
            <Eye className="w-4 h-4" /> View Tasks
          </button>
          {group.status === 'draft' && (
            <button onClick={onPublish} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded-xl transition-colors">
              <Unlock className="w-4 h-4" /> Publish
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Stats Panel ──────────────────────────────────────────────────────────────

const StatsPanel: React.FC<{ stats: TaskGroupStats }> = ({ stats }) => (
  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-gray-50 rounded-2xl">
    {[
      { label: 'Submitted', value: stats.submitted, total: stats.totalStudents, color: 'text-blue-600' },
      { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
      { label: 'Late', value: stats.late, color: 'text-red-600' },
      { label: 'Reviewed', value: stats.reviewed, color: 'text-green-600' },
    ].map((s) => (
      <div key={s.label} className="text-center">
        <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
        <div className="text-xs text-gray-500">{s.label}</div>
        {s.total && <ProgressBar value={(s.value / s.total) * 100} />}
      </div>
    ))}
    <div className="text-center">
      <div className="text-2xl font-bold text-indigo-600">{stats.averageScore?.toFixed(1) ?? '—'}</div>
      <div className="text-xs text-gray-500">Avg Score</div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

type TabKey = 'manage' | 'evaluate';

const TeacherTaskManagement: React.FC = () => {
  const { user } = useDashboard();

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('manage');
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskGroupStatus>('all');

  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Expanded group detail view
  const [selectedGroup, setSelectedGroup] = useState<TaskGroup | null>(null);
  const [groupTasks, setGroupTasks] = useState<Task[]>([]);
  const [groupSubmissions, setGroupSubmissions] = useState<Submission[]>([]);
  const [groupStats, setGroupStats] = useState<TaskGroupStats | null>(null);
  const [loadingGroupDetail, setLoadingGroupDetail] = useState(false);

  // Grading
  const [gradingSubmission, setGradingSubmission] = useState<{ sub: Submission; task: Task } | null>(null);

  // Evaluate tab
  const [evalGroupId, setEvalGroupId] = useState<string>('');
  const [evalTaskFilter, setEvalTaskFilter] = useState<string>('all');
  const [evalStatusFilter, setEvalStatusFilter] = useState<string>('all');
  const [evalSubmissions, setEvalSubmissions] = useState<Submission[]>([]);
  const [evalTasks, setEvalTasks] = useState<Task[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [fetchedGroups, fetchedCourses] = await Promise.all([
        taskService.getTaskGroupsByTeacher(user.uid),
        courseService.getCourses().catch(() => []),
      ]);
      setGroups(fetchedGroups);
      setCourses(fetchedCourses.map((c: any) => ({ id: c.id, name: c.name || c.title || c.id })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadGroupDetail = useCallback(async (group: TaskGroup) => {
    setLoadingGroupDetail(true);
    setSelectedGroup(group);
    try {
      const [tasks, subs] = await Promise.all([
        taskService.getTasksByGroup(group.id),
        taskService.getGroupSubmissions(group.id),
      ]);
      setGroupTasks(tasks);
      setGroupSubmissions(subs);
      const stats = await taskService.getTaskGroupStats(group.id, 50); // TODO: get actual student count
      setGroupStats(stats);
    } finally {
      setLoadingGroupDetail(false);
    }
  }, []);

  const loadEvaluation = useCallback(async (groupId: string) => {
    if (!groupId) return;
    setEvalLoading(true);
    try {
      const [tasks, subs] = await Promise.all([
        taskService.getTasksByGroup(groupId),
        taskService.getGroupSubmissions(groupId),
      ]);
      setEvalTasks(tasks);
      setEvalSubmissions(subs);
    } finally {
      setEvalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'evaluate' && groups.length > 0 && !evalGroupId) {
      setEvalGroupId(groups[0].id);
      loadEvaluation(groups[0].id);
    }
  }, [activeTab, groups]);

  useEffect(() => {
    if (evalGroupId) loadEvaluation(evalGroupId);
  }, [evalGroupId]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleGroupSaved = async (groupId: string) => {
    setShowGroupModal(false);
    setEditingGroup(null);
    await loadData();
    // Re-select if we were viewing it
    if (selectedGroup?.id === groupId) {
      const updated = await taskService.getTaskGroupById(groupId);
      if (updated) loadGroupDetail(updated);
    }
  };

  const handleTaskSaved = async () => {
    setShowTaskModal(false);
    setEditingTask(null);
    if (selectedGroup) await loadGroupDetail(selectedGroup);
    await loadData();
  };

  const handleDeleteGroup = async (group: TaskGroup) => {
    if (!confirm(`Delete "${group.title}" and all its tasks? This cannot be undone.`)) return;
    try {
      await taskService.deleteTaskGroup(group.id);
      if (selectedGroup?.id === group.id) setSelectedGroup(null);
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    try {
      await taskService.deleteTask(task.id);
      if (selectedGroup) await loadGroupDetail(selectedGroup);
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handlePublish = async (group: TaskGroup) => {
    try {
      await taskService.publishTaskGroup(group.id);
      await loadData();
      if (selectedGroup?.id === group.id) {
        const updated = await taskService.getTaskGroupById(group.id);
        if (updated) setSelectedGroup(updated);
      }
    } catch (e: any) { alert(e.message); }
  };

  // ── Filtered data ─────────────────────────────────────────────────────────────

  const filteredGroups = groups.filter((g) => {
    const matchSearch = g.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || g.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredEvalSubmissions = evalSubmissions.filter((s) => {
    const matchTask = evalTaskFilter === 'all' || s.taskId === evalTaskFilter;
    const matchStatus = evalStatusFilter === 'all' || s.status === evalStatusFilter;
    return matchTask && matchStatus;
  });

  // ── Submission status helper ──────────────────────────────────────────────────

  const subStatusColor = (status: string) => {
    if (status === 'reviewed') return 'bg-green-100 text-green-700';
    if (status === 'late') return 'bg-amber-100 text-amber-700';
    if (status === 'submitted' || status === 'resubmitted') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create, manage, and evaluate student tasks</p>
          </div>
          {activeTab === 'manage' && (
            <button
              onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> New Task Group
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-100 shadow-sm w-fit">
          {(['manage', 'evaluate'] as TabKey[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
              {tab === 'manage' ? <Layers className="w-4 h-4" /> : <Award className="w-4 h-4" />}
              {tab === 'manage' ? 'Manage Tasks' : 'Evaluate'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0" />{error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── MANAGE TAB ──────────────────────────────────────────────────────── */}

        {activeTab === 'manage' && (
          <div className="space-y-6">
            {selectedGroup ? (
              /* Group Detail View */
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedGroup(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">{selectedGroup.title}</h2>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        selectedGroup.status === 'published' ? 'bg-green-100 text-green-700' :
                        selectedGroup.status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[selectedGroup.status].dot}`} />
                        {STATUS_META[selectedGroup.status].label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedGroup.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingGroup(selectedGroup); setShowGroupModal(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium">
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    {selectedGroup.status === 'draft' && (
                      <button onClick={() => handlePublish(selectedGroup)} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium">
                        <Unlock className="w-4 h-4" /> Publish
                      </button>
                    )}
                    <button onClick={() => { setEditingTask(null); setShowTaskModal(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
                      <Plus className="w-4 h-4" /> Add Task
                    </button>
                  </div>
                </div>

                {/* Stats */}
                {groupStats && <StatsPanel stats={groupStats} />}

                {/* Tasks List */}
                {loadingGroupDetail ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : groupTasks.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tasks yet. Add your first task!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupTasks.map((task, idx) => {
                      const meta = TASK_TYPE_META[task.type];
                      const TaskIcon = meta.icon;
                      const taskSubs = groupSubmissions.filter((s) => s.taskId === task.id);
                      const reviewed = taskSubs.filter((s) => s.status === 'reviewed').length;
                      return (
                        <div key={task.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 group hover:shadow-md transition-all">
                          <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
                            <TaskIcon className={`w-5 h-5 ${meta.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-gray-400">#{idx + 1}</span>
                              <h4 className="font-semibold text-gray-900 truncate">{task.title}</h4>
                              <Badge>{meta.label.split('/')[0].trim()}</Badge>
                            </div>
                            <p className="text-sm text-gray-500 truncate">{task.description}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span><Award className="w-3 h-3 inline mr-0.5" />{task.points} pts</span>
                              <span><Send className="w-3 h-3 inline mr-0.5" />{taskSubs.length} submissions</span>
                              <span><CheckCircle className="w-3 h-3 inline mr-0.5 text-green-500" />{reviewed} reviewed</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingTask(task); setShowTaskModal(true); }} className="p-2 hover:bg-blue-50 rounded-xl" title="Edit">
                              <Edit2 className="w-4 h-4 text-blue-600" />
                            </button>
                            <button onClick={() => handleDeleteTask(task)} className="p-2 hover:bg-red-50 rounded-xl" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent Submissions in this group */}
                {groupSubmissions.length > 0 && (
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-3">Recent Submissions</h3>
                    <div className="space-y-2">
                      {groupSubmissions.slice(0, 10).map((sub) => {
                        const task = groupTasks.find((t) => t.id === sub.taskId);
                        return (
                          <div key={sub.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                              {sub.studentName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900">{sub.studentName}</span>
                              <span className="text-xs text-gray-400 ml-2">{task?.title}</span>
                              <div className="text-xs text-gray-400">{formatDate(sub.submittedAt)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${subStatusColor(sub.status)}`}>{sub.status}</span>
                              {sub.grade !== undefined && <span className="text-xs font-bold text-blue-700">{sub.grade}/{task?.points}</span>}
                              {task && sub.status !== 'reviewed' && (
                                <button onClick={() => setGradingSubmission({ sub, task })} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
                                  Grade
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
              /* Groups List */
              <div className="space-y-4">
                {/* Search / Filter */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search task groups..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-1">
                    {(['all', 'draft', 'published', 'closed'] as const).map((s) => (
                      <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                        statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <button onClick={loadData} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors" title="Refresh">
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-16"><Spinner /></div>
                ) : filteredGroups.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium text-gray-500">No task groups yet</p>
                    <p className="text-sm mt-1">Create your first task group to get started</p>
                    <button onClick={() => setShowGroupModal(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                      <Plus className="w-4 h-4" /> Create Task Group
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        onEdit={() => { setEditingGroup(group); setShowGroupModal(true); }}
                        onDelete={() => handleDeleteGroup(group)}
                        onView={() => loadGroupDetail(group)}
                        onPublish={() => handlePublish(group)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── EVALUATE TAB ─────────────────────────────────────────────────────── */}

        {activeTab === 'evaluate' && (
          <div className="space-y-5">
            {/* Group selector + filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Task Group</label>
                  <select
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
                    value={evalGroupId}
                    onChange={(e) => setEvalGroupId(e.target.value)}
                  >
                    <option value="">— Select Group —</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                {evalTasks.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Task</label>
                    <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={evalTaskFilter} onChange={(e) => setEvalTaskFilter(e.target.value)}>
                      <option value="all">All Tasks</option>
                      {evalTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                  <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={evalStatusFilter} onChange={(e) => setEvalStatusFilter(e.target.value)}>
                    <option value="all">All Status</option>
                    <option value="submitted">Submitted</option>
                    <option value="late">Late</option>
                    <option value="resubmitted">Resubmitted</option>
                    <option value="reviewed">Reviewed</option>
                  </select>
                </div>
                <div className="ml-auto text-sm text-gray-500">
                  {filteredEvalSubmissions.length} submission{filteredEvalSubmissions.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Submissions table */}
            {evalLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : !evalGroupId ? (
              <div className="text-center py-16 text-gray-400">
                <Award className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Select a task group to view submissions</p>
              </div>
            ) : filteredEvalSubmissions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Send className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>No submissions yet for this group</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Task</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredEvalSubmissions.map((sub) => {
                        const task = evalTasks.find((t) => t.id === sub.taskId);
                        const taskMeta = task ? TASK_TYPE_META[task.type] : null;
                        const TaskIcon = taskMeta?.icon ?? FileText;
                        return (
                          <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                  {sub.studentName[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{sub.studentName}</div>
                                  {sub.studentEmail && <div className="text-xs text-gray-400">{sub.studentEmail}</div>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {taskMeta && <TaskIcon className={`w-4 h-4 ${taskMeta.color} shrink-0`} />}
                                <span className="text-gray-700">{task?.title ?? '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              <div>{formatDate(sub.submittedAt)}</div>
                              <div>Attempt #{sub.attemptNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${subStatusColor(sub.status)}`}>{sub.status}</span>
                                {sub.isLate && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Late</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {sub.grade !== undefined ? (
                                <div>
                                  <span className="font-bold text-blue-700">{sub.grade}</span>
                                  <span className="text-gray-400">/{task?.points}</span>
                                  <div className="text-xs text-gray-400">{task?.points ? Math.round((sub.grade / task.points) * 100) : 0}%</div>
                                </div>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                {task && (
                                  <button
                                    onClick={() => setGradingSubmission({ sub, task })}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      sub.status === 'reviewed'
                                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                  >
                                    <Award className="w-3.5 h-3.5" />
                                    {sub.status === 'reviewed' ? 'Re-grade' : 'Grade'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Grading stats for evaluate tab */}
            {evalSubmissions.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total', value: evalSubmissions.length, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Pending', value: evalSubmissions.filter((s) => !['reviewed'].includes(s.status)).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Graded', value: evalSubmissions.filter((s) => s.status === 'reviewed').length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Late', value: evalSubmissions.filter((s) => s.isLate).length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${s.color}`} />
                        <span className="text-xs font-medium text-gray-600">{s.label}</span>
                      </div>
                      <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}

      {showGroupModal && user && (
        <TaskGroupFormModal
          courses={courses}
          editGroup={editingGroup}
          teacherId={user.uid}
          teacherName={user.displayName ?? 'Teacher'}
          onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
          onSaved={handleGroupSaved}
        />
      )}

      {showTaskModal && selectedGroup && user && (
        <TaskFormModal
          groupId={selectedGroup.id}
          teacherId={user.uid}
          existingTasks={groupTasks}
          editTask={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSaved={handleTaskSaved}
        />
      )}

      {gradingSubmission && user && (
        <GradingModal
          submission={gradingSubmission.sub}
          task={gradingSubmission.task}
          teacherId={user.uid}
          teacherName={user.displayName ?? 'Teacher'}
          onClose={() => setGradingSubmission(null)}
          onGraded={async () => {
            setGradingSubmission(null);
            if (selectedGroup) await loadGroupDetail(selectedGroup);
            if (evalGroupId) await loadEvaluation(evalGroupId);
          }}
        />
      )}
    </div>
  );
};

export default TeacherTaskManagement;
