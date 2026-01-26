import express, { Request, Response } from 'express';
import cors from 'cors';

// IMPORTANT: Node 18+ has fetch built-in
// If using Node <18, uncomment below:
// import fetch from 'node-fetch';

const router = express.Router();

/* ------------------ MIDDLEWARE ------------------ */
router.use(cors());
router.use(express.json());

/* ------------------ TYPES ------------------ */
interface SMSRequestBody {
  phoneNumber: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/* ------------------ ROUTE ------------------ */
router.post('/sms', async (req: Request, res: Response<SMSResponse>) => {
  try {
    const { phoneNumber, message } = req.body as SMSRequestBody;

    /* ---------- Validation ---------- */
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required',
      });
    }

    /* ---------- ENV ---------- */
    const API_KEY =
      process.env.SMS_API_KEY || process.env.VITE_SMS_API_KEY;
    const SENDER_ID =
      process.env.SMS_SENDER_ID || process.env.VITE_SMS_SENDER_ID;

    if (!API_KEY || !SENDER_ID) {
      console.error('❌ SMS credentials missing');
      return res.status(500).json({
        success: false,
        error: 'SMS service not configured',
      });
    }

    /* ---------- SMS API ---------- */
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

    /* ---------- Handle SMS API ---------- */
    if (!smsResponse.ok) {
      console.error('❌ SMS API failed:', rawText);
      return res.status(500).json({
        success: false,
        error: 'Failed to send OTP',
      });
    }

    // Optional: log success for debugging
    console.log('✅ SMS sent:', rawText);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    });

  } catch (err: any) {
    console.error('🔥 SMS SERVER ERROR:', err);

    return res.status(500).json({
      success: false,
      error: 'Internal server error while sending OTP',
    });
  }
});

export default router;
