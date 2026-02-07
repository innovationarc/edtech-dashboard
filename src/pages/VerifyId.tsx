// src/pages/VerifyId.tsx - QR Code Based ID Card Verification
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Shield, AlertCircle, CheckCircle2, XCircle, Loader, 
  User, Phone, MapPin, Calendar, CreditCard, Activity, QrCode
} from 'lucide-react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

interface VerifiedUser {
  userId: string;
  surname: string;
  name: string;
  fullName: string;
  designation: string;
  bloodGroup: string;
  phoneNumber: string;
  email: string;
  address: string;
  profilePictureUrl?: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  issueDate: string;
  validTill?: string | 'lifetime';
  role: string;
  verificationHash: string;
}

const VerifyId = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);
  const [error, setError] = useState('');

  // Auto-verify from URL token
  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid verification link. Please scan the QR code on the ID card.');
      setLoading(false);
      return;
    }

    handleVerify(token);
  }, [searchParams]);

  // Verify ID card using Firestore token lookup
  const handleVerify = async (token: string) => {
    setLoading(true);
    setError('');
    setVerifiedUser(null);

    try {
      const db = getFirestore();
      const verificationRef = doc(db, 'id-verifications', token);
      const verificationDoc = await getDoc(verificationRef);

      if (!verificationDoc.exists()) {
        setError('Invalid or expired ID card. This verification link is not recognized.');
        setLoading(false);
        return;
      }

      const data = verificationDoc.data();

      // Set verified user with data from Firestore
      const verifiedUserData: VerifiedUser = {
        userId: data.userId || 'N/A',
        surname: data.surname || '',
        name: data.name || '',
        fullName: data.fullName || 'Unknown',
        designation: data.designation || 'Not Specified',
        bloodGroup: data.bloodGroup || 'Not Specified',
        phoneNumber: data.phoneNumber || 'Not Specified',
        email: data.email || 'Not Specified',
        address: data.address || 'Not Specified',
        profilePictureUrl: data.profilePictureUrl || undefined,
        status: (data.status as 'active' | 'inactive' | 'suspended' | 'pending') || 'active',
        issueDate: data.issueDate || new Date().toISOString(),
        validTill: data.validTill || 'lifetime',
        role: data.role || 'Unknown',
        verificationHash: data.verificationHash || token
      };

      setVerifiedUser(verifiedUserData);
      setLoading(false);

    } catch (err: any) {
      setError(err.message || 'Failed to verify ID card. Please try again.');
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Not specified';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) {
        return 'Not specified';
      }
      return d.toLocaleDateString('en-GB', { 
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Not specified';
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = (status || 'unknown').toLowerCase();
    switch (normalizedStatus) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-300';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    const normalizedStatus = (status || 'unknown').toLowerCase();
    switch (normalizedStatus) {
      case 'active': return <CheckCircle2 className="w-5 h-5" />;
      case 'suspended': return <XCircle className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
            ID Card Verification
          </h1>
          <p className="text-gray-400 text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
            Verify the authenticity of EDTECH DASHBOARD ID cards
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-slate-800 rounded-2xl p-12 border border-slate-700 text-center">
            <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-white text-lg font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
              Verifying ID Card...
            </p>
            <p className="text-gray-400 mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              Please wait while we authenticate the ID card
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && !loading && (
          <div className="bg-red-900/30 border border-red-500 rounded-2xl p-8 mb-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <XCircle className="w-16 h-16 text-red-400 flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold text-red-400 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Verification Failed
                </h3>
                <p className="text-red-300 text-lg mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-gray-300 text-sm">
                  <QrCode className="w-4 h-4" />
                  <span style={{ fontFamily: 'Inter, sans-serif' }}>Scan the QR code on the ID card to verify</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verified User Information */}
        {verifiedUser && !loading && (
          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
            {/* Success Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-900/30 border-2 border-green-500 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                <span className="text-green-400 font-bold text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
                  ID CARD VERIFIED SUCCESSFULLY
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Verified ID Card
                </h2>
                <p className="text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                  This ID card is authentic and issued by EDTECH DASHBOARD
                </p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusColor(verifiedUser.status)}`}>
                {getStatusIcon(verifiedUser.status)}
                <span className="font-semibold capitalize" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {verifiedUser.status || 'Unknown'}
                </span>
              </div>
            </div>

            {/* User Photo and Basic Info */}
            <div className="flex flex-col md:flex-row gap-6 mb-8 pb-8 border-b border-slate-700">
              <div className="flex-shrink-0">
                <img
                  src={verifiedUser.profilePictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(verifiedUser.fullName)}&size=300&background=3b82f6&color=ffffff`}
                  alt={verifiedUser.fullName}
                  className="w-32 h-32 rounded-lg object-cover border-2 border-slate-600"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(verifiedUser.fullName)}&size=300&background=3b82f6&color=ffffff`;
                  }}
                />
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {verifiedUser.fullName}
                </h3>
                <p className="text-xl text-gray-400 italic mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {verifiedUser.designation}
                </p>
                <div className="flex items-center gap-2 text-blue-400">
                  <CreditCard className="w-5 h-5" />
                  <span className="font-mono text-lg font-semibold">{verifiedUser.userId}</span>
                </div>
              </div>
            </div>

            {/* Detailed Information Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              <InfoField icon={<Activity />} label="Blood Group" value={verifiedUser.bloodGroup} />
              <InfoField icon={<Phone />} label="Emergency Contact" value={verifiedUser.phoneNumber} />
              <InfoField icon={<User />} label="Email" value={verifiedUser.email} />
              <InfoField icon={<MapPin />} label="Address" value={verifiedUser.address} />
              <InfoField icon={<Calendar />} label="Issue Date" value={formatDate(verifiedUser.issueDate)} />
              <InfoField 
                icon={<Calendar />} 
                label="Valid Till" 
                value={verifiedUser.validTill === 'lifetime' ? 'Lifetime' : formatDate(verifiedUser.validTill)} 
              />
            </div>

            {/* Footer Note */}
            <div className="mt-8 pt-6 border-t border-slate-700">
              <p className="text-center text-sm text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
                This verification was performed on {new Date().toLocaleString('en-GB')}
              </p>
              <p className="text-center text-xs text-gray-600 mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                Verification Hash: {verifiedUser.verificationHash.substring(0, 16)}...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for info fields
const InfoField = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3 p-4 bg-slate-700/50 rounded-xl">
    <div className="flex-shrink-0 mt-1 text-blue-400">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
        {label}
      </p>
      <p className="text-sm font-medium text-white break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
        {value}
      </p>
    </div>
  </div>
);

export default VerifyId;
