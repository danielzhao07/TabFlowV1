/**
 * Thumbnail routes - Upload, retrieve, and delete tab screenshots via S3.
 */
import { Router, Request, Response } from 'express';
import { uploadThumbnail, getThumbnailUrl, deleteThumbnail } from '../services/s3.js';
import { z } from 'zod';

export const thumbnailRouter = Router();

const uploadSchema = z.object({
    tabUrl: z.string().url(),
    imageData: z.string(),
    contentType: z.enum(['image/webp', 'image/png', 'image/jpeg']).optional().default('image/webp'),
});

thumbnailRouter.post('/upload', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
        const imageBuffer = Buffer.from(parsed.data.imageData, 'base64');
        if (imageBuffer.length > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image too large (max 2MB)' });
        }
        const key = await uploadThumbnail(userId, parsed.data.tabUrl, imageBuffer, parsed.data.contentType);
        const url = await getThumbnailUrl(key);
        res.status(201).json({ key, url });
    } catch (error) {
        console.error('Thumbnail upload failed:', error);
        res.status(500).json({ error: 'Failed to upload thumbnail' });
    }
});

thumbnailRouter.get('/url', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const key = req.query.key as string;
    if (!key) return res.status(400).json({ error: 'Missing key parameter' });
    try {
        if (!key.includes(userId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const url = await getThumbnailUrl(key);
        res.json({ url });
    } catch (error) {
        console.error('Thumbnail retrieval failed:', error);
        res.status(500).json({ error: 'Failed to retrieve thumbnail' });
    }
});

thumbnailRouter.delete('/', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const key = req.query.key as string;
    if (!key) return res.status(400).json({ error: 'Missing key parameter' });
    try {
        if (!key.includes(userId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await deleteThumbnail(key);
        res.json({ success: true });
    } catch (error) {
        console.error('Thumbnail deletion failed:', error);
        res.status(500).json({ error: 'Failed to delete thumbnail' });
    }
});
