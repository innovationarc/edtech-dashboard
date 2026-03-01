// src/pages/StudentTaskDashboard.tsx
// Fixed: blank screen, Firestore query issues, removed useNavigate (use window.location for exam)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, FolderOpen, Beaker, MessageSquare, Users, Link2, GraduationCap,
  Clock, Calendar, Award, AlertCircle, CheckCircle, Send, Upload,
  FileText, Eye, X, Plus, Loader2, ArrowLeft, ChevronDown, ChevronUp,
  RefreshCw, Globe, Paperclip, AlertTriangle, Check, Layers,
  Search, Star, Lock,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import {
  taskService, TaskGroup, Task, Submission, TaskType,
  TaskAttachment, LinkEntry,
} from '../services/taskService';

// ─── Task type display config ─────────────────────────────────────────────────

const TYPE_META: Record<TaskType, { label: string; icon: React.ElementType; color: string }> = {
  homework:        { label: 'Homework',    icon: BookOpen,      color: '#3b82f6' },
  project:         { label: 'Project',     icon: FolderOpen,    color: '#8b5cf6' },
  practical:       { label: 'Lab',         icon: Beaker,        color: '#10b981' },
  discussion:      { label: 'Discussion',  icon: MessageSquare, color: '#f59e0b' },
  peer_review:     { label: 'Peer Review', icon: Users,         color: '#ef4444' },
  link_submission: { label: 'Link',        icon: Link2,         color: '#06b6d4' },
  exam:            { label: 'Exam',        icon: GraduationCap, color: '#6366f1' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: Date | null, short?: boolean) => {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', short
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  ).format(d);
};

const fmtBytes = (b?: number) => {
  if (!b) return '';
  return b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
};

