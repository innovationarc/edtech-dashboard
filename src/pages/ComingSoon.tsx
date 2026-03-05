// src/pages/ComingSoon.tsx
import { useState, useEffect } from 'react';
import {
  Clock, Star, BookOpen, GitMerge, Zap, Upload, Smartphone,
  BarChart2, Cpu, Users, Layers, CheckCircle, X, ExternalLink,
  AlertCircle, Send, Eye, Trash2,
  Wifi, Globe, Shield, Lock, Bell, Camera, Code, Database,
  Download, Filter, Flag, Gift, Hash, Heart, Home, Image,
  Mail, Map, MessageSquare, Monitor, Music, Package, Play,
  Search, Settings, Share2, Sliders, Tag, Target, Terminal,
  Truck, Video, Wrench, Aperture, Award,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { comingSoonService, ComingSoonFeature, EarlyAccessRequest, FeatureRequest } from '../services/comingSoonService';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Icon map (matches management picker) ────────────────────────────────────
const ICON_COLORS = [
  'text-primary-400', 'text-secondary-400', 'text-accent-400',
  'text-warning-DEFAULT', 'text-error-DEFAULT', 'text-green-400',
  'text-purple-400', 'text-pink-400', 'text-orange-400',
];
// Deterministic colour per icon name
const iconColor = (name: string) => ICON_COLORS[name.charCodeAt(0) % ICON_COLORS.length];

const ICON_MAP: Record<string, (size?: number) => React.ReactNode> = {
  Zap:          (s = 24) => <Zap size={s} className={iconColor('Zap')} />,
  BookOpen:     (s = 24) => <BookOpen size={s} className={iconColor('BookOpen')} />,
  Star:         (s = 24) => <Star size={s} className={iconColor('Star')} />,
  Upload:       (s = 24) => <Upload size={s} className={iconColor('Upload')} />,
  GitMerge:     (s = 24) => <GitMerge size={s} className={iconColor('GitMerge')} />,
  BarChart2:    (s = 24) => <BarChart2 size={s} className={iconColor('BarChart2')} />,
  Cpu:          (s = 24) => <Cpu size={s} className={iconColor('Cpu')} />,
  Users:        (s = 24) => <Users size={s} className={iconColor('Users')} />,
  Layers:       (s = 24) => <Layers size={s} className={iconColor('Layers')} />,
  Smartphone:   (s = 24) => <Smartphone size={s} className={iconColor('Smartphone')} />,
  Wifi:         (s = 24) => <Wifi size={s} className={iconColor('Wifi')} />,
  Globe:        (s = 24) => <Globe size={s} className={iconColor('Globe')} />,
  Shield:       (s = 24) => <Shield size={s} className={iconColor('Shield')} />,
  Lock:         (s = 24) => <Lock size={s} className={iconColor('Lock')} />,
  Bell:         (s = 24) => <Bell size={s} className={iconColor('Bell')} />,
  Camera:       (s = 24) => <Camera size={s} className={iconColor('Camera')} />,
  Code:         (s = 24) => <Code size={s} className={iconColor('Code')} />,
  Database:     (s = 24) => <Database size={s} className={iconColor('Database')} />,
  Download:     (s = 24) => <Download size={s} className={iconColor('Download')} />,
  Filter:       (s = 24) => <Filter size={s} className={iconColor('Filter')} />,
  Flag:         (s = 24) => <Flag size={s} className={iconColor('Flag')} />,
  Gift:         (s = 24) => <Gift size={s} className={iconColor('Gift')} />,
  Hash:         (s = 24) => <Hash size={s} className={iconColor('Hash')} />,
  Heart:        (s = 24) => <Heart size={s} className={iconColor('Heart')} />,
  Home:         (s = 24) => <Home size={s} className={iconColor('Home')} />,
  Image:        (s = 24) => <Image size={s} className={iconColor('Image')} />,
  Mail:         (s = 24) => <Mail size={s} className={iconColor('Mail')} />,
  Map:          (s = 24) => <Map size={s} className={iconColor('Map')} />,
  MessageSquare:(s = 24) => <MessageSquare size={s} className={iconColor('MessageSquare')} />,
  Monitor:      (s = 24) => <Monitor size={s} className={iconColor('Monitor')} />,
  Music:        (s = 24) => <Music size={s} className={iconColor('Music')} />,
  Package:      (s = 24) => <Package size={s} className={iconColor('Package')} />,
  Play:         (s = 24) => <Play size={s} className={iconColor('Play')} />,
  Search:       (s = 24) => <Search size={s} className={iconColor('Search')} />,
  Settings:     (s = 24) => <Settings size={s} className={iconColor('Settings')} />,
  Share2:       (s = 24) => <Share2 size={s} className={iconColor('Share2')} />,
  Sliders:      (s = 24) => <Sliders size={s} className={iconColor('Sliders')} />,
  Tag:          (s = 24) => <Tag size={s} className={iconColor('Tag')} />,
  Target:       (s = 24) => <Target size={s} className={iconColor('Target')} />,
  Terminal:     (s = 24) => <Terminal size={s} className={iconColor('Terminal')} />,
  Truck:        (s = 24) => <Truck size={s} className={iconColor('Truck')} />,
  Video:        (s = 24) => <Video size={s} className={iconColor('Video')} />,
  Wrench:       (s = 24) => <Wrench size={s} className={iconColor('Wrench')} />,
  Aperture:     (s = 24) => <Aperture size={s} className={iconColor('Aperture')} />,
  Award:        (s = 24) => <Award size={s} className={iconColor('Award')} />,
};

const getIcon = (name: string) =>
  (ICON_MAP[name] ?? ICON_MAP['Zap'])(24);

// ─── Status badge colours ─────────────────────────────────────────────────────
const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  in_review: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  reviewed:  'bg-green-500/20 text-green-400 border border-green-500/30',
  planned:   'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  declined:  'bg-red-500/20 text-red-400 border border-red-500/30',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  in_review: 'In Review',
  reviewed:  'Reviewed',
  planned:   'Planned',
  declined:  'Declined',
};

