// src/pages/PaymentSuccess.tsx
// Simplified payment status display - validation happens in API route

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled' | 'validating' | 'error'>('loading');
  const [message, setMessage] = useState('Processing...');
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const tranId = searchParams.get('tran_id');
    const error = searchParams.get('error');

    console.log('PaymentSuccess page:', { urlStatus, tranId, error });

    setTransactionId(tranId || '');

    if (error) {
      setStatus('error');
      setMessage(getErrorMessage(error));
      return;
    }

    if (!urlStatus) {
      setStatus('error');
      setMessage('No payment status received');
      return;
    }

    switch (urlStatus) {
      case 'success':
        setStatus('success');
        setMessage('Payment completed successfully!');
        setTimeout(() => {
          navigate('/course-enrollment?enrolled=true', { replace: true });
        }, 2000);
        break;

      case 'failed':
        setStatus('failed');
        setMessage('Payment failed. Please try again.');
        setTimeout(() => {
          navigate('/course-enrollment', { replace: true });
        }, 3000);
        break;

      case 'cancelled':
        setStatus('cancelled');
        setMessage('Payment was cancelled.');
        setTimeout(() => {
          navigate('/course-enrollment', { replace: true });
        }, 3000);
        break;

      case 'validating':
        setStatus('validating');
        setMessage('Payment received and being validated. This may take a few moments.');
        setTimeout(() => {
          navigate('/course-enrollment?enrolled=true', { replace: true });
        }, 4000);
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
  }, [searchParams, navigate]);

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

  return (
    <div className="min-h-screen bg-background-DEFAULT flex items-center justify-center p-4">
      <div className="bg-background-800 rounded-xl p-8 max-w-md w-full shadow-2xl border border-background-700">
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
              <p className="text-gray-400 text-sm">Redirecting to your courses...</p>
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
              <p className="text-gray-400 text-sm">Redirecting shortly...</p>
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
              <button
                onClick={() => navigate('/course-enrollment', { replace: true })}
                className="mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Return to Courses
              </button>
            </>
          )}

          {status === 'cancelled' && (
            <>
              <div className="w-16 h-16 bg-warning-DEFAULT rounded-full flex items-center justify-center">
                <AlertTriangle size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-warning-light">Payment Cancelled</h2>
              <p className="text-gray-300">{message}</p>
              <button
                onClick={() => navigate('/course-enrollment', { replace: true })}
                className="mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Return to Courses
              </button>
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
              <button
                onClick={() => navigate('/course-enrollment', { replace: true })}
                className="mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Return to Courses
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
