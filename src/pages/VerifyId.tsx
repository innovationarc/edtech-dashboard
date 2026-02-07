// src/pages/VerifyId.tsx - Public ID Card Verification (Using user-search.ts)
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Shield, AlertCircle, CheckCircle2, XCircle, Loader, 
  User, Phone, MapPin, Calendar, CreditCard, Activity
} from 'lucide-react';
import { validateMRZ, extractUserIdFromMRZ, type MRZValidationResult } from '../utils/mrz-utils';

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
  createdAt: Date | string;
  validTill?: string | 'lifetime';
  role: string;
}

const VerifyId = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'userId' | 'mrz'>('userId');
  const [userId, setUserId] = useState('');
  const [mrzLine1, setMrzLine1] = useState('');
  const [mrzLine2, setMrzLine2] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);
  const [error, setError] = useState('');
  const [mrzValidation, setMrzValidation] = useState<MRZValidationResult | null>(null);

  // Auto-load from URL params
  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    if (userIdParam) {
      setUserId(userIdParam);
      setVerificationMethod('userId');
      // Auto-verify on load
      handleVerify(userIdParam, null, null);
    }
  }, [searchParams]);

  // Verify ID card using user-search.ts API with master key
  const handleVerify = async (userIdValue?: string, line1?: string, line2?: string) => {
    setLoading(true);
    setError('');
    setVerifiedUser(null);
    setMrzValidation(null);

    try {
      let userIdToVerify = userIdValue || userId;

      // If using MRZ, validate first
      if (verificationMethod === 'mrz' || (line1 && line2)) {
        const l1 = line1 || mrzLine1;
        const l2 = line2 || mrzLine2;

        if (!l1 || !l2) {
          setError('Please enter both MRZ lines');
          setLoading(false);
          return;
        }

        const validation = validateMRZ(l1.toUpperCase(), l2.toUpperCase());
        setMrzValidation(validation);

        if (!validation.isValid) {
          setError('Invalid MRZ: ' + validation.errors.join(', '));
          setLoading(false);
          return;
        }

        // Extract userId from MRZ
        userIdToVerify = extractUserIdFromMRZ(l2.toUpperCase()) || '';
        
        if (!userIdToVerify) {
          setError('Could not extract user ID from MRZ');
          setLoading(false);
          return;
        }
      }

      if (!userIdToVerify || userIdToVerify.trim() === '') {
        setError('Please enter a User ID');
        setLoading(false);
        return;
      }

      console.log('🔍 Verifying ID:', userIdToVerify);

      // Get master key from environment variable
      const MASTER_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      // Call user-search API with loginId (not userId) and master key
      const response = await fetch('/api/user-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loginId: userIdToVerify,  // Changed from userId to loginId
          purpose: 'user-lookup',
          apiKey: MASTER_KEY // Include master key for authentication
        })
      });

      const data = await response.json();

      console.log('📡 API Response:', response.status, data);

      if (!response.ok || !data.success) {
        setError(data.error || 'User not found');
        setLoading(false);
        return;
      }

      if (!data.userData) {
        setError('User data not available');
        setLoading(false);
        return;
      }

      // Set verified user
      setVerifiedUser({
        userId: data.userData.userId,
        surname: data.userData.surname || '',
        name: data.userData.name || '',
        fullName: data.userData.fullName || `${data.userData.surname || ''} ${data.userData.name || ''}`.trim(),
        designation: data.userData.designation || 'Not Specified',
        bloodGroup: data.userData.bloodGroup || 'Not Specified',
        phoneNumber: data.userData.phoneNumber || 'Not Specified',
        email: data.userData.email || 'Not Specified',
        address: data.userData.address || 'Not Specified',
        profilePictureUrl: data.userData.profilePictureUrl,
        status: data.userData.status || 'unknown',
        createdAt: data.userData.createdAt,
        validTill: data.userData.validTill,
        role: data.userData.role || 'Unknown'
      });

      console.log('✅ Verification successful');

    } catch (err: any) {
      console.error('❌ Verification error:', err);
      setError(err.message || 'Failed to verify ID card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Not specified';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-300';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
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

        {/* Verification Method Tabs */}
        <div className="bg-slate-800 rounded-2xl p-6 mb-6 border border-slate-700">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setVerificationMethod('userId')}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                verificationMethod === 'userId'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              User ID
            </button>
            <button
              onClick={() => setVerificationMethod('mrz')}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                verificationMethod === 'mrz'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              MRZ Code
            </button>
          </div>

          {/* User ID Input */}
          {verificationMethod === 'userId' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                Enter User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value.toUpperCase())}
                placeholder="e.g., AD-2601-26571"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            </div>
          )}

          {/* MRZ Input */}
          {verificationMethod === 'mrz' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  MRZ Line 1 (44 characters)
                </label>
                <input
                  type="text"
                  value={mrzLine1}
                  onChange={(e) => setMrzLine1(e.target.value.toUpperCase())}
                  placeholder="Enter first MRZ line from ID card"
                  maxLength={44}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
                <p className="text-xs text-gray-500 mt-1">{mrzLine1.length}/44 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  MRZ Line 2 (44 characters)
                </label>
                <input
                  type="text"
                  value={mrzLine2}
                  onChange={(e) => setMrzLine2(e.target.value.toUpperCase())}
                  placeholder="Enter second MRZ line from ID card"
                  maxLength={44}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
                <p className="text-xs text-gray-500 mt-1">{mrzLine2.length}/44 characters</p>
              </div>
            </div>
          )}

          {/* Verify Button */}
          <button
            onClick={() => handleVerify()}
            disabled={loading}
            className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Verify ID Card
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-red-400 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Verification Failed
                </h3>
                <p className="text-red-300" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MRZ Validation Result */}
        {mrzValidation && mrzValidation.isValid && (
          <div className="bg-green-900/30 border border-green-500 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-bold text-green-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                MRZ Validated Successfully
              </h3>
            </div>
            {mrzValidation.extractedData && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Name:</p>
                  <p className="text-white font-semibold">
                    {mrzValidation.extractedData.surname} {mrzValidation.extractedData.firstName}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">User ID:</p>
                  <p className="text-white font-semibold">{mrzValidation.extractedData.userId}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verified User Information */}
        {verifiedUser && (
          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
            {/* Status Badge */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Verified ID Card
                </h2>
                <p className="text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                  This ID card is authentic
                </p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusColor(verifiedUser.status)}`}>
                {getStatusIcon(verifiedUser.status)}
                <span className="font-semibold capitalize" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {verifiedUser.status}
                </span>
              </div>
            </div>

            {/* User Photo and Basic Info */}
            <div className="flex flex-col md:flex-row gap-6 mb-8 pb-8 border-b border-slate-700">
              <div className="flex-shrink-0">
                <img
                  src={verifiedUser.profilePictureUrl || `https://i.pravatar.cc/300?u=${verifiedUser.userId}`}
                  alt={verifiedUser.fullName}
                  className="w-32 h-32 rounded-lg object-cover border-2 border-slate-600"
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
              <InfoField icon={<Calendar />} label="Issue Date" value={formatDate(verifiedUser.createdAt)} />
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