const getStatusInfo = (sub?: Submission | null) => {
  if (!sub) return { label: 'Pending', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' };
  if (sub.status === 'reviewed') return { label: 'Reviewed', color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)' };
  if (sub.isLate || sub.status === 'late') return { label: 'Late', color: '#fcd34d', bg: 'rgba(245,158,11,0.1)' };
  if (sub.status === 'resubmitted') return { label: 'Resubmitted', color: '#a5b4fc', bg: 'rgba(99,102,241,0.1)' };
  return { label: 'Submitted', color: '#93c5fd', bg: 'rgba(59,130,246,0.1)' };
};

// Countdown
const useCountdown = (due?: Date | null) => {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    if (!due) return;
    const tick = () => {
      const diff = due.getTime() - Date.now();
      if (diff <= 0) { setText('Overdue'); setUrgent(true); return; }
      setUrgent(diff < 3600000 * 24);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (d > 0) setText(`${d}d ${h}h`);
      else if (h > 0) setText(`${h}h ${m}m`);
      else setText(`${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [due]);
  return { text, urgent };
};

const Spinner = () => <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;

// ─── File Drop Zone ───────────────────────────────────────────────────────────

const FileDropZone = ({
  files, onAdd, onRemove, allowedFormats, maxSizeMB = 50, label = 'Upload files', accept
}: {
  files: TaskAttachment[]; onAdd: (f: TaskAttachment[]) => void; onRemove: (i: number) => void;
  allowedFormats?: string[]; maxSizeMB?: number; label?: string; accept?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [over, setOver] = useState(false);

  const handle = async (fl: FileList | null) => {
    if (!fl?.length) return;
    setUploading(true);
    const out: TaskAttachment[] = [];
    for (const f of Array.from(fl)) {
      if (maxSizeMB && f.size > maxSizeMB * 1048576) { alert(`${f.name}: exceeds ${maxSizeMB}MB`); continue; }
      if (allowedFormats?.length) {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!ext || !allowedFormats.includes(ext)) { alert(`.${ext} not allowed`); continue; }
      }
      try {
        const att = await taskService.uploadStudentFile(f, 'submissions', p => setProgress(x => ({ ...x, [f.name]: p })));
        out.push(att);
      } catch (e: any) { alert(e.message); }
    }
    setProgress({}); setUploading(false);
    if (out.length) onAdd(out);
  };

  const cardStyle: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))' };

  return (
    <div className="space-y-2">
      <div onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        className="border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors"
        style={{ borderColor: over ? 'var(--color-primary, #6366f1)' : 'rgba(255,255,255,0.15)', background: over ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
        {uploading
          ? <div className="flex items-center justify-center gap-2 text-gray-400 text-sm"><Spinner />Uploading...</div>
          : <>
            <Upload className="w-5 h-5 mx-auto mb-1 text-gray-500" />
            <p className="text-sm text-gray-400">{label}</p>
            {allowedFormats?.length && <p className="text-xs text-gray-500 mt-0.5">{allowedFormats.map(f => `.${f}`).join(', ')} · max {maxSizeMB}MB</p>}
          </>}
        <input ref={ref} type="file" multiple accept={accept} className="hidden" onChange={e => handle(e.target.files)} />
      </div>
      {Object.entries(progress).map(([name, pct]) => (
        <div key={name} className="p-2 rounded-lg text-xs" style={{ background: 'rgba(99,102,241,0.08)' }}>
          <div className="flex justify-between mb-1 text-blue-400"><span className="truncate">{name}</span><span>{pct}%</span></div>
          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-lg group" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="flex-1 text-xs text-gray-300 truncate">{f.name}</span>
          {f.size && <span className="text-xs text-gray-500">{fmtBytes(f.size)}</span>}
          <button onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
};

// ─── Simple rich text editor ──────────────────────────────────────────────────

const SimpleEditor = ({ value, onChange, placeholder, wordLimit }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; wordLimit?: number;
}) => {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const over = wordLimit ? words > wordLimit : false;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex items-center gap-1 px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[['B', 'bold'], ['I', 'italic'], ['U', 'underline']].map(([l, cmd]) => (
          <button key={cmd} type="button" onClick={() => document.execCommand(cmd)}
            className="w-6 h-6 flex items-center justify-center rounded text-xs text-gray-400 hover:bg-white/10 font-medium"
            style={cmd === 'bold' ? { fontWeight: 700 } : cmd === 'italic' ? { fontStyle: 'italic' } : { textDecoration: 'underline' }}>
            {l}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button type="button" onClick={() => document.execCommand('insertUnorderedList')}
          className="w-6 h-6 flex items-center justify-center rounded text-xs text-gray-400 hover:bg-white/10">•</button>
      </div>
      <div
        contentEditable suppressContentEditableWarning
        className="min-h-28 p-3 text-sm outline-none"
        style={{ color: '#e5e7eb', lineHeight: 1.6 }}
        onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
        dangerouslySetInnerHTML={{ __html: value }}
      />
      {wordLimit ? (
        <div className="px-3 py-1.5 text-xs text-right" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: over ? '#fca5a5' : '#6b7280' }}>
          {words} / {wordLimit} words
        </div>
      ) : null}
    </div>
  );
};

// ─── Submission form (per task type) ─────────────────────────────────────────

const SubmissionForm = ({
  task, group, studentId, studentName, studentEmail, existing, onSubmitted, onCancel,
}: {
  task: Task; group: TaskGroup; studentId: string; studentName: string; studentEmail?: string;
  existing?: Submission | null; onSubmitted: () => void; onCancel: () => void;
}) => {
  const [textContent, setTextContent] = useState(existing?.textContent ?? '');
  const [files, setFiles] = useState<TaskAttachment[]>(existing?.files ?? []);
  const [links, setLinks] = useState<LinkEntry[]>(existing?.links?.length ? existing.links : [{ url: '', label: '' }]);
  const [discussionText, setDiscussionText] = useState(existing?.discussionText ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateLink = (i: number, field: 'url' | 'label', v: string) =>
    setLinks(l => l.map((x, j) => j === i ? { ...x, [field]: v } : x));

  const validate = () => {
    if (task.type === 'homework' && !textContent && !files.length) return 'Please provide an answer or upload a file.';
    if (task.type === 'practical' && !files.length) return 'Please upload evidence files.';
    if (task.type === 'discussion' && !discussionText.trim()) return 'Please write your discussion response.';
    if (task.type === 'link_submission' && !links.some(l => l.url.trim())) return 'Please provide at least one link.';
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true); setError('');
    try {
      await taskService.submitTask({
        taskId: task.id, taskGroupId: group.id,
        studentId, studentName, studentEmail,
        dueDate: group.dueDate,
        textContent: textContent || undefined,
        files, links: links.filter(l => l.url.trim()),
        discussionText: discussionText || undefined,
      });
      onSubmitted();
    } catch (e: any) { setError(e.message); } finally { setSubmitting(false); }
  };

  const secBg: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' };
  const inputStyle: React.CSSProperties = { borderColor: 'rgba(255,255,255,0.1)', color: '#e5e7eb', background: 'transparent' };
  const inputCls = 'w-full rounded-xl px-3 py-2 text-sm border outline-none focus:ring-1 focus:ring-white/20';

  // Exam: redirect to ExamViewer
  if (task.type === 'exam') {
    return (
      <div style={secBg} className="rounded-xl p-6 text-center space-y-4">
        <GraduationCap className="w-10 h-10 mx-auto text-indigo-400" />
        <div>
          <p className="font-semibold text-gray-200">Exam Task</p>
          <p className="text-sm text-gray-400 mt-1">This task requires you to take an exam. Make sure you have enough time before starting.</p>
        </div>
        {task.contentId ? (
          <button
            onClick={() => { window.location.href = `/exam/${task.contentId}`; }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--color-primary, #6366f1)' }}>
            <GraduationCap className="w-4 h-4" /> Start Exam
          </button>
        ) : (
          <p className="text-sm text-amber-400">Exam not configured yet. Contact your instructor.</p>
        )}
      </div>
    );
  }

  // Peer review: informational
  if (task.type === 'peer_review') {
    return (
      <div style={secBg} className="rounded-xl p-5 text-center">
        <Users className="w-8 h-8 mx-auto mb-2 text-rose-400" />
        <p className="font-medium text-gray-300">Peer Review</p>
        <p className="text-sm text-gray-400 mt-1">Peer submissions will be assigned to you after the submission deadline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Reference files */}
      {task.attachments?.length ? (
        <div style={secBg} className="rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-semibold text-blue-400">📎 Reference Files</p>
          {task.attachments.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300">
              <FileText className="w-3.5 h-3.5" />{att.name}
            </a>
          ))}
        </div>
      ) : null}

      {/* Homework */}
      {task.type === 'homework' && (
        <>
          {task.allowRichText !== false && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Your Answer</label>
              <SimpleEditor value={textContent} onChange={setTextContent} placeholder="Write your answer here..." />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Upload Files {task.allowedFormats?.length ? <span className="text-gray-500">({task.allowedFormats.join(', ')})</span> : ''}
            </label>
            <FileDropZone files={files} onAdd={f => setFiles(x => [...x, ...f])} onRemove={i => setFiles(x => x.filter((_, j) => j !== i))}
              allowedFormats={task.allowedFormats} maxSizeMB={task.maxFileSizeMB} />
          </div>
        </>
      )}

      {/* Project */}
      {task.type === 'project' && (
        <>
          {task.milestones?.length ? (
            <div style={secBg} className="rounded-xl p-3">
              <p className="text-xs font-semibold text-purple-400 mb-1.5">Milestones</p>
              {task.milestones.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">{i + 1}</span>
                  <span className="font-medium text-gray-300">{m.title}</span>
                  <span className="text-gray-500">· Due {fmtDate(m.dueDate, true)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Upload Files</label>
            <FileDropZone files={files} onAdd={f => setFiles(x => [...x, ...f])} onRemove={i => setFiles(x => x.filter((_, j) => j !== i))} />
          </div>
          {task.allowLinks && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">External Links</label>
              {links.map((l, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <div className="flex-1 relative">
                    <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input className={`${inputCls} pl-8`} style={inputStyle} placeholder="https://..."
                      value={l.url} onChange={e => updateLink(i, 'url', e.target.value)} />
                  </div>
                  <input className={`w-32 ${inputCls}`} style={inputStyle} placeholder="Label"
                    value={l.label} onChange={e => updateLink(i, 'label', e.target.value)} />
                  {i > 0 && <button onClick={() => setLinks(x => x.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>}
                </div>
              ))}
              <button onClick={() => setLinks(x => [...x, { url: '', label: '' }])} className="text-xs text-blue-400 hover:text-blue-300 font-medium">+ Add link</button>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes (optional)</label>
            <textarea rows={2} className={inputCls} style={inputStyle} placeholder="Describe your project..."
              value={textContent} onChange={e => setTextContent(e.target.value)} />
          </div>
        </>
      )}

      {/* Practical */}
      {task.type === 'practical' && (
        <>
          {task.experimentSteps?.length ? (
            <div style={secBg} className="rounded-xl p-3">
              <p className="text-xs font-semibold text-green-400 mb-1.5">Experiment Steps</p>
              <ol className="list-decimal list-inside space-y-1">
                {task.experimentSteps.filter(Boolean).map((step, i) => (
                  <li key={i} className="text-xs text-gray-300">{step}</li>
                ))}
              </ol>
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Upload Evidence {task.requiredSubmissionTypes?.length ? `(${task.requiredSubmissionTypes.join(', ')})` : ''}
            </label>
            <FileDropZone files={files} onAdd={f => setFiles(x => [...x, ...f])} onRemove={i => setFiles(x => x.filter((_, j) => j !== i))}
              label="Upload images, videos, documents, screenshots" accept="image/*,video/*,application/pdf" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Observations / Notes</label>
            <textarea rows={2} className={inputCls} style={inputStyle} placeholder="Write your observations..."
              value={textContent} onChange={e => setTextContent(e.target.value)} />
          </div>
        </>
      )}

      {/* Discussion */}
      {task.type === 'discussion' && (
        <>
          {task.prompt && (
            <div style={secBg} className="rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-400 mb-1">Discussion Prompt</p>
              <p className="text-sm text-gray-300">{task.prompt}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Your Response {task.wordLimit ? <span className="text-gray-500">(max {task.wordLimit} words)</span> : ''}
            </label>
            <SimpleEditor value={discussionText} onChange={setDiscussionText}
              placeholder="Share your thoughts..." wordLimit={task.wordLimit} />
          </div>
        </>
      )}

      {/* Link submission */}
      {task.type === 'link_submission' && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Submit Links {task.allowedLinkTypes?.length ? `(${task.allowedLinkTypes.join(', ')})` : ''}
          </label>
          {links.map((l, i) => (
            <div key={i} className="flex gap-2 mb-1.5">
              <div className="flex-1 relative">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input className={`${inputCls} pl-8`} style={inputStyle} placeholder="https://..."
                  value={l.url} onChange={e => updateLink(i, 'url', e.target.value)} />
              </div>
              <input className={`w-32 ${inputCls}`} style={inputStyle} placeholder="Label"
                value={l.label} onChange={e => updateLink(i, 'label', e.target.value)} />
              {i > 0 && <button onClick={() => setLinks(x => x.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>}
            </div>
          ))}
          <button onClick={() => setLinks(x => [...x, { url: '', label: '' }])} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">+ Add link</button>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
        <button onClick={submit} disabled={submitting}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--color-primary, #6366f1)' }}>
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</> : <><Send className="w-4 h-4" />{existing ? 'Resubmit' : 'Submit'}</>}
        </button>
      </div>
    </div>
  );
};

// ─── Feedback panel ───────────────────────────────────────────────────────────

const FeedbackPanel = ({ sub, task }: { sub: Submission; task: Task }) => {
  if (sub.status !== 'reviewed') return null;
  const pct = task.points ? Math.round(((sub.grade ?? 0) / task.points) * 100) : 0;
  const gradeColor = pct >= 80 ? '#6ee7b7' : pct >= 60 ? '#fcd34d' : '#fca5a5';
  return (
    <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-green-400">Instructor Feedback</p>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: gradeColor }}>{sub.grade ?? 0}</span>
          <span className="text-gray-400 text-sm">/ {task.points} pts</span>
          <span className="text-sm font-medium" style={{ color: gradeColor }}>({pct}%)</span>
        </div>
      </div>
      {sub.rubricScores?.length ? (
        <div className="space-y-1.5">
          {sub.rubricScores.map((rs, i) => (
            <div key={i} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex justify-between mb-0.5">
                <span className="text-xs text-gray-300">{rs.criterion}</span>
                <span className="text-xs font-bold text-gray-200">{rs.score}/{rs.maxPoints}</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full bg-green-500" style={{ width: `${(rs.score / rs.maxPoints) * 100}%` }} />
              </div>
              {rs.comment && <p className="text-xs text-gray-400 mt-1">{rs.comment}</p>}
            </div>
          ))}
        </div>
      ) : null}
      {sub.feedback && <p className="text-sm text-gray-300">{sub.feedback}</p>}
      {sub.feedbackFiles?.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
          <Paperclip className="w-3.5 h-3.5" />{f.name}
        </a>
      ))}
      <p className="text-xs text-gray-500">Graded by {sub.gradedByName ?? 'Instructor'} · {fmtDate(sub.gradedAt)}</p>
    </div>
  );
};

// ─── Task detail modal ────────────────────────────────────────────────────────

const TaskModal = ({
  task, group, sub, studentId, studentName, studentEmail, onClose, onSubmitted,
}: {
  task: Task; group: TaskGroup; sub?: Submission | null;
  studentId: string; studentName: string; studentEmail?: string;
  onClose: () => void; onSubmitted: () => void;
}) => {
  const meta = TYPE_META[task.type];
  const TIcon = meta.icon;
  const { text: countdown, urgent } = useCountdown(group.dueDate);
  const isPastDue = new Date() > group.dueDate;
  const isLateAllowed = group.lateSubmissionAllowed;
  const isPastLate = group.lateSubmissionDeadline ? new Date() > group.lateSubmissionDeadline : isPastDue;
  const canSubmit = !isPastDue || (isLateAllowed && !isPastLate);
  const [showForm, setShowForm] = useState(!sub && canSubmit);

  const modalBg: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" style={modalBg}>
        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${meta.color}18` }}>
                <TIcon className="w-4.5 h-4.5" style={{ color: meta.color }} />
              </div>
              <div>
                <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
                <h2 className="text-base font-bold text-gray-100">{task.title}</h2>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span><Award className="w-3.5 h-3.5 inline mr-1" />{task.points} pts</span>
            <span style={{ color: urgent ? '#fcd34d' : undefined }}>
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              {isPastDue && isLateAllowed && !isPastLate ? `Late window: ${countdown}` : isPastDue ? 'Overdue' : `Due in ${countdown}`}
            </span>
            <span><Calendar className="w-3.5 h-3.5 inline mr-1" />{fmtDate(group.dueDate)}</span>
          </div>
          {isPastDue && isLateAllowed && !isPastLate && (
            <div className="mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertTriangle className="w-3.5 h-3.5" />Late submission accepted until {fmtDate(group.lateSubmissionDeadline)}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {task.description && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1">Instructions</p>
              <p className="text-sm text-gray-300 leading-relaxed">{task.description}</p>
            </div>
          )}

          {task.rubric?.length ? (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-semibold text-gray-400 mb-2">Grading Rubric</p>
              {task.rubric.map(r => (
                <div key={r.id} className="flex items-center justify-between py-1 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div>
                    <span className="text-xs font-medium text-gray-200">{r.criterion}</span>
                    {r.description && <span className="text-xs text-gray-500 ml-2">{r.description}</span>}
                  </div>
                  <span className="text-xs font-bold text-gray-300 shrink-0 ml-2">{r.maxPoints} pts</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Feedback from past submission */}
          {sub && <FeedbackPanel sub={sub} task={task} />}

          {/* Submission form */}
          {showForm ? (
            <div>
              {sub && <p className="text-xs font-semibold text-blue-400 mb-2">📤 Resubmit</p>}
              <SubmissionForm
                task={task} group={group}
                studentId={studentId} studentName={studentName} studentEmail={studentEmail}
                existing={sub}
                onSubmitted={() => { setShowForm(false); onSubmitted(); }}
                onCancel={() => { if (sub) setShowForm(false); else onClose(); }}
              />
            </div>
          ) : sub && task.allowResubmission && canSubmit && task.type !== 'exam' && task.type !== 'peer_review' ? (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white border transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              <RefreshCw className="w-4 h-4" /> Resubmit
            </button>
          ) : !canSubmit && !sub ? (
            <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Lock className="w-5 h-5 mx-auto mb-1 text-red-400" />
              <p className="text-xs text-red-400">Submission closed</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ─── Group card ───────────────────────────────────────────────────────────────

const GroupCard = ({
  group, tasks, submissions, studentId, onOpenTask,
}: {
  group: TaskGroup; tasks: Task[]; submissions: Submission[];
  studentId: string; onOpenTask: (task: Task, sub?: Submission) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const { text: countdown, urgent } = useCountdown(group.dueDate);
  const submitted = tasks.filter(t => submissions.some(s => s.taskId === t.id && s.studentId === studentId));
  const progress = tasks.length ? (submitted.length / tasks.length) * 100 : 0;
  const earned = submissions.filter(s => s.studentId === studentId && s.status === 'reviewed' && s.grade !== undefined)
    .reduce((sum, s) => sum + (s.grade ?? 0), 0);

  const cardStyle: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))' };

  return (
    <div style={cardStyle} className="rounded-2xl overflow-hidden hover:border-white/20 transition-all">
      <button onClick={() => setExpanded(x => !x)} className="w-full text-left p-5 hover:bg-white/2 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-100 text-base truncate">{group.title}</h3>
            {group.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{group.description}</p>}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
          <span><Layers className="w-3 h-3 inline mr-1" />{tasks.length} tasks</span>
          <span><Award className="w-3 h-3 inline mr-1" />{group.totalPoints} pts total</span>
          {earned > 0 && <span style={{ color: '#a5b4fc' }}><Star className="w-3 h-3 inline mr-1" />{earned} pts earned</span>}
          <span style={{ color: urgent ? '#fcd34d' : undefined }}>
            <Clock className="w-3 h-3 inline mr-1" />{countdown}
          </span>
          <span><Calendar className="w-3 h-3 inline mr-1" />{fmtDate(group.dueDate)}</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: '#6b7280' }}>
            <span>{submitted.length} / {tasks.length} submitted</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${progress}%`,
              background: progress === 100 ? '#10b981' : 'var(--color-primary, #6366f1)',
            }} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No tasks in this group.</p>
          ) : (
            tasks.map(task => {
              const meta = TYPE_META[task.type];
              const TIcon = meta.icon;
              const sub = submissions.find(s => s.taskId === task.id && s.studentId === studentId);
              const statusInfo = getStatusInfo(sub);
              const isPastDue = new Date() > group.dueDate;
              const isLateAllowed = group.lateSubmissionAllowed;
              const isPastLate = group.lateSubmissionDeadline ? new Date() > group.lateSubmissionDeadline : isPastDue;
              const canSubmit = !isPastDue || (isLateAllowed && !isPastLate);

              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors mt-2"
                  style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${meta.color}18` }}>
                    <TIcon className="w-4 h-4" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200 truncate">{task.title}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span>{task.points} pts</span>
                      {sub?.grade !== undefined && (
                        <span style={{ color: '#93c5fd' }}>· {sub.grade}/{task.points} ({Math.round((sub.grade / task.points) * 100)}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                    <button onClick={() => onOpenTask(task, sub)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                      style={{ background: 'var(--color-primary, #6366f1)' }}>
                      {sub ? (task.allowResubmission && canSubmit ? 'Resubmit' : 'View') : canSubmit ? 'Submit' : 'View'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const StudentTaskDashboard: React.FC = () => {
  const { user } = useDashboard();
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasksByGroup, setTasksByGroup] = useState<Record<string, Task[]>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TaskGroup | null>(null);
  const [selectedSub, setSelectedSub] = useState<Submission | null | undefined>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const courseId = (user as any).courseId;
      const classGrade = (user as any).classGrade;
      const [fetchedGroups, fetchedSubs] = await Promise.all([
        taskService.getTaskGroupsForStudent(user.uid, courseId, classGrade),
        taskService.getStudentSubmissions(user.uid),
      ]);
      setGroups(fetchedGroups);
      setSubmissions(fetchedSubs);

      // Load tasks per group
      const map: Record<string, Task[]> = {};
      await Promise.all(fetchedGroups.map(async g => {
        try { map[g.id] = await taskService.getTasksByGroup(g.id); }
        catch { map[g.id] = []; }
      }));
      setTasksByGroup(map);
    } catch (e: any) {
      setError(e.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const allTasks = Object.values(tasksByGroup).flat();
  const submittedIds = new Set(submissions.map(s => s.taskId));
  const pendingCount = allTasks.filter(t => !submittedIds.has(t.id)).length;
  const reviewedCount = submissions.filter(s => s.status === 'reviewed').length;
  const earnedPoints = submissions.filter(s => s.grade !== undefined).reduce((sum, s) => sum + (s.grade ?? 0), 0);

  const filtered = groups.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    (g.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const cardStyle: React.CSSProperties = { background: 'var(--color-surface, #1f2937)', border: '1px solid var(--color-border, rgba(255,255,255,0.08))' };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">My Tasks</h1>
        <p className="text-sm text-gray-400 mt-0.5">View and submit your assigned tasks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Tasks', value: allTasks.length, color: '#e5e7eb' },
          { label: 'Pending', value: pendingCount, color: '#fcd34d' },
          { label: 'Reviewed', value: reviewedCount, color: '#6ee7b7' },
          { label: 'Points Earned', value: earnedPoints, color: '#a5b4fc' },
        ].map(s => (
          <div key={s.label} style={cardStyle} className="rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border bg-transparent outline-none focus:ring-1 focus:ring-white/20"
            style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#e5e7eb' }}
            placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-white/5 text-gray-400" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner />
          <p className="text-sm text-gray-400">Loading tasks...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={cardStyle} className="rounded-2xl p-16 text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400 font-medium">No tasks found</p>
          <p className="text-sm text-gray-500 mt-1">Tasks assigned by your instructor will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              tasks={tasksByGroup[group.id] ?? []}
              submissions={submissions}
              studentId={user?.uid ?? ''}
              onOpenTask={(task, sub) => {
                setSelectedTask(task);
                setSelectedGroup(group);
                setSelectedSub(sub);
              }}
            />
          ))}
        </div>
      )}

      {/* Task modal */}
      {selectedTask && selectedGroup && user && (
        <TaskModal
          task={selectedTask} group={selectedGroup}
          sub={selectedSub}
          studentId={user.uid}
          studentName={`${user.name ?? ''} ${(user as any).surname ?? ''}`.trim() || user.name || 'Student'}
          studentEmail={user.email}
          onClose={() => { setSelectedTask(null); setSelectedGroup(null); setSelectedSub(null); }}
          onSubmitted={async () => {
            setSelectedTask(null); setSelectedGroup(null); setSelectedSub(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

export default StudentTaskDashboard;
