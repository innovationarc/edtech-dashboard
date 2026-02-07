// src/components/profile/IdCardModal-1.tsx - ID Card Modal with Exact Template Preservation
import { useState, useRef, useEffect } from 'react';
import { X, Download, Printer, Loader } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { generateMRZ, type MRZData } from '../../utils/mrz-utils';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface IdCardModal1Props {
  onClose: () => void;
}

const IdCardModal1 = ({ onClose }: IdCardModal1Props) => {
  const { user } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [verificationHash, setVerificationHash] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);

  // Generate verification hash and store in Firestore
  useEffect(() => {
    const generateVerificationHash = async () => {
      if (!user?.userId) return;

      // Generate a random hash for this ID card issuance
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const hash = btoa(`${user.userId}-${timestamp}-${randomString}`).replace(/[+/=]/g, '');

      setVerificationHash(hash);

      // Store verification record in Firestore
      try {
        const db = getFirestore();
        const verificationRef = doc(db, 'id-verifications', hash);
        
        await setDoc(verificationRef, {
          userId: user.userId,
          fullName: user.fullName || `${user.surname || ''} ${user.name || ''}`.trim(),
          surname: user.surname || '',
          name: user.name || '',
          designation: user.designation || 'Not Specified',
          bloodGroup: user.bloodGroup || 'Not Specified',
          phoneNumber: user.phoneNumber || 'Not Specified',
          email: user.email || 'Not Specified',
          address: user.address || 'Not Specified',
          profilePictureUrl: user.profilePictureUrl || '',
          status: user.status || 'active',
          role: user.role || 'Unknown',
          issueDate: new Date().toISOString(),
          validTill: user.validTill || 'lifetime',
          createdAt: new Date().toISOString(),
          verificationHash: hash
        });
      } catch (error) {
        console.error('Error storing verification record:', error);
      }
    };

    generateVerificationHash();
  }, [user]);

  // Generate MRZ when modal opens
  const mrzData: MRZData = {
    userId: user?.userId || 'UNKNOWN',
    fullName: `${user?.surname || ''} ${user?.name || ''}`.trim(),
    surname: user?.surname || 'UNKNOWN',
    name: user?.name || '',
    middleName: '',
    dob: user?.dob ? new Date(user.dob) : new Date(),
    issueDate: new Date(),
    expiryDate: user?.validTill === 'lifetime' ? 'lifetime' : 
                user?.validTill ? new Date(user.validTill) : 'lifetime'
  };

  const mrz = generateMRZ(mrzData);

  // Format dates
  const formatIssueDate = () => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const formatValidTill = (validTill: string | undefined) => {
    if (!validTill || validTill === 'lifetime') return 'Lifetime';
    const d = new Date(validTill);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  // Generate public verification URL with hash
  const verificationUrl = `${window.location.origin}/verify-id?token=${verificationHash}`;

  // Generate barcode URL (PDF-417) - now using hash
  const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(verificationHash)}&code=PDF417&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=96&imagetype=Gif&rotation=0&color=%23000000&bgcolor=%23ffffff&qunit=Mm&quiet=0`;

  // Generate QR code URL - now using hash
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=svg&color=0f172a&bgcolor=ffffff&margin=0`;

  // User photo URL with fallback
  const userPhotoUrl = user?.profilePictureUrl || 'https://i.pravatar.cc/300?u=default';

  // Full name
  const fullName = `${user?.surname || ''} ${user?.name || ''}`.trim() || 'Not Specified';

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

  if (!verificationHash) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl p-8 text-center">
          <Loader size={40} className="animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-700 font-semibold">Generating ID Card...</p>
        </div>
      </div>
    );
  }

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
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Professional ID Card
          </h2>
          <p className="text-gray-600 text-sm md:text-base">
            Official identification document
          </p>
        </div>

        {/* ID Card Preview - Exact Template Rendering */}
        <div className="flex justify-center mb-6">
          <div className="inline-block bg-gray-100 p-6 rounded-2xl">
            {/* EXACT HTML TEMPLATE - DO NOT MODIFY STRUCTURE OR STYLES */}
            <div ref={cardRef}>
              <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono&display=swap');

                :root {
                    --primary: #1e3a8a;
                    --accent: #374151;
                    --sidebar: #f9fafb;
                    --text-dark: #1f2937;
                    --text-muted: #6b7280;
                    --caution-red: #dc2626;
                    --id-color: #1f2937;
                    --designation-color: #4b5563;
                }

                * { box-sizing: border-box; -webkit-print-color-adjust: exact; }

                .id-card {
                    width: 539.8px;
                    height: 337.5px;
                    background: #ffffff;
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    position: relative;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2);
                    border: 1px solid #e5e7eb;
                }

                .sidebar {
                    width: 33%;
                    background-color: var(--sidebar);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 15px 20px;
                    border-right: 1px solid #e5e7eb;
                    position: relative;
                }

                .sidebar::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 6px;
                    height: 100%;
                    background: linear-gradient(to bottom, var(--primary), #4b5563);
                }

                .photo-box {
                    width: 130px;
                    height: 130px;
                    background: #fff;
                    border-radius: 8px;
                    border: 1px solid #d1d5db;
                    overflow: hidden;
                    margin-bottom: 10px;
                    margin-left: 3px;
                }

                .photo-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .id-text-container {
                    text-align: center;
                    margin: 3px 0 3px 0;
                    width: 100%;
                }

                .id-separator {
                    width: 120px;
                    height: 1px;
                    background-color: #e5e7eb;
                    margin: 0 auto;
                }

                .student-id-text {
                    font-family: 'Inter', sans-serif;
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--id-color);
                    letter-spacing: 0.8px;
                    text-align: center;
                    line-height: 1.4;
                    margin: 6px 0;
                }

                .pdf417-barcode {
                    width: 140px;
                    height: 40px;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-top: 5px;
                    margin-left: 3px;
                }

                .pdf417-barcode img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .main-content {
                    flex: 1;
                    padding: 25px 35px 25px 35px;
                    display: flex;
                    flex-direction: column;
                }

                .header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }

                .brand h1 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 800;
                    color: var(--primary);
                    letter-spacing: -0.5px;
                }

                .brand p {
                    margin: 0;
                    font-size: 10px;
                    color: var(--accent);
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .qr-small {
                    width: 55px;
                    height: 55px;
                    padding: 0;
                    overflow: hidden;
                }

                .qr-small img {
                    width: 100%;
                    height: 100%;
                }

                .user-info {
                    flex: 1;
                }

                .user-name-container {
                    margin: 0 0 14px 0;
                }

                .user-name {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--text-dark);
                    margin: 0 0 3px 0;
                    line-height: 1.2;
                }

                .designation {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--designation-color);
                    letter-spacing: 0.2px;
                    font-style: italic;
                    margin: 0 0 15px 0;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .info-item .label {
                    font-size: 9px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    margin-bottom: 3px;
                }

                .info-item .value {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text-dark);
                }

                .mrz-container {
                    margin-top: 25px;
                    width: 100%;
                    background: #f9fafb;
                    padding: 6px 0;
                    border-top: 1px solid #e5e7eb;
                    font-family: 'JetBrains Mono', monospace;
                    text-align: center;
                }

                .mrz-line-1 {
                    font-size: 8px;
                    letter-spacing: 1.1px;
                    color: #1f2937;
                    line-height: 1.2;
                    width: 100%;
                    margin: 1px 0 0 0;
                    display: block;
                    white-space: pre;
                    text-align: center;
                    padding: 0;
                    overflow: hidden;
                }

                .mrz-line-2 {
                    font-size: 8px;
                    letter-spacing: 1.1px;
                    color: #1f2937;
                    line-height: 1.2;
                    width: 100%;
                    margin: 0 0 1px 0;
                    display: block;
                    white-space: pre;
                    text-align: center;
                    padding: 0;
                    overflow: hidden;
                }

                .caution-text {
                    font-size: 7.5px;
                    color: var(--caution-red);
                    font-weight: 600;
                    text-align: center;
                    margin-top: 6px;
                    letter-spacing: 0.2px;
                    width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                }

                @media print {
                    body { background: transparent; }
                    .id-card { box-shadow: none; border: 1px solid #ddd; }
                    .sidebar::before { background: var(--primary); }
                    .photo-box { box-shadow: none; }
                }
              `}} />

              <div className="id-card">
                <div className="sidebar">
                  <div className="photo-box">
                    <img src={userPhotoUrl} alt="Photo" crossOrigin="anonymous" />
                  </div>
                  
                  <div className="id-text-container">
                    <div className="id-separator"></div>
                    <div className="student-id-text">{user?.userId || 'ST-2601-00001'}</div>
                    <div className="id-separator"></div>
                  </div>
                  
                  <div className="pdf417-barcode">
                    <img src={barcodeUrl} alt="PDF-417 Barcode" crossOrigin="anonymous" />
                  </div>
                </div>

                <div className="main-content">
                  <div className="header-top">
                    <div className="brand">
                      <h1>EDTECH DASHBOARD</h1>
                      <p>Global Learning Network</p>
                    </div>
                    <div className="qr-small">
                      <img src={qrCodeUrl} alt="QR" crossOrigin="anonymous" />
                    </div>
                  </div>

                  <div className="user-info">
                    <div className="user-name-container">
                      <h2 className="user-name">{fullName}</h2>
                      <div className="designation">{user?.designation || 'Security Analyst'}</div>
                    </div>
                    
                    <div className="info-grid">
                      <div className="info-item">
                        <div className="label">Blood Group</div>
                        <div className="value">{user?.bloodGroup || 'Not Specified'}</div>
                      </div>
                      <div className="info-item">
                        <div className="label">Emergency Contact</div>
                        <div className="value">{user?.phoneNumber || 'Not Specified'}</div>
                      </div>
                      <div className="info-item">
                        <div className="label">Issue Date</div>
                        <div className="value">{formatIssueDate()}</div>
                      </div>
                      <div className="info-item">
                        <div className="label">Valid Till</div>
                        <div className="value">{formatValidTill(user?.validTill)}</div>
                      </div>
                    </div>

                    <div className="mrz-container">
                      <div className="mrz-line-1">{mrz.line1}</div>
                      <div className="mrz-line-2">{mrz.line2}</div>
                    </div>
                    <div className="caution-text">If this card found unattended, please return it to Edtech-dashboard.</div>
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
