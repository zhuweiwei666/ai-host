import { http } from '../api/http';

/**
 * OSS Upload Result
 */
export interface OssUploadResult {
  url: string;
  key: string;
  name?: string;
}

/**
 * Upload file to OSS via backend proxy API
 * This bypasses browser-side signature issues by using backend Node.js ali-oss client
 * 
 * @param file - File to upload
 * @param options - Upload options
 * @param options.folder - Optional folder prefix (default: 'uploads')
 * @returns Promise resolving to upload result with URL and key
 */
export async function uploadToOSS(
  file: File,
  options?: { folder?: string }
): Promise<string> {
  try {
    const result = await uploadFileViaBackend(file, options);
    return result.url;
  } catch (error: any) {
    console.error('[OSS Upload] Failed:', error);
    throw new Error(error?.message || '上传失败，请稍后重试');
  }
}

/**
 * Upload file via backend API (returns full result object)
 * 
 * @param file - File to upload
 * @param options - Upload options
 * @param options.folder - Optional folder prefix (default: 'uploads')
 * @returns Promise resolving to upload result
 */
export async function uploadFileViaBackend(
  file: File,
  options?: { folder?: string }
): Promise<OssUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const params: Record<string, string> = {};
  if (options?.folder) {
    params.folder = options.folder;
  }

  try {
    // Use http instance which has baseURL='/api' configured
    // This will POST to /api/oss/upload
    const response = await http.post<OssUploadResult>('/oss/upload', formData, {
      params,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes for large files
    });

    // Response interceptor already unwraps { success, data } format
    // So response.data should be the actual data object
    const data = response.data;

    if (!data || !data.url) {
      throw new Error('上传失败：服务器返回格式错误');
    }

    console.log('[OSS Upload] Success:', {
      url: data.url,
      key: data.key,
      name: data.name,
    });

    return {
      url: data.url,
      key: data.key,
      name: data.name,
    };
  } catch (error: any) {
    console.error('[OSS Upload] API Error:', error);
    
    // Extract error message
    let errorMessage = '上传失败';
    if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}

/**
 * Upload image file to OSS (alias for uploadToOSS)
 * @deprecated Use uploadToOSS directly
 */
export const uploadImageToOSS = uploadToOSS;

/**
 * Upload video file to OSS (alias for uploadToOSS)
 * @deprecated Use uploadToOSS directly
 */
export const uploadVideoToOSS = uploadToOSS;
