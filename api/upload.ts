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

// Detect correct MIME type (CRITICAL FIX)
const getContentType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    default:
      return 'application/octet-stream';
  }
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileName, file } = req.body;

    if (!fileName || !file) {
      return res.status(400).json({ error: 'Missing fileName or file' });
    }

    // Convert Base64 → Buffer
    const buffer = Buffer.from(file, 'base64');

    // Upload to Supabase (UNCHANGED behavior, FIXED MIME)
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        upsert: false,
        contentType: getContentType(fileName), // ✅ FIX
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    // Return PUBLIC URL (same as before)
    const { data } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return res.status(200).json({
      url: data.publicUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
