// src/api/upload-to-drive.ts
// Google Drive upload endpoint using Service Account

export const config = {
  runtime: 'edge',
  api: {
    bodyParser: false,
  },
};

// Google Drive folder IDs
const QA_FOLDER_ID = '1iOrOSwGYQlTvVNXYa7JL-o8Q0A0dA4UQ'; // For Q&A files
const KNOWLEDGE_FOLDER_ID = '15CmR8svI9TYW8uqcCB0RbdgNkXAk1cTI'; // For Knowledge files

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine which folder to use based on the folder parameter
    let targetFolderId = QA_FOLDER_ID; // Default to Q&A folder
    
    if (folder === 'knowledge' || folder === 'knowledge_images') {
      targetFolderId = KNOWLEDGE_FOLDER_ID;
    }

    // Get Google Service Account credentials from environment
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!serviceAccountEmail || !privateKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google Service Account credentials not configured' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create JWT for Google API authentication
    const jwt = await createJWT(serviceAccountEmail, privateKey);
    
    // Get access token
    const accessToken = await getAccessToken(jwt);
    
    // Upload file to Google Drive
    const fileBuffer = await file.arrayBuffer();
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [targetFolderId],
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', new Blob([fileBuffer], { type: file.type }));

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Google Drive API Error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to upload to Google Drive' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await uploadResponse.json();

    // Make the file publicly accessible (anyone with link can view)
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${result.id}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone',
          }),
        }
      );
    } catch (permError) {
      console.warn('Failed to set permissions, but file uploaded successfully');
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileId: result.id,
        webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Google Drive upload error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to upload to Google Drive',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

// Helper functions for JWT and Google Auth
async function createJWT(email: string, privateKey: string): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${signatureInput}.${encodedSignature}`;
}

async function getAccessToken(jwt: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to get access token: ${errorData.error_description || errorData.error}`);
  }

  const data = await response.json();
  return data.access_token;
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;
  
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    base64 = btoa(String.fromCharCode(...bytes));
  }
  
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
