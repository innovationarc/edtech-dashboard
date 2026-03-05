// src/pages/ComingSoonManagement.tsx
import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Save,
  CheckCircle, XCircle, Eye, AlertCircle, Users, Inbox,
  Zap, BookOpen, Star, Upload, GitMerge, BarChart2, Cpu,
  Layers, Smartphone, Link, FileText,
} from 'lucide-react';
import Card from '../components/ui/Card';
import {
  comingSoonService,
  ComingSoonFeature,
  EarlyAccessRequest,
  FeatureRequest,
  FeatureRequestStatus,
} from '../services/comingSoonService';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  'Zap', 'BookOpen', 'Star', 'Upload', 'GitMerge',
  'BarChart2', 'Cpu', 'Users', 'Layers', 'Smartphone',
];

const ICON_PREVIEW: Record<string, React.ReactNode> = {
  Zap:       <Zap size={18} />,
  BookOpen:  <BookOpen size={18} />,
  Star:      <Star size={18} />,
  Upload:    <Upload size={18} />,
  GitMerge:  <GitMerge size={18} />,
  BarChart2: <BarChart2 size={18} />,
  Cpu:       <Cpu size={18} />,
  Users:     <Users size={18} />,
  Layers:    <Layers size={18} />,
  Smartphone:<Smartphone size={18} />,
};

