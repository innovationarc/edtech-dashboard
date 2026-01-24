// api/upload.ts

import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getContentType = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  return 'application/octet-stream';
};

/**
 * Get bucket name based on bucket type
 */
const getBucketName = (bucketType: 'public' | 'private'): string => {
  return bucketType === 'private' ? 'assets' : 'uploads';
};

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
    // POST: Upload file
    if (req.method === 'POST') {
      const { fileName, file, bucketType = 'public' } = req.body;

      if (!fileName || !file) {
        return res.status(400).json({ error: 'Missing fileName or file' });
      }

      const bucket = getBucketName(bucketType);
      const buffer = Buffer.from(file, 'base64');

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, buffer, {
          upsert: false,
          contentType: getContentType(fileName),
          metadata: {
            contentDisposition: 'inline',
          },
        });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Get public URL (even for private bucket, we'll use signed URLs on the client)
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return res.status(200).json({ 
        url: data.publicUrl,
        bucket,
        bucketType 
      });
    }

    // DELETE: Delete file
    else if (req.method === 'DELETE') {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ error: 'Missing fileUrl' });
      }

      const parsed = parseFileUrl(fileUrl);
      
      if (!parsed) {
        return res.status(400).json({ error: 'Invalid file URL' });
      }

      const { bucket, filePath } = parsed;

      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ 
        message: 'File deleted successfully',
        bucket,
        filePath 
      });
    }

    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
