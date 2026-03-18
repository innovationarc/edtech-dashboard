// src/components/announcements/DailyInspirationManager.tsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Loader, AlertCircle, X } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { inspirationService, Inspiration } from '../../services/inspirationService';

const DailyInspirationManager = () => {
  const { user } = useDashboard();

  const [inspirations, setInspirations]   = useState<Inspiration[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [deleting, setDeleting]           = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setInspirations(await inspirationService.getAll());
    } catch {
      setError('Failed to load inspirations.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this inspiration?')) return;
    try {
      setDeleting(id);
      await inspirationService.remove(id);
      setInspirations(prev => prev.filter(i => i.id !== id));
      if ((window as any).addNotification)
        (window as any).addNotification('Inspiration removed.', 'success');
    } catch {
      if ((window as any).addNotification)
        (window as any).addNotification('Failed to remove inspiration.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleAdded = (ins: Inspiration) => {
    setInspirations(prev => [ins, ...prev]);
    setShowModal(false);
    if ((window as any).addNotification)
      (window as any).addNotification('Inspiration added!', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader size={20} className="animate-spin text-primary-500" />
        <span className="text-gray-400">Loading inspirations…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Daily Inspirations</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            These quotes appear on the student dashboard inspiration card.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
        >
          <Plus size={16} />
          Add Quote
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-error-dark text-error-light px-4 py-3 rounded-lg text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* List */}
      {inspirations.length === 0 ? (
        <div className="text-center py-16">
          <Star size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-white font-medium mb-1">No inspirations yet</p>
          <p className="text-gray-400 text-sm">Add your first quote to show on student dashboards.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inspirations.map(ins => (
            <div
              key={ins.id}
              className="flex items-start gap-4 bg-background-800 border border-background-700 rounded-xl px-5 py-4"
            >
              <Star size={16} className="text-yellow-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm italic leading-relaxed">"{ins.text}"</p>
                <p className="text-primary-400 text-xs font-semibold mt-1">— {ins.author}</p>
                <p className="text-gray-500 text-xs mt-1">
                  Added by {ins.addedByName} · {ins.createdAt.toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(ins.id)}
                disabled={deleting === ins.id}
                className="shrink-0 p-1.5 rounded-lg bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                title="Remove"
              >
                {deleting === ins.id
                  ? <Loader size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && user && (
        <AddInspirationModal
          user={user}
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
};

// ── Add Modal ─────────────────────────────────────────────────────────────────
interface AddModalProps {
  user: { uid: string; name: string };
  onClose: () => void;
  onAdded: (ins: Inspiration) => void;
}

const AddInspirationModal = ({ user, onClose, onAdded }: AddModalProps) => {
  const [text, setText]     = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async () => {
    if (!text.trim()) { setError('Quote text is required.'); return; }
    try {
      setLoading(true);
      setError('');
      const id = await inspirationService.add(text, author, user.uid, user.name);
      onAdded({
        id,
        text: text.trim(),
        author: author.trim() || 'Unknown',
        addedBy: user.uid,
        addedByName: user.name,
        createdAt: new Date(),
      });
    } catch {
      setError('Failed to add inspiration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <Star size={20} className="text-yellow-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Add Inspiration</h3>
            <p className="text-gray-400 text-sm">It will appear on student dashboards.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-error-dark text-error-light px-3 py-2 rounded-lg text-sm mb-4">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Quote *
            </label>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setError(''); }}
              placeholder="Enter the inspirational quote…"
              rows={4}
              maxLength={500}
              className="w-full bg-background-800 text-white rounded-lg py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{text.length}/500</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="e.g. Albert Einstein"
              maxLength={100}
              className="w-full bg-background-800 text-white rounded-lg py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Preview */}
          {text.trim() && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
              <p className="text-yellow-100 text-sm italic leading-relaxed">"{text.trim()}"</p>
              {author.trim() && (
                <p className="text-yellow-400 text-xs font-semibold mt-1.5">— {author.trim()}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-background-800 hover:bg-background-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className="flex-1 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader size={14} className="animate-spin" />}
              {loading ? 'Saving…' : 'Add Quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyInspirationManager;
