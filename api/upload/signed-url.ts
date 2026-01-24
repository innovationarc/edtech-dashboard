// api/upload/signed-url.ts

import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extract bucket type and file path from URL
 */
const parseFileUrl = (fileUrl: string): { bucket: string; filePath: string } | null => {
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    
    // Expected format: /storage/v1/object/public/uploads/... or /storage/v1/object/public/assets/...
    const bucketIndex = pathParts.findIndex(part => part === 'uploads' || part === 'assets');
    
    if (bucketIndex === -1) {
      return null;
    }
    
    const bucket = pathParts[bucketIndex];
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    return { bucket, filePath };
  } catch (error) {
    console.error('Error parsing file URL:', error);
    return null;
  }
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileUrl, expiresIn = 3600 } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: 'Missing fileUrl' });
    }

    const parsed = parseFileUrl(fileUrl);
    
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid file URL' });
    }

    const { bucket, filePath } = parsed;

    // Generate signed URL (only works for private buckets, but can be used for public too)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data || !data.signedUrl) {
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }

    return res.status(200).json({ 
      signedUrl: data.signedUrl,
      expiresIn,
      bucket,
      filePath 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
