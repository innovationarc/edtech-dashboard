// src/pages/ComingSoon.tsx
import { useState, useEffect } from 'react';
import {
  Clock, Star, BookOpen, GitMerge, Zap, Upload, Smartphone,
  BarChart2, Cpu, Users, Layers, CheckCircle, X, ExternalLink,
  AlertCircle, ChevronRight, Send, Eye,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { comingSoonService, ComingSoonFeature, EarlyAccessRequest, FeatureRequest } from '../services/comingSoonService';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Icon map ────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  Zap:      <Zap size={24} className="text-primary-400" />,
  BookOpen: <BookOpen size={24} className="text-secondary-400" />,
  Star:     <Star size={24} className="text-accent-400" />,
  Upload:   <Upload size={24} className="text-warning-DEFAULT" />,
  GitMerge: <GitMerge size={24} className="text-error-DEFAULT" />,
  BarChart2:<BarChart2 size={24} className="text-primary-400" />,
  Cpu:      <Cpu size={24} className="text-accent-400" />,
  Users:    <Users size={24} className="text-secondary-400" />,
  Layers:   <Layers size={24} className="text-warning-DEFAULT" />,
  Smartphone:<Smartphone size={24} className="text-primary-400" />,
};

const getIcon = (name: string) => ICON_MAP[name] ?? <Zap size={24} className="text-primary-400" />;

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
  onClose: () => void;
}

const FeatureRequestModal = ({ studentId, studentName, onClose }: FeatureRequestModalProps) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      await comingSoonService.submitFeatureRequest(description.trim(), studentId, studentName);
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
  onClose: () => void;
}

const MyRequestsModal = ({ requests, onClose }: MyRequestsModalProps) => (
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
  requestingId: string | null;
}

const FeatureCard = ({ feature, earlyAccess, onRequestAccess, onTryAccess, requestingId }: FeatureCardProps) => {
  const isRequested = !!earlyAccess;
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
          <button
            disabled
            className="w-full bg-background-700 text-gray-500 py-2 rounded cursor-not-allowed text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle size={14} className="text-primary-400" />
            <span className="text-primary-400">Requested</span>
          </button>
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

  const handleRequestAccess = async (feature: ComingSoonFeature) => {
    if (!user) return;
    setRequestingId(feature.id);
    try {
      await comingSoonService.requestEarlyAccess(
        feature.id,
        feature.title,
        user.uid,
        user.name + (user.surname ? ' ' + user.surname : ''),
        user.email,
      );
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
    } catch {
      // silent fail
    } finally {
      setRequestingId(null);
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
          onClose={handleFeatureRequestSubmitted}
        />
      )}
      {showMyRequestsModal && (
        <MyRequestsModal
          requests={myFeatureRequests}
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
