// src/pages/VerifyReceipt.tsx
// Public page — accessible by anyone who scans the QR code, no login required.

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CheckCircle, XCircle, Loader, ShieldCheck, ShieldX } from 'lucide-react';
import { deriveReceiptNumber } from '../services/receiptService';

// ==================== INTERFACES ====================

interface VerifiedReceipt {
  receiptNumber: string;
  studentName: string;
  studentUserId: string;
  courseTitle: string;
  courseClass: string;
  courseCategory: string;
  amountPaid: number;
  isFree: boolean;
  paymentStatus: string;
  issuedAt: Date;
  enrollmentId: string;
}

type VerifyStatus = 'loading' | 'valid' | 'invalid' | 'mismatch' | 'error';

// ==================== HELPERS ====================

function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const p = new Date(value);
  return isNaN(p.getTime()) ? new Date() : p;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ==================== VERIFIER ====================

async function verifyReceipt(
  enrollmentId: string,
  receiptRef: string
): Promise<{ status: VerifyStatus; data?: VerifiedReceipt; message: string }> {
  if (!enrollmentId || !receiptRef) {
    return { status: 'invalid', message: 'Missing verification parameters. This QR code may be damaged.' };
  }

  try {
    // 1. Fetch enrollment doc
    const enrollSnap = await getDoc(doc(db, 'enrollments', enrollmentId));
    if (!enrollSnap.exists()) {
      return { status: 'invalid', message: 'No enrollment record found for this receipt. It may have been removed.' };
    }

    const enroll = enrollSnap.data();

    // 2. Verify receipt number matches what we'd derive from this enrollmentId
    const expectedRef = deriveReceiptNumber(enrollmentId);
    if (receiptRef.toUpperCase() !== expectedRef.toUpperCase()) {
      return {
        status: 'mismatch',
        message: `Receipt reference mismatch. Expected ${expectedRef}, got ${receiptRef}. This receipt may be tampered.`,
      };
    }

    // 3. Verify payment status is completed
    if (enroll.paymentStatus !== 'completed') {
      return {
        status: 'invalid',
        message: `Payment status is "${enroll.paymentStatus}". This receipt is not valid for a completed payment.`,
      };
    }

    // 4. Fetch course details
    let courseTitle    = '';
    let courseClass    = '';
    let courseCategory = '';
    if (enroll.courseId) {
      try {
        const courseSnap = await getDoc(doc(db, 'courses', enroll.courseId));
        if (courseSnap.exists()) {
          const c = courseSnap.data();
          courseTitle    = c.title    || '';
          courseClass    = c.class    || '';
          courseCategory = c.category || '';
        }
      } catch (_) {}
    }

    const data: VerifiedReceipt = {
      receiptNumber: expectedRef,
      studentName:   enroll.studentName   || 'N/A',
      studentUserId: enroll.studentUserId || '',
      courseTitle,
      courseClass,
      courseCategory,
      amountPaid:    enroll.amountPaid    || 0,
      isFree:        enroll.amountPaid    === 0,
      paymentStatus: enroll.paymentStatus || '',
      issuedAt:      toDate(enroll.paymentDate || enroll.enrolledAt),
      enrollmentId,
    };

    return { status: 'valid', data, message: 'This receipt is authentic and verified.' };

  } catch (err: any) {
    console.error('[VerifyReceipt] Error:', err.message);
    return { status: 'error', message: 'Verification service unavailable. Please try again later.' };
  }
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

    /* Loading state */
    .vr-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      color: #6b7280;
    }
    .vr-loading p { font-size: 15px; margin: 0; }
    @keyframes vr-spin { to { transform: rotate(360deg); } }
    .vr-spin { animation: vr-spin .75s linear infinite; color: #1a56db; }

    /* Card */
    .vr-card {
      width: 100%;
      max-width: 560px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      overflow: hidden;
    }

    /* Status banner */
    .vr-banner {
      padding: 32px 28px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }
    .vr-banner--valid   { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-bottom: 3px solid #10b981; }
    .vr-banner--invalid { background: linear-gradient(135deg, #fef2f2, #fee2e2); border-bottom: 3px solid #ef4444; }
    .vr-banner--mismatch{ background: linear-gradient(135deg, #fffbeb, #fef3c7); border-bottom: 3px solid #f59e0b; }
    .vr-banner--error   { background: linear-gradient(135deg, #f9fafb, #f3f4f6); border-bottom: 3px solid #9ca3af; }

    .vr-banner-title {
      font-size: 22px;
      font-weight: 800;
      margin: 0;
    }
    .vr-banner--valid   .vr-banner-title { color: #065f46; }
    .vr-banner--invalid .vr-banner-title { color: #991b1b; }
    .vr-banner--mismatch .vr-banner-title { color: #92400e; }
    .vr-banner--error   .vr-banner-title { color: #374151; }

    .vr-banner-sub {
      font-size: 14px;
      margin: 0;
      max-width: 400px;
      line-height: 1.6;
    }
    .vr-banner--valid   .vr-banner-sub { color: #047857; }
    .vr-banner--invalid .vr-banner-sub { color: #b91c1c; }
    .vr-banner--mismatch .vr-banner-sub { color: #b45309; }
    .vr-banner--error   .vr-banner-sub { color: #6b7280; }

    /* Receipt details */
    .vr-body {
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .vr-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9ca3af;
      margin: 0 0 16px;
    }

    .vr-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    .vr-field {}
    .vr-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #9ca3af;
      font-weight: 700;
      margin-bottom: 4px;
      display: block;
      letter-spacing: 0.06em;
    }
    .vr-value {
      font-size: 15px;
      color: #111827;
      font-weight: 600;
    }
    .vr-value--mono {
      font-family: monospace;
      font-size: 13px;
    }
    .vr-value--free { color: #059669; }
    .vr-value--amount { color: #1a56db; font-size: 18px; }

    /* Divider */
    .vr-divider {
      border: none;
      border-top: 1px solid #f3f4f6;
      margin: 0 0 24px;
    }

    /* Valid badge row */
    .vr-stamp {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      padding: 12px;
      font-size: 13px;
      font-weight: 600;
      color: #065f46;
      margin-top: 4px;
    }

    /* Branding footer */
    .vr-footer {
      padding: 16px 28px;
      background: #f9fafb;
      border-top: 1px solid #f3f4f6;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
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
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const enrollmentId = params.get('id')  || '';
  const receiptRef   = params.get('ref') || '';

  const [status, setStatus]   = useState<VerifyStatus>('loading');
  const [data, setData]       = useState<VerifiedReceipt | undefined>(undefined);
  const [message, setMessage] = useState('');

  useEffect(() => {
    verifyReceipt(enrollmentId, receiptRef).then(result => {
      setStatus(result.status);
      setData(result.data);
      setMessage(result.message);
    });
  }, [enrollmentId, receiptRef]);

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

  const bannerCls = `vr-banner vr-banner--${status === 'valid' ? 'valid' : status === 'mismatch' ? 'mismatch' : status === 'error' ? 'error' : 'invalid'}`;

  const bannerIcon = status === 'valid'
    ? <ShieldCheck size={48} color="#10b981" />
    : status === 'mismatch'
    ? <ShieldX size={48} color="#f59e0b" />
    : <ShieldX size={48} color="#ef4444" />;

  const bannerTitle = status === 'valid'
    ? 'Receipt Verified'
    : status === 'mismatch'
    ? 'Receipt Mismatch'
    : status === 'error'
    ? 'Verification Unavailable'
    : 'Receipt Invalid';

  return (
    <>
      <VRStyles />
      <div className="vr-shell">
        <div className="vr-card">

          {/* Status banner */}
          <div className={bannerCls}>
            {bannerIcon}
            <h1 className="vr-banner-title">{bannerTitle}</h1>
            <p className="vr-banner-sub">{message}</p>
          </div>

          {/* Receipt details — only shown for valid */}
          {status === 'valid' && data && (
            <div className="vr-body">
              <p className="vr-section-title">Receipt Details</p>

              <div className="vr-grid">
                <div className="vr-field">
                  <span className="vr-label">Receipt No</span>
                  <span className="vr-value" style={{ color: '#1a56db' }}>#{data.receiptNumber}</span>
                </div>
                <div className="vr-field">
                  <span className="vr-label">Date of Issue</span>
                  <span className="vr-value">{formatDate(data.issuedAt)}</span>
                </div>
                <div className="vr-field">
                  <span className="vr-label">Student Name</span>
                  <span className="vr-value">{data.studentName}</span>
                </div>
                {data.studentUserId && (
                  <div className="vr-field">
                    <span className="vr-label">Student ID</span>
                    <span className="vr-value">{data.studentUserId}</span>
                  </div>
                )}
              </div>

              <hr className="vr-divider" />
              <p className="vr-section-title">Course</p>

              <div className="vr-grid">
                <div className="vr-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="vr-label">Course Name</span>
                  <span className="vr-value">{data.courseTitle}</span>
                </div>
                {(data.courseClass || data.courseCategory) && (
                  <div className="vr-field">
                    <span className="vr-label">Class / Category</span>
                    <span className="vr-value">{[data.courseClass, data.courseCategory].filter(Boolean).join(' | ')}</span>
                  </div>
                )}
                <div className="vr-field">
                  <span className="vr-label">Amount Paid</span>
                  <span className={`vr-value ${data.isFree ? 'vr-value--free' : 'vr-value--amount'}`}>
                    {data.isFree ? 'Free' : `৳${data.amountPaid.toLocaleString()}`}
                  </span>
                </div>
              </div>

              <hr className="vr-divider" />

              <div className="vr-field" style={{ marginBottom: '16px' }}>
                <span className="vr-label">Enrollment ID</span>
                <span className="vr-value vr-value--mono">{data.enrollmentId}</span>
              </div>

              <div className="vr-stamp">
                <CheckCircle size={16} />
                Authentic receipt issued by the institution
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="vr-footer">
            <strong>YOUR INSTITUTE</strong> · Official Receipt Verification System
          </div>
        </div>
      </div>
    </>
  );
};

export default VerifyReceipt;
