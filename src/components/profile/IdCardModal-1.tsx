// src/components/profile/IdCardModal-1.tsx - ID Card Modal with Real-time Preview
import { useState, useRef, useEffect } from 'react';
import { X, Download, Printer, Loader } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { generateMRZ, type MRZData } from '../../utils/mrz-utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface IdCardModal1Props {
  onClose: () => void;
}

const IdCardModal1 = ({ onClose }: IdCardModal1Props) => {
  const { user } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Generate MRZ when modal opens
  const mrzData: MRZData = {
    userId: user?.userId || 'UNKNOWN',
    fullName: `${user?.surname || ''} ${user?.name || ''}`.trim(),
    surname: user?.surname || 'UNKNOWN',
    name: user?.name || '',
    middleName: '', // Add if available in user object
    dob: user?.dob ? new Date(user.dob) : new Date(),
    issueDate: user?.createdAt ? new Date(user.createdAt) : new Date(),
    expiryDate: user?.validTill === 'lifetime' ? 'lifetime' : 
                user?.validTill ? new Date(user.validTill) : 'lifetime'
  };

  const mrz = generateMRZ(mrzData);

  // Format dates
  const formatIssueDate = (date: Date | string | undefined) => {
    if (!date) return 'Not Specified';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const formatValidTill = (validTill: string | undefined) => {
    if (!validTill || validTill === 'lifetime') return 'Lifetime';
    const d = new Date(validTill);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  // Generate public verification URL
  const verificationUrl = `${window.location.origin}/verify-id?userId=${user?.userId}`;

  // Generate barcode URL (PDF-417)
  const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(user?.userId || '')}&code=PDF417&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=96&imagetype=Gif&rotation=0&color=%23000000&bgcolor=%23ffffff&qunit=Mm&quiet=0`;

  // Generate QR code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=svg&color=0f172a&bgcolor=ffffff&margin=0`;

  // Download as PDF
  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      
      // ID card dimensions: 539.8px x 337.5px (CR80 landscape)
      // Convert to mm: 85.6mm x 53.98mm
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 53.98);
      pdf.save(`ID-Card-${user?.userId}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Print ID card
  const handlePrint = () => {
    if (!cardRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the ID card.');
      return;
    }

    const cardHTML = cardRef.current.outerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>ID Card - ${user?.userId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
        <style>
          @page {
            size: 85.6mm 53.98mm;
            margin: 0;
          }
          * { 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .id-card {
            page-break-after: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        ${cardHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl p-6 md:p-8 relative shadow-2xl my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <X size={24} className="text-gray-600" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            ID Card Preview
          </h2>
          <p className="text-gray-600" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Download or print your official identification card
          </p>
        </div>

        {/* ID Card Preview */}
        <div className="flex justify-center mb-6">
          <div ref={cardRef}>
            {/* Exact HTML Template */}
            <div className="id-card" style={{
              width: '539.8px',
              height: '337.5px',
              background: '#ffffff',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              position: 'relative',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e5e7eb',
              fontFamily: 'Inter, sans-serif'
            }}>
              {/* Left Sidebar */}
              <div className="sidebar" style={{
                width: '33%',
                backgroundColor: '#f9fafb',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '15px 20px',
                borderRight: '1px solid #e5e7eb',
                position: 'relative'
              }}>
                {/* Colored Left Border */}
                <div style={{
                  content: '',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '6px',
                  height: '100%',
                  background: 'linear-gradient(to bottom, #1e3a8a, #4b5563)'
                }}></div>

                {/* Photo */}
                <div className="photo-box" style={{
                  width: '130px',
                  height: '130px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  overflow: 'hidden',
                  marginBottom: '10px',
                  marginLeft: '3px'
                }}>
                  <img 
                    src={user?.profilePictureUrl || 'https://i.pravatar.cc/300?u=' + user?.userId} 
                    alt="Photo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>

                {/* ID Text */}
                <div className="id-text-container" style={{
                  textAlign: 'center',
                  margin: '3px 0 3px 0',
                  width: '100%'
                }}>
                  <div style={{
                    width: '120px',
                    height: '1px',
                    backgroundColor: '#e5e7eb',
                    margin: '0 auto'
                  }}></div>
                  <div className="student-id-text" style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#1f2937',
                    letterSpacing: '0.8px',
                    textAlign: 'center',
                    lineHeight: 1.4,
                    margin: '6px 0'
                  }}>
                    {user?.userId || 'UNKNOWN'}
                  </div>
                  <div style={{
                    width: '120px',
                    height: '1px',
                    backgroundColor: '#e5e7eb',
                    margin: '0 auto'
                  }}></div>
                </div>

                {/* Barcode */}
                <div className="pdf417-barcode" style={{
                  width: '140px',
                  height: '40px',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '5px',
                  marginLeft: '3px'
                }}>
                  <img 
                    src={barcodeUrl}
                    alt="Barcode"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              </div>

              {/* Right Content */}
              <div className="main-content" style={{
                flex: 1,
                padding: '25px 35px 25px 35px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Header Top */}
                <div className="header-top" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '20px'
                }}>
                  <div className="brand">
                    <h1 style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#1e3a8a',
                      letterSpacing: '-0.5px',
                      fontFamily: 'Inter, sans-serif'
                    }}>EDTECH DASHBOARD</h1>
                    <p style={{
                      margin: 0,
                      fontSize: '10px',
                      color: '#374151',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontFamily: 'Inter, sans-serif'
                    }}>Global Learning Network</p>
                  </div>
                  <div className="qr-small" style={{
                    width: '55px',
                    height: '55px',
                    padding: 0,
                    overflow: 'hidden'
                  }}>
                    <img 
                      src={qrCodeUrl}
                      alt="QR"
                      style={{
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  </div>
                </div>

                {/* User Info */}
                <div className="user-info" style={{ flex: 1 }}>
                  <div className="user-name-container" style={{ margin: '0 0 14px 0' }}>
                    <h2 className="user-name" style={{
                      fontSize: '24px',
                      fontWeight: 700,
                      color: '#1f2937',
                      margin: '0 0 3px 0',
                      lineHeight: 1.2,
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      {user?.surname || ''} {user?.name || ''}
                    </h2>
                    <div className="designation" style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#4b5563',
                      letterSpacing: '0.2px',
                      fontStyle: 'italic',
                      margin: '0 0 15px 0',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      {user?.designation || 'Administrator'}
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="info-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <div className="info-item">
                      <div className="label" style={{
                        fontSize: '9px',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        marginBottom: '3px',
                        fontFamily: 'Inter, sans-serif'
                      }}>Blood Group</div>
                      <div className="value" style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1f2937',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {user?.bloodGroup || 'Not Specified'}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="label" style={{
                        fontSize: '9px',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        marginBottom: '3px',
                        fontFamily: 'Inter, sans-serif'
                      }}>Emergency Contact</div>
                      <div className="value" style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1f2937',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {user?.phoneNumber || 'Not Specified'}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="label" style={{
                        fontSize: '9px',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        marginBottom: '3px',
                        fontFamily: 'Inter, sans-serif'
                      }}>Issue Date</div>
                      <div className="value" style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1f2937',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {formatIssueDate(user?.createdAt)}
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="label" style={{
                        fontSize: '9px',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        marginBottom: '3px',
                        fontFamily: 'Inter, sans-serif'
                      }}>Valid Till</div>
                      <div className="value" style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1f2937',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {formatValidTill(user?.validTill)}
                      </div>
                    </div>
                  </div>

                  {/* MRZ Container */}
                  <div className="mrz-container" style={{
                    marginTop: '25px',
                    width: '100%',
                    background: '#f9fafb',
                    padding: '6px 0',
                    borderTop: '1px solid #e5e7eb',
                    fontFamily: 'JetBrains Mono, monospace',
                    textAlign: 'center'
                  }}>
                    <div className="mrz-line-1" style={{
                      fontSize: '8px',
                      letterSpacing: '1.1px',
                      color: '#1f2937',
                      lineHeight: 1.2,
                      width: '100%',
                      margin: '1px 0 0 0',
                      display: 'block',
                      whiteSpace: 'pre',
                      textAlign: 'center',
                      padding: 0,
                      overflow: 'hidden',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      {mrz.line1}
                    </div>
                    <div className="mrz-line-2" style={{
                      fontSize: '8px',
                      letterSpacing: '1.1px',
                      color: '#1f2937',
                      lineHeight: 1.2,
                      width: '100%',
                      margin: '0 0 1px 0',
                      display: 'block',
                      whiteSpace: 'pre',
                      textAlign: 'center',
                      padding: 0,
                      overflow: 'hidden',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      {mrz.line2}
                    </div>
                  </div>

                  {/* Caution Text */}
                  <div className="caution-text" style={{
                    fontSize: '7.5px',
                    color: '#dc2626',
                    fontWeight: 600,
                    textAlign: 'center',
                    marginTop: '6px',
                    letterSpacing: '0.2px',
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    If this card found unattended, please return it to Edtech-dashboard.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl transition-all duration-200 font-bold"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {isGenerating ? (
              <>
                <Loader size={20} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download size={20} />
                Download PDF
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all duration-200 font-bold"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            <Printer size={20} />
            Print Card
          </button>
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
