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
  providerResponse?: string;
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
    const { phoneNumber, message } = req.body as SMSRequestBody;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required',
      });
    }

    const API_KEY = process.env.SMS_API_KEY || process.env.VITE_SMS_API_KEY;
    const SENDER_ID = process.env.SMS_SENDER_ID || process.env.VITE_SMS_SENDER_ID;

    if (!API_KEY || !SENDER_ID) {
      return res.status(500).json({
        success: false,
        error: 'SMS service not configured',
      });
    }

    // Fix phone format (BulkSMSBD requires 880 prefix)
    const formattedNumber = phoneNumber.startsWith("880")
      ? phoneNumber
      : `880${phoneNumber.replace(/^0+/, "")}`;

    // Fix message format (BulkSMSBD OTP format)
    const otpMessage = `Your EdTech OTP is ${message}`;

    const url = 'http://bulksmsbd.net/api/smsapi';

    const params = new URLSearchParams({
      api_key: API_KEY,
      senderid: SENDER_ID,
      number: formattedNumber,
      message: otpMessage,
      type: 'text',
    });

    const smsResponse = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
    });

    const rawText = await smsResponse.text();

    // LOG provider response
    console.log("SMS Provider Response:", rawText);

    // BulkSMSBD returns 200 even on failure, so check the response text
    if (!rawText.toLowerCase().includes("ok")) {
      return res.status(500).json({
        success: false,
        error: "SMS provider rejected the request",
        providerResponse: rawText
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      providerResponse: rawText
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while sending OTP',
    });
  }
}