// ─── Early Access Modal ───────────────────────────────────────────────────────
interface EarlyAccessModalProps {
  request: EarlyAccessRequest;
  onClose: () => void;
}

const EarlyAccessModal = ({ request, onClose }: EarlyAccessModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-md shadow-2xl animate-fade-in">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold text-lg">Early Access Granted 🎉</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          You've been approved for early access to <span className="text-white font-medium">{request.featureTitle}</span>.
        </p>

        {request.guidelines && (
          <div className="bg-background-900 rounded-lg p-4 mb-6">
            <p className="text-xs font-medium text-primary-400 mb-2 uppercase tracking-wider">Guidelines</p>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{request.guidelines}</p>
          </div>
        )}

        <a
          href={request.accessLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-lg transition-colors font-medium"
        >
          Try Early Access <ExternalLink size={16} />
        </a>
      </div>
    </div>
  </div>
);

// ─── Feature Request Form Modal ───────────────────────────────────────────────
interface FeatureRequestModalProps {
  studentId: string;
  studentName: string;
  studentUserId?: string;
  onClose: () => void;
}

const FeatureRequestModal = ({ studentId, studentName, studentUserId, onClose }: FeatureRequestModalProps) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      await comingSoonService.submitFeatureRequest(description.trim(), studentId, studentName, studentUserId);
      setSubmitted(true);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Request Submitted!</h3>
              <p className="text-gray-400 text-sm mb-6">
                Thank you! We've received your feature request and will review it shortly.
              </p>
              <button
                onClick={onClose}
                className="bg-primary-600 hover:bg-primary-500 text-white py-2 px-6 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold text-lg">Submit Feature Request</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Describe the feature you'd like to see. We review all requests carefully.
              </p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="E.g. I'd love a dark mode for the mobile app..."
                rows={4}
                className="w-full bg-background-900 border border-background-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 transition-colors"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={onClose}
                  className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!description.trim() || loading}
                  className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Submit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── My Requests Modal ────────────────────────────────────────────────────────
