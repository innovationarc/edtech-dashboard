// src/pages/VerifyReceipt.tsx
// Public page — accessible by anyone who scans the QR code, no login required.
// URL: /verify-receipt?r=RCP-XXXXXXXX

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, Loader, ShieldCheck, ShieldX } from 'lucide-react';
import receiptService, { ReceiptData } from '../services/receiptService';

type VerifyStatus = 'loading' | 'valid' | 'not_found' | 'error';

// ==================== HELPERS ====================

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ==================== STYLES ====================

const VRStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    * { box-sizing: border-box; }

    .vr-shell {
      min-height: 100vh;
      background: #f3f4f6;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      font-family: 'Inter', Arial, sans-serif;
    }

    .vr-loading { display: flex; flex-direction: column; align-items: center; gap: 16px; color: #6b7280; }
    .vr-loading p { font-size: 15px; margin: 0; }
    @keyframes vr-spin { to { transform: rotate(360deg); } }
    .vr-spin { animation: vr-spin .75s linear infinite; color: #1a56db; }

    .vr-card {
      width: 100%;
      max-width: 560px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      overflow: hidden;
    }

    .vr-banner {
      padding: 32px 28px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }
    .vr-banner--valid     { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-bottom: 3px solid #10b981; }
    .vr-banner--not_found { background: linear-gradient(135deg, #fef2f2, #fee2e2); border-bottom: 3px solid #ef4444; }
    .vr-banner--error     { background: linear-gradient(135deg, #f9fafb, #f3f4f6); border-bottom: 3px solid #9ca3af; }

    .vr-banner-title { font-size: 22px; font-weight: 800; margin: 0; }
    .vr-banner--valid     .vr-banner-title { color: #065f46; }
    .vr-banner--not_found .vr-banner-title { color: #991b1b; }
    .vr-banner--error     .vr-banner-title { color: #374151; }

    .vr-banner-sub { font-size: 14px; margin: 0; max-width: 400px; line-height: 1.6; }
    .vr-banner--valid     .vr-banner-sub { color: #047857; }
    .vr-banner--not_found .vr-banner-sub { color: #b91c1c; }
    .vr-banner--error     .vr-banner-sub { color: #6b7280; }

    .vr-body { padding: 28px; display: flex; flex-direction: column; }

    .vr-section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #9ca3af; margin: 0 0 16px;
    }

    .vr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }

    .vr-label {
      font-size: 11px; text-transform: uppercase; color: #9ca3af;
      font-weight: 700; margin-bottom: 4px; display: block; letter-spacing: 0.06em;
    }
    .vr-value        { font-size: 15px; color: #111827; font-weight: 600; }
    .vr-value--blue  { color: #1a56db; }
    .vr-value--free  { color: #059669; }
    .vr-value--paid  { color: #1a56db; font-size: 18px; }
    .vr-value--mono  { font-family: monospace; font-size: 13px; word-break: break-all; }

    .vr-divider { border: none; border-top: 1px solid #f3f4f6; margin: 0 0 24px; }

    .vr-stamp {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px;
      padding: 12px; font-size: 13px; font-weight: 600; color: #065f46; margin-top: 4px;
    }

    .vr-footer {
      padding: 16px 28px; background: #f9fafb;
      border-top: 1px solid #f3f4f6; text-align: center;
      font-size: 12px; color: #9ca3af;
    }
    .vr-footer strong { color: #6b7280; }

    @media (max-width: 480px) {
      .vr-grid { grid-template-columns: 1fr; gap: 16px; }
      .vr-banner { padding: 24px 20px 20px; }
      .vr-body { padding: 20px; }
    }
  `}</style>
);

// ==================== MAIN PAGE ====================

const VerifyReceipt: React.FC = () => {
  const location      = useLocation();
  const params        = new URLSearchParams(location.search);
  const receiptNumber = params.get('r') || '';

  const [status,  setStatus]  = useState<VerifyStatus>('loading');
  const [data,    setData]    = useState<ReceiptData | undefined>(undefined);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!receiptNumber) {
      setStatus('not_found');
      setMessage('No receipt number provided. This QR code may be damaged or incomplete.');
      return;
    }

    receiptService.getReceiptByNumber(receiptNumber).then(result => {
      if (result.status === 'success') {
        setStatus('valid');
        setData(result.data);
        setMessage('This receipt is authentic and has been verified against our records.');
      } else if (result.status === 'not_found') {
        setStatus('not_found');
        setMessage(result.message);
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    });
  }, [receiptNumber]);

  if (status === 'loading') {
    return (
      <>
        <VRStyles />
        <div className="vr-shell">
          <div className="vr-loading">
            <Loader size={36} className="vr-spin" />
            <p>Verifying receipt authenticity…</p>
          </div>
        </div>
      </>
    );
  }

  const bannerIcon =
    status === 'valid'
      ? <ShieldCheck size={48} color="#10b981" />
      : <ShieldX size={48} color={status === 'error' ? '#9ca3af' : '#ef4444'} />;

  const bannerTitle =
    status === 'valid'     ? 'Receipt Verified'        :
    status === 'not_found' ? 'Receipt Not Found'       : 'Verification Unavailable';

  return (
    <>
      <VRStyles />
      <div className="vr-shell">
        <div className="vr-card">

          {/* Banner */}
          <div className={`vr-banner vr-banner--${status}`}>
            {bannerIcon}
            <h1 className="vr-banner-title">{bannerTitle}</h1>
            <p className="vr-banner-sub">{message}</p>
          </div>

          {/* Details — only when valid */}
          {status === 'valid' && data && (
            <div className="vr-body">

              <p className="vr-section-title">Receipt Details</p>
              <div className="vr-grid">
                <div>
                  <span className="vr-label">Receipt No</span>
                  <span className="vr-value vr-value--blue">#{data.receiptNumber}</span>
                </div>
                <div>
                  <span className="vr-label">Date of Issue</span>
                  <span className="vr-value">{formatDate(data.issuedAt)}</span>
                </div>
              </div>

              <div className="vr-grid">
                <div>
                  <span className="vr-label">Student Name</span>
                  <span className="vr-value">{data.studentName}</span>
                </div>
                {data.studentUserId && (
                  <div>
                    <span className="vr-label">Student ID</span>
                    <span className="vr-value">{data.studentUserId}</span>
                  </div>
                )}
              </div>

              <hr className="vr-divider" />

              <p className="vr-section-title">Course</p>
              <div className="vr-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <span className="vr-label">Course Name</span>
                  <span className="vr-value">{data.courseTitle}</span>
                </div>
              </div>
              <div className="vr-grid">
                {(data.courseClass || data.courseCategory) && (
                  <div>
                    <span className="vr-label">Class / Category</span>
                    <span className="vr-value">
                      {[data.courseClass, data.courseCategory].filter(Boolean).join(' | ')}
                    </span>
                  </div>
                )}
                <div>
                  <span className="vr-label">Amount Paid</span>
                  <span className={`vr-value ${data.isFree ? 'vr-value--free' : 'vr-value--paid'}`}>
                    {data.isFree ? 'Free' : `৳${data.amountPaid.toLocaleString()}`}
                  </span>
                </div>
              </div>

              <hr className="vr-divider" />

              {data.transactionId && (
                <div className="vr-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '20px' }}>
                  <div>
                    <span className="vr-label">Transaction ID</span>
                    <span className="vr-value vr-value--mono">{data.transactionId}</span>
                  </div>
                </div>
              )}

              <div className="vr-stamp">
                <CheckCircle size={16} />
                Authentic receipt issued by the institution
              </div>
            </div>
          )}

          <div className="vr-footer">
            <strong>Ed-Tech</strong> · Official Receipt Verification System
          </div>

        </div>
      </div>
    </>
  );
};

export default VerifyReceipt;
