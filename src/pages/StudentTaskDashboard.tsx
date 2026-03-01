// src/pages/StudentTaskDashboard.tsx
// Production-grade Student Task Dashboard
// Features: View task groups, submit per task type, see feedback, track deadlines

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, FolderOpen, Beaker, MessageSquare, Users, Link2, GraduationCap,
  Clock, Calendar, Award, AlertCircle, CheckCircle, XCircle, Send, Upload,
  FileText, Eye, X, Plus, Loader2, ArrowLeft, ArrowRight, ChevronDown,
  ChevronUp, Star, BarChart2, RefreshCw, ExternalLink, Globe, Github,
  Paperclip, MessageCircle, Image, Video, AlertTriangle, Lock, Info,
  Check, Target, Layers,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import {
  taskService,
  TaskGroup,
  Task,
  Submission,
  TaskType,
  TaskAttachment,
  LinkEntry,
  RubricScore,
} from '../services/taskService';

// ─── Task Type Meta ───────────────────────────────────────────────────────────

const TASK_TYPE_META: Record<TaskType, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  homework:        { label: 'Homework',    icon: BookOpen,      color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  project:         { label: 'Project',     icon: FolderOpen,    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  practical:       { label: 'Lab',         icon: Beaker,        color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  discussion:      { label: 'Discussion',  icon: MessageSquare, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  peer_review:     { label: 'Peer Review', icon: Users,         color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  link_submission: { label: 'Link',        icon: Link2,         color: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200' },
  exam:            { label: 'Exam',        icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
};

// ─── Status Config ────────────────────────────────────────────────────────────

const getStatusConfig = (status: string, isLate: boolean) => {
  if (status === 'reviewed') return { label: 'Reviewed', color: 'bg-green-100 text-green-700', icon: CheckCircle, iconColor: 'text-green-600' };
  if (isLate || status === 'late') return { label: 'Late', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle, iconColor: 'text-amber-600' };
  if (status === 'resubmitted') return { label: 'Resubmitted', color: 'bg-blue-100 text-blue-700', icon: RefreshCw, iconColor: 'text-blue-600' };
  if (status === 'submitted') return { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Send, iconColor: 'text-blue-600' };
  return { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock, iconColor: 'text-gray-400' };
};

// ─── Utility ──────────────────────────────────────────────────────────────────

const formatDate = (d: Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', opts ?? { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Countdown timer hook
const useCountdown = (dueDate: Date | null | undefined) => {
  const [display, setDisplay] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!dueDate) return;
    const update = () => {
      const diff = dueDate.getTime() - Date.now();
      if (diff <= 0) { setDisplay('Overdue'); setIsOverdue(true); return; }
      setIsOverdue(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 48) setDisplay(`${Math.floor(h / 24)}d ${h % 24}h`);
      else if (h > 0) setDisplay(`${h}h ${m}m`);
      else setDisplay(`${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [dueDate]);

  return { display, isOverdue };
};

const Spinner = () => <Loader2 className="w-5 h-5 animate-spin" />;

const ProgressBar: React.FC<{ value: number; color?: string; label?: string }> = ({ value, color = 'bg-blue-500', label }) => (
  <div className="space-y-1">
    {label && <div className="flex justify-between text-xs text-gray-500"><span>{label}</span><span>{Math.round(value)}%</span></div>}
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  </div>
);

// ─── File Drop Zone ───────────────────────────────────────────────────────────

const FileDropZone: React.FC<{
  files: TaskAttachment[];
  onAdd: (files: TaskAttachment[]) => void;
  onRemove: (i: number) => void;
  accept?: string;
  maxSizeMB?: number;
  allowedFormats?: string[];
  label?: string;
}> = ({ files, onAdd, onRemove, accept, maxSizeMB = 50, allowedFormats, label = 'Upload files' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);

  const validate = (file: File): string | null => {
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) return `File too large (max ${maxSizeMB}MB)`;
    if (allowedFormats?.length) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!allowedFormats.includes(ext)) return `Format .${ext} not allowed`;
    }
    return null;
  };

  const handleFiles = async (selected: FileList | null) => {
    if (!selected?.length) return;
    setUploading(true);
    const results: TaskAttachment[] = [];
    for (const file of Array.from(selected)) {
      const err = validate(file);
      if (err) { alert(err); continue; }
      try {
        const att = await taskService.uploadStudentFile(file, 'submissions', (pct) =>
          setProgress((p) => ({ ...p, [file.name]: pct }))
        );
        results.push(att);
      } catch (e: any) { alert(`Upload failed: ${e.message}`); }
    }
    setProgress({});
    setUploading(false);
    if (results.length) onAdd(results);
  };

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner />
            <span className="text-sm text-gray-500">Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="w-6 h-6 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">{label}</span>
            <span className="text-xs text-gray-400">
              {allowedFormats?.length ? allowedFormats.map((f) => `.${f}`).join(', ') : 'Any file'}
              {maxSizeMB ? ` — max ${maxSizeMB}MB` : ''}
            </span>
          </div>
        )}
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {Object.entries(progress).map(([name, pct]) => (
        <div key={name} className="p-2 bg-blue-50 rounded-lg text-xs">
          <div className="flex justify-between mb-1"><span className="truncate">{name}</span><span>{pct}%</span></div>
          <ProgressBar value={pct} />
        </div>
      ))}

      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100 group">
          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="flex-1 text-sm truncate">{f.name}</span>
          {f.size && <span className="text-xs text-gray-400">{formatBytes(f.size)}</span>}
          <button onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Rich Text Editor (Simple) ────────────────────────────────────────────────

const RichTextEditor: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; wordLimit?: number }> = ({
  value, onChange, placeholder = 'Write your answer here...', wordLimit,
}) => {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const overLimit = wordLimit && wordCount > wordLimit;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
      {/* Simple toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <button type="button" className="p-1 hover:bg-gray-200 rounded font-bold text-sm w-6 h-6 flex items-center justify-center" onClick={() => document.execCommand('bold')}>B</button>
        <button type="button" className="p-1 hover:bg-gray-200 rounded italic text-sm w-6 h-6 flex items-center justify-center" onClick={() => document.execCommand('italic')}>I</button>
        <button type="button" className="p-1 hover:bg-gray-200 rounded underline text-sm w-6 h-6 flex items-center justify-center" onClick={() => document.execCommand('underline')}>U</button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" className="p-1 hover:bg-gray-200 rounded text-xs w-6 h-6 flex items-center justify-center" onClick={() => document.execCommand('insertUnorderedList')}>•</button>
        <button type="button" className="p-1 hover:bg-gray-200 rounded text-xs w-6 h-6 flex items-center justify-center" onClick={() => document.execCommand('insertOrderedList')}>1.</button>
      </div>
      <div
        contentEditable
        suppressContentEditableWarning
        className="min-h-32 p-4 text-sm text-gray-800 focus:outline-none"
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        dangerouslySetInnerHTML={{ __html: value }}
        style={{ lineHeight: 1.6 }}
      />
      {wordLimit ? (
        <div className={`px-3 py-1.5 text-xs text-right border-t border-gray-100 ${overLimit ? 'text-red-600 bg-red-50' : 'text-gray-400'}`}>
          {wordCount} / {wordLimit} words
        </div>
      ) : null}
    </div>
  );
};

// ─── Submission Form (per task type) ─────────────────────────────────────────

interface SubmitFormProps {
  task: Task;
  group: TaskGroup;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  existingSubmission?: Submission | null;
  onSubmitted: () => void;
  onCancel: () => void;
}

const SubmissionForm: React.FC<SubmitFormProps> = ({
  task, group, studentId, studentName, studentEmail, existingSubmission, onSubmitted, onCancel,
}) => {
  const navigate = useNavigate();
  const [textContent, setTextContent] = useState(existingSubmission?.textContent ?? '');
  const [files, setFiles] = useState<TaskAttachment[]>(existingSubmission?.files ?? []);
  const [links, setLinks] = useState<LinkEntry[]>(existingSubmission?.links ?? [{ url: '', label: '' }]);
  const [discussionText, setDiscussionText] = useState(existingSubmission?.discussionText ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addLink = () => setLinks((l) => [...l, { url: '', label: '' }]);
  const removeLink = (i: number) => setLinks((l) => l.filter((_, j) => j !== i));
  const updateLink = (i: number, field: 'url' | 'label', val: string) =>
    setLinks((l) => l.map((x, j) => j === i ? { ...x, [field]: val } : x));

  const validate = (): string | null => {
    if (task.type === 'homework') {
      if (!textContent && files.length === 0) return 'Please provide an answer or upload a file.';
    }
    if (task.type === 'project') {
      if (files.length === 0 && !links.some((l) => l.url)) return 'Upload files or provide at least one link.';
    }
    if (task.type === 'practical') {
      if (files.length === 0) return 'Please upload evidence files.';
    }
    if (task.type === 'discussion') {
      if (!discussionText.trim()) return 'Please write your discussion response.';
      if (task.wordLimit && discussionText.trim().split(/\s+/).length > task.wordLimit)
        return `Response exceeds word limit of ${task.wordLimit} words.`;
    }
    if (task.type === 'link_submission') {
      if (!links.some((l) => l.url.trim())) return 'Please provide at least one link.';
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError('');
    try {
      await taskService.submitTask({
        taskId: task.id,
        taskGroupId: group.id,
        studentId,
        studentName,
        studentEmail,
        dueDate: group.dueDate,
        textContent: task.allowRichText !== false ? textContent : undefined,
        files,
        links: links.filter((l) => l.url.trim()),
        discussionText: task.type === 'discussion' ? discussionText : undefined,
      });
      onSubmitted();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isResubmit = !!existingSubmission;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Reference attachments from teacher */}
      {task.attachments && task.attachments.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">📎 Reference Files from Instructor</h4>
          <div className="space-y-1">
            {task.attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                <FileText className="w-4 h-4" />{att.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Homework / Written */}
      {task.type === 'homework' && (
        <>
          {task.allowRichText !== false && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Your Answer</label>
              <RichTextEditor value={textContent} onChange={setTextContent} placeholder="Write your answer here..." />
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Upload Files
              {task.allowedFormats?.length && <span className="text-gray-400 font-normal ml-1">({task.allowedFormats.join(', ')})</span>}
            </label>
            <FileDropZone
              files={files} onAdd={(f) => setFiles((x) => [...x, ...f])} onRemove={(i) => setFiles((x) => x.filter((_, j) => j !== i))}
              allowedFormats={task.allowedFormats} maxSizeMB={task.maxFileSizeMB}
            />
          </div>
        </>
      )}

      {/* Project */}
      {task.type === 'project' && (
        <>
          {task.milestones && task.milestones.length > 0 && (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <h4 className="text-sm font-semibold text-purple-800 mb-2">Milestones</h4>
              <div className="space-y-1">
                {task.milestones.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-700 text-xs flex items-center justify-center">{i + 1}</span>
                    <span className="font-medium text-gray-700">{m.title}</span>
                    <span className="text-gray-400 text-xs">Due: {formatDate(m.dueDate, { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Upload Files</label>
            <FileDropZone files={files} onAdd={(f) => setFiles((x) => [...x, ...f])} onRemove={(i) => setFiles((x) => x.filter((_, j) => j !== i))} />
          </div>
          {task.allowLinks && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">External Links</label>
              {links.map((l, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://github.com/..." value={l.url} onChange={(e) => updateLink(i, 'url', e.target.value)} />
                  <input className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Label" value={l.label} onChange={(e) => updateLink(i, 'label', e.target.value)} />
                  <button onClick={() => removeLink(i)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={addLink} className="text-sm text-blue-600 hover:underline font-medium">+ Add link</button>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Notes / Description (optional)</label>
            <textarea rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe your project..." value={textContent} onChange={(e) => setTextContent(e.target.value)} />
          </div>
        </>
      )}

      {/* Practical / Lab */}
      {task.type === 'practical' && (
        <>
          {task.experimentSteps && task.experimentSteps.length > 0 && (
            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
              <h4 className="text-sm font-semibold text-green-800 mb-2">Experiment Steps</h4>
              <ol className="list-decimal list-inside space-y-1">
                {task.experimentSteps.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700">{step}</li>
                ))}
              </ol>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">
              Upload Evidence
              {task.requiredSubmissionTypes?.length && (
                <span className="text-gray-400 font-normal ml-1">(Required: {task.requiredSubmissionTypes.join(', ')})</span>
              )}
            </label>
            <FileDropZone
              files={files} onAdd={(f) => setFiles((x) => [...x, ...f])} onRemove={(i) => setFiles((x) => x.filter((_, j) => j !== i))}
              label="Upload images, videos, documents, screenshots"
              accept="image/*,video/*,application/pdf"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Observations / Notes</label>
            <textarea rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Write your observations..." value={textContent} onChange={(e) => setTextContent(e.target.value)} />
          </div>
        </>
      )}

      {/* Discussion */}
      {task.type === 'discussion' && (
        <>
          {task.prompt && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <h4 className="text-sm font-semibold text-amber-800 mb-1">Discussion Prompt</h4>
              <p className="text-sm text-gray-700">{task.prompt}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Your Response
              {task.wordLimit ? <span className="text-gray-400 font-normal ml-1">(max {task.wordLimit} words)</span> : null}
            </label>
            <RichTextEditor
              value={discussionText}
              onChange={setDiscussionText}
              placeholder="Share your thoughts..."
              wordLimit={task.wordLimit}
            />
          </div>
        </>
      )}

      {/* Peer Review — show assigned submissions */}
      {task.type === 'peer_review' && (
        <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-center">
          <Users className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="text-sm text-rose-800 font-medium">Peer reviews are assigned after submissions close.</p>
          <p className="text-xs text-rose-600 mt-1">You'll be notified when peer submissions are ready to review.</p>
        </div>
      )}

      {/* Link Submission */}
      {task.type === 'link_submission' && (
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Submit Links
            {task.allowedLinkTypes?.length && <span className="text-gray-400 font-normal ml-1">({task.allowedLinkTypes.join(', ')})</span>}
          </label>
          {links.map((l, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="w-full pl-9 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="https://..." value={l.url} onChange={(e) => updateLink(i, 'url', e.target.value)} />
              </div>
              <input className="w-36 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Label" value={l.label} onChange={(e) => updateLink(i, 'label', e.target.value)} />
              {i > 0 && <button onClick={() => removeLink(i)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>}
            </div>
          ))}
          <button onClick={addLink} className="text-sm text-cyan-600 hover:underline font-medium">+ Add another link</button>
        </div>
      )}

      {/* Exam */}
      {task.type === 'exam' && (
        <div className="p-6 text-center bg-indigo-50 rounded-xl border border-indigo-100">
          <GraduationCap className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
          <h4 className="font-semibold text-indigo-800 mb-1">Exam Task</h4>
          <p className="text-sm text-indigo-600 mb-4">This exam will open in the Exam Viewer. Make sure you have enough time before starting.</p>
          <button
            onClick={() => navigate(`/exam/${task.contentId}`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <GraduationCap className="w-4 h-4" /> Start Exam
          </button>
        </div>
      )}

      {/* Submit button */}
      {task.type !== 'exam' && task.type !== 'peer_review' && (
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm">
            {submitting ? <><Spinner /> Submitting...</> : <><Send className="w-4 h-4" />{isResubmit ? 'Resubmit' : 'Submit'}</>}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────────────────

const TaskCard: React.FC<{
  task: Task;
  group: TaskGroup;
  submission?: Submission;
  onOpen: () => void;
}> = ({ task, group, submission, onOpen }) => {
  const meta = TASK_TYPE_META[task.type];
  const TaskIcon = meta.icon;
  const status = submission ? getStatusConfig(submission.status, submission.isLate) : getStatusConfig('', false);
  const StatusIcon = status.icon;

  const isPastDue = new Date() > group.dueDate;
  const isLateAllowed = group.lateSubmissionAllowed;
  const canSubmit = !isPastDue || (isLateAllowed && group.lateSubmissionDeadline && new Date() < group.lateSubmissionDeadline);
  const canResubmit = task.allowResubmission && submission && canSubmit;

  return (
    <div className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-all group">
      <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
        <TaskIcon className={`w-4.5 h-4.5 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">{task.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${meta.bg} ${meta.color}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span><Award className="w-3 h-3 inline mr-0.5" />{task.points} pts</span>
          {submission?.grade !== undefined && (
            <span className="font-bold text-blue-700">{submission.grade}/{task.points} ({Math.round((submission.grade / task.points) * 100)}%)</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
          <StatusIcon className={`w-3 h-3 ${status.iconColor}`} />
          {status.label}
        </div>
        <button onClick={onOpen} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors">
          {submission ? (canResubmit ? 'Resubmit' : 'View') : canSubmit ? 'Submit' : 'View'}
        </button>
      </div>
    </div>
  );
};

// ─── Feedback Panel ───────────────────────────────────────────────────────────

const FeedbackPanel: React.FC<{ submission: Submission; task: Task }> = ({ submission, task }) => {
  if (submission.status !== 'reviewed') return null;

  const pct = task.points ? Math.round(((submission.grade ?? 0) / task.points) * 100) : 0;
  const gradeColor = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-green-800">📋 Instructor Feedback</h4>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${gradeColor}`}>{submission.grade ?? 0}</span>
          <span className="text-gray-400 text-sm">/ {task.points} pts</span>
          <span className={`text-sm font-medium ${gradeColor}`}>({pct}%)</span>
        </div>
      </div>

      {submission.rubricScores && submission.rubricScores.length > 0 && (
        <div className="space-y-2">
          {submission.rubricScores.map((rs, i) => (
            <div key={i} className="p-2 bg-white rounded-lg border border-green-100">
              <div className="flex justify-between mb-0.5">
                <span className="text-xs font-medium text-gray-700">{rs.criterion}</span>
                <span className="text-xs font-bold text-gray-900">{rs.score}/{rs.maxPoints}</span>
              </div>
              <ProgressBar value={(rs.score / rs.maxPoints) * 100} color="bg-green-500" />
              {rs.comment && <p className="text-xs text-gray-500 mt-1">{rs.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {submission.feedback && (
        <div className="p-3 bg-white rounded-lg border border-green-100">
          <p className="text-sm text-gray-700">{submission.feedback}</p>
        </div>
      )}

      {submission.feedbackFiles && submission.feedbackFiles.length > 0 && (
        <div className="space-y-1">
          {submission.feedbackFiles.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Paperclip className="w-3.5 h-3.5" />{f.name}
            </a>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">Graded by {submission.gradedByName ?? 'Instructor'} on {formatDate(submission.gradedAt)}</p>
    </div>
  );
};

// ─── Task Detail Modal ────────────────────────────────────────────────────────

const TaskDetailModal: React.FC<{
  task: Task;
  group: TaskGroup;
  submission?: Submission | null;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({ task, group, submission, studentId, studentName, studentEmail, onClose, onSubmitted }) => {
  const meta = TASK_TYPE_META[task.type];
  const TaskIcon = meta.icon;
  const { display: countdown, isOverdue } = useCountdown(group.dueDate);

  const isPastDue = new Date() > group.dueDate;
  const isLateAllowed = group.lateSubmissionAllowed;
  const isPastLate = group.lateSubmissionDeadline ? new Date() > group.lateSubmissionDeadline : isPastDue;
  const canSubmit = !isPastDue || (isLateAllowed && !isPastLate);
  const isLateWindow = isPastDue && isLateAllowed && !isPastLate;

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`p-6 border-b border-gray-100 ${meta.bg}`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center`}>
                <TaskIcon className={`w-5 h-5 ${meta.color}`} />
              </div>
              <div>
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                <h2 className="text-lg font-bold text-gray-900">{task.title}</h2>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-xl"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700">{task.points} points</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
              <Clock className="w-4 h-4" />
              <span>{isLateWindow ? `Late window: ${countdown}` : isOverdue ? 'Overdue' : `Due in ${countdown}`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(group.dueDate)}</span>
            </div>
          </div>

          {isLateWindow && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Late submission accepted until {formatDate(group.lateSubmissionDeadline)}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Instructions</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Rubric */}
          {task.rubric && task.rubric.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Grading Rubric</h4>
              <div className="space-y-2">
                {task.rubric.map((r) => (
                  <div key={r.id} className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700">{r.criterion}</span>
                      {r.description && <p className="text-xs text-gray-500">{r.description}</p>}
                    </div>
                    <span className="text-sm font-bold text-gray-600 ml-3">{r.maxPoints} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previous submission feedback */}
          {submission && <FeedbackPanel submission={submission} task={task} />}

          {/* Submission form */}
          {(showForm || (!submission && canSubmit)) && task.type !== 'exam' && (
            <div className={`${showForm && submission ? 'mt-4 pt-4 border-t border-gray-100' : ''}`}>
              {showForm && submission && (
                <h3 className="text-sm font-semibold text-blue-700 mb-3">📤 Resubmit</h3>
              )}
              <SubmissionForm
                task={task} group={group}
                studentId={studentId} studentName={studentName} studentEmail={studentEmail}
                existingSubmission={submission}
                onSubmitted={() => { setShowForm(false); onSubmitted(); }}
                onCancel={() => { if (submission) setShowForm(false); else onClose(); }}
              />
            </div>
          )}

          {/* Exam task (no form) */}
          {task.type === 'exam' && !submission && (
            <SubmissionForm
              task={task} group={group}
              studentId={studentId} studentName={studentName} studentEmail={studentEmail}
              onSubmitted={onSubmitted}
              onCancel={onClose}
            />
          )}
        </div>

        {/* Footer for resubmit */}
        {submission && !showForm && task.allowResubmission && canSubmit && task.type !== 'exam' && (
          <div className="p-4 border-t border-gray-100 flex justify-end">
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
              <RefreshCw className="w-4 h-4" /> Resubmit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Group Card ───────────────────────────────────────────────────────────────

const GroupCard: React.FC<{
  group: TaskGroup;
  tasks: Task[];
  submissions: Submission[];
  studentId: string;
  onOpenTask: (task: Task, submission?: Submission) => void;
}> = ({ group, tasks, submissions, studentId, onOpenTask }) => {
  const [expanded, setExpanded] = useState(false);
  const { display: countdown, isOverdue } = useCountdown(group.dueDate);

  const completedTasks = tasks.filter((t) => submissions.some((s) => s.taskId === t.id && s.studentId === studentId));
  const progress = tasks.length ? (completedTasks.length / tasks.length) * 100 : 0;
  const totalEarned = submissions
    .filter((s) => s.studentId === studentId && s.status === 'reviewed' && s.grade !== undefined)
    .reduce((sum, s) => sum + (s.grade ?? 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Group header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-5 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base mb-0.5 truncate">{group.title}</h3>
            {group.description && <p className="text-sm text-gray-500 line-clamp-1">{group.description}</p>}
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />{tasks.length} tasks
          </div>
          <div className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />{group.totalPoints} pts total
          </div>
          <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
            <Clock className="w-3.5 h-3.5" />
            {isOverdue ? 'Overdue' : `Due in ${countdown}`}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />{formatDate(group.dueDate, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          {totalEarned > 0 && (
            <div className="flex items-center gap-1 text-blue-600 font-medium">
              <Star className="w-3.5 h-3.5" />{totalEarned} pts earned
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{completedTasks.length} / {tasks.length} tasks submitted</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} color={progress === 100 ? 'bg-green-500' : 'bg-blue-500'} />
        </div>
      </button>

      {/* Tasks list */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No tasks in this group yet.</p>
          ) : (
            tasks.map((task) => {
              const sub = submissions.find((s) => s.taskId === task.id && s.studentId === studentId);
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  group={group}
                  submission={sub}
                  onOpen={() => onOpenTask(task, sub)}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentTaskDashboard: React.FC = () => {
  const { user } = useDashboard();

  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasksByGroup, setTasksByGroup] = useState<Record<string, Task[]>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'reviewed'>('all');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TaskGroup | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [fetchedGroups, fetchedSubs] = await Promise.all([
        taskService.getTaskGroupsForStudent(user.uid, (user as any).courseId, (user as any).classId),
        taskService.getStudentSubmissions(user.uid),
      ]);
      setGroups(fetchedGroups);
      setSubmissions(fetchedSubs);

      // Load tasks for each group
      const tasksMap: Record<string, Task[]> = {};
      await Promise.all(
        fetchedGroups.map(async (g) => {
          try {
            tasksMap[g.id] = await taskService.getTasksByGroup(g.id);
          } catch {
            tasksMap[g.id] = [];
          }
        })
      );
      setTasksByGroup(tasksMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filteredGroups = groups.filter((g) => {
    const matchSearch = g.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (statusFilter === 'all') return true;
    const tasks = tasksByGroup[g.id] ?? [];
    if (statusFilter === 'pending') return tasks.some((t) => !submissions.find((s) => s.taskId === t.id));
    if (statusFilter === 'submitted') return tasks.some((t) => submissions.find((s) => s.taskId === t.id && s.status !== 'reviewed'));
    if (statusFilter === 'reviewed') return tasks.some((t) => submissions.find((s) => s.taskId === t.id && s.status === 'reviewed'));
    return true;
  });

  // ── Summary stats ────────────────────────────────────────────────────────────

  const allTasks = Object.values(tasksByGroup).flat();
  const submittedTaskIds = new Set(submissions.map((s) => s.taskId));
  const reviewedCount = submissions.filter((s) => s.status === 'reviewed').length;
  const totalEarned = submissions.filter((s) => s.grade !== undefined).reduce((sum, s) => sum + (s.grade ?? 0), 0);
  const pendingCount = allTasks.filter((t) => !submittedTaskIds.has(t.id)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and submit your assignments</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Tasks', value: allTasks.length, icon: Layers, color: 'text-gray-700', bg: 'bg-white' },
            { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Reviewed', value: reviewedCount, icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Points Earned', value: totalEarned, icon: Award, color: 'text-blue-700', bg: 'bg-blue-50' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 p-4 shadow-sm`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-gray-500">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            );
          })}
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search task groups..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'pending', 'submitted', 'reviewed'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={loadData} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* Groups List */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium text-gray-500">No tasks found</p>
            <p className="text-sm mt-1">Tasks assigned by your instructor will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                tasks={tasksByGroup[group.id] ?? []}
                submissions={submissions}
                studentId={user?.uid ?? ''}
                onOpenTask={(task, sub) => {
                  setSelectedTask(task);
                  setSelectedGroup(group);
                  setSelectedSubmission(sub ?? null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && selectedGroup && user && (
        <TaskDetailModal
          task={selectedTask}
          group={selectedGroup}
          submission={selectedSubmission}
          studentId={user.uid}
          studentName={user.displayName ?? 'Student'}
          studentEmail={user.email}
          onClose={() => { setSelectedTask(null); setSelectedGroup(null); setSelectedSubmission(null); }}
          onSubmitted={async () => {
            setSelectedTask(null); setSelectedGroup(null); setSelectedSubmission(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
};

export default StudentTaskDashboard;
