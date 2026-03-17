// src/pages/ComingSoonManagement.tsx
import PageSkeleton from '../components/ui/PageSkeleton';
import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Save,
  CheckCircle, XCircle, AlertCircle, Users, Inbox,
  Zap, BookOpen, Star, Upload, GitMerge, BarChart2, Cpu,
  Layers, Smartphone, Link, FileText, Activity, Clock,
  Wifi, Globe, Shield, Lock, Bell, Camera, Code, Database,
  Download, Filter, Flag, Gift, Hash, Heart, Home, Image,
  Mail, Map, MessageSquare, Monitor, Music, Package, Play,
  Search, Settings, Share2, Sliders, Tag, Target, Terminal,
  Truck, Video, Wrench, Aperture, Award,
} from 'lucide-react';
import Card from '../components/ui/Card';
import {
  comingSoonService,
  ComingSoonFeature,
  EarlyAccessRequest,
  FeatureRequest,
  FeatureRequestStatus,
  ActivityLog,
  ActivityLogAction,
} from '../services/comingSoonService';
import { useDashboard } from '../contexts/DashboardContext';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';

// ─── Icon registry ─────────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  'Zap', 'BookOpen', 'Star', 'Upload', 'GitMerge',
  'BarChart2', 'Cpu', 'Users', 'Layers', 'Smartphone',
  'Wifi', 'Globe', 'Shield', 'Lock', 'Bell',
  'Camera', 'Code', 'Database', 'Download', 'Filter',
  'Flag', 'Gift', 'Hash', 'Heart', 'Home',
  'Image', 'Mail', 'Map', 'MessageSquare', 'Monitor',
  'Music', 'Package', 'Play', 'Search', 'Settings',
  'Share2', 'Sliders', 'Tag', 'Target', 'Terminal',
  'Truck', 'Video', 'Wrench', 'Aperture', 'Award',
];

const ICON_COMPONENTS: Record<string, React.ReactNode> = {
  Zap: <Zap size={18} />, BookOpen: <BookOpen size={18} />, Star: <Star size={18} />,
  Upload: <Upload size={18} />, GitMerge: <GitMerge size={18} />, BarChart2: <BarChart2 size={18} />,
  Cpu: <Cpu size={18} />, Users: <Users size={18} />, Layers: <Layers size={18} />,
  Smartphone: <Smartphone size={18} />, Wifi: <Wifi size={18} />, Globe: <Globe size={18} />,
  Shield: <Shield size={18} />, Lock: <Lock size={18} />, Bell: <Bell size={18} />,
  Camera: <Camera size={18} />, Code: <Code size={18} />, Database: <Database size={18} />,
  Download: <Download size={18} />, Filter: <Filter size={18} />, Flag: <Flag size={18} />,
  Gift: <Gift size={18} />, Hash: <Hash size={18} />, Heart: <Heart size={18} />,
  Home: <Home size={18} />, Image: <Image size={18} />, Mail: <Mail size={18} />,
  Map: <Map size={18} />, MessageSquare: <MessageSquare size={18} />, Monitor: <Monitor size={18} />,
  Music: <Music size={18} />, Package: <Package size={18} />, Play: <Play size={18} />,
  Search: <Search size={18} />, Settings: <Settings size={18} />, Share2: <Share2 size={18} />,
  Sliders: <Sliders size={18} />, Tag: <Tag size={18} />, Target: <Target size={18} />,
  Terminal: <Terminal size={18} />, Truck: <Truck size={18} />, Video: <Video size={18} />,
  Wrench: <Wrench size={18} />, Aperture: <Aperture size={18} />, Award: <Award size={18} />,
};

const getIconNode = (name: string) => ICON_COMPONENTS[name] ?? <Zap size={18} />;

// ─── Status styles ─────────────────────────────────────────────────────────────
const EA_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  approved:  'bg-green-500/20 text-green-400 border border-green-500/30',
  rejected:  'bg-red-500/20 text-red-400 border border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

