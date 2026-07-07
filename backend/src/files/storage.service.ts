import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('s3.bucket', 'hrbot-cvs');
    this.client = new S3Client({
      endpoint: config.get<string>('s3.endpoint'),
      region: config.get<string>('s3.region'),
      forcePathStyle: config.get<boolean>('s3.forcePathStyle'),
      credentials: {
        accessKeyId: config.get<string>('s3.accessKey', 'minioadmin'),
        secretAccessKey: config.get<string>('s3.secretKey', 'minioadmin'),
      },
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        this.logger.warn(`Could not create bucket ${this.bucket}: ${(error as Error).message}`);
      }
    }
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }));
    return key;
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }
}
