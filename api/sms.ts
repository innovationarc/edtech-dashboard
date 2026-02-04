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

// SMS Panel Error Code Mapping
const SMS_ERROR_CODES: { [key: string]: string } = {
  '202': 'SMS Submitted Successfully',
  '1001': 'Invalid Number',
  '1002': 'Sender ID not correct/Sender ID is disabled',
  '1003': 'Please Required all fields/Contact Your System Administrator',
  '1005': 'Internal Error',
  '1006': 'Balance Validity Not Available',
  '1007': 'Balance Insufficient',
  '1011': 'User ID not found',
  '1012': 'Masking SMS must be sent in Bengali',
  '1013': 'Sender ID has not found Gateway by API key',
  '1014': 'Sender Type Name not found using this sender by API key',
  '1015': 'Sender ID has not found Any Valid Gateway by API key',
  '1016': 'Sender Type Name Active Price Info not found by this sender ID',
  '1017': 'Sender Type Name Price Info not found by this sender ID',
  '1018': 'The Owner of this (username) Account is disabled',
  '1019': 'The (sender type name) Price of this (username) Account is disabled',
  '1020': 'The parent of this account is not found',
  '1021': 'The parent active (sender type name) price of this account is not found',
  '1031': 'Your Account Not Verified, Please Contact Administrator',
  '1032': 'IP Not whitelisted',
};

// Parse error code from response
function parseErrorCode(response: string): { code: string | null; message: string } {
  const trimmedResponse = response.trim();
  
  // Check if response matches an error code
  if (SMS_ERROR_CODES[trimmedResponse]) {
    return {
      code: trimmedResponse,
      message: SMS_ERROR_CODES[trimmedResponse]
    };
  }
  
  // Try to extract error code from response text
  const codeMatch = trimmedResponse.match(/\b(202|10\d{2}|1032)\b/);
  if (codeMatch) {
    const code = codeMatch[1];
    return {
      code: code,
      message: SMS_ERROR_CODES[code] || 'Unknown error code'
    };
  }
  
  return {
    code: null,
    message: trimmedResponse
  };
}

// Log SMS failure with detailed information
function logSMSFailure(
  phoneNumber: string,
  rawResponse: string,
  context: {
    senderId?: string;
    messageLength?: number;
    formattedNumber?: string;
    smsContent?: string;
    originalMessage?: string;
  } = {}
): void {
  const { code, message } = parseErrorCode(rawResponse);
  
  console.error('========== SMS FAILURE ==========');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Phone Number:', phoneNumber);
  if (context.formattedNumber && context.formattedNumber !== phoneNumber) {
    console.error('Formatted Number:', context.formattedNumber);
  }
  if (context.senderId) {
    console.error('Sender ID:', context.senderId);
  }
  if (context.originalMessage) {
    console.error('Original Message:', context.originalMessage);
  }
  if (context.smsContent && context.smsContent !== context.originalMessage) {
    console.error('Formatted SMS Content (GSM7):', context.smsContent);
  }
  if (context.messageLength) {
    console.error('Message Length:', context.messageLength, 'characters');
  }
  console.error('Raw Response:', rawResponse);
  
  if (code) {
    console.error('Error Code:', code);
    console.error('Error Description:', message);
  } else {
    console.error('Error Type: Unknown/Unparsed Error');
    console.error('Error Message:', message);
  }
  
  console.error('=================================');
}

// Log successful SMS with minimal info
function logSMSSuccess(
  phoneNumber: string, 
  rawResponse: string,
  smsContent?: string
): void {
  console.log('SMS sent successfully to', phoneNumber, '- Response:', rawResponse);
  if (smsContent) {
    console.log('SMS Content:', smsContent);
  }
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
      console.error('SMS request missing required fields:', { 
        hasPhoneNumber: !!phoneNumber, 
        hasMessage: !!message 
      });
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
      console.error('SMS provider credentials not configured:', {
        hasSmsApiKey: !!SMS_API_KEY,
        hasSenderId: !!SENDER_ID
      });
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
        console.error('Unauthorized SMS request attempt:', {
          phoneNumber,
          hasApiKey: !!apiKey,
          hasSignature: !!requestSignature
        });
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
    const trimmedResponse = rawText.trim();

    // Log the raw response from SMS panel for debugging
    console.log('SMS Panel Response:', {
      statusCode: smsResponse.status,
      statusText: smsResponse.statusText,
      rawResponse: trimmedResponse,
      phoneNumber: formattedNumber,
      smsContent: formattedMessage,
      originalMessage: message
    });

    // Check if response is an error code from the SMS panel
    // Success code is 202, anything else is an error
    const { code, message: errorMessage } = parseErrorCode(trimmedResponse);
    
    // Determine if this is a success or failure
    const isSuccess = trimmedResponse === '202' || 
                     rawText.toLowerCase().includes('success') ||
                     rawText.toLowerCase().includes('ok');

    if (!isSuccess) {
      // Log detailed failure information with error code from SMS panel
      logSMSFailure(phoneNumber, rawText, {
        senderId: SENDER_ID,
        messageLength: formattedMessage.length,
        formattedNumber: formattedNumber,
        smsContent: formattedMessage,
        originalMessage: message
      });

      return res.status(500).json({
        success: false,
        error: code ? `SMS Error (${code}): ${errorMessage}` : 'Failed to send SMS',
        providerResponse: rawText
      });
    }

    // Log success (minimal logging)
    logSMSSuccess(phoneNumber, rawText, formattedMessage);

    return res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      providerResponse: rawText
    });

  } catch (error: any) {
    console.error('========== SMS API EXCEPTION ==========');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error Type:', error.name || 'Unknown');
    console.error('Error Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('=======================================');

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
