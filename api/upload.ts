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


export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileName, file } = req.body;

    if (!fileName || !file) {
      return res.status(400).json({ error: 'Missing fileName or file' });
    }

    // ❌ Remove this block
    // if (!fileName.startsWith('uploads/')) {
    //   return res.status(400).json({ error: 'Invalid file path' });
    // }

    const ext = fileName.split('.').pop()?.toLowerCase();
    

    const buffer = Buffer.from(file, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        upsert: false,
        contentType: `application/octet-stream`,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase.storage.from('uploads').getPublicUrl(fileName);

    return res.status(200).json({ url: data.publicUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
