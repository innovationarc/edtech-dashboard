// src/pages/VerifyProfile.tsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, GraduationCap, Building, Calendar, Users, Droplet, Shield, CheckCircle, AlertCircle, Loader, Award, ArrowLeft } from 'lucide-react';
import { userService } from '../services/userService';
import { UserProfile } from '../services/authService';

const VerifyProfile = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const uid = searchParams.get('uid');

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!uid) {
        setError('No user ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        // Fetch user profile by UID
        const userData = await userService.getUserByUid(uid);
        
        if (!userData) {
          setError('User not found');
          setLoading(false);
          return;
        }

        setUser(userData);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        setError(err.message || 'Failed to verify profile. Please try again.');
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [uid]);

  const getRoleBadgeColors = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-red-600 to-red-700';
      case 'manager':
        return 'bg-gradient-to-r from-blue-600 to-blue-700';
      case 'coordinator':
        return 'bg-gradient-to-r from-yellow-600 to-yellow-700';
      case 'teacher':
        return 'bg-gradient-to-r from-green-600 to-green-700';
      case 'parent':
        return 'bg-gradient-to-r from-purple-600 to-purple-700';
      case 'student':
        return 'bg-gradient-to-r from-cyan-600 to-cyan-700';
      default:
        return 'bg-gradient-to-r from-gray-600 to-gray-700';
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => {
    if (!value) return null;
    
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{label}</p>
          <p className="text-sm text-gray-900 font-semibold break-words" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{value}</p>
        </div>
      </div>
    );
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full p-4 shadow-xl">
                  <Loader size={48} className="text-white animate-spin" />
                </div>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Verifying Profile
            </h2>
            
            <p className="text-gray-600 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Please wait while we verify the profile information...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 rounded-full p-4 shadow-lg">
                <AlertCircle size={64} className="text-red-600" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Verification Failed
            </h2>
            
            <div className="bg-red-50 text-red-800 px-6 py-4 rounded-xl border border-red-200 mb-6">
              <p className="font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                {error || 'User profile not found'}
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg font-bold w-full"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <ArrowLeft size={18} />
              <span>Go to Home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success State - Display User Profile
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Success Badge */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-2xl px-6 py-3 shadow-lg border border-green-200 flex items-center gap-3">
            <div className="bg-green-100 rounded-full p-2">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Profile Verified</p>
              <p className="text-xs text-gray-600 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Authentic user profile</p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
          {/* Professional Header with Fixed Background */}
          <div className="relative h-48 bg-gray-900 overflow-hidden">
            {/* Modern Geometric Pattern Background */}
            <div className="absolute inset-0 opacity-30">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99, 102, 241, 0.3)" strokeWidth="1"/>
                  </pattern>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#4f46e5', stopOpacity: 1 }} />
                    <stop offset="50%" style={{ stopColor: '#7c3aed', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#4f46e5', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#grad1)" />
                <rect width="100%" height="100%" fill="url(#grid)" />
                <circle cx="10%" cy="20%" r="60" fill="rgba(139, 92, 246, 0.3)" />
                <circle cx="90%" cy="80%" r="80" fill="rgba(99, 102, 241, 0.3)" />
                <circle cx="50%" cy="50%" r="100" fill="rgba(167, 139, 250, 0.2)" />
              </svg>
            </div>
          </div>

          {/* Profile Content */}
          <div className="relative px-6 sm:px-8 pb-8">
            {/* Profile Picture and Name */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-20 mb-6">
              <div className="relative group">
                <div className="h-32 w-32 rounded-2xl overflow-hidden bg-white shadow-xl ring-4 ring-white">
                  {user.profilePictureUrl ? (
                    <img loading="lazy"
                      src={user.profilePictureUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <span className="text-5xl text-white font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {user.name?.charAt(0) || user.surname?.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg ring-4 ring-white">
                  <Award size={16} className="text-white" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {user.surname} {user.name}
                  </h1>
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold ${getRoleBadgeColors(user.role)} text-white shadow-md capitalize`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {user.role}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>ID: <span className="text-gray-900 font-mono font-bold">{user.userId}</span></p>
                <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
                  <span className="text-xs text-green-700 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Verified Profile</span>
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Basic Information */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <User size={18} className="text-indigo-600" />
                  </div>
                  Basic Information
                </h3>
                <div className="space-y-1">
                  <InfoRow icon={User} label="Full Name" value={user.name} />
                  <InfoRow icon={User} label="Surname" value={user.surname} />
                  <InfoRow icon={Mail} label="Email" value={user.email} />
                  <InfoRow icon={Calendar} label="Date of Birth" value={user.dob ? new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined} />
                  <InfoRow icon={Users} label="Gender" value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : undefined} />
                  <InfoRow icon={Droplet} label="Blood Group" value={user.bloodGroup} />
                  <InfoRow icon={Shield} label="Religion" value={user.religion} />
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Phone size={18} className="text-purple-600" />
                  </div>
                  Contact Information
                </h3>
                <div className="space-y-1">
                  <InfoRow 
                    icon={Phone} 
                    label="Phone Number" 
                    value={user.phoneNumber ? `+880${user.phoneNumber}` : undefined} 
                  />
                  <InfoRow icon={Phone} label="Mobile Number" value={user.mobileNumber} />
                  <InfoRow 
                    icon={Users} 
                    label="Guardian Phone" 
                    value={user.guardianPhone ? `+880${user.guardianPhone}` : undefined} 
                  />
                  <InfoRow icon={MapPin} label="Address" value={user.address} />
                </div>
              </div>

              {/* Educational Information */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <GraduationCap size={18} className="text-green-600" />
                  </div>
                  Educational Information
                </h3>
                <div className="space-y-1">
                  <InfoRow icon={GraduationCap} label="Class/Grade" value={user.classGrade} />
                  <InfoRow icon={GraduationCap} label="Current Class" value={user.class} />
                  <InfoRow icon={Building} label="School" value={user.school} />
                  <InfoRow icon={GraduationCap} label="College/University" value={user.college} />
                </div>
              </div>

              {/* Account Information */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Shield size={18} className="text-blue-600" />
                  </div>
                  Account Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-sm ${getRoleBadgeColors(user.role)}`}>
                      <Shield size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Account Type</p>
                      <p className="text-sm text-gray-900 font-bold capitalize" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{user.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Status</p>
                      <p className="text-sm text-green-700 font-bold capitalize" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{user.status}</p>
                    </div>
                  </div>
                  {user.createdAt && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Calendar size={18} className="text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Member Since</p>
                        <p className="text-sm text-gray-900 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                          {new Date(user.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Back to Home Button */}
            <div className="flex justify-center">
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl font-bold"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                <ArrowLeft size={18} />
                <span>Go to Home</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            This profile has been verified through our secure system
          </p>
          <p className="text-xs text-gray-500 mt-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            © {new Date().getFullYear()} Learning Management Portal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyProfile;
