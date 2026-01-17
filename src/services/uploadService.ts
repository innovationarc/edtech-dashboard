// src/services/uploadService.ts
export const uploadService = {
  async uploadToSupabase(
    file: File,
    folder: string
  ): Promise<{ url: string }> {
    try {
      // Read file as Base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data:image/png;base64, prefix
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
      });

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const uniqueFileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExtension}`;

      // Send to API endpoint
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `${folder}/${uniqueFileName}`,
          file: base64String,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      
      if (!data.url) {
        throw new Error('No URL returned from upload');
      }

      return { url: data.url };
    } catch (error: any) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }
  },
};
