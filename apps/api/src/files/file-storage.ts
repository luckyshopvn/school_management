import { Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStorageSettings } from '../common/configuration.js';

// Kho tệp: máy chủ API ghi và đọc tệp qua giao diện S3 (TP-08, YCTD-45); kiểm thử dùng kho trong bộ nhớ
export abstract class FileStorage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract get(key: string): Promise<Buffer>;
}

export class S3FileStorage extends FileStorage {
  private readonly logger = new Logger('FileStorage');
  private readonly client: S3Client;
  private bucketReady: Promise<void> | undefined;

  constructor(private readonly settings: ObjectStorageSettings) {
    super();
    this.client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: true,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({ Bucket: this.settings.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }));
    return Buffer.from(await (result.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray());
  }

  // Tạo thùng chứa ở lần ghi đầu nếu chưa có
  private ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.settings.bucket }));
      } catch {
        this.logger.warn(`Tạo thùng chứa tệp ${this.settings.bucket}`);
        await this.client.send(new CreateBucketCommand({ Bucket: this.settings.bucket }));
      }
    })().catch((error: unknown) => {
      this.bucketReady = undefined;
      throw error;
    });
    return this.bucketReady;
  }
}

export class MemoryFileStorage extends FileStorage {
  private readonly objects = new Map<string, Buffer>();

  async put(key: string, body: Buffer): Promise<void> {
    this.objects.set(key, body);
  }

  async get(key: string): Promise<Buffer> {
    const body = this.objects.get(key);
    if (!body) {
      throw new Error(`Không có tệp ${key}`);
    }
    return body;
  }
}
