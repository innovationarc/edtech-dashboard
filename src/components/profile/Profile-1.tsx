// src/pages/Profile-1.tsx - Elite Admin Profile
import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { 
  User, Mail, Phone, MapPin, Calendar, Shield, FileText, 
  Edit, Lock, Printer, CreditCard, Loader, Activity, 
  Database, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import ProfileEditModal1 from '../../components/profile/ProfileEditModal-1';
import ChangePasswordModal from '../../components/profile/ChangePasswordModal';
import IdCardModal1 from '../../components/profile/IdCardModal-1';

const Profile1 = () => {
  const { user } = useDashboard();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);

  const handlePrintProfile = () => {
    window.print();
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

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-GB', { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const DataField = ({ 
    label, 
    value, 
    icon: Icon 
  }: { 
    label: string; 
    value?: string; 
    icon?: any;
  }) => {
    if (!value || value.trim() === '') return null;
    
    return (
      <div className="flex items-start gap-3 py-3 border-b border-slate-700/30">
        {Icon && (
          <div className="flex-shrink-0 mt-0.5">
            <Icon size={16} className="text-slate-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1 tracking-wide uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
            {label}
          </p>
          <p className="text-sm text-slate-200 font-medium break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
            {value}
          </p>
        </div>
      </div>
    );
  };

  const StatBlock = ({ 
    value, 
    label, 
    icon: Icon 
  }: { 
    value: string | number; 
    label: string; 
    icon: any;
  }) => (
    <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
          <Icon size={16} className="text-slate-400" />
        </div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
          {label}
        </p>
      </div>
      <p className="text-2xl font-semibold text-slate-100" style={{ fontFamily: 'Inter, sans-serif' }}>
        {value}
      </p>
    </div>
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader size={48} className="animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Print Styles */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-content, .print-content * {
              visibility: visible;
            }
            .print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
            .bg-slate-950 {
              background: white !important;
            }
          }
        `}</style>

        {/* Page Header - No Print */}
        <div className="no-print mb-8">
          <h1 className="text-3xl font-semibold text-slate-100 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
            Administrator Profile
          </h1>
          <p className="text-slate-400 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            Platform identity and system access overview
          </p>
        </div>

        {/* Print Content */}
        <div className="print-content space-y-6">
          {/* Admin Identity Header */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 border border-slate-700/50 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Profile Image */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-700/50 shadow-xl bg-slate-800">
                  {user.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt="Administrator"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                      <span className="text-3xl text-slate-300 font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {user.surname?.charAt(0) || user.name?.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-cyan-600 rounded-lg p-1.5 shadow-lg border-2 border-slate-900">
                  <Shield size={14} className="text-white" />
                </div>
              </div>

              {/* Identity Information */}
              <div className="flex-1">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-slate-100 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {user.surname} {user.fullName || user.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-medium text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                      Platform Administrator
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/30 text-xs font-medium text-emerald-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                      Active
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                      Administrator ID
                    </p>
                    <p className="text-sm text-slate-200 font-mono font-medium" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {user.userId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                      Account Created
                    </p>
                    <p className="text-sm text-slate-200 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {formatDate(user.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Badge */}
              <div className="no-print flex-shrink-0">
                <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30 text-center min-w-[140px]">
                  <div className="flex justify-center mb-2">
                    <div className="h-10 w-10 rounded-lg bg-cyan-950/50 border border-cyan-800/30 flex items-center justify-center">
                      <CheckCircle2 size={20} className="text-cyan-400" />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                    Verified
                  </p>
                  <p className="text-xs text-slate-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                    System Admin
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - No Print */}
          <div className="no-print flex flex-wrap gap-3">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all duration-200 flex items-center gap-2 border border-slate-700/50 font-medium text-sm"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <Edit size={16} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={handlePrintProfile}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all duration-200 flex items-center gap-2 border border-slate-700/50 font-medium text-sm"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <Printer size={16} />
              <span>Print Profile</span>
            </button>
            <button
              onClick={() => setShowIdCardModal(true)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all duration-200 flex items-center gap-2 border border-slate-700/50 font-medium text-sm"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <CreditCard size={16} />
              <span>ID Card</span>
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all duration-200 flex items-center gap-2 border border-slate-700/50 font-medium text-sm"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <Lock size={16} />
              <span>Change Password</span>
            </button>
          </div>

          {/* Authority & Activity Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatBlock
              icon={Activity}
              value="Full Access"
              label="Clearance Level"
            />
            <StatBlock
              icon={Database}
              value="All Modules"
              label="System Scope"
            />
            <StatBlock
              icon={Clock}
              value={user.lastLogin ? formatTime(user.lastLogin) : 'N/A'}
              label="Last Active"
            />
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30">
              <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-6 w-6 rounded-lg bg-slate-800/60 flex items-center justify-center">
                  <User size={14} className="text-slate-400" />
                </div>
                Personal Information
              </h3>
              <div className="space-y-0">
                <DataField icon={User} label="Surname" value={user.surname} />
                <DataField icon={User} label="Full Name" value={user.fullName} />
                <DataField icon={Mail} label="Email" value={user.email} />
                <DataField 
                  icon={Calendar} 
                  label="Date of Birth" 
                  value={user.dob ? formatDate(user.dob) : undefined} 
                />
                <DataField 
                  icon={User} 
                  label="Gender" 
                  value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : undefined} 
                />
                <DataField 
                  icon={Activity} 
                  label="Blood Group" 
                  value={user.bloodGroup} 
                />
                <DataField icon={Shield} label="Religion" value={user.religion} />
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30">
              <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-6 w-6 rounded-lg bg-slate-800/60 flex items-center justify-center">
                  <Phone size={14} className="text-slate-400" />
                </div>
                Contact Information
              </h3>
              <div className="space-y-0">
                <DataField 
                  icon={Phone} 
                  label="Phone Number" 
                  value={user.phoneNumber ? `+880 ${user.phoneNumber}` : undefined} 
                />
                <DataField icon={MapPin} label="Address" value={user.address} />
              </div>
            </div>

            {/* Official Documents */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30">
              <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-6 w-6 rounded-lg bg-slate-800/60 flex items-center justify-center">
                  <FileText size={14} className="text-slate-400" />
                </div>
                Official Documents
              </h3>
              <div className="space-y-0">
                <DataField 
                  icon={FileText} 
                  label="Birth Certificate Number" 
                  value={(user as any).birthCertificateNumber} 
                />
                <DataField 
                  icon={FileText} 
                  label="National ID (NID)" 
                  value={(user as any).nid} 
                />
              </div>
            </div>

            {/* Account & System Information */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30">
              <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-6 w-6 rounded-lg bg-slate-800/60 flex items-center justify-center">
                  <Shield size={14} className="text-slate-400" />
                </div>
                Account Information
              </h3>
              <div className="space-y-0">
                <DataField 
                  icon={Shield} 
                  label="Account Type" 
                  value="Platform Administrator" 
                />
                <DataField 
                  icon={CheckCircle2} 
                  label="Account Status" 
                  value={user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : undefined} 
                />
                <DataField 
                  icon={Calendar} 
                  label="Account Created" 
                  value={user.createdAt ? formatDate(user.createdAt) : undefined} 
                />
                {(user as any).designation && (
                  <DataField 
                    icon={FileText} 
                    label="Designation" 
                    value={(user as any).designation} 
                  />
                )}
                {(user as any).validTill && (
                  <DataField 
                    icon={Calendar} 
                    label="Access Valid Till" 
                    value={(user as any).validTill === 'lifetime' ? 'Lifetime' : formatDate((user as any).validTill)} 
                  />
                )}
              </div>
            </div>
          </div>

          {/* Responsibility & Access Summary */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30">
            <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              <div className="h-6 w-6 rounded-lg bg-slate-800/60 flex items-center justify-center">
                <Database size={14} className="text-slate-400" />
              </div>
              System Access & Responsibilities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                'User Management',
                'Content Administration',
                'System Configuration',
                'Security & Audit',
                'Analytics & Reports',
                'Platform Settings'
              ].map((scope, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-800/40 rounded-xl border border-slate-700/30"
                >
                  <div className="h-2 w-2 rounded-full bg-cyan-500"></div>
                  <span className="text-sm text-slate-300 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {scope}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System Trace & Audit History */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/30">
            <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              <div className="h-6 w-6 rounded-lg bg-slate-800/60 flex items-center justify-center">
                <Clock size={14} className="text-slate-400" />
              </div>
              Recent Activity Timeline
            </h3>
            <div className="space-y-3">
              {user.lastLogin && (
                <div className="flex items-start gap-4 pb-3 border-b border-slate-700/30">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 font-medium mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Last Login
                    </p>
                    <p className="text-xs text-slate-500 font-mono" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {formatDate(user.lastLogin)} at {formatTime(user.lastLogin)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-4 pb-3 border-b border-slate-700/30">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-2 w-2 rounded-full bg-slate-600"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 font-medium mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Account Created
                  </p>
                  <p className="text-xs text-slate-500 font-mono" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {formatDate(user.createdAt)}
                  </p>
                </div>
              </div>
              {(user as any).createdBy && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-2 w-2 rounded-full bg-slate-600"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 font-medium mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Created By
                    </p>
                    <p className="text-xs text-slate-500 font-mono" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {(user as any).createdBy}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        {showEditModal && (
          <ProfileEditModal1
            onClose={() => setShowEditModal(false)}
            onSuccess={() => {
              setShowEditModal(false);
            }}
          />
        )}

        {showPasswordModal && (
          <ChangePasswordModal
            onClose={() => setShowPasswordModal(false)}
            onSuccess={() => {
              setShowPasswordModal(false);
            }}
          />
        )}

        {showIdCardModal && (
          <IdCardModal1
            onClose={() => setShowIdCardModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Profile1;
