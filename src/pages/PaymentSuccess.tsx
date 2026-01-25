// src/pages/PaymentSuccess.tsx
// Dedicated payment success/failure handler page

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { courseService } from '../services/courseService';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading');
  const [message, setMessage] = useState('Processing payment...');
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    const processPayment = async () => {
      const paymentStatus = searchParams.get('status');
      const tranId = searchParams.get('tran_id');

      console.log('Payment callback received:', { paymentStatus, tranId });

      if (!tranId) {
        setStatus('failed');
        setMessage('Invalid payment reference. Please contact support.');
        return;
      }

      setTransactionId(tranId);

      if (paymentStatus === 'success') {
        setMessage('Validating your payment...');
        
        // Wait for IPN to process
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
          const validation = await courseService.validatePayment(tranId);
          
          if (validation.success && validation.validated) {
            setStatus('success');
            setMessage('Payment successful! Redirecting to your courses...');
            
            // Redirect after 2 seconds
            setTimeout(() => {
              navigate('/course-enrollment?enrolled=true', { replace: true });
            }, 2000);
          } else if (validation.status === 'pending') {
            setStatus('success');
            setMessage('Payment received! Your enrollment is being processed. Redirecting...');
            
            setTimeout(() => {
              navigate('/course-enrollment?enrolled=true', { replace: true });
            }, 2000);
          } else {
            setStatus('failed');
            setMessage('Payment validation failed. Please contact support with Transaction ID: ' + tranId);
          }
        } catch (error) {
          setStatus('failed');
          setMessage('Unable to verify payment. Please contact support with Transaction ID: ' + tranId);
        }
      } else if (paymentStatus === 'failed') {
        setStatus('failed');
        setMessage('Payment failed. You can try again.');
        
        setTimeout(() => {
          navigate('/course-enrollment', { replace: true });
        }, 3000);
      } else if (paymentStatus === 'cancel') {
        setStatus('cancelled');
        setMessage('Payment was cancelled. Redirecting...');
        
        setTimeout(() => {
          navigate('/course-enrollment', { replace: true });
        }, 3000);
      } else {
        setStatus('failed');
        setMessage('Unknown payment status. Please contact support.');
      }
    };

    processPayment();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background-DEFAULT flex items-center justify-center p-4">
      <div className="bg-background-800 rounded-xl p-8 max-w-md w-full shadow-2xl border border-background-700">
        <div className="flex flex-col items-center text-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader size={64} className="animate-spin text-primary-500" />
              <h2 className="text-2xl font-bold text-white">Processing Payment</h2>
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
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