const EA_STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const FR_STATUS_OPTIONS: { value: FeatureRequestStatus; label: string; color: string }[] = [
  { value: 'pending',   label: 'Pending',   color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  { value: 'in_review', label: 'In Review', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  { value: 'reviewed',  label: 'Reviewed',  color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  { value: 'planned',   label: 'Planned',   color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  { value: 'declined',  label: 'Declined',  color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

const Spinner = () => (
  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
);

// ─── Feature Form Modal ───────────────────────────────────────────────────────
interface FeatureFormModalProps {
  feature?: ComingSoonFeature | null;
  existingCount: number;
  onSave: () => void;
  onClose: () => void;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  iconName: 'Zap',
  progress: 0,
  expectedDate: '',
  status: 'in_development' as const,
  order: 0,
};

const FeatureFormModal = ({ feature, existingCount, onSave, onClose }: FeatureFormModalProps) => {
  const [form, setForm] = useState(
    feature
      ? {
          title: feature.title,
          description: feature.description,
          iconName: feature.iconName,
          progress: feature.progress,
          expectedDate: feature.expectedDate,
          status: feature.status,
          order: feature.order,
        }
      : { ...EMPTY_FORM, order: existingCount },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.title.trim() || !form.expectedDate.trim()) {
      setError('Title and Expected Date are required.');
      return;
    }
    setSaving(true);
    try {
      if (feature) {
        await comingSoonService.updateFeature(feature.id, form);
      } else {
        await comingSoonService.addFeature(form);
      }
      onSave();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background-800 flex items-center justify-between p-6 border-b border-background-700 z-10">
          <h3 className="text-white font-semibold text-lg">
            {feature ? 'Edit Feature' : 'Add New Feature'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Title *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Advanced Analytics"
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Brief description of this feature..."
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Icon</label>
              <select
                value={form.iconName}
                onChange={e => set('iconName', e.target.value)}
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
              >
                {ICON_OPTIONS.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
              >
                <option value="in_development">In Development</option>
                <option value="beta">Beta</option>
                <option value="released">Released</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">
              Progress — {form.progress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.progress}
              onChange={e => set('progress', Number(e.target.value))}
              className="w-full accent-primary-500"
            />
            <div className="w-full bg-background-900 rounded-full h-2 mt-1">
              <div
                className="h-2 rounded-full bg-primary-500 transition-all"
                style={{ width: `${form.progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Expected Date *</label>
              <input
                value={form.expectedDate}
                onChange={e => set('expectedDate', e.target.value)}
                placeholder="e.g. Q2 2025"
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Display Order</label>
              <input
                type="number"
                value={form.order}
                onChange={e => set('order', Number(e.target.value))}
                min={0}
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background-800 flex gap-3 p-6 border-t border-background-700">
          <button
            onClick={onClose}
            className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {saving ? <Spinner /> : <Save size={14} />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Early Access Review Modal ────────────────────────────────────────────────
interface EarlyAccessReviewModalProps {
  request: EarlyAccessRequest;
  adminId: string;
  onDone: () => void;
  onClose: () => void;
}

const EarlyAccessReviewModal = ({ request, adminId, onDone, onClose }: EarlyAccessReviewModalProps) => {
  const [accessLink, setAccessLink] = useState(request.accessLink ?? '');
  const [guidelines, setGuidelines] = useState(request.guidelines ?? '');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    if (!accessLink.trim()) return;
    setAction('approve');
    setLoading(true);
    try {
      await comingSoonService.approveEarlyAccess(request.id, accessLink.trim(), guidelines.trim(), adminId);
      onDone();
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setAction('reject');
    setLoading(true);
    try {
      await comingSoonService.rejectEarlyAccess(request.id, adminId);
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-background-700">
          <h3 className="text-white font-semibold">Review Early Access</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-background-900 rounded-lg p-3 text-sm">
            <p className="text-gray-400">Student</p>
            <p className="text-white font-medium">{request.studentName}</p>
          </div>

          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1.5 mb-1.5">
              <Link size={13} /> Access Link *
            </label>
            <input
              value={accessLink}
              onChange={e => setAccessLink(e.target.value)}
              placeholder="https://..."
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1.5 mb-1.5">
              <FileText size={13} /> Guidelines (optional)
            </label>
            <textarea
              value={guidelines}
              onChange={e => setGuidelines(e.target.value)}
              rows={3}
              placeholder="Add any instructions or notes for the student..."
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-background-700">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading && action === 'reject' ? <Spinner /> : <XCircle size={14} />} Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={loading || !accessLink.trim()}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            {loading && action === 'approve' ? <Spinner /> : <CheckCircle size={14} />} Approve
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Early Access Requests Panel ──────────────────────────────────────────────
interface EarlyAccessPanelProps {
  featureId: string;
  featureTitle: string;
  adminId: string;
}

const EarlyAccessPanel = ({ featureId, featureTitle, adminId }: EarlyAccessPanelProps) => {
  const [requests, setRequests] = useState<EarlyAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<EarlyAccessRequest | null>(null);

  const load = () => {
    setLoading(true);
    comingSoonService.getEarlyAccessByFeature(featureId).then(setRequests).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [featureId]);

  if (loading) return <div className="py-4 text-center"><Spinner /></div>;

  return (
    <div className="space-y-2 mt-4">
      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No early access requests yet.</p>
      ) : (
        requests.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3 bg-background-900 border border-background-700 rounded-lg px-4 py-3">
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{r.studentName}</p>
              <p className="text-gray-500 text-xs">{fmt(r.requestedAt)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2.5 py-1 rounded-full ${EA_STATUS_STYLES[r.status]}`}>
                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
              </span>
              {r.status === 'pending' && (
                <button
                  onClick={() => setReviewing(r)}
                  className="text-xs bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Review
                </button>
              )}
            </div>
          </div>
        ))
      )}
      {reviewing && (
        <EarlyAccessReviewModal
          request={reviewing}
          adminId={adminId}
          onDone={() => { setReviewing(null); load(); }}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
};

// ─── Feature Row ──────────────────────────────────────────────────────────────
interface FeatureRowProps {
  feature: ComingSoonFeature;
  adminId: string;
  onEdit: (f: ComingSoonFeature) => void;
  onDelete: (id: string) => void;
}

const FeatureRow = ({ feature, adminId, onEdit, onDelete }: FeatureRowProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-background-800 border border-background-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="h-10 w-10 rounded-full bg-background-900 flex items-center justify-center flex-shrink-0 text-primary-400">
          {ICON_PREVIEW[feature.iconName] ?? <Zap size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-medium">{feature.title}</p>
            <span className="text-xs bg-background-900 border border-background-700 text-gray-400 px-2 py-0.5 rounded-full">
              {feature.expectedDate}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex-1 max-w-[200px] bg-background-900 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${feature.progress}%` }} />
            </div>
            <span className="text-xs text-gray-400">{feature.progress}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-background-900 hover:bg-background-700 border border-background-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Users size={12} /> Requests {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={() => onEdit(feature)}
            className="p-2 text-gray-400 hover:text-white hover:bg-background-700 rounded-lg transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(feature.id)}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-background-700 pt-3">
          <EarlyAccessPanel featureId={feature.id} featureTitle={feature.title} adminId={adminId} />
        </div>
      )}
    </div>
  );
};

// ─── Feature Requests Tab ─────────────────────────────────────────────────────
const FeatureRequestsTab = ({ adminId }: { adminId: string }) => {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    comingSoonService.getAllFeatureRequests().then(setRequests).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatusUpdate = async (requestId: string, status: FeatureRequestStatus) => {
    setUpdating(requestId);
    try {
      await comingSoonService.updateFeatureRequestStatus(requestId, status, noteEditing[requestId]);
      load();
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-3">
      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Inbox size={40} className="mx-auto mb-3 opacity-40" />
          <p>No feature requests yet.</p>
        </div>
      ) : (
        requests.map(r => {
          const statusMeta = FR_STATUS_OPTIONS.find(s => s.value === r.status);
          return (
            <div key={r.id} className="bg-background-800 border border-background-700 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-white font-medium text-sm">{r.studentName}</p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${statusMeta?.color}`}>
                      {statusMeta?.label}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{r.description}</p>
                  <p className="text-gray-500 text-xs mt-2">{fmt(r.requestedAt)}</p>

                  {/* Admin note */}
                  <div className="mt-3">
                    <input
                      value={noteEditing[r.id] ?? (r.adminNote || '')}
                      onChange={e => setNoteEditing(prev => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="Add admin note (optional)..."
                      className="w-full bg-background-900 border border-background-700 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Status selector */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {FR_STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusUpdate(r.id, opt.value)}
                      disabled={updating === r.id || r.status === opt.value}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${r.status === opt.value
                          ? opt.color + ' cursor-default'
                          : 'bg-background-900 border-background-700 text-gray-400 hover:border-primary-500 hover:text-white'
                        }`}
                    >
                      {updating === r.id && r.status !== opt.value ? <Spinner /> : opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'features' | 'feature_requests';

const ComingSoonManagement = () => {
  const { user } = useDashboard();

  const [activeTab, setActiveTab] = useState<Tab>('features');
  const [features, setFeatures] = useState<ComingSoonFeature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ComingSoonFeature | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFeatures = () => {
    setLoadingFeatures(true);
    comingSoonService.getFeatures().then(setFeatures).finally(() => setLoadingFeatures(false));
  };

  useEffect(() => { loadFeatures(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this feature? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await comingSoonService.deleteFeature(id);
      loadFeatures();
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = () => {
    setShowFormModal(false);
    setEditingFeature(null);
    loadFeatures();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Coming Soon Management</h1>
          <p className="text-gray-400 text-sm mt-1">Manage upcoming features, early access, and feature requests.</p>
        </div>
        {activeTab === 'features' && (
          <button
            onClick={() => { setEditingFeature(null); setShowFormModal(true); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg transition-colors text-sm font-medium self-start sm:self-auto"
          >
            <Plus size={16} /> Add Feature
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Features', value: features.length, icon: <Layers size={20} className="text-primary-400" /> },
          { label: 'In Development', value: features.filter(f => f.status === 'in_development').length, icon: <Cpu size={20} className="text-yellow-400" /> },
          { label: 'Beta / Released', value: features.filter(f => f.status !== 'in_development').length, icon: <CheckCircle size={20} className="text-green-400" /> },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-background-900 flex items-center justify-center">{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-background-700">
        {([
          { id: 'features', label: 'Features', icon: <Layers size={15} /> },
          { id: 'feature_requests', label: 'Feature Requests', icon: <Inbox size={15} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === tab.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-gray-400 hover:text-white'
              }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'features' ? (
        loadingFeatures ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : features.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Layers size={40} className="mx-auto mb-3 opacity-40" />
            <p>No features added yet.</p>
            <button
              onClick={() => setShowFormModal(true)}
              className="mt-4 text-primary-400 hover:text-primary-300 text-sm underline"
            >
              Add your first feature
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {features.map(f => (
              <FeatureRow
                key={f.id}
                feature={f}
                adminId={user?.uid ?? ''}
                onEdit={feat => { setEditingFeature(feat); setShowFormModal(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
      ) : (
        <FeatureRequestsTab adminId={user?.uid ?? ''} />
      )}

      {/* Feature Form Modal */}
      {showFormModal && (
        <FeatureFormModal
          feature={editingFeature}
          existingCount={features.length}
          onSave={handleSaved}
          onClose={() => { setShowFormModal(false); setEditingFeature(null); }}
        />
      )}
    </div>
  );
};

export default ComingSoonManagement;
