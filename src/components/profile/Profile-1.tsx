// src/components/profile/Profile-1.tsx
import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { 
  User, Mail, Phone, MapPin, Calendar, Shield, FileText, 
  Edit, Lock, Printer, CreditCard, Loader, X, Clock, CheckCircle2
} from 'lucide-react';
import ProfileEditModal1 from '../../components/profile/ProfileEditModal-1';
import ChangePasswordModal from '../../components/profile/ChangePasswordModal';
import IdCardModal1 from '../../components/profile/IdCardModal-1';

interface Profile1Props {
  onClose?: () => void;
}

const Profile1 = ({ onClose }: Profile1Props) => {
  const { user } = useDashboard();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

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
      <div className="flex items-start gap-2 sm:gap-3 py-2 sm:py-3 border-b border-slate-700/30">
        {Icon && (
          <div className="flex-shrink-0 mt-0.5">
            <Icon size={14} className="sm:w-4 sm:h-4 text-slate-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-0.5 sm:mb-1 tracking-wide uppercase" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
            {label}
          </p>
          <p className="text-xs sm:text-sm text-slate-200 font-medium break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
            {value}
          </p>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
        <Loader size={48} className="animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <>
      {/* Full Screen Modal Overlay */}
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm">
        {/* Close on background click */}
        <div 
          className="absolute inset-0" 
          onClick={handleClose}
        />

        {/* Modal Content Container */}
        <div className="relative h-full w-full flex flex-col">
          {/* Spacer replacing removed header — matches bg */}
          <div className="flex-shrink-0 bg-slate-950/95 pt-3 sm:pt-4" />

          {/* Scrollable Content */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#475569 #1e293b'
            }}
          >
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8">
              <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: #1e293b;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #475569;
                  border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #64748b;
                }
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
                }
              `}</style>

              <div className="print-content space-y-3 sm:space-y-4 md:space-y-6 pb-4 sm:pb-6">
                {/* Admin Identity Header */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8 border border-slate-700/50">
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 md:gap-6">
                    {/* Profile Image + Close Button Row */}
                    <div className="flex items-start justify-between w-full sm:w-auto sm:block">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg sm:rounded-xl overflow-hidden border-2 border-slate-700/50 shadow-xl bg-slate-800">
                        {user.profilePictureUrl ? (
                          <img
                            src={user.profilePictureUrl}
                            alt="Administrator"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                            <span className="text-xl sm:text-2xl md:text-3xl text-slate-300 font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                              {user.surname?.charAt(0) || user.name?.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-cyan-600 rounded-md sm:rounded-lg p-1 sm:p-1.5 shadow-lg border-2 border-slate-900">
                        <Shield size={12} className="sm:w-3.5 sm:h-3.5 text-white" />
                      </div>
                    </div>
                    <button
                      onClick={handleClose}
                      className="no-print w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg transition-all border border-slate-700/50 group sm:hidden"
                      aria-label="Close profile"
                    >
                      <X size={16} className="group-hover:rotate-90 transition-transform duration-200" />
                    </button>
                    </div>

                    {/* Identity Information */}
                    <div className="flex-1 w-full sm:w-auto">
                      <div className="hidden sm:flex justify-end mb-2">
                        <button
                          onClick={handleClose}
                          className="no-print w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg transition-all border border-slate-700/50 group"
                          aria-label="Close profile"
                        >
                          <X size={16} className="group-hover:rotate-90 transition-transform duration-200" />
                        </button>
                      </div>
                      <div className="mb-3 sm:mb-4">
                        <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-slate-100 mb-1.5 sm:mb-2 break-words" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {user.fullName || user.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="inline-flex items-center px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-medium text-slate-300 uppercase tracking-wide" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                            Platform Administrator
                          </span>
                          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-950/50 border border-emerald-800/30 text-xs font-medium text-emerald-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                            Active
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-0.5 sm:mb-1 uppercase tracking-wide" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                            Administrator ID
                          </p>
                          <p className="text-xs sm:text-sm text-slate-200 font-mono font-medium break-all" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                            {user.userId}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-0.5 sm:mb-1 uppercase tracking-wide" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>
                            Username
                          </p>
                          <p className="text-xs sm:text-sm text-slate-200 font-mono font-medium break-all" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                            {user.username}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-4 sm:mt-6 md:mt-8 pt-4 sm:pt-6 md:pt-8 border-t border-slate-700/30 no-print">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center justify-center gap-1.5 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 rounded-md sm:rounded-lg transition-colors border border-cyan-500/30"
                      >
                        <Edit size={14} className="sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ fontFamily: 'Inter, sans-serif' }}>Edit</span>
                      </button>
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        className="flex items-center justify-center gap-1.5 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-md sm:rounded-lg transition-colors border border-slate-700/50"
                      >
                        <Lock size={14} className="sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ fontFamily: 'Inter, sans-serif' }}>Password</span>
                      </button>
                      <button
                        onClick={() => setShowIdCardModal(true)}
                        className="flex items-center justify-center gap-1.5 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-md sm:rounded-lg transition-colors border border-slate-700/50"
                      >
                        <CreditCard size={14} className="sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ fontFamily: 'Inter, sans-serif' }}>ID Card</span>
                      </button>
                      <button
                        onClick={handlePrintProfile}
                        className="flex items-center justify-center gap-1.5 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-md sm:rounded-lg transition-colors border border-slate-700/50"
                      >
                        <Printer size={14} className="sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ fontFamily: 'Inter, sans-serif' }}>Print</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Profile Details Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                  {/* Personal Information */}
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 border border-slate-700/30">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center">
                        <User size={12} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                      </div>
                      Personal Information
                    </h3>
                    <div className="space-y-0">
                      <DataField icon={User} label="Surname" value={user.surname} />
                      <DataField icon={User} label="Full Name" value={user.fullName || user.name} />
                      <DataField icon={Mail} label="Email Address" value={user.email} />
                      <DataField 
                        icon={Calendar} 
                        label="Date of Birth" 
                        value={(user as any).dob ? formatDate((user as any).dob) : undefined} 
                      />
                      <DataField 
                        icon={User} 
                        label="Gender" 
                        value={(user as any).gender ? (user as any).gender.charAt(0).toUpperCase() + (user as any).gender.slice(1) : undefined} 
                      />
                      <DataField 
                        icon={User} 
                        label="Blood Group" 
                        value={(user as any).bloodGroup} 
                      />
                      <DataField 
                        icon={User} 
                        label="Religion" 
                        value={(user as any).religion} 
                      />
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 border border-slate-700/30">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center">
                        <Phone size={12} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                      </div>
                      Contact Information
                    </h3>
                    <div className="space-y-0">
                      <DataField 
                        icon={Phone} 
                        label="Phone Number" 
                        value={user.phoneNumber ? `+880 ${user.phoneNumber.replace(/^880/, '')}` : undefined} 
                      />
                      <DataField icon={MapPin} label="Address" value={user.address} />
                    </div>
                  </div>

                  {/* Official Documents */}
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 border border-slate-700/30">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center">
                        <FileText size={12} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
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
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 border border-slate-700/30">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center">
                        <Shield size={12} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
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
                        icon={Shield} 
                        label="Role" 
                        value={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : undefined} 
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
                      <DataField 
                        icon={FileText} 
                        label="Designation" 
                        value={(user as any).designation} 
                      />
                      <DataField 
                        icon={Calendar} 
                        label="Profile Validity" 
                        value={(user as any).validTill === 'lifetime' ? 'Lifetime' : (user as any).validTill ? formatDate((user as any).validTill) : undefined} 
                      />
                    </div>
                  </div>
                </div>

                {/* System Trace & Audit History */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 border border-slate-700/30">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center">
                      <Clock size={12} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                    </div>
                    Recent Activity Timeline
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {user.lastLogin && (
                      <div className="flex items-start gap-2 sm:gap-3 md:gap-4 pb-2 sm:pb-3 border-b border-slate-700/30">
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-slate-300 font-medium mb-0.5 sm:mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                            Last Login
                          </p>
                          <p className="text-xs text-slate-500 font-mono break-words" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                            {formatDate(user.lastLogin)} at {formatTime(user.lastLogin)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2 sm:gap-3 md:gap-4 pb-2 sm:pb-3 border-b border-slate-700/30">
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-slate-600"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-slate-300 font-medium mb-0.5 sm:mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                          Account Created
                        </p>
                        <p className="text-xs text-slate-500 font-mono break-words" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                          {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>
                    {(user as any).createdBy && (
                      <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-2 w-2 rounded-full bg-slate-600"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-slate-300 font-medium mb-0.5 sm:mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                            Created By
                          </p>
                          <p className="text-xs text-slate-500 font-mono break-words" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                            {(user as any).createdBy}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
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
    </>
  );
};

export default Profile1;
