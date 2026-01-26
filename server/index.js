// server.js or server/index.js
// Simple Express backend for handling SMS API

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// SMS API Route
app.post('/api/sms', async (req, res) => {
  const { phoneNumber, message } = req.body;

  if (!phoneNumber || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Phone number and message are required' 
    });
  }

  // Get API key and sender ID from environment variables
  const API_KEY = process.env.VITE_SMS_API_KEY || process.env.SMS_API_KEY;
  const SENDER_ID = process.env.VITE_SMS_SENDER_ID || process.env.SMS_SENDER_ID;

  if (!API_KEY || !SENDER_ID) {
    console.error('SMS credentials not configured');
    return res.status(500).json({ 
      success: false, 
      error: 'SMS service not configured' 
    });
  }

  try {
    const url = 'http://bulksmsbd.net/api/smsapi';
    
    const params = new URLSearchParams({
      api_key: API_KEY,
      senderid: SENDER_ID,
      number: phoneNumber,
      message: message,
      type: 'text'
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.text();
    
    if (response.ok) {
      return res.status(200).json({ 
        success: true, 
        message: 'OTP sent successfully' 
      });
    } else {
      console.error('SMS API Error:', data);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send OTP. Please try again.' 
      });
    }
  } catch (error) {
    console.error('SMS sending error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP. Please check your connection.' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
