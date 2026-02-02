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

// GSM 7-bit character set - extended
const GSM_7BIT_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_7BIT_EXTENDED = "^{}\\[~]|€";

// Convert text to GSM 7-bit compatible format
function toGSM7Bit(text: string): string {
  return text.split('').map(char => {
    // Check if character is in basic or extended GSM 7-bit set
    if (GSM_7BIT_BASIC.includes(char) || GSM_7BIT_EXTENDED.includes(char)) {
      return char;
    }
    
    // Replace common non-GSM characters
    const replacements: { [key: string]: string } = {
      '"': '"',
      '"': '"',
      "'": "'",
      "'": "'",
      '–': '-',
      '—': '-',
      '…': '...',
      '\u00A0': ' ',
      '•': '*',
      '→': '->',
      '←': '<-',
      '™': '(TM)',
      '©': '(C)',
      '®': '(R)',
    };
    
    return replacements[char] || char;
  }).join('');
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
  // Set CORS headers
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://edtech-dashboard-alpha.vercel.app',
    'http://localhost:3000',
    'http://localhost:5174'
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

    // Get SMS provider credentials
    const SMS_API_KEY = process.env.SMS_API_KEY;
    const SENDER_ID = process.env.SMS_SENDER_ID;
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;

    // Check if SMS service is configured
    if (!SMS_API_KEY || !SENDER_ID) {
      console.error('SMS provider credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'SMS provider not configured. Please contact administrator.',
      });
    }

    // SECURITY: Validate API Key if MASTER_KEY is set
    if (MASTER_API_KEY) {
      const requestSignature = req.headers['x-request-signature'] as string;
      let isAuthorized = false;

      if (apiKey && apiKey === MASTER_API_KEY) {
        isAuthorized = true;
      } else if (requestSignature && validateRequest(phoneNumber, message, requestSignature, MASTER_API_KEY)) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized request',
        });
      }
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

    // Convert message to GSM 7-bit encoding
    const formattedMessage = toGSM7Bit(message);

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
        'User-Agent': 'EdTech-Platform/1.0',
        'Accept': 'text/plain',
        'Accept-Charset': 'utf-8'
      }
    });

    const rawText = await smsResponse.text();

    // BulkSMSBD returns different responses
    // Success: Usually contains "success" or specific success code
    const isSuccess = 
      rawText.toLowerCase().includes('success') ||
      rawText.toLowerCase().includes('ok') ||
      /^[0-9]+$/.test(rawText.trim());

    if (!isSuccess) {
      console.error('SMS Provider Error:', rawText);
      return res.status(500).json({
        success: false,
        error: 'Failed to send SMS',
        providerResponse: rawText
      });
    }

    return res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      providerResponse: rawText
    });

  } catch (error: any) {
    console.error('SMS API Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
