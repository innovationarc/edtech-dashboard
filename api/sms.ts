// api/sms.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

interface SMSRequestBody {
  phoneNumber: string;
  message: string;
  apiKey?: string;
}

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
  providerResponse?: string;
}

// Generate HMAC signature for request validation
function generateSignature(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

// Validate request signature
function validateRequest(phoneNumber: string, message: string, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(`${phoneNumber}:${message}`, secret);
  return signature === expectedSignature;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<SMSResponse>
) {
  // Set CORS headers - restrict to your domain in production
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://edtech-dashboard-alpha.vercel.app',
    // Add your production domain here
  ];

  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, X-Request-Signature'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { phoneNumber, message, apiKey } = req.body as SMSRequestBody;

    // Validate required fields
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required',
      });
    }

    // SECURITY: Validate API Key (Master Key from environment)
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    const requestSignature = req.headers['x-request-signature'] as string;

    if (!MASTER_API_KEY) {
      console.error('❌ SMS_MASTER_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'SMS service not configured',
      });
    }

    // Method 1: Check API Key in body (simpler but less secure)
    // Method 2: Check HMAC signature in header (more secure)
    let isAuthorized = false;

    if (apiKey && apiKey === MASTER_API_KEY) {
      isAuthorized = true;
    } else if (requestSignature && validateRequest(phoneNumber, message, requestSignature, MASTER_API_KEY)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      console.error('❌ Unauthorized SMS request');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized request',
      });
    }

    // SECURITY: Rate limiting check (basic)
    // In production, use Redis or similar for distributed rate limiting
    const requestKey = `${phoneNumber}:${Date.now()}`;
    // TODO: Implement proper rate limiting

    // Get SMS provider credentials
    const SMS_API_KEY = process.env.SMS_API_KEY || process.env.VITE_SMS_API_KEY;
    const SENDER_ID = process.env.SMS_SENDER_ID || process.env.VITE_SMS_SENDER_ID;

    if (!SMS_API_KEY || !SENDER_ID) {
      console.error('❌ SMS provider credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'SMS provider not configured',
      });
    }

    // Format phone number for BulkSMSBD (requires 880 prefix without +)
    let formattedNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    
    if (formattedNumber.startsWith('880')) {
      // Already has country code
      formattedNumber = formattedNumber;
    } else if (formattedNumber.startsWith('88')) {
      formattedNumber = '0' + formattedNumber;
    } else if (formattedNumber.startsWith('0')) {
      formattedNumber = '88' + formattedNumber;
    } else if (formattedNumber.startsWith('1') && formattedNumber.length === 10) {
      formattedNumber = '8801' + formattedNumber;
    } else {
      formattedNumber = '880' + formattedNumber;
    }

    // Extract OTP from message (assumes format: "Your verification code is: 123456...")
    const otpMatch = message.match(/\d{6}/);
    const otp = otpMatch ? otpMatch[0] : message;

    // Format message for BulkSMSBD
    const formattedMessage = `Your verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

    console.log('📱 Sending SMS:', { number: formattedNumber, otp });

    // Call BulkSMSBD API
    const url = 'http://bulksmsbd.net/api/smsapi';

    const params = new URLSearchParams({
      api_key: SMS_API_KEY,
      senderid: SENDER_ID,
      number: formattedNumber,
      message: formattedMessage,
      type: 'text',
    });

    const smsResponse = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'EdTech-Platform/1.0'
      }
    });

    const rawText = await smsResponse.text();

    console.log('📡 SMS Provider Response:', rawText);

    // BulkSMSBD returns different responses
    // Success: Usually contains "success" or specific success code
    // Check for common success indicators
    const isSuccess = 
      rawText.toLowerCase().includes('success') ||
      rawText.toLowerCase().includes('ok') ||
      /^[0-9]+$/.test(rawText.trim()); // Some providers return just a message ID

    if (!isSuccess) {
      console.error('❌ SMS Provider Error:', rawText);
      return res.status(500).json({
        success: false,
        error: 'Failed to send SMS',
        providerResponse: rawText
      });
    }

    console.log('✅ SMS sent successfully');

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      providerResponse: rawText
    });

  } catch (error: any) {
    console.error('🔥 SMS API Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
