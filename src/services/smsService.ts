// src/services/smsService.ts
// Client-side service that calls your backend API

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const smsService = {
  async sendSMS(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      // Replace with your actual backend URL
      const BACKEND_URL = import.meta.env.BACKEND_URL || 'http://localhost:3000';
      
      const response = await fetch(`${BACKEND_URL}/api/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message
        })
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('SMS service error:', error);
      return {
        success: false,
        error: 'Failed to send SMS. Please try again.'
      };
    }
  }
};
