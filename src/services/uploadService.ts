// src/services/uploadService.ts

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number; // bytes per second
}

export type BucketType = 'public' | 'private';

export const uploadService = {
  async uploadToSupabase(
    file: File,
    folder: string,
    onProgress?: (progress: UploadProgress) => void,
    bucketType: BucketType = 'public'
  ): Promise<{ url: string }> {
    try {
      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      // Read file as Base64 with progress
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000; // seconds
            const bytesDiff = event.loaded - lastLoaded;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 50), // 0-50% for reading
              speed
            });

            lastLoaded = event.loaded;
            lastTime = now;
          }
        };

        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data:image/png;base64, prefix
          resolve(base64);
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        
        reader.readAsDataURL(file);
      });

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileExtension = file.name.split('.').pop();
      const uniqueFileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExtension}`;

      // Prepare upload data
      const uploadData = JSON.stringify({
        fileName: `${folder}/${uniqueFileName}`,
        file: base64String,
        bucketType, // Include bucket type
      });

      const uploadSize = new Blob([uploadData]).size;
      let uploadedBytes = 0;

      // Send to API endpoint with progress simulation
      const uploadStartTime = Date.now();
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: uploadData,
      });

      // Simulate upload progress (50-100%)
      if (onProgress) {
        const uploadInterval = setInterval(() => {
          uploadedBytes += uploadSize * 0.1; // Simulate 10% increments
          if (uploadedBytes >= uploadSize) {
            uploadedBytes = uploadSize;
            clearInterval(uploadInterval);
          }

          const now = Date.now();
          const timeDiff = (now - uploadStartTime) / 1000;
          const speed = timeDiff > 0 ? uploadedBytes / timeDiff : 0;

          onProgress({
            loaded: uploadedBytes,
            total: uploadSize,
            percentage: 50 + Math.round((uploadedBytes / uploadSize) * 50), // 50-100%
            speed
          });
        }, 100);

        // Clear interval when response is received
        if (response.ok) {
          clearInterval(uploadInterval);
          onProgress({
            loaded: uploadSize,
            total: uploadSize,
            percentage: 100,
            speed: uploadSize / ((Date.now() - uploadStartTime) / 1000)
          });
        }
      }

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

  async deleteFromSupabase(fileUrl: string): Promise<void> {
    try {
      const response = await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      console.log('File deleted from Supabase:', fileUrl);
    } catch (error: any) {
      console.error('Supabase delete error:', error);
      throw new Error(`Failed to delete from Supabase: ${error.message}`);
    }
  },

  /**
   * Generate a signed URL for private bucket files
   * @param fileUrl - The URL of the file in the private bucket
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   */
  async getSignedUrl(fileUrl: string, expiresIn: number = 3600): Promise<string> {
    try {
      const response = await fetch('/api/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, expiresIn }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate signed URL');
      }

      const data = await response.json();
      return data.signedUrl;
    } catch (error: any) {
      console.error('Signed URL generation error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }
};
