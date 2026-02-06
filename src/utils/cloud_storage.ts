import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

// Ellenőrzés: Ha nincs beállítva, figyelmeztet, de nem omlik össze (opcionális dependency)
const R2_CONFIGURED = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

const s3Client = R2_CONFIGURED ? new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
}) : null;

const BUCKET = process.env.R2_BUCKET_NAME || "vodor1";

export class CloudStorage {
  static async upload(filename: string, content: string | Buffer, mimeType: string = "text/plain"): Promise<string> {
    if (!s3Client) throw new Error("Cloudflare R2 nincs konfigurálva a .env fájlban!");
    
    const key = `Brunella-core/${filename}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: content,
      ContentType: mimeType,
    }));
    
    console.log(`☁️ [R2] Feltöltve: ${key}`);
    return key;
  }

  static async listFiles(prefix: string = "Brunella-core/"): Promise<string[]> {
    if (!s3Client) return [];
    const command = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix });
    const response = await s3Client.send(command);
    return response.Contents?.map(c => c.Key || "") || [];
  }
}