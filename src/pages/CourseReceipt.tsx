// src/pages/CourseReceipt.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDashboard } from '../contexts/DashboardContext';
import { Loader, ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import receiptService, { ReceiptData } from '../services/receiptService';

// ==================== HELPERS ====================

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ==================== RECEIPT DOCUMENT (matches HTML template exactly) ====================

const ReceiptDocument: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const verifyUrl = `${window.location.origin}/verify-receipt?id=${data.enrollmentId}&ref=${data.receiptNumber}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;
  const watermarkText = data.isFree ? 'FREE' : 'PAID';

  return (
    <div className="cr-page">
      {/* Watermark */}
      <div className="cr-watermark">{watermarkText}</div>

      {/* Header */}
      <div className="cr-header">
        <div className="cr-logo-area">
          <svg className="cr-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <h1 className="cr-brand-name">YOUR INSTITUTE</h1>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Official Enrollment Receipt</span>
          </div>
        </div>
        <div className="cr-receipt-label">
          <h2>RECEIPT</h2>
          <div className="cr-field" style={{ marginTop: '10px' }}>
            <span className="cr-label">Receipt No</span>
            <span className="cr-value" style={{ color: '#1a56db' }}>#{data.receiptNumber}</span>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="cr-details-grid">
        <div>
          <div className="cr-field">
            <span className="cr-label">Date of Issue</span>
            <span className="cr-value">{formatDate(data.issuedAt)}</span>
          </div>
          <div className="cr-field">
            <span className="cr-label">Student Name</span>
            <span className="cr-value">{data.studentName}</span>
          </div>
          {data.studentUserId && (
            <div className="cr-field">
              <span className="cr-label">Student ID</span>
              <span className="cr-value">{data.studentUserId}</span>
            </div>
          )}
          {data.studentEmail && (
            <div className="cr-field">
              <span className="cr-label">Email</span>
              <span className="cr-value">{data.studentEmail}</span>
            </div>
          )}
        </div>
        <div>
          <div className="cr-field">
            <span className="cr-label">Course Name</span>
            <span className="cr-value">{data.courseTitle}</span>
          </div>
          {(data.courseClass || data.courseCategory) && (
            <div className="cr-field">
              <span className="cr-label">Class / Category</span>
              <span className="cr-value">{[data.courseClass, data.courseCategory].filter(Boolean).join(' | ')}</span>
            </div>
          )}
          {data.courseInstructor && (
            <div className="cr-field">
              <span className="cr-label">Instructor</span>
              <span className="cr-value">{data.courseInstructor}</span>
            </div>
          )}
          {data.transactionId && (
            <div className="cr-field">
              <span className="cr-label">Transaction ID</span>
              <span className="cr-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>{data.transactionId}</span>
            </div>
          )}
          <div className="cr-field">
            <span className="cr-label">Enrollment ID</span>
            <span className="cr-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>{data.enrollmentId}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="cr-items-table">
        <thead>
          <tr>
            <th>Item Description</th>
            <th style={{ textAlign: 'right', width: '150px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Course Enrollment Fee</strong>
              <br />
              <small style={{ color: '#6b7280' }}>
                {data.isFree ? 'Free Enrollment' : `Payment via ${data.paymentMethod || 'Online Gateway'}`}
              </small>
            </td>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>
              {data.isFree ? 'Free' : `৳${data.basePrice.toLocaleString()}`}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Summary */}
      <div className="cr-summary-container">
        <div className="cr-qr-box">
          <img src={qrUrl} alt="Verification QR Code" />
          <span>Scan to Verify Receipt</span>
        </div>

        <div className="cr-total-box">
          <div className="cr-row">
            <span style={{ color: '#6b7280' }}>Course Amount:</span>
            <span style={{ fontWeight: 600 }}>{data.isFree ? 'Free' : `৳${data.basePrice.toLocaleString()}`}</span>
          </div>
          {data.previousStudentDiscount > 0 && (
            <div className="cr-row">
              <span style={{ color: '#059669', fontWeight: 600 }}>Previous Student Discount:</span>
              <span style={{ color: '#059669' }}>-৳{data.previousStudentDiscount.toLocaleString()}</span>
            </div>
          )}
          {data.extraDiscount > 0 && (
            <div className="cr-row">
              <span style={{ color: '#059669', fontWeight: 600 }}>Limited Time Discount:</span>
              <span style={{ color: '#059669' }}>-৳{data.extraDiscount.toLocaleString()}</span>
            </div>
          )}
          {data.couponDiscount > 0 && (
            <div className="cr-row">
              <span style={{ color: '#059669', fontWeight: 600 }}>
                Coupon{data.couponCodes.length > 0 ? ` (${data.couponCodes.join(', ')})` : ''}:
              </span>
              <span style={{ color: '#059669' }}>-৳{data.couponDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="cr-row cr-grand-total">
            <span>Total Amount:</span>
            <span>{data.isFree ? 'Free' : `৳${data.amountPaid.toLocaleString()}`}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="cr-footer-note">
        <p>This document is an official record of enrollment. Receipt No: <strong>#{data.receiptNumber}</strong></p>
        <p>For any queries, please contact support with your Enrollment ID or Transaction ID.</p>
      </div>
    </div>
  );
};

// ==================== STYLES ====================

const CRStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

    .cr-shell {
      background: #525659;
      min-height: 100vh;
      padding: 32px 16px 60px;
      font-family: 'Inter', Arial, sans-serif;
    }

    .cr-actions {
      width: 800px;
      max-width: 100%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .cr-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: opacity .15s;
    }
    .cr-action-btn:hover { opacity: .85; }
    .cr-action-btn--back  { background: rgba(255,255,255,.15); color: #fff; }
    .cr-action-btn--print { background: #1a56db; color: #fff; }

    /* Receipt page — matches HTML template exactly */
    .cr-page {
      width: 800px;
      height: 1032px;
      padding: 60px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
    }

    .cr-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 150px;
      font-weight: 900;
      color: rgba(26, 86, 219, 0.05);
      pointer-events: none;
      text-transform: uppercase;
      letter-spacing: 20px;
    }

    .cr-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1a56db;
      padding-bottom: 30px;
      margin-bottom: 40px;
    }
    .cr-logo-area { display: flex; align-items: center; gap: 15px; }
    .cr-logo-icon { width: 50px; height: 50px; background: #1a56db; border-radius: 8px; flex-shrink: 0; }
    .cr-brand-name { font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -1px; margin: 0; }
    .cr-receipt-label { text-align: right; }
    .cr-receipt-label h2 { margin: 0; font-size: 32px; color: #1a56db; letter-spacing: 2px; }

    .cr-details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-bottom: 50px;
    }
    .cr-field { margin-bottom: 15px; }
    .cr-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 700;
      margin-bottom: 4px;
      display: block;
    }
    .cr-value { font-size: 15px; color: #111827; font-weight: 600; }

    .cr-items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    .cr-items-table th {
      background: #f9fafb;
      text-align: left;
      padding: 12px 15px;
      font-size: 12px;
      text-transform: uppercase;
      border-bottom: 2px solid #e5e7eb;
      color: #374151;
    }
    .cr-items-table td { padding: 20px 15px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }

    .cr-summary-container { display: flex; justify-content: space-between; margin-top: 20px; }
    .cr-qr-box { border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; text-align: center; width: 130px; }
    .cr-qr-box img { width: 100%; height: auto; }
    .cr-qr-box span { font-size: 9px; color: #9ca3af; margin-top: 5px; display: block; }
    .cr-total-box { width: 300px; }
    .cr-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .cr-grand-total {
      margin-top: 10px;
      padding: 15px 10px;
      background: #1a56db;
      color: white;
      border-radius: 6px;
      font-weight: 800;
      font-size: 18px;
    }

    .cr-footer-note {
      position: absolute;
      bottom: 60px;
      left: 60px;
      right: 60px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
    .cr-footer-note p { margin: 4px 0; }

    .cr-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 16px;
      color: #fff;
    }
    .cr-state p { font-size: 15px; color: rgba(255,255,255,.75); }
    @keyframes cr-spin { to { transform: rotate(360deg); } }
    .cr-spin { animation: cr-spin .75s linear infinite; }

    @media print {
      .cr-actions { display: none !important; }
      .cr-shell { background: none; padding: 0; }
      .cr-page { box-shadow: none; margin: 0; }
    }

    @media (max-width: 860px) {
      .cr-actions { width: 100%; }
      .cr-page { width: 100%; height: auto; min-height: 1032px; padding: 40px 24px; }
      .cr-watermark { font-size: 80px; }
      .cr-brand-name { font-size: 20px; }
      .cr-receipt-label h2 { font-size: 24px; }
      .cr-details-grid { gap: 16px; margin-bottom: 30px; }
      .cr-footer-note { position: static; margin-top: 40px; }
    }

    @media (max-width: 560px) {
      .cr-details-grid { grid-template-columns: 1fr; }
      .cr-summary-container { flex-direction: column; gap: 24px; }
      .cr-total-box { width: 100%; }
      .cr-qr-box { width: 110px; }
    }
  `}</style>
);

