// api/sms.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SMSRequestBody {
  phoneNumber: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<SMSResponse>
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { phoneNumber, message } = req.body as SMSRequestBody;

    // Validation
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required',
      });
    }

    // Get API credentials from environment
    const API_KEY = process.env.SMS_API_KEY || process.env.VITE_SMS_API_KEY;
    const SENDER_ID = process.env.SMS_SENDER_ID || process.env.VITE_SMS_SENDER_ID;

    if (!API_KEY || !SENDER_ID) {
      console.error('❌ SMS credentials missing');
      return res.status(500).json({
        success: false,
        error: 'SMS service not configured',
      });
    }

    // Send SMS using BulkSMSBD API
    const url = 'http://bulksmsbd.net/api/smsapi';

    const params = new URLSearchParams({
      api_key: API_KEY,
      senderid: SENDER_ID,
      number: phoneNumber,
      message: message,
      type: 'text',
    });

    const smsResponse = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
    });

    const rawText = await smsResponse.text();

    // Check if SMS API returned success
    if (!smsResponse.ok) {
      console.error('❌ SMS API failed:', rawText);
      return res.status(500).json({
        success: false,
        error: 'Failed to send OTP via SMS',
      });
    }

    // Log success
    console.log('✅ SMS sent successfully:', rawText);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    });

  } catch (error: any) {
    console.error('🔥 SMS SERVER ERROR:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while sending OTP',
    });
  }
}
