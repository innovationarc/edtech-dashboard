// src/components/profile/IdCardModal-1.tsx - Admin ID Card Modal (Placeholder)
import { X } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

interface IdCardModal1Props {
  onClose: () => void;
}

const IdCardModal1 = ({ onClose }: IdCardModal1Props) => {
  const { user } = useDashboard();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl p-8 relative shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X size={24} className="text-gray-600" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Admin ID Card
          </h2>
          <p className="text-gray-600" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Placeholder for ID card generation
          </p>
        </div>

        {/* Placeholder Content */}
        <div className="bg-gray-50 rounded-2xl p-12 border-2 border-dashed border-gray-300">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-indigo-100 rounded-full mb-6">
              <span className="text-5xl">🎫</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              ID Card Generator
            </h3>
            <p className="text-gray-600 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              This feature will generate a printable ID card for:
            </p>
            <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              {user?.surname} {user?.name}
            </p>
            <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              ID: {user?.userId}
            </p>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-xl transition-all duration-200 font-bold"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdCardModal1;
