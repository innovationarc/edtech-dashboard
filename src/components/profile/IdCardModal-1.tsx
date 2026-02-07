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

      // Get the actual rendered dimensions of the card
      const cardElement = cardRef.current;
      const rect = cardElement.getBoundingClientRect();

      // Use high scale for quality while maintaining exact proportions
      const scale = 5; // Very high quality for printing
      
      const canvas = await html2canvas(cardElement, {
        scale: scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        removeContainer: true,
        // Let html2canvas use the natural dimensions
        width: rect.width,
        height: rect.height,
        windowWidth: rect.width,
        windowHeight: rect.height,
        x: 0,
        y: 0,
      });

      // Convert to high quality image
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with exact credit card dimensions (CR80 standard)
      // 85.6mm x 53.98mm (3.375" x 2.125")
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98], // Credit card size
        compress: false // No compression for best quality
      });

      // Add image to fill entire PDF page
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

          body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }

          .id-card {
              width: 85.6mm;
              height: 53.98mm;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
              display: flex;
              position: relative;
              border: 1px solid #e5e7eb;
          }

          .sidebar {
              width: 120px;
              background: linear-gradient(135deg, var(--primary) 0%, #1e40af 50%, #1e3a8a 100%);
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 18px 10px 12px;
              position: relative;
              box-shadow: 4px 0 12px rgba(0,0,0,0.08);
          }

          .sidebar::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%);
              pointer-events: none;
          }

          .photo-box {
              width: 96px;
              height: 96px;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1);
              position: relative;
              z-index: 1;
              border: 2px solid rgba(255,255,255,0.3);
          }

          .photo-box img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
          }

          .id-text-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              margin: 16px 0 12px;
              gap: 8px;
              position: relative;
              z-index: 1;
          }

          .id-separator {
              width: 70%;
              height: 1px;
              background: rgba(255,255,255,0.3);
          }

          .student-id-text {
              font-size: 11px;
              color: white;
              font-weight: 700;
              letter-spacing: 1px;
              text-align: center;
              text-shadow: 0 2px 4px rgba(0,0,0,0.2);
              padding: 0 8px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100px;
          }

          .pdf417-barcode {
              width: 100px;
              height: 30px;
              background: white;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
              position: relative;
              z-index: 1;
          }

          .pdf417-barcode img {
              width: 100%;
              height: 100%;
              object-fit: contain;
          }

          .main-content {
              flex: 1;
              padding: 16px 18px 12px 16px;
              display: flex;
              flex-direction: column;
              background: white;
          }

          .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 10px;
              gap: 12px;
          }

          .brand {
              flex: 1;
          }

          .brand h1 {
              font-size: 15px;
              font-weight: 800;
              color: var(--primary);
              margin: 0 0 2px 0;
              line-height: 1.1;
              letter-spacing: -0.3px;
          }

          .brand p {
              font-size: 9px;
              color: var(--text-muted);
              font-weight: 500;
              margin: 0;
              letter-spacing: 0.3px;
          }

          .qr-small {
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
    
    // Wait for resources to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Digital ID Card
            </h2>
            <p className="text-blue-200 text-sm mt-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Official Identity Credential
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Card Preview */}
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div 
              ref={cardRef}
              style={{
                width: '539.8px', // 85.6mm * 6.3 (conversion factor for screen display)
                height: '337.5px', // 53.98mm * 6.25 (maintains aspect ratio)
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
              }}
            >
              <style dangerouslySetInnerHTML={{
                __html: `
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

                .id-card {
                    width: 100%;
                    height: 100%;
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
                    display: flex;
                    position: relative;
                    border: 1px solid #e5e7eb;
                }

                .sidebar {
                    width: 120px;
                    background: linear-gradient(135deg, var(--primary) 0%, #1e40af 50%, #1e3a8a 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 18px 10px 12px;
                    position: relative;
                    box-shadow: 4px 0 12px rgba(0,0,0,0.08);
                }

                .sidebar::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%);
                    pointer-events: none;
                }

                .photo-box {
                    width: 96px;
                    height: 96px;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1);
                    position: relative;
                    z-index: 1;
                    border: 2px solid rgba(255,255,255,0.3);
                }

                .photo-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .id-text-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    margin: 16px 0 12px;
                    gap: 8px;
                    position: relative;
                    z-index: 1;
                }

                .id-separator {
                    width: 70%;
                    height: 1px;
                    background: rgba(255,255,255,0.3);
                }

                .student-id-text {
                    font-size: 11px;
                    color: white;
                    font-weight: 700;
                    letter-spacing: 1px;
                    text-align: center;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    padding: 0 8px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100px;
                }

                .pdf417-barcode {
                    width: 100px;
                    height: 30px;
                    background: white;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                    position: relative;
                    z-index: 1;
                }

                .pdf417-barcode img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .main-content {
                    flex: 1;
                    padding: 16px 18px 12px 16px;
                    display: flex;
                    flex-direction: column;
                    background: white;
                }

                .header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 10px;
                    gap: 12px;
                }

                .brand {
                    flex: 1;
                }

                .brand h1 {
                    font-size: 15px;
                    font-weight: 800;
                    color: var(--primary);
                    margin: 0 0 2px 0;
                    line-height: 1.1;
                    letter-spacing: -0.3px;
                }

                .brand p {
                    font-size: 9px;
                    color: var(--text-muted);
                    font-weight: 500;
                    margin: 0;
                    letter-spacing: 0.3px;
                }

                .qr-small {
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6 pb-8">
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
