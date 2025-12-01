import OSS from 'ali-oss';
import { http } from '../api/http';

interface STSResponse {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expiration: string;
  bucket: string;
  region: string;
  endpoint: string;
  basePath: string;
}

/**
 * Upload file directly to Alibaba Cloud OSS using STS temporary credentials
 * @param file - File to upload
 * @returns Public URL of the uploaded file
 */
export async function uploadToOSS(file: File): Promise<string> {
  try {
    // 1. Get temporary STS credentials from backend
    const stsResponse = await http.get<STSResponse>('/api/oss/sts');
    const sts = stsResponse.data;

    // 2. Initialize OSS client with STS credentials
    const client = new OSS({
      region: sts.region,
      accessKeyId: sts.accessKeyId,
      accessKeySecret: sts.accessKeySecret,
      stsToken: sts.securityToken,
      bucket: sts.bucket,
      endpoint: sts.endpoint,
    });

    // 3. Generate unique object key
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2, 11);
    const objectKey = `${sts.basePath}/${timestamp}-${randomStr}.${ext}`;

    // 4. Upload file to OSS
    const result = await client.put(objectKey, file);

    // 5. Return public URL
    return result.url;
  } catch (error: any) {
    console.error('[OSS Upload] Failed:', error);
    throw new Error(error?.response?.data?.error || error?.message || 'Failed to upload file to OSS');
  }
}

/**
 * Upload image file to OSS (alias for uploadToOSS)
 */
export const uploadImageToOSS = uploadToOSS;

/**
 * Upload video file to OSS (alias for uploadToOSS)
 */
export const uploadVideoToOSS = uploadToOSS;

