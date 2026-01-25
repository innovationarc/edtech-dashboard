// src/pages/PaymentSuccess.tsx
// Payment Success Page with Receipt and Print Functionality

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Loader, CheckCircle, XCircle, AlertTriangle, Info, 
  Printer, ArrowLeft, Download, Check, X
} from 'lucide-react';
import QRCode from 'qrcode';
import { useDashboard } from '../contexts/DashboardContext';
import paymentService from '../services/paymentService';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useDashboard();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled' | 'validating' | 'error'>('loading');
  const [message, setMessage] = useState('Processing...');
  const [transactionId, setTransactionId] = useState('');
  const [transaction, setTransaction] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const tranId = searchParams.get('tran_id');
    const enrolled = searchParams.get('enrolled');
    const error = searchParams.get('error');

    console.log('PaymentSuccess page:', { urlStatus, tranId, enrolled, error });

    setTransactionId(tranId || '');

    // Handle enrolled=true (from successful callback)
    if (enrolled === 'true' && tranId) {
      loadTransactionDetails(tranId);
      setStatus('success');
      setMessage('Payment completed successfully!');
      setShowReceipt(true);
      return;
    }

    // Handle error
    if (error) {
      setStatus('error');
      setMessage(getErrorMessage(error));
      return;
    }

    // Handle status
    if (!urlStatus) {
      setStatus('error');
      setMessage('No payment status received');
      return;
    }

    switch (urlStatus) {
      case 'success':
        if (tranId) {
          loadTransactionDetails(tranId);
        }
        setStatus('success');
        setMessage('Payment completed successfully!');
        setShowReceipt(true);
        break;

      case 'failed':
        setStatus('failed');
        setMessage('Payment failed. Please try again.');
        break;

      case 'cancelled':
        setStatus('cancelled');
        setMessage('Payment was cancelled.');
        break;

      case 'validating':
        setStatus('validating');
        setMessage('Payment received and being validated. This may take a few moments.');
        break;

      case 'validation_error':
        setStatus('error');
        setMessage('Unable to validate payment. Please contact support.');
        break;

      case 'unknown':
        setStatus('error');
        setMessage('Unknown payment status. Please contact support.');
        break;

      default:
        setStatus('error');
        setMessage('Invalid payment status');
    }
  }, [searchParams]);

  const loadTransactionDetails = async (tranId: string) => {
    try {
      const txn = await paymentService.getTransactionByTranId(tranId);
      if (txn) {
        setTransaction(txn);
        // Generate QR code
        const verificationData = JSON.stringify({
          transactionId: txn.transactionId,
          courseId: txn.productId,
          studentId: txn.userId,
          amount: txn.amount,
          date: txn.completedAt?.toISOString() || txn.createdAt.toISOString()
        });
        const qr = await QRCode.toDataURL(verificationData);
        setQrCodeUrl(qr);
      }
    } catch (error) {
      console.error('Failed to load transaction:', error);
    }
  };

  function getErrorMessage(error: string): string {
    switch (error) {
      case 'invalid_transaction':
        return 'Invalid transaction reference';
      case 'callback_failed':
        return 'Payment callback processing failed';
      default:
        return 'An error occurred during payment processing';
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const handleReturnToCourses = () => {
    if (status === 'success') {
      navigate('/course-enrollment?enrolled=true', { replace: true });
    } else {
      navigate('/course-enrollment', { replace: true });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const Receipt = () => {
    if (!transaction || !showReceipt) return null;

    const totalDiscount = (transaction.appliedDiscounts?.previousStudentDiscount || 0) +
                         (transaction.appliedDiscounts?.extraDiscount || 0) +
                         (transaction.appliedDiscounts?.couponDiscount || 0);

    return (
      <div ref={receiptRef} className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-2xl text-gray-900">
        {/* Logo/Header */}
        <div className="text-center border-b-2 border-gray-300 pb-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">ED</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Receipt</h1>
          <p className="text-gray-600">Course Enrollment Confirmation</p>
        </div>

        {/* Student Information */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Student Name</p>
            <p className="font-semibold text-gray-900">{transaction.userName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Email</p>
            <p className="font-semibold text-gray-900">{transaction.userEmail}</p>
          </div>
        </div>

        {/* Course Information */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-2">Course Enrolled</p>
          <p className="font-bold text-lg text-gray-900">{transaction.productName}</p>
          <p className="text-sm text-gray-600 mt-1">Course ID: {transaction.productId}</p>
        </div>

        {/* Payment Details */}
        <div className="border-t border-b border-gray-300 py-4 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Payment Details</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction ID</span>
              <span className="font-mono text-sm text-gray-900">{transaction.transactionId}</span>
            </div>
            
            {transaction.bankTransactionId && (
              <div className="flex justify-between">
                <span className="text-gray-600">Bank Transaction ID</span>
                <span className="font-mono text-sm text-gray-900">{transaction.bankTransactionId}</span>
              </div>
            )}

            {transaction.paymentMethod && (
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="text-gray-900">{transaction.paymentMethod}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600">Payment Date</span>
              <span className="text-gray-900">
                {formatDate(transaction.completedAt || transaction.createdAt)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                <CheckCircle size={16} />
                Completed
              </span>
            </div>
          </div>
        </div>

        {/* Amount Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Amount Breakdown</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Course Price</span>
              <span className="text-gray-900">৳{transaction.amount.toLocaleString()}</span>
            </div>

            {transaction.appliedDiscounts?.previousStudentDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Previous Student Discount</span>
                <span className="text-green-600">
                  -৳{transaction.appliedDiscounts.previousStudentDiscount.toLocaleString()}
                </span>
              </div>
            )}

            {transaction.appliedDiscounts?.extraDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Limited Time Discount</span>
                <span className="text-green-600">
                  -৳{transaction.appliedDiscounts.extraDiscount.toLocaleString()}
                </span>
              </div>
            )}

            {transaction.appliedDiscounts?.couponDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Coupon Discount</span>
                <span className="text-green-600">
                  -৳{transaction.appliedDiscounts.couponDiscount.toLocaleString()}
                </span>
              </div>
            )}

            {totalDiscount > 0 && (
              <div className="flex justify-between pt-2 border-t border-gray-300 text-sm">
                <span className="text-gray-600 font-medium">Total Discount</span>
                <span className="text-green-600 font-semibold">
                  ৳{totalDiscount.toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t-2 border-gray-900">
              <span className="font-bold text-gray-900">Amount Paid</span>
              <span className="font-bold text-xl text-gray-900">
                ৳{transaction.amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        {qrCodeUrl && (
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-3">Verification QR Code</p>
            <div className="inline-block p-3 bg-white border-2 border-gray-300 rounded-lg">
              <img src={qrCodeUrl} alt="Verification QR Code" className="w-32 h-32" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Scan to verify enrollment</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pt-6 border-t border-gray-300">
          <p>Thank you for enrolling!</p>
          <p className="mt-1">For support, please contact: support@educationplatform.com</p>
        </div>

        {/* Print-only styles */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            ${receiptRef.current ? `
              #receipt-container,
              #receipt-container * {
                visibility: visible;
              }
              #receipt-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            ` : ''}
          }
        `}</style>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Status Display */}
        {!showReceipt && (
          <div className="bg-background-800 rounded-xl p-8 shadow-2xl border border-background-700">
            <div className="flex flex-col items-center text-center space-y-4">
              {status === 'loading' && (
                <>
                  <Loader size={64} className="animate-spin text-primary-500" />
                  <h2 className="text-2xl font-bold text-white">Processing</h2>
                  <p className="text-gray-400">{message}</p>
                </>
              )}

              {status === 'success' && (
                <>
                  <div className="w-16 h-16 bg-success-DEFAULT rounded-full flex items-center justify-center">
                    <CheckCircle size={40} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-success-light">Payment Successful!</h2>
                  <p className="text-gray-300">{message}</p>
                  {transactionId && (
                    <p className="text-xs text-gray-500">Transaction ID: {transactionId}</p>
                  )}
                </>
              )}

              {status === 'validating' && (
                <>
                  <div className="w-16 h-16 bg-primary-DEFAULT rounded-full flex items-center justify-center">
                    <Info size={40} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-primary-light">Validating Payment</h2>
                  <p className="text-gray-300">{message}</p>
                  {transactionId && (
                    <p className="text-xs text-gray-500">Transaction ID: {transactionId}</p>
                  )}
                </>
              )}

              {status === 'failed' && (
                <>
                  <div className="w-16 h-16 bg-error-DEFAULT rounded-full flex items-center justify-center">
                    <XCircle size={40} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-error-light">Payment Failed</h2>
                  <p className="text-gray-300">{message}</p>
                  {transactionId && (
                    <p className="text-xs text-gray-500">Transaction ID: {transactionId}</p>
                  )}
                </>
              )}

              {status === 'cancelled' && (
                <>
                  <div className="w-16 h-16 bg-warning-DEFAULT rounded-full flex items-center justify-center">
                    <AlertTriangle size={40} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-warning-light">Payment Cancelled</h2>
                  <p className="text-gray-300">{message}</p>
                </>
              )}

              {status === 'error' && (
                <>
                  <div className="w-16 h-16 bg-error-DEFAULT rounded-full flex items-center justify-center">
                    <XCircle size={40} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-error-light">Error</h2>
                  <p className="text-gray-300">{message}</p>
                  {transactionId && (
                    <p className="text-xs text-gray-500">Transaction ID: {transactionId}</p>
                  )}
                </>
              )}

              <button
                onClick={handleReturnToCourses}
                className="mt-6 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={20} />
                Return to Courses
              </button>
            </div>
          </div>
        )}

        {/* Receipt Display */}
        {showReceipt && status === 'success' && (
          <div className="space-y-4">
            <div className="flex justify-center gap-4 print:hidden">
              <button
                onClick={handlePrint}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Printer size={20} />
                Print Receipt
              </button>
              <button
                onClick={handleReturnToCourses}
                className="px-6 py-3 bg-background-700 hover:bg-background-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={20} />
                Return to Courses
              </button>
            </div>
            
            <div id="receipt-container" className="flex justify-center">
              <Receipt />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