// ==================== MAIN PAGE ====================

const CourseReceipt: React.FC = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const enrollmentId = new URLSearchParams(location.search).get('enrollment') || '';
  const cacheKey = `receipt_${enrollmentId}`;

  useEffect(() => {
    if (!enrollmentId) {
      setError('No enrollment ID provided.');
      setLoading(false);
      return;
    }
    if (!user?.uid) {
      setError('You must be logged in to view this receipt.');
      setLoading(false);
      return;
    }

    // Try sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.issuedAt = new Date(parsed.issuedAt);
        setReceiptData(parsed);
        setLoading(false);
        return;
      }
    } catch (_) {}

    // Fetch via service
    receiptService.getReceiptData(enrollmentId, user.uid)
      .then(result => {
        if (result.status === 'success' && result.data) {
          setReceiptData(result.data);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              ...result.data,
              issuedAt: result.data.issuedAt.toISOString(),
            }));
          } catch (_) {}
        } else {
          setError(result.message);
        }
      })
      .catch(err => {
        console.error('CourseReceipt fetch error:', err);
        setError('Failed to load receipt. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [enrollmentId, user?.uid]);

  if (loading) {
    return (
      <>
        <CRStyles />
        <div className="cr-shell">
          <div className="cr-state">
            <Loader size={32} className="cr-spin" />
            <p>Loading your receipt…</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !receiptData) {
    return (
      <>
        <CRStyles />
        <div className="cr-shell">
          <div className="cr-state">
            <AlertCircle size={36} style={{ color: '#f87171' }} />
            <p>{error || 'Something went wrong.'}</p>
            <button className="cr-action-btn cr-action-btn--back" onClick={() => navigate('/course-enrollment')}>
              <ArrowLeft size={16} /> Back to Courses
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CRStyles />
      <div className="cr-shell">
        <div className="cr-actions">
          <button className="cr-action-btn cr-action-btn--back" onClick={() => navigate('/course-enrollment')}>
            <ArrowLeft size={16} /> Back to Courses
          </button>
          <button className="cr-action-btn cr-action-btn--print" onClick={() => window.print()}>
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
        <ReceiptDocument data={receiptData} />
      </div>
    </>
  );
};

export default CourseReceipt;
