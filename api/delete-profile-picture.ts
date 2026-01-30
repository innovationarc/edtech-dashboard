import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint to delete profile pictures from Supabase storage
 * Bucket: uploads (public bucket)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const { profilePictureUrl, uid, apiKey } = req.body;

    // Verify API key if configured
    const masterKey = process.env.VITE_SMS_MASTER_KEY || process.env.SMS_MASTER_KEY;
    if (masterKey && apiKey !== masterKey) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Invalid API key'
      });
    }

    // Validate required parameters
    if (!profilePictureUrl || typeof profilePictureUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid profilePictureUrl is required'
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase configuration missing'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract file path from URL
    const filePath = extractFilePathFromUrl(profilePictureUrl);
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile picture URL format'
      });
    }

    // Delete from Supabase storage (uploads bucket)
    const { error: deleteError } = await supabase.storage
      .from('uploads')
      .remove([filePath]);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        error: `Failed to delete from Supabase: ${deleteError.message}`,
        details: deleteError
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile picture deleted successfully from Supabase',
      uid: uid || null,
      filePath
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

/**
 * Extract file path from Supabase URL
 * Expected formats:
 * - https://[project].supabase.co/storage/v1/object/public/uploads/[filepath]
 * - https://[custom-domain]/storage/v1/object/public/uploads/[filepath]
 */
function extractFilePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find 'uploads' bucket in path
    const uploadsIndex = pathParts.findIndex(part => part === 'uploads');
    
    if (uploadsIndex === -1 || uploadsIndex === pathParts.length - 1) {
      return null;
    }
    
    // Get everything after 'uploads/'
    const filePath = pathParts.slice(uploadsIndex + 1).join('/');
    
    return filePath || null;
  } catch (error) {
    return null;
  }
}
