import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, file } = req.body;

    if (!fileName || !file) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const buffer = Buffer.from(file, 'base64');

    const { error } = await supabase.storage
      .from('uploads') // bucket name
      .upload(fileName, buffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return res.status(200).json({ url: data.publicUrl });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
