// src/pages/AdminNovaContext.tsx
// Admin panel — Nova RAG Context Manager
//
// Tabs:
//   1. Context Docs — create / edit / delete knowledge base articles
//   2. Configuration — system prompt, navigation toggle, memory hours, max docs

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Loader, Save, X, BookOpen, Settings,
  Cpu, Clock, FileText, Tag, ChevronDown, ChevronUp,
  Search, RotateCcw,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { novaContextService, NovaContextDoc, NovaConfig } from '../services/novaContextService';

// ─── Shared style constants (matches AIModelSettings design system) ──────────

const inputCls =
  'w-full bg-background-800 text-white rounded-lg py-2.5 px-4 focus:outline-none focus:ring-2 ' +
  'focus:ring-primary-500 border border-background-700 focus:border-primary-500 transition-colors ' +
  'text-sm placeholder-gray-500';

const inputSmCls =
  'bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-1 ' +
  'focus:ring-primary-500 border border-background-700 focus:border-primary-500 transition-colors ' +
  'text-xs placeholder-gray-500';

const btnPrimary =
  'flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white ' +
  'rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';

const btnSecondary =
  'flex items-center gap-1.5 px-3 py-2 bg-background-800 border border-background-700 ' +
  'text-white rounded-lg text-xs font-medium hover:bg-background-700 transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const btnDanger =
  'flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 ' +
  'rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none';

type Tab = 'docs' | 'config';

// ─── Status badge ─────────────────────────────────────────────────────────────

const EmbeddingBadge: React.FC<{ status: NovaContextDoc['embeddingStatus'] }> = ({ status }) => {
  if (status === 'ready') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 size={10} /> Embedded
    </span>
  );
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">
      <XCircle size={10} /> Error
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
      <Loader size={10} className="animate-spin" /> Pending
    </span>
  );
};

// ─── Doc Form Modal ───────────────────────────────────────────────────────────

