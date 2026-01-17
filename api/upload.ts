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

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileName, file } = req.body;

    if (!fileName || !file) {
      return res.status(400).json({ error: 'Missing fileName or file' });
    }

    const buffer = Buffer.from(file, 'base64');

    const { error } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        upsert: false,
        contentType: getContentType(fileName),
        metadata: {
          contentDisposition: 'inline', // 🔥 THIS IS THE KEY
        },
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const { data } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return res.status(200).json({ url: data.publicUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
