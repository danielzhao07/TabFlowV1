/**
 * AWS S3 service for storing and retrieving tab thumbnail screenshots.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'tabflow-thumbnails';

export async function uploadThumbnail(
    userId: string,
    tabUrl: string,
    imageBuffer: Buffer,
    contentType: string = 'image/webp',
): Promise<string> {
    const urlHash = hashUrl(tabUrl);
    const key = `thumbnails/${userId}/${urlHash}`;
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: imageBuffer,
        ContentType: contentType,
        CacheControl: 'max-age=86400',
        Metadata: {
            'tab-url': tabUrl.slice(0, 512),
        },
    }));
    return key;
}

export async function getThumbnailUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    return getSignedUrl(s3, command, { expiresIn });
}

export async function deleteThumbnail(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    }));
}

function hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}
