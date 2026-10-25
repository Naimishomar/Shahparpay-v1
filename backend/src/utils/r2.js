import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export const uploadOnR2 = async (localFilePath, contentType = 'image/jpeg') => {
  try {
    if (!localFilePath) return null;

    const fileContent = fs.readFileSync(localFilePath);
    const fileName = `${crypto.randomUUID()}-${path.basename(localFilePath)}`;

    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      // Multer saves without an extension, so callers that store something other
      // than a photo (the AEPS KYC video) say what it is.
      ContentType: contentType,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    // Remove locally saved temporary file
    fs.unlinkSync(localFilePath);

    // Return the public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
    return { url: publicUrl };
  } catch (error) {
    console.error('Cloudflare R2 Upload Error:', error);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath); // remove locally saved temporary file as the upload operation failed
    }
    return null;
  }
};
