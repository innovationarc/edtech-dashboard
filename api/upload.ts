import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  try {
    // Step 1: basic reachability
    console.log('UPLOAD ENDPOINT HIT');

    // Step 2: method check
    if (req.method !== 'POST') {
      console.log('WRONG METHOD:', req.method);
      return res.status(405).json({
        stage: 'method_check',
        error: 'Method not allowed',
      });
    }

    // Step 3: env check
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({
        stage: 'env_check',
        error: 'SUPABASE_URL is missing',
      });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        stage: 'env_check',
        error: 'SUPABASE_SERVICE_ROLE_KEY is missing',
      });
    }

    // Step 4: body check
    if (!req.body) {
      return res.status(400).json({
        stage: 'body_check',
        error: 'Request body is empty',
      });
    }

    const { fileName, file } = req.body;

    if (typeof fileName !== 'string') {
      return res.status(400).json({
        stage: 'payload_check',
        error: 'fileName is missing or not a string',
        received: fileName,
      });
    }

    if (typeof file !== 'string') {
      return res.status(400).json({
        stage: 'payload_check',
        error: 'file is missing or not a string (base64 expected)',
        receivedType: typeof file,
      });
    }

    // Step 5: base64 decode check
    let buffer: Buffer;
    try {
      buffer = Buffer.from(file, 'base64');
    } catch (e) {
      return res.status(400).json({
        stage: 'base64_decode',
        error: 'Invalid base64 data',
      });
    }

    // Step 6: Supabase client init
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Step 7: upload
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        upsert: false,
        contentType: 'application/octet-stream',
      });

    if (uploadError) {
      return res.status(500).json({
        stage: 'supabase_upload',
        error: uploadError.message,
        details: uploadError,
      });
    }

    // Step 8: public URL
    const { data } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    if (!data?.publicUrl) {
      return res.status(500).json({
        stage: 'public_url',
        error: 'Public URL not generated',
        data,
      });
    }

    // ✅ SUCCESS
    return res.status(200).json({
      stage: 'success',
      url: data.publicUrl,
    });
  } catch (err: any) {
    console.error('UNCAUGHT ERROR:', err);
    return res.status(500).json({
      stage: 'uncaught_exception',
      error: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