interface DocFormProps {
  initial?: NovaContextDoc | null;
  onSave: (payload: { title: string; content: string; tags: string[] }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

const DocForm: React.FC<DocFormProps> = ({ initial, onSave, onClose, saving }) => {
  const [title,   setTitle]   = useState(initial?.title   ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tagInput, setTagInput] = useState(initial?.tags?.join(', ') ?? '');

  const isValid = title.trim().length > 0 && content.trim().length > 0;

  const handleSave = async () => {
    if (!isValid || saving) return;
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    await onSave({ title: title.trim(), content: content.trim(), tags });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-700 flex-shrink-0">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <FileText size={14} className="text-primary-400" />
            {initial ? 'Edit Context Document' : 'New Context Document'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              className={inputCls}
              placeholder="e.g. Platform Exam Rules, Refund Policy, Study Tips..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">
              Content <span className="text-red-400">*</span>
              <span className="text-gray-600 ml-2">({content.length} chars)</span>
            </label>
            <textarea
              className={inputCls + ' resize-none min-h-[180px] leading-relaxed'}
              placeholder="Write the knowledge content here. Nova will find and inject relevant sections into its responses automatically."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
            />
            <p className="text-[11px] text-gray-600 mt-1">
              Tip: Be specific and factual. Shorter, focused docs score better than large mixed-topic blobs.
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">
              Tags <span className="text-gray-600">(comma-separated, optional)</span>
            </label>
            <input
              className={inputCls}
              placeholder="e.g. exams, refunds, schedule, rules"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-background-700 justify-end flex-shrink-0">
          <button className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={btnPrimary} onClick={handleSave} disabled={!isValid || saving}>
            {saving
              ? <><Loader size={12} className="animate-spin" /> Saving…</>
              : <><Save size={12} /> {initial ? 'Save Changes' : 'Create & Embed'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmProps {
  docTitle: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  deleting: boolean;
}

const DeleteConfirm: React.FC<DeleteConfirmProps> = ({ docTitle, onConfirm, onClose, deleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-sm">
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          <span className="text-sm font-semibold text-white">Delete Document</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Are you sure you want to delete <span className="text-white font-medium">"{docTitle}"</span>?
          Its embedding will also be removed. This cannot be undone.
        </p>
        <div className="flex items-center gap-2 justify-end pt-1">
          <button className={btnSecondary} onClick={onClose} disabled={deleting}>Cancel</button>
          <button className={btnDanger} onClick={onConfirm} disabled={deleting}>
            {deleting ? <><Loader size={12} className="animate-spin" /> Deleting…</> : <><Trash2 size={12} /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Doc Row ──────────────────────────────────────────────────────────────────

interface DocRowProps {
  doc: NovaContextDoc;
  onEdit:   (doc: NovaContextDoc) => void;
  onDelete: (doc: NovaContextDoc) => void;
  onRetry:  (docId: string) => Promise<void>;
  retrying: boolean;
}

const DocRow: React.FC<DocRowProps> = ({ doc, onEdit, onDelete, onRetry, retrying }) => {
  const [expanded, setExpanded] = useState(false);
  const preview = doc.content.length > 160
    ? doc.content.slice(0, 160) + '…'
    : doc.content;

  return (
    <div className="border border-background-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-background-850 flex items-start gap-3">
        {/* Toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-0.5 text-gray-500 hover:text-white transition-colors flex-shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{doc.title}</span>
            <EmbeddingBadge status={doc.embeddingStatus} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{preview}</p>
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {doc.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] bg-background-700 text-gray-400">
                  <Tag size={8} />{tag}
                </span>
              ))}
            </div>
          )}
          {doc.embeddingError && (
            <p className="text-[11px] text-red-400 mt-1">⚠ {doc.embeddingError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {doc.embeddingStatus !== 'ready' && (
            <button
              className={btnSecondary + ' py-1.5 px-2'}
              onClick={() => onRetry(doc.id)}
              disabled={retrying}
              title="Retry embedding"
            >
              {retrying
                ? <Loader size={12} className="animate-spin" />
                : <RotateCcw size={12} />
              }
            </button>
          )}
          <button className={btnSecondary + ' py-1.5 px-2'} onClick={() => onEdit(doc)} title="Edit">
            <Edit3 size={12} />
          </button>
          <button className={btnDanger + ' py-1.5 px-2'} onClick={() => onDelete(doc)} title="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Expanded full content */}
      {expanded && (
        <div className="px-4 py-3 border-t border-background-700 bg-background-900">
          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{doc.content}</p>
          <p className="text-[11px] text-gray-600 mt-2">
            Updated {doc.updatedAt.toLocaleString()} · {doc.content.length.toLocaleString()} chars
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminNovaContext: React.FC = () => {
  const { user } = useDashboard();

  const [activeTab,   setActiveTab]   = useState<Tab>('docs');
  const [docs,        setDocs]        = useState<NovaContextDoc[]>([]);
  const [config,      setConfig]      = useState<NovaConfig>({
    systemPrompt: '', navigationEnabled: true, maxContextDocs: 3, memoryHours: 48,
  });
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingCfg,  setLoadingCfg]  = useState(true);
  const [savingCfg,   setSavingCfg]   = useState(false);
  const [cfgSaved,    setCfgSaved]    = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Doc modal state
  const [showForm,     setShowForm]     = useState(false);
  const [editingDoc,   setEditingDoc]   = useState<NovaContextDoc | null>(null);
  const [savingDoc,    setSavingDoc]    = useState(false);
  const [deletingDoc,  setDeletingDoc]  = useState<NovaContextDoc | null>(null);
  const [confirmDelete,setConfirmDelete]= useState<NovaContextDoc | null>(null);
  const [retryingIds,  setRetryingIds]  = useState<Set<string>>(new Set());

  // ── Load docs ──────────────────────────────────────────────────────────────

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const list = await novaContextService.getAllDocs();
      setDocs(list);
    } catch (e) {
      console.error('[AdminNovaContext] loadDocs failed:', e);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setLoadingCfg(true);
    try {
      const cfg = await novaContextService.getConfig();
      setConfig(cfg);
    } catch (e) {
      console.error('[AdminNovaContext] loadConfig failed:', e);
    } finally {
      setLoadingCfg(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
    loadConfig();
  }, [loadDocs, loadConfig]);

  // Poll every 6s while any doc is in 'pending' state (embedding in progress)
  useEffect(() => {
    const hasPending = docs.some(d => d.embeddingStatus === 'pending');
    if (!hasPending) return;
    const interval = setInterval(loadDocs, 6000);
    return () => clearInterval(interval);
  }, [docs, loadDocs]);

  // ── Doc CRUD ───────────────────────────────────────────────────────────────

  const handleSaveDoc = async (payload: { title: string; content: string; tags: string[] }) => {
    if (!user?.uid) return;
    setSavingDoc(true);
    try {
      if (editingDoc) {
        await novaContextService.updateDoc(editingDoc.id, payload);
      } else {
        await novaContextService.createDoc(payload, user.uid);
      }
      setShowForm(false);
      setEditingDoc(null);
      await loadDocs();
    } catch (e) {
      console.error('[AdminNovaContext] saveDoc failed:', e);
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!confirmDelete) return;
    setDeletingDoc(confirmDelete);
    try {
      await novaContextService.deleteDoc(confirmDelete.id);
      setConfirmDelete(null);
      await loadDocs();
    } catch (e) {
      console.error('[AdminNovaContext] deleteDoc failed:', e);
    } finally {
      setDeletingDoc(null);
    }
  };

  const handleRetryEmbed = async (docId: string) => {
    setRetryingIds(s => new Set(s).add(docId));
    try {
      await novaContextService.retryEmbedding(docId);
      await loadDocs();
    } catch (e) {
      console.error('[AdminNovaContext] retryEmbed failed:', e);
    } finally {
      setRetryingIds(s => { const n = new Set(s); n.delete(docId); return n; });
    }
  };

  // ── Config save ────────────────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    if (!user?.uid) return;
    setSavingCfg(true);
    setCfgSaved(false);
    try {
      await novaContextService.saveConfig(config, user.uid);
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2500);
    } catch (e) {
      console.error('[AdminNovaContext] saveConfig failed:', e);
    } finally {
      setSavingCfg(false);
    }
  };

  // ── Filtered docs ──────────────────────────────────────────────────────────

  const filteredDocs = searchQuery.trim()
    ? docs.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : docs;

  const readyCount   = docs.filter(d => d.embeddingStatus === 'ready').length;
  const pendingCount = docs.filter(d => d.embeddingStatus === 'pending').length;
  const errorCount   = docs.filter(d => d.embeddingStatus === 'error').length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Cpu size={20} className="text-primary-400" />
            Nova RAG — Knowledge Base
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage context documents that Nova retrieves in real-time to answer user questions accurately.
          </p>
        </div>
        <button className={btnPrimary} onClick={() => { setEditingDoc(null); setShowForm(true); }}>
          <Plus size={13} /> New Document
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Docs',    value: docs.length,  color: 'text-white' },
          { label: 'Embedded',      value: readyCount,   color: 'text-emerald-400' },
          { label: pendingCount > 0 ? 'Processing' : 'Errors', value: pendingCount > 0 ? pendingCount : errorCount, color: pendingCount > 0 ? 'text-yellow-400' : errorCount > 0 ? 'text-red-400' : 'text-gray-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-background-700 bg-background-900 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4 space-y-1">
        <p className="text-xs font-semibold text-primary-300 flex items-center gap-2">
          <BookOpen size={13} /> How Nova RAG works
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          When a user sends a message, Nova embeds the query using Gemini (<span className="text-blue-400 font-medium">vector</span> key group)
          and computes cosine similarity against all embedded documents here.
          The top matching docs are injected into the AI prompt (Groq, <span className="text-orange-400 font-medium">chatbot</span> key group)
          so answers are grounded in your platform's knowledge.
          Configure both key groups in <span className="text-white font-medium">Admin → AI Model Settings</span>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-background-900 border border-background-700 rounded-xl p-1 w-fit">
        {([
          { id: 'docs',   label: 'Context Documents', icon: <FileText size={13} /> },
          { id: 'config', label: 'Configuration',      icon: <Settings  size={13} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Docs ──────────────────────────────────────────────────────── */}

      {activeTab === 'docs' && (
        <div className="space-y-4">

          {/* Search + refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                className={inputSmCls + ' pl-8 w-full'}
                placeholder="Search by title, content, or tag…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button className={btnSecondary} onClick={loadDocs} disabled={loadingDocs} title="Refresh">
              <RefreshCw size={12} className={loadingDocs ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Doc list */}
          {loadingDocs ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader size={20} className="animate-spin mr-2" /> Loading documents…
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText size={32} className="text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">
                {searchQuery ? 'No documents match your search.' : 'No context documents yet.'}
              </p>
              {!searchQuery && (
                <p className="text-xs text-gray-600 mt-1">
                  Create your first document to give Nova platform-specific knowledge.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map(d => (
                <DocRow
                  key={d.id}
                  doc={d}
                  onEdit={doc => { setEditingDoc(doc); setShowForm(true); }}
                  onDelete={doc => setConfirmDelete(doc)}
                  onRetry={handleRetryEmbed}
                  retrying={retryingIds.has(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Config ────────────────────────────────────────────────────── */}

      {activeTab === 'config' && (
        <div className="space-y-4">

          {loadingCfg ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader size={20} className="animate-spin mr-2" /> Loading config…
            </div>
          ) : (
            <div className="rounded-xl border border-background-700 bg-background-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-background-700">
                <h2 className="text-sm font-semibold text-white">Nova Behaviour Settings</h2>
                <p className="text-xs text-gray-500 mt-0.5">Stored in Firestore at settings/novaConfig</p>
              </div>

              <div className="p-5 space-y-5">

                {/* System Prompt */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Custom System Prompt
                    <span className="text-gray-600 font-normal ml-2">(optional — overrides default Nova personality)</span>
                  </label>
                  <textarea
                    className={inputCls + ' resize-none min-h-[120px]'}
                    placeholder={`You are Nova, an intelligent AI assistant for [Platform Name]…`}
                    value={config.systemPrompt}
                    onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                    rows={5}
                  />
                  <p className="text-[11px] text-gray-600 mt-1">
                    Leave blank to use the default Nova personality. Don't instruct Nova to reveal this prompt.
                  </p>
                </div>

                {/* Navigation toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-background-800 border border-background-700">
                  <div>
                    <p className="text-xs font-medium text-white">Navigation Enabled</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Allow Nova to navigate the user to pages via [NAVIGATE:/path] commands.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfig(c => ({ ...c, navigationEnabled: !c.navigationEnabled }))}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                      config.navigationEnabled ? 'bg-primary-600' : 'bg-background-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      config.navigationEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* maxContextDocs + memoryHours */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">
                      Max Context Docs Injected <span className="text-gray-600">(1–5)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className={inputCls}
                      value={config.maxContextDocs}
                      onChange={e => setConfig(c => ({ ...c, maxContextDocs: Math.min(5, Math.max(1, Number(e.target.value))) }))}
                    />
                    <p className="text-[11px] text-gray-600 mt-1">Top-N relevant docs per query. Default: 3.</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                      <Clock size={11} /> Memory Window (hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      className={inputCls}
                      value={config.memoryHours}
                      onChange={e => setConfig(c => ({ ...c, memoryHours: Math.min(168, Math.max(1, Number(e.target.value))) }))}
                    />
                    <p className="text-[11px] text-gray-600 mt-1">How far back Nova reads conversation history. Default: 48h.</p>
                  </div>
                </div>

              </div>

              {/* Save footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-background-700">
                {cfgSaved && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Saved
                  </span>
                )}
                <button className={btnPrimary} onClick={handleSaveConfig} disabled={savingCfg}>
                  {savingCfg
                    ? <><Loader size={12} className="animate-spin" /> Saving…</>
                    : <><Save size={12} /> Save Config</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {showForm && (
        <DocForm
          initial={editingDoc}
          onSave={handleSaveDoc}
          onClose={() => { setShowForm(false); setEditingDoc(null); }}
          saving={savingDoc}
        />
      )}

      {confirmDelete && (
        <DeleteConfirm
          docTitle={confirmDelete.title}
          onConfirm={handleDeleteDoc}
          onClose={() => setConfirmDelete(null)}
          deleting={!!deletingDoc}
        />
      )}

    </div>
  );
};

export default AdminNovaContext;