const FR_STATUS_OPTIONS: { value: FeatureRequestStatus; label: string; color: string }[] = [
  { value: 'pending',   label: 'Pending',   color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  { value: 'in_review', label: 'In Review', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  { value: 'reviewed',  label: 'Reviewed',  color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  { value: 'planned',   label: 'Planned',   color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  { value: 'declined',  label: 'Declined',  color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
];

const LOG_ACTION_LABELS: Record<ActivityLogAction, string> = {
  feature_added:                  'Feature Added',
  feature_edited:                 'Feature Edited',
  feature_deleted:                'Feature Deleted',
  early_access_approved:          'Early Access Approved',
  early_access_rejected:          'Early Access Rejected',
  early_access_cancelled:         'Early Access Cancelled',
  feature_request_status_updated: 'Feature Request Updated',
  feature_request_deleted:        'Feature Request Deleted',
};

const LOG_ACTION_COLORS: Record<ActivityLogAction, string> = {
  feature_added:                  'bg-green-500/20 text-green-400 border border-green-500/30',
  feature_edited:                 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  feature_deleted:                'bg-red-500/20 text-red-400 border border-red-500/30',
  early_access_approved:          'bg-green-500/20 text-green-400 border border-green-500/30',
  early_access_rejected:          'bg-red-500/20 text-red-400 border border-red-500/30',
  early_access_cancelled:         'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  feature_request_status_updated: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  feature_request_deleted:        'bg-red-500/20 text-red-400 border border-red-500/30',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) => new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const Spinner = () => (
  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
);

const IdBadge = ({ id }: { id?: string }) =>
  id ? (
    <span className="text-[10px] font-mono bg-background-900 border border-background-700 text-primary-400 px-1.5 py-0.5 rounded">
      {id}
    </span>
  ) : null;

// ─── Feature Form Modal ────────────────────────────────────────────────────────
interface FeatureFormModalProps {
  feature?: ComingSoonFeature | null;
  existingCount: number;
  actor: { uid: string; userId?: string; name: string };
  onSave: () => void;
  onClose: () => void;
}

const EMPTY_FORM = {
  title: '', description: '', iconName: 'Zap',
  progress: 0, expectedDate: '', status: 'in_development' as const, order: 0, tryLink: '',
};

const FeatureFormModal = ({ feature, existingCount, actor, onSave, onClose }: FeatureFormModalProps) => {
  const [form, setForm] = useState(
    feature
      ? { title: feature.title, description: feature.description, iconName: feature.iconName,
          progress: feature.progress, expectedDate: feature.expectedDate, status: feature.status, order: feature.order, tryLink: feature.tryLink ?? '' }
      : { ...EMPTY_FORM, order: existingCount },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.expectedDate.trim()) { setError('Title and Expected Date are required.'); return; }
    setSaving(true);
    try {
      if (feature) {
        await comingSoonService.updateFeature(feature.id, form, actor, feature.title);
      } else {
        const newId = await comingSoonService.addFeature(form, actor);
        // Notify all active students about the new feature
        userService.getAllUsers().then(users => {
          users.filter(u => u.role === 'student' && u.status === 'active').forEach(u => {
            notificationService.createNotification({
              userId: u.uid,
              title: 'New Feature Coming Soon',
              message: form.title.trim(),
              type: 'announcement',
              priority: 'low',
              isPermanent: true,
              relatedId: newId,
              relatedType: 'comingSoon',
              metadata: { featureTitle: form.title.trim(), expectedDate: form.expectedDate },
            });
          });
        }).catch(() => {});
      }
      onSave();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background-800 flex items-center justify-between p-6 border-b border-background-700 z-10">
          <h3 className="text-white font-semibold text-lg">{feature ? 'Edit Feature' : 'Add New Feature'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Advanced Analytics"
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors" />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="Brief description of this feature..."
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 transition-colors" />
          </div>

          {/* Visual icon picker */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Icon</label>
            <div className="grid grid-cols-9 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {ICON_OPTIONS.map(i => (
                <button key={i} type="button" onClick={() => set('iconName', i)} title={i}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all
                    ${form.iconName === i
                      ? 'border-primary-500 bg-primary-500/15 text-primary-400'
                      : 'border-background-700 bg-background-900 text-gray-400 hover:border-background-600 hover:text-white'}`}>
                  {ICON_COMPONENTS[i]}
                  <span className="text-[9px] leading-none truncate w-full text-center opacity-70">{i}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors">
              <option value="in_development">In Development</option>
              <option value="beta">Beta</option>
              <option value="released">Released</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Progress — {form.progress}%</label>
            <input type="range" min={0} max={100} value={form.progress}
              onChange={e => set('progress', Number(e.target.value))} className="w-full accent-primary-500" />
            <div className="w-full bg-background-900 rounded-full h-2 mt-1">
              <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${form.progress}%` }} />
            </div>
          </div>

          {form.progress === 100 && form.status === 'in_development' && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm rounded-lg px-4 py-2">
              <AlertCircle size={14} /> 100% complete — consider moving status to Beta or Released.
            </div>
          )}

          {(form.status === 'beta' || form.status === 'released') && (
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Try Link <span className="text-gray-500">(optional)</span></label>
              <input value={form.tryLink} onChange={e => set('tryLink', e.target.value)}
                placeholder="https://..."
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Expected Date *</label>
              <input value={form.expectedDate} onChange={e => set('expectedDate', e.target.value)}
                placeholder="e.g. Q2 2025"
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Display Order</label>
              <input type="number" value={form.order} onChange={e => set('order', Number(e.target.value))} min={0}
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors" />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background-800 flex gap-3 p-6 border-t border-background-700">
          <button onClick={onClose} className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg transition-colors text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
            {saving ? <Spinner /> : <Save size={14} />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Early Access Review Modal ─────────────────────────────────────────────────
interface EarlyAccessReviewModalProps {
  request: EarlyAccessRequest;
  actor: { uid: string; userId?: string; name: string };
  featureTitle?: string;
  onDone: () => void;
  onClose: () => void;
}

const EarlyAccessReviewModal = ({ request, actor, featureTitle, onDone, onClose }: EarlyAccessReviewModalProps) => {
  const [accessLink, setAccessLink] = useState(request.accessLink ?? '');
  const [guidelines, setGuidelines] = useState(request.guidelines ?? '');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    if (!accessLink.trim()) return;
    setAction('approve'); setLoading(true);
    try {
      await comingSoonService.approveEarlyAccess(request.id, accessLink.trim(), guidelines.trim(), actor, featureTitle, request.studentName);
      notificationService.createNotification({
        userId: request.studentId,
        title: 'Early Access Approved 🎉',
        message: featureTitle ?? request.featureTitle,
        type: 'announcement',
        priority: 'high',
        isPermanent: true,
        relatedId: request.featureId,
        relatedType: 'earlyAccess',
        metadata: { featureTitle: featureTitle ?? request.featureTitle, accessLink: accessLink.trim() },
      });
      onDone();
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    setAction('reject'); setLoading(true);
    try {
      await comingSoonService.rejectEarlyAccess(request.id, actor, featureTitle, request.studentName, request.rejectionCount);
      notificationService.createNotification({
        userId: request.studentId,
        title: 'Early Access Request Rejected',
        message: featureTitle ?? request.featureTitle,
        type: 'system',
        priority: 'low',
        isPermanent: true,
        relatedId: request.featureId,
        relatedType: 'earlyAccess',
        metadata: { featureTitle: featureTitle ?? request.featureTitle },
      });
      onDone();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-background-700">
          <h3 className="text-white font-semibold">Review Early Access</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-background-900 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-xs">Student</p>
              <IdBadge id={request.studentUserId} />
            </div>
            <p className="text-white font-medium">{request.studentName}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-400 text-xs">Current status:</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${EA_STATUS_STYLES[request.status]}`}>
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1.5 mb-1.5"><Link size={13} /> Access Link *</label>
            <input value={accessLink} onChange={e => setAccessLink(e.target.value)} placeholder="https://..."
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1.5 mb-1.5"><FileText size={13} /> Guidelines (optional)</label>
            <textarea value={guidelines} onChange={e => setGuidelines(e.target.value)} rows={3}
              placeholder="Add any instructions or notes for the student..."
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-background-700">
          <button onClick={handleReject} disabled={loading}
            className="flex-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
            {loading && action === 'reject' ? <Spinner /> : <XCircle size={14} />} Reject
          </button>
          <button onClick={handleApprove} disabled={loading || !accessLink.trim()}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5">
            {loading && action === 'approve' ? <Spinner /> : <CheckCircle size={14} />} Approve
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Bulk Approve Modal ───────────────────────────────────────────────────────
interface BulkApproveModalProps {
  count: number;
  actor: { uid: string; userId?: string; name: string };
  onConfirm: (link: string, guidelines: string) => Promise<void>;
  onClose: () => void;
}

const BulkApproveModal = ({ count, actor, onConfirm, onClose }: BulkApproveModalProps) => {
  const [link, setLink] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!link.trim()) return;
    setLoading(true);
    try { await onConfirm(link.trim(), guidelines.trim()); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-background-700">
          <h3 className="text-white font-semibold">Bulk Approve {count} Request{count !== 1 ? 's' : ''}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1.5 flex items-center gap-1.5"><Link size={13} /> Access Link *</label>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..."
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1.5 flex items-center gap-1.5"><FileText size={13} /> Guidelines (optional)</label>
            <textarea value={guidelines} onChange={e => setGuidelines(e.target.value)} rows={3}
              className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-background-700">
          <button onClick={onClose} className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={handle} disabled={loading || !link.trim()}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            {loading ? <Spinner /> : <CheckCircle size={14} />} Approve All
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Early Access Panel ────────────────────────────────────────────────────────
interface EarlyAccessPanelProps {
  featureId: string;
  featureTitle: string;
  actor: { uid: string; userId?: string; name: string };
}

const EarlyAccessPanel = ({ featureId, featureTitle, actor }: EarlyAccessPanelProps) => {
  const [requests, setRequests] = useState<EarlyAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<EarlyAccessRequest | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setSelected(new Set());
    comingSoonService.getEarlyAccessByFeature(featureId).then(setRequests).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [featureId]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(
    selected.size === requests.length ? new Set() : new Set(requests.map(r => r.id))
  );

  const selectedRequests = requests.filter(r => selected.has(r.id));

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} request(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      await comingSoonService.bulkDeleteEarlyAccess([...selected]);
      load();
    } finally { setBulkLoading(false); }
  };

  const handleBulkReject = async () => {
    if (!confirm(`Reject ${selected.size} request(s)?`)) return;
    setBulkLoading(true);
    try {
      await comingSoonService.bulkRejectEarlyAccess(
        selectedRequests.map(r => ({ id: r.id, rejectionCount: r.rejectionCount })),
        actor,
        featureTitle,
      );
      selectedRequests.forEach(r => {
        notificationService.createNotification({
          userId: r.studentId,
          title: 'Early Access Request Rejected',
          message: featureTitle,
          type: 'system',
          priority: 'low',
          isPermanent: true,
          relatedId: featureId,
          relatedType: 'earlyAccess',
          metadata: { featureTitle },
        });
      });
      load();
    } finally { setBulkLoading(false); }
  };

  const handleBulkApprove = async (link: string, guidelines: string) => {
    await comingSoonService.bulkApproveEarlyAccess(
      selectedRequests.map(r => ({ id: r.id, featureTitle, studentName: r.studentName })),
      link,
      guidelines,
      actor,
    );
    selectedRequests.forEach(r => {
      notificationService.createNotification({
        userId: r.studentId,
        title: 'Early Access Approved 🎉',
        message: featureTitle,
        type: 'announcement',
        priority: 'high',
        isPermanent: true,
        relatedId: featureId,
        relatedType: 'earlyAccess',
        metadata: { featureTitle, accessLink: link },
      });
    });
    setBulkAction(null);
    load();
  };

  const handleAdminDelete = async (r: EarlyAccessRequest) => {
    if (!confirm(`Delete request from ${r.studentName}?`)) return;
    await comingSoonService.adminDeleteEarlyAccess(r.id, actor, featureTitle, r.studentName);
    load();
  };

  if (loading) return <PageSkeleton variant="cards" />;

  return (
    <div className="mt-4 space-y-2">
      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No early access requests yet.</p>
      ) : (
        <>
          {/* Bulk toolbar */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-white transition-colors">
              <input type="checkbox"
                checked={selected.size === requests.length && requests.length > 0}
                onChange={toggleAll}
                className="accent-primary-500 w-3.5 h-3.5" />
              Select all ({requests.length})
            </label>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <span className="text-xs text-gray-400">{selected.size} selected</span>
                <button onClick={() => setBulkAction('approve')} disabled={bulkLoading}
                  className="flex items-center gap-1 text-xs bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  <CheckCircle size={11} /> Approve
                </button>
                <button onClick={handleBulkReject} disabled={bulkLoading}
                  className="flex items-center gap-1 text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  <XCircle size={11} /> Reject
                </button>
                <button onClick={handleBulkDelete} disabled={bulkLoading}
                  className="flex items-center gap-1 text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {bulkLoading ? <Spinner /> : <Trash2 size={11} />} Delete
                </button>
              </div>
            )}
          </div>

          {/* Request rows */}
          {requests.map(r => (
            <div key={r.id}
              className={`bg-background-900 border rounded-lg px-4 py-3 transition-colors
                ${selected.has(r.id) ? 'border-primary-500/50 bg-primary-500/5' : 'border-background-700'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                  className="accent-primary-500 w-3.5 h-3.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-medium">{r.studentName}</p>
                    <IdBadge id={r.studentUserId} />
                    {r.rejectionCount > 0 && (
                      <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                        Rejected {r.rejectionCount}×{r.rejectionCount >= 3 ? ' (final)' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{fmt(r.requestedAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${EA_STATUS_STYLES[r.status]}`}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                  <button onClick={() => setReviewing(r)}
                    className="text-xs bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                    {r.status === 'pending' ? 'Review' : 'Change'}
                  </button>
                  <button onClick={() => handleAdminDelete(r)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {reviewing && (
        <EarlyAccessReviewModal
          request={reviewing}
          actor={actor}
          featureTitle={featureTitle}
          onDone={() => { setReviewing(null); load(); }}
          onClose={() => setReviewing(null)}
        />
      )}
      {bulkAction === 'approve' && (
        <BulkApproveModal
          count={selected.size}
          actor={actor}
          onConfirm={handleBulkApprove}
          onClose={() => setBulkAction(null)}
        />
      )}
    </div>
  );
};

// ─── Feature Row ───────────────────────────────────────────────────────────────
interface FeatureRowProps {
  feature: ComingSoonFeature;
  actor: { uid: string; userId?: string; name: string };
  onEdit: (f: ComingSoonFeature) => void;
  onDelete: (f: ComingSoonFeature) => void;
}

const FeatureRow = ({ feature, actor, onEdit, onDelete }: FeatureRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    comingSoonService.getEarlyAccessByFeature(feature.id).then(reqs => {
      setPendingCount(reqs.filter(r => r.status === 'pending').length);
    });
  }, [feature.id]);

  return (
    <div className="bg-background-800 border border-background-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="h-10 w-10 rounded-full bg-background-900 flex items-center justify-center flex-shrink-0 text-primary-400">
          {getIconNode(feature.iconName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-medium">{feature.title}</p>
            <span className="text-xs bg-background-900 border border-background-700 text-gray-400 px-2 py-0.5 rounded-full">
              {feature.expectedDate}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="max-w-[160px] w-full bg-background-900 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${feature.progress}%` }} />
              </div>
              <span className="text-xs text-gray-400">{feature.progress}%</span>
            </div>
            {/* Creator info */}
            {(feature.createdByName || feature.createdByUserId) && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>by {feature.createdByName}</span>
                <IdBadge id={feature.createdByUserId} />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-background-900 hover:bg-background-700 border border-background-700 px-3 py-1.5 rounded-lg transition-colors">
            <Users size={12} /> Requests
            {pendingCount !== null && pendingCount > 0 && (
              <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {pendingCount}
              </span>
            )}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={() => onEdit(feature)}
            className="p-2 text-gray-400 hover:text-white hover:bg-background-700 rounded-lg transition-colors">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(feature)}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-background-700 pt-3">
          <EarlyAccessPanel featureId={feature.id} featureTitle={feature.title} actor={actor} />
        </div>
      )}
    </div>
  );
};

// ─── Feature Requests Tab ──────────────────────────────────────────────────────
const FeatureRequestsTab = ({
  actor,
  onCountChange,
}: {
  actor: { uid: string; userId?: string; name: string };
  onCountChange?: (n: number) => void;
}) => {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    comingSoonService.getAllFeatureRequests().then(reqs => {
      setRequests(reqs);
      onCountChange?.(reqs.filter(r => r.status === 'pending').length);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatusUpdate = async (r: FeatureRequest, status: FeatureRequestStatus) => {
    setUpdating(r.id);
    try {
      await comingSoonService.updateFeatureRequestStatus(r.id, status, actor, noteEditing[r.id], r.studentName);
      if (['reviewed', 'planned', 'declined'].includes(status)) {
        const titleMap: Record<string, string> = {
          reviewed: 'Feature Request Reviewed',
          planned:  'Feature Request Planned 🎯',
          declined: 'Feature Request Declined',
        };
        notificationService.createNotification({
          userId: r.studentId,
          title: titleMap[status],
          message: r.description,
          type: status === 'declined' ? 'system' : 'announcement',
          priority: status === 'planned' ? 'high' : 'low',
          isPermanent: true,
          relatedId: r.id,
          relatedType: 'featureRequest',
          metadata: { status, adminNote: noteEditing[r.id] ?? r.adminNote ?? '' },
        });
      }
      load();
    } finally { setUpdating(null); }
  };

  const handleDelete = async (r: FeatureRequest) => {
    if (!confirm(`Delete this request by ${r.studentName}? This cannot be undone.`)) return;
    setDeleting(r.id);
    try {
      await comingSoonService.adminDeleteFeatureRequest(r.id, actor, r.studentName);
      load();
    } finally { setDeleting(null); }
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
                    <IdBadge id={r.studentUserId} />
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${statusMeta?.color}`}>
                      {statusMeta?.label}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{r.description}</p>
                  <p className="text-gray-500 text-xs mt-2">{fmt(r.requestedAt)}</p>
                  <div className="mt-3">
                    <input
                      value={noteEditing[r.id] ?? (r.adminNote || '')}
                      onChange={e => setNoteEditing(prev => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="Add admin note (optional)..."
                      className="w-full bg-background-900 border border-background-700 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {FR_STATUS_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => handleStatusUpdate(r, opt.value)}
                      disabled={updating === r.id || r.status === opt.value}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${r.status === opt.value ? opt.color + ' cursor-default' : 'bg-background-900 border-background-700 text-gray-400 hover:border-primary-500 hover:text-white'}`}>
                      {updating === r.id && r.status !== opt.value ? <Spinner /> : opt.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deleting === r.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                    {deleting === r.id ? <Spinner /> : <Trash2 size={11} />} Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Activity Log Tab ──────────────────────────────────────────────────────────
const ActivityLogTab = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    comingSoonService.getActivityLogs(150).then(setLogs).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-2">
      {logs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Activity size={40} className="mx-auto mb-3 opacity-40" />
          <p>No activity logged yet.</p>
        </div>
      ) : (
        logs.map(log => {
          const color = LOG_ACTION_COLORS[log.action] ?? 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
          return (
            <div key={log.id} className="bg-background-800 border border-background-700 rounded-xl px-4 py-3 flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <Clock size={14} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>
                    {LOG_ACTION_LABELS[log.action]}
                  </span>
                  {log.targetTitle && (
                    <span className="text-white text-sm font-medium truncate">{log.targetTitle}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
                  <span>by {log.actorName}</span>
                  <IdBadge id={log.actorUserId} />
                </div>
                {log.details && (
                  <p className="text-gray-500 text-xs mt-1">{log.details}</p>
                )}
              </div>
              <p className="text-gray-600 text-xs flex-shrink-0 text-right">{fmtTime(log.timestamp)}</p>
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
type Tab = 'features' | 'feature_requests' | 'activity_log';

const ComingSoonManagement = () => {
  const { user } = useDashboard();
  const actor = {
    uid: user?.uid ?? '',
    userId: user?.userId,
    name: user ? `${user.name}${user.surname ? ' ' + user.surname : ''}` : '',
  };

  const [activeTab, setActiveTab] = useState<Tab>('features');
  const [features, setFeatures] = useState<ComingSoonFeature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ComingSoonFeature | null>(null);
  const [featuresSubTab, setFeaturesSubTab] = useState<'mine' | 'all'>('mine');
  const [pendingFeatureRequestCount, setPendingFeatureRequestCount] = useState(0);

  const loadPendingCount = () => {
    comingSoonService.getAllFeatureRequests().then(reqs => {
      setPendingFeatureRequestCount(reqs.filter(r => r.status === 'pending').length);
    });
  };

  const loadFeatures = () => {
    setLoadingFeatures(true);
    comingSoonService.getFeatures().then(setFeatures).finally(() => setLoadingFeatures(false));
  };

  useEffect(() => {
    loadFeatures();
    loadPendingCount();
  }, []);

  const handleDelete = async (feature: ComingSoonFeature) => {
    if (!confirm(`Delete "${feature.title}"? This cannot be undone.`)) return;
    await comingSoonService.deleteFeature(feature.id, feature.title, actor);
    loadFeatures();
  };

  const handleSaved = () => {
    setShowFormModal(false);
    setEditingFeature(null);
    loadFeatures();
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'features',         label: 'Features',         icon: <Layers size={15} /> },
    { id: 'feature_requests', label: 'Feature Requests', icon: <Inbox size={15} />,    badge: pendingFeatureRequestCount },
    { id: 'activity_log',     label: 'Activity Log',     icon: <Activity size={15} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Coming Soon Management</h1>
          <p className="text-gray-400 text-sm mt-1">Manage upcoming features, early access, and feature requests.</p>
        </div>
        {activeTab === 'features' && (
          <button onClick={() => { setEditingFeature(null); setShowFormModal(true); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg transition-colors text-sm font-medium self-start sm:self-auto">
            <Plus size={16} /> Add Feature
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Features',    value: features.length,                                          icon: <Layers size={20} className="text-primary-400" /> },
          { label: 'In Development',    value: features.filter(f => f.status === 'in_development').length, icon: <Cpu size={20} className="text-yellow-400" /> },
          { label: 'Beta / Released',   value: features.filter(f => f.status !== 'in_development').length, icon: <CheckCircle size={20} className="text-green-400" /> },
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
      <div className="flex border-b border-background-700 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap
              ${activeTab === tab.id ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {tab.icon} {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'features' ? (
        <>
          <div className="flex gap-1 bg-background-900 border border-background-700 rounded-lg p-1 w-fit">
            {(['mine', 'all'] as const).map(st => (
              <button key={st} onClick={() => setFeaturesSubTab(st)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${featuresSubTab === st ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {st === 'mine' ? 'My Features' : 'All Features'}
                <span className="ml-1.5 text-xs opacity-70">
                  ({st === 'mine' ? features.filter(f => f.createdBy === user?.uid).length : features.length})
                </span>
              </button>
            ))}
          </div>

          {loadingFeatures ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (() => {
            const visible = featuresSubTab === 'mine' ? features.filter(f => f.createdBy === user?.uid) : features;
            return visible.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <Layers size={40} className="mx-auto mb-3 opacity-40" />
                <p>{featuresSubTab === 'mine' ? "You haven't added any features yet." : 'No features added yet.'}</p>
                {featuresSubTab === 'mine' && (
                  <button onClick={() => setShowFormModal(true)} className="mt-4 text-primary-400 hover:text-primary-300 text-sm underline">
                    Add your first feature
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map(f => (
                  <FeatureRow key={f.id} feature={f} actor={actor}
                    onEdit={feat => { setEditingFeature(feat); setShowFormModal(true); }}
                    onDelete={handleDelete} />
                ))}
              </div>
            );
          })()}
        </>
      ) : activeTab === 'feature_requests' ? (
        <FeatureRequestsTab actor={actor} onCountChange={setPendingFeatureRequestCount} />
      ) : (
        <ActivityLogTab />
      )}

      {showFormModal && (
        <FeatureFormModal
          feature={editingFeature}
          existingCount={features.length}
          actor={actor}
          onSave={handleSaved}
          onClose={() => { setShowFormModal(false); setEditingFeature(null); }}
        />
      )}
    </div>
  );
};

export default ComingSoonManagement;
