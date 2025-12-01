import OSS from 'ali-oss';
import { http } from '../api/http';

interface STSResponse {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string; // Optional: root accounts don't have STS token
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
    const stsResponse = await http.get<STSResponse>('/oss/sts');
    const sts = stsResponse.data;

    // 2. Initialize OSS client with STS credentials (or direct AccessKey if root account)
    const clientConfig: any = {
      region: sts.region,
      accessKeyId: sts.accessKeyId,
      accessKeySecret: sts.accessKeySecret,
      bucket: sts.bucket,
      endpoint: sts.endpoint,
    };
    
    // Only add stsToken if it exists (root accounts don't have STS token)
    if (sts.securityToken) {
      clientConfig.stsToken = sts.securityToken;
    }
    
    const client = new OSS(clientConfig);

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

