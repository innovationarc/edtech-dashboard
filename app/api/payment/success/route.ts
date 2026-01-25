// api/payment/success/route.ts
// SSLCOMMERZ POST callback handler - handles success/fail/cancel redirects

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const SSLCOMMERZ_CONFIG = {
  storeId: process.env.SSLCOMMERZ_STORE_ID || '',
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
  isLive: process.env.SSLCOMMERZ_IS_LIVE === 'true',
  validationUrl: process.env.SSLCOMMERZ_IS_LIVE === 'true'
    ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
};

export async function POST(req: NextRequest) {
  console.log('');
  console.log('='.repeat(80));
  console.log('🔔 SSLCOMMERZ CALLBACK RECEIVED');
  console.log('='.repeat(80));
  console.log('Timestamp:', new Date().toISOString());
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('='.repeat(80));

  try {
    // Parse form data from SSLCOMMERZ
    const formData = await req.formData();
    
    const status = formData.get('status') as string;
    const tran_id = formData.get('tran_id') as string;
    const val_id = formData.get('val_id') as string;
    const amount = formData.get('amount') as string;
    const currency = formData.get('currency') as string;
    const card_type = formData.get('card_type') as string;
    const bank_tran_id = formData.get('bank_tran_id') as string;
    const risk_level = formData.get('risk_level') as string;
    const risk_title = formData.get('risk_title') as string;

    console.log('📦 CALLBACK DATA:');
    console.log('  Status:', status);
    console.log('  Transaction ID:', tran_id);
    console.log('  Validation ID:', val_id);
    console.log('  Amount:', amount);
    console.log('  Currency:', currency);
    console.log('  Card Type:', card_type);
    console.log('  Bank Tran ID:', bank_tran_id);
    console.log('  Risk Level:', risk_level);

    if (!tran_id) {
      console.error('❌ Missing transaction ID');
      return NextResponse.redirect(
        new URL('/course-enrollment?error=invalid_transaction', req.url)
      );
    }

    // Handle different statuses
    if (status === 'CANCELLED' || status === 'FAILED') {
      console.log('⚠️ Payment cancelled or failed');
      
      // Update transaction status in Firestore via internal API
      try {
        await updateTransactionStatus(tran_id, status === 'CANCELLED' ? 'cancelled' : 'failed');
      } catch (error) {
        console.warn('⚠️ Failed to update transaction status:', error);
      }

      return NextResponse.redirect(
        new URL(`/course-enrollment?status=${status.toLowerCase()}&tran_id=${tran_id}`, req.url)
      );
    }

    // Handle SUCCESS - validate with SSLCOMMERZ
    if (status === 'VALID' || status === 'VALIDATED') {
      console.log('🔍 Validating payment with SSLCOMMERZ...');

      try {
        const validationResponse = await axios.get(SSLCOMMERZ_CONFIG.validationUrl, {
          params: {
            val_id,
            store_id: SSLCOMMERZ_CONFIG.storeId,
            store_passwd: SSLCOMMERZ_CONFIG.storePassword,
            format: 'json'
          },
          timeout: 30000
        });

        const validationData = validationResponse.data;
        console.log('✅ Validation response:', validationData.status);

        if (validationData.status === 'VALID' || validationData.status === 'VALIDATED') {
          console.log('✅ Payment validated successfully');

          // Check risk level
          if (risk_level === '1') {
            console.warn('⚠️ High risk transaction - needs manual review');
            
            await updateTransactionStatus(tran_id, 'validating', {
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level,
              riskTitle: risk_title,
              needsManualReview: true
            });

            return NextResponse.redirect(
              new URL(`/course-enrollment?status=validating&tran_id=${tran_id}`, req.url)
            );
          }

          // Update transaction as successful
          await updateTransactionStatus(tran_id, 'success', {
            validationId: val_id,
            paymentMethod: card_type,
            bankTransactionId: bank_tran_id,
            riskLevel: risk_level || '0'
          });

          console.log('✅ Transaction marked as successful');

          // Redirect to success page with enrolled flag
          return NextResponse.redirect(
            new URL(`/course-enrollment?enrolled=true&tran_id=${tran_id}`, req.url)
          );
        } else {
          console.error('❌ Validation failed:', validationData.status);
          
          await updateTransactionStatus(
            tran_id, 
            validationData.status === 'CANCELLED' ? 'cancelled' : 'failed',
            { validationResponse: validationData }
          );

          return NextResponse.redirect(
            new URL(`/course-enrollment?status=failed&tran_id=${tran_id}`, req.url)
          );
        }
      } catch (validationError: any) {
        console.error('❌ Validation error:', validationError.message);
        
        return NextResponse.redirect(
          new URL(`/course-enrollment?status=validation_error&tran_id=${tran_id}`, req.url)
        );
      }
    }

    // Unknown status
    console.error('❌ Unknown status:', status);
    return NextResponse.redirect(
      new URL(`/course-enrollment?status=unknown&tran_id=${tran_id}`, req.url)
    );

  } catch (error: any) {
    console.error('');
    console.error('💥 CALLBACK ERROR');
    console.error('='.repeat(80));
    console.error('Timestamp:', new Date().toISOString());
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));

    return NextResponse.redirect(
      new URL('/course-enrollment?error=callback_failed', req.url)
    );
  }
}

// Helper function to update transaction status
async function updateTransactionStatus(
  transactionId: string,
  status: string,
  metadata?: any
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    await axios.post(
      `${baseUrl}/api/payment/internal/update`,
      {
        transactionId,
        status,
        metadata
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': process.env.INTERNAL_API_KEY || 'dev-key'
        },
        timeout: 10000
      }
    );
  } catch (error: any) {
    console.error('Failed to update transaction:', error.message);
    throw error;
  }
}

// GET requests should not reach here
export async function GET(req: NextRequest) {
  console.log('⚠️ GET request received on callback URL - redirecting...');
  return NextResponse.redirect(new URL('/course-enrollment', req.url));
}
