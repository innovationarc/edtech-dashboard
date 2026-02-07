// src/components/profile/IdCardModal-1.tsx - ID Card Modal with Exact Template Preservation
import { useState, useRef, useEffect } from 'react';
import { X, Download, Printer, Loader } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { generateMRZ, type MRZData } from '../../utils/mrz-utils';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import bwipjs from 'bwip-js';

interface IdCardModal1Props {
  onClose: () => void;
}

const IdCardModal1 = ({ onClose }: IdCardModal1Props) => {
  const { user } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [verificationHash, setVerificationHash] = useState<string>('');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
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

  // Generate barcode locally using bwip-js
  useEffect(() => {
    if (!user?.userId) return;

    try {
      const canvas = document.createElement('canvas');
      bwipjs.toCanvas(canvas, {
        bcid: 'pdf417',
        text: user.userId,
        scale: 3,
        height: 10,
        width: 50,
        padding: 2,
        backgroundcolor: 'ffffff',
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('Barcode generation error:', error);
      // Fallback to external API if local generation fails
      setBarcodeDataUrl(`https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(user?.userId || 'ST-2601-00001')}&code=PDF417&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=150&imagetype=Png&rotation=0&color=%23000000&bgcolor=%23ffffff&qunit=Mm&quiet=0&eclevel=5`);
    }
  }, [user?.userId]);

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

  // Generate QR code URL - now using hash
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=svg&color=0f172a&bgcolor=ffffff&margin=0`;

  // User photo URL with fallback
  const userPhotoUrl = user?.profilePictureUrl || 'https://i.pravatar.cc/300?u=default';

  // Full name
  const fullName = `${user?.surname || ''} ${user?.name || ''}`.trim() || 'Not Specified';

  // Download as PDF - FIXED VERSION
  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;

    setIsGenerating(true);
    try {
      // Wait for images to fully load
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Get the actual rendered size of the card
      const cardElement = cardRef.current;
      const rect = cardElement.getBoundingClientRect();
      
      const canvas = await html2canvas(cardElement, {
        scale: 5, // Ultra high quality for printing
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const clonedCard = clonedDoc.querySelector('.id-card') as HTMLElement;
          if (clonedCard) {
            // Force exact dimensions in the clone
            clonedCard.style.width = '539.84px';
            clonedCard.style.height = '337.5px';
            clonedCard.style.transform = 'none';
            clonedCard.style.margin = '0';
            clonedCard.style.padding = '0';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98],
        compress: false // No compression for maximum quality
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 53.98, undefined, 'FAST');
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

    const cardHTML = cardRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>ID Card - ${user?.userId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
        <style>
          @page {
            size: 85.6mm 53.98mm landscape;
            margin: 0;
          }
          
          * { 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          html, body {
            margin: 0;
            padding: 0;
            background: white;
            width: 85.6mm;
            height: 53.98mm;
          }
          
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

          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }

          body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 0;
          }

          .id-card {
              width: 85.6mm;
              height: 53.98mm;
              background: white;
              display: flex;
              position: relative;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }

          .sidebar {
              width: 30%;
              background: linear-gradient(180deg, var(--primary) 0%, #1e40af 100%);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              padding: 16px 10px;
              position: relative;
          }

          .sidebar::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: var(--primary);
              opacity: 0.95;
          }

          .photo-box {
              width: 80px;
              height: 95px;
              border-radius: 6px;
              overflow: hidden;
              background: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              position: relative;
              z-index: 1;
              flex-shrink: 0;
          }

          .photo-box img {
              width: 100%;
              height: 100%;
              object-fit: cover;
          }

          .id-text-container {
              margin-top: 10px;
              display: flex;
              flex-direction: column;
              align-items: center;
              position: relative;
              z-index: 1;
          }

          .id-separator {
              width: 50px;
              height: 1px;
              background: rgba(255, 255, 255, 0.3);
          }

          .student-id-text {
              padding: 4px 0;
              font-size: 10px;
              font-weight: 700;
              color: white;
              letter-spacing: 0.5px;
              text-align: center;
          }

          .pdf417-barcode {
              margin-top: auto;
              width: 100%;
              display: flex;
              justify-content: center;
              position: relative;
              z-index: 1;
              padding: 0 5px;
          }

          .pdf417-barcode img {
              width: 100%;
              height: auto;
              max-width: 90px;
              filter: brightness(1.1);
          }

          .main-content {
              flex: 1;
              padding: 14px 18px 8px 18px;
              display: flex;
              flex-direction: column;
              background: white;
          }

          .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e5e7eb;
          }

          .brand h1 {
              font-size: 16px;
              font-weight: 800;
              color: var(--primary);
              line-height: 1.1;
              margin: 0 0 2px 0;
              letter-spacing: -0.3px;
          }

          .brand p {
              font-size: 8px;
              color: var(--text-muted);
              font-weight: 500;
              margin: 0;
              letter-spacing: 0.3px;
          }

          .qr-small {
              flex-shrink: 0;
              width: 60px;
              height: 60px;
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
              margin: 0 0 5px 0;
          }

          .user-name {
              font-size: 24px;
              font-weight: 700;
              color: var(--text-dark);
              margin: 0 0 2px 0;
              line-height: 1.2;
          }

          .designation {
              font-size: 13px;
              font-weight: 500;
              color: var(--designation-color);
              letter-spacing: 0.2px;
              font-style: italic;
              margin: 0 0 10px 0;
          }

          .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
              margin-bottom: 3px;
          }

          .info-item .label {
              font-size: 9px;
              color: var(--text-muted);
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
          }

          .info-item .value {
              font-size: 13px;
              font-weight: 500;
              color: var(--text-dark);
          }

          .mrz-container {
              margin-top: 16px;
              width: 100%;
              background: #f9fafb;
              padding: 3px 0;
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
              margin: 2px 0 0 0;
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
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center rounded-t-2xl z-10">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Your Digital ID Card</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Card Preview */}
        <div className="p-8">
          <div className="flex justify-center mb-4">
            <div className="inline-block bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl shadow-inner">
              <div ref={cardRef} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <style>{`
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

                  * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                  }

                  body {
                      font-family: 'Inter', system-ui, -apple-system, sans-serif;
                      -webkit-font-smoothing: antialiased;
                      -moz-osx-font-smoothing: grayscale;
                      background: white;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin: 0;
                      padding: 0;
                  }

                  .id-card {
                      width: 539.84px;
                      height: 337.5px;
                      background: white;
                      display: flex;
                      position: relative;
                      border-radius: 12px;
                      overflow: hidden;
                      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                  }

                  .sidebar {
                      width: 30%;
                      background: linear-gradient(180deg, var(--primary) 0%, #1e40af 100%);
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: flex-start;
                      padding: 24px 16px;
                      position: relative;
                  }

                  .sidebar::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      background: var(--primary);
                      opacity: 0.95;
                  }

                  .photo-box {
                      width: 120px;
                      height: 140px;
                      border-radius: 8px;
                      overflow: hidden;
                      background: white;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                      position: relative;
                      z-index: 1;
                      flex-shrink: 0;
                  }

                  .photo-box img {
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                  }

                  .id-text-container {
                      margin-top: 16px;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      position: relative;
                      z-index: 1;
                  }

                  .id-separator {
                      width: 80px;
                      height: 2px;
                      background: rgba(255, 255, 255, 0.3);
                  }

                  .student-id-text {
                      padding: 8px 0;
                      font-size: 14px;
                      font-weight: 700;
                      color: white;
                      letter-spacing: 1px;
                      text-align: center;
                  }

                  .pdf417-barcode {
                      margin-top: auto;
                      width: 100%;
                      display: flex;
                      justify-content: center;
                      position: relative;
                      z-index: 1;
                      padding: 0 8px;
                  }

                  .pdf417-barcode img {
                      width: 100%;
                      height: auto;
                      max-width: 130px;
                      filter: brightness(1.1);
                  }

                  .main-content {
                      flex: 1;
                      padding: 24px 28px 16px 28px;
                      display: flex;
                      flex-direction: column;
                      background: white;
                  }

                  .header-top {
                      display: flex;
                      justify-content: space-between;
                      align-items: flex-start;
                      margin-bottom: 18px;
                      padding-bottom: 12px;
                      border-bottom: 3px solid #e5e7eb;
                  }

                  .brand h1 {
                      font-size: 22px;
                      font-weight: 800;
                      color: var(--primary);
                      line-height: 1.1;
                      margin: 0 0 4px 0;
                      letter-spacing: -0.5px;
                  }

                  .brand p {
                      font-size: 11px;
                      color: var(--text-muted);
                      font-weight: 500;
                      margin: 0;
                      letter-spacing: 0.5px;
                  }

                  .qr-small {
                      flex-shrink: 0;
                      width: 75px;
                      height: 75px;
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
                      margin: 0 0 8px 0;
                  }

                  .user-name {
                      font-size: 32px;
                      font-weight: 700;
                      color: var(--text-dark);
                      margin: 0 0 4px 0;
                      line-height: 1.2;
                  }

                  .designation {
                      font-size: 16px;
                      font-weight: 500;
                      color: var(--designation-color);
                      letter-spacing: 0.3px;
                      font-style: italic;
                      margin: 0 0 16px 0;
                  }

                  .info-grid {
                      display: grid;
                      grid-template-columns: repeat(2, 1fr);
                      gap: 20px;
                      margin-bottom: 6px;
                  }

                  .info-item .label {
                      font-size: 11px;
                      color: var(--text-muted);
                      text-transform: uppercase;
                      font-weight: 600;
                      letter-spacing: 0.8px;
                      margin-bottom: 4px;
                  }

                  .info-item .value {
                      font-size: 15px;
                      font-weight: 500;
                      color: var(--text-dark);
                  }

                  .mrz-container {
                      margin-top: 20px;
                      width: 100%;
                      background: #f9fafb;
                      padding: 6px 0;
                      border-top: 2px solid #e5e7eb;
                      font-family: 'JetBrains Mono', monospace;
                      text-align: center;
                  }

                  .mrz-line-1 {
                      font-size: 10px;
                      letter-spacing: 1.5px;
                      color: #1f2937;
                      line-height: 1.4;
                      width: 100%;
                      margin: 2px 0 0 0;
                      display: block;
                      white-space: pre;
                      text-align: center;
                      padding: 0;
                      overflow: hidden;
                  }

                  .mrz-line-2 {
                      font-size: 10px;
                      letter-spacing: 1.5px;
                      color: #1f2937;
                      line-height: 1.4;
                      width: 100%;
                      margin: 0 0 2px 0;
                      display: block;
                      white-space: pre;
                      text-align: center;
                      padding: 0;
                      overflow: hidden;
                  }

                  .caution-text {
                      font-size: 9px;
                      color: var(--caution-red);
                      font-weight: 600;
                      text-align: center;
                      margin-top: 8px;
                      letter-spacing: 0.3px;
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
                `}</style>

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
                      <img src={barcodeDataUrl} alt="PDF-417 Barcode" />
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