interface MyRequestsModalProps {
  requests: FeatureRequest[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

const MyRequestsModal = ({ requests, onDelete, onClose }: MyRequestsModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-background-800 border border-background-700 rounded-xl w-full max-w-lg shadow-2xl">
      <div className="flex items-center justify-between p-6 border-b border-background-700">
        <h3 className="text-white font-semibold text-lg">My Feature Requests</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
        {requests.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">You haven't submitted any feature requests yet.</p>
        ) : (
          requests.map(r => (
            <div key={r.id} className="bg-background-900 rounded-lg p-4 border border-background-700">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-white text-sm leading-relaxed">{r.description}</p>
                <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${REQUEST_STATUS_STYLES[r.status]}`}>
                  {REQUEST_STATUS_LABELS[r.status]}
                </span>
              </div>
              {r.adminNote && (
                <p className="text-gray-400 text-xs mt-2 pt-2 border-t border-background-700">
                  <span className="text-primary-400">Admin note: </span>{r.adminNote}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-2">
                {new Date(r.requestedAt).toLocaleDateString()}
              </p>
              <div className="mt-3 flex justify-end">
                {r.status === 'pending' && (
                  <button
                    onClick={() => onDelete(r.id)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={11} /> Delete Request
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

// ─── Feature Card ─────────────────────────────────────────────────────────────
interface FeatureCardProps {
  feature: ComingSoonFeature;
  earlyAccess?: EarlyAccessRequest;
  onRequestAccess: (feature: ComingSoonFeature) => void;
  onTryAccess: (request: EarlyAccessRequest) => void;
  onCancelAccess: (featureId: string, requestId: string) => void;
  requestingId: string | null;
}

const FeatureCard = ({ feature, earlyAccess, onRequestAccess, onTryAccess, onCancelAccess, requestingId }: FeatureCardProps) => {
  const isRequested = !!earlyAccess && earlyAccess.status !== 'cancelled';
  const isApproved = earlyAccess?.status === 'approved';
  const isLoading = requestingId === feature.id;

  return (
    <Card className="p-0 transition-all duration-300 hover:shadow-card-hover flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-background-800 flex items-center justify-center flex-shrink-0">
            {getIcon(feature.iconName)}
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">{feature.title}</h3>
            <p className="text-gray-400 text-sm">{feature.description}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Development Progress</span>
            <span className="text-sm text-white">{feature.progress}%</span>
          </div>
          <div className="w-full bg-background-800 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary-500 transition-all duration-700"
              style={{ width: `${feature.progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Clock size={16} className="text-primary-400" />
          <span className="text-sm text-primary-400">Expected: {feature.expectedDate}</span>
        </div>
      </div>

      <div className="p-4 border-t border-background-800 bg-card-dark">
        {isApproved ? (
          <button
            onClick={() => onTryAccess(earlyAccess!)}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <ExternalLink size={14} /> Try Early Access
          </button>
        ) : isRequested ? (
          <div className="flex gap-2">
            <button
              disabled
              className="flex-1 bg-background-700 text-gray-500 py-2 rounded cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle size={14} className="text-primary-400" />
              <span className="text-primary-400">Requested</span>
            </button>
            {earlyAccess?.status === 'pending' && (
              <button
                onClick={() => onCancelAccess(feature.id, earlyAccess.id)}
                className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-3 py-2 rounded text-xs transition-colors"
                title="Cancel request"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onRequestAccess(feature)}
            disabled={isLoading}
            className="w-full bg-background-700 hover:bg-background-600 text-white py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            Request Early Access
          </button>
        )}
      </div>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ComingSoon = () => {
  const { user } = useDashboard();

  const [features, setFeatures] = useState<ComingSoonFeature[]>([]);
  const [earlyAccessMap, setEarlyAccessMap] = useState<Record<string, EarlyAccessRequest>>({});
  const [myFeatureRequests, setMyFeatureRequests] = useState<FeatureRequest[]>([]);

  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
  const [showMyRequestsModal, setShowMyRequestsModal] = useState(false);
  const [activeEarlyAccess, setActiveEarlyAccess] = useState<EarlyAccessRequest | null>(null);

  // Load features
  useEffect(() => {
    comingSoonService.getFeatures()
      .then(setFeatures)
      .finally(() => setLoadingFeatures(false));
  }, []);

  // Load student's early access requests
  useEffect(() => {
    if (!user?.uid) return;
    comingSoonService.getEarlyAccessByStudent(user.uid).then(requests => {
      const map: Record<string, EarlyAccessRequest> = {};
      requests.forEach(r => { map[r.featureId] = r; });
      setEarlyAccessMap(map);
    });
  }, [user?.uid]);

  // Load student's feature requests
  useEffect(() => {
    if (!user?.uid) return;
    comingSoonService.getFeatureRequestsByStudent(user.uid).then(setMyFeatureRequests);
  }, [user?.uid]);

  const refreshEarlyAccessMap = (uid: string) => {
    comingSoonService.getEarlyAccessByStudent(uid).then(requests => {
      const map: Record<string, EarlyAccessRequest> = {};
      requests.forEach(r => { map[r.featureId] = r; });
      setEarlyAccessMap(map);
    });
  };

  const handleRequestAccess = async (feature: ComingSoonFeature) => {
    if (!user) return;
    setRequestingId(feature.id);
    // Optimistic update so button changes instantly
    setEarlyAccessMap(prev => ({
      ...prev,
      [feature.id]: {
        id: 'temp',
        featureId: feature.id,
        featureTitle: feature.title,
        studentId: user.uid,
        studentName: user.name,
        status: 'pending',
        requestedAt: new Date(),
      },
    }));
    try {
      await comingSoonService.requestEarlyAccess(
        feature.id,
        feature.title,
        user.uid,
        user.name + (user.surname ? ' ' + user.surname : ''),
        user.userId,
        user.email,
      );
      // Refresh with real Firestore data (gets real doc ID)
      refreshEarlyAccessMap(user.uid);
    } catch {
      // Roll back optimistic update on failure
      setEarlyAccessMap(prev => {
        const next = { ...prev };
        delete next[feature.id];
        return next;
      });
    } finally {
      setRequestingId(null);
    }
  };

  const handleCancelEarlyAccess = async (featureId: string, requestId: string) => {
    // Optimistic update
    setEarlyAccessMap(prev => {
      const next = { ...prev };
      if (next[featureId]) next[featureId] = { ...next[featureId], status: 'cancelled' };
      return next;
    });
    try {
      await comingSoonService.cancelEarlyAccess(requestId);
      refreshEarlyAccessMap(user!.uid);
    } catch {
      // Revert on failure
      refreshEarlyAccessMap(user!.uid);
    }
  };

  const handleDeleteFeatureRequest = async (requestId: string) => {
    if (!confirm('Delete this request?')) return;
    try {
      await comingSoonService.deleteFeatureRequest(requestId);
      if (user?.uid) {
        comingSoonService.getFeatureRequestsByStudent(user.uid).then(setMyFeatureRequests);
      }
    } catch {
      // silent fail
    }
  };

  const handleFeatureRequestSubmitted = () => {
    setShowFeatureRequestModal(false);
    if (user?.uid) {
      comingSoonService.getFeatureRequestsByStudent(user.uid).then(setMyFeatureRequests);
    }
  };

  if (loadingFeatures) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Coming Soon</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          We're constantly working to improve your experience. Check out these exciting features that are currently in development.
        </p>
      </div>

      {/* Feature Cards */}
      {features.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No upcoming features at the moment. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(feature => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              earlyAccess={earlyAccessMap[feature.id]}
              onRequestAccess={handleRequestAccess}
              onTryAccess={req => setActiveEarlyAccess(req)}
              onCancelAccess={handleCancelEarlyAccess}
              requestingId={requestingId}
            />
          ))}
        </div>
      )}

      {/* Feature Request Banner */}
      <div className="mt-12 bg-gradient-to-r from-primary-900 to-secondary-900 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">Have a Feature Request?</h2>
        <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
          We value your input! If you have ideas for features that would make your experience better, we'd love to hear them.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setShowFeatureRequestModal(true)}
            className="bg-white text-primary-800 hover:bg-gray-100 font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Submit Feature Request
          </button>
          {myFeatureRequests.length > 0 && (
            <button
              onClick={() => setShowMyRequestsModal(true)}
              className="flex items-center gap-2 border border-white/30 text-white hover:bg-white/10 font-medium py-2 px-6 rounded-lg transition-colors"
            >
              <Eye size={16} /> View My Requests ({myFeatureRequests.length})
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showFeatureRequestModal && user && (
        <FeatureRequestModal
          studentId={user.uid}
          studentName={user.name + (user.surname ? ' ' + user.surname : '')}
          studentUserId={user.userId}
          onClose={handleFeatureRequestSubmitted}
        />
      )}
      {showMyRequestsModal && (
        <MyRequestsModal
          requests={myFeatureRequests}
          onDelete={handleDeleteFeatureRequest}
          onClose={() => setShowMyRequestsModal(false)}
        />
      )}
      {activeEarlyAccess && (
        <EarlyAccessModal
          request={activeEarlyAccess}
          onClose={() => setActiveEarlyAccess(null)}
        />
      )}
    </div>
  );
};

export default ComingSoon;
