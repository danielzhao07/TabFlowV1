/**
 * AI routes - Semantic search via Gemini embeddings + pgvector.
 */
import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db/index.js';
import { tabEmbeddings } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

export const aiRouter = Router();

// Gemini client (initialized lazily)
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set');
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

async function generateEmbedding(text: string): Promise<number[]> {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

// POST /api/ai/embed
const embedSchema = z.object({
    url: z.string(),
    title: z.string().max(512),
    contentSummary: z.string().max(5000).optional(),
});

aiRouter.post('/embed', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = embedSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
        const textToEmbed = [parsed.data.title, parsed.data.url, parsed.data.contentSummary].filter(Boolean).join(' | ');
        const embedding = await generateEmbedding(textToEmbed);
        const [record] = await db.insert(tabEmbeddings).values({
            userId,
            url: parsed.data.url,
            title: parsed.data.title,
            contentSummary: parsed.data.contentSummary ?? null,
            embedding,
        }).returning();
        res.status(201).json({ id: record.id, url: record.url });
    } catch (error) {
        console.error('Embedding generation failed:', error);
        res.status(500).json({ error: 'Failed to generate embedding' });
    }
});

// POST /api/ai/search
const searchSchema = z.object({
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(50).optional().default(10),
});

aiRouter.post('/search', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
        const queryEmbedding = await generateEmbedding(parsed.data.query);
        const results = await db.execute(sql`
      SELECT
        id,
        url,
        title,
        content_summary,
        1 - (
          (SELECT SUM(a * b) FROM UNNEST(embedding, ${sql.raw(`ARRAY[${queryEmbedding.join(',')}]::real[]`)}) AS t(a, b))
          / (
            SQRT((SELECT SUM(a * a) FROM UNNEST(embedding) AS t(a)))
            * SQRT((SELECT SUM(b * b) FROM UNNEST(${sql.raw(`ARRAY[${queryEmbedding.join(',')}]::real[]`)}) AS t(b)))
          )
        ) AS similarity
      FROM tab_embeddings
      WHERE user_id = ${userId}
      ORDER BY similarity DESC
      LIMIT ${parsed.data.limit}
    `);
        res.json({
            results: (results as any[]).map((row: any) => ({
                id: row.id,
                url: row.url,
                title: row.title,
                contentSummary: row.content_summary,
                similarity: row.similarity,
            })),
        });
    } catch (error) {
        console.error('Semantic search failed:', error);
        res.status(500).json({ error: 'Semantic search failed' });
    }
});

// GET /api/ai/history?q=...&limit=10
// Semantic search over all stored embeddings (including closed tabs from history)
aiRouter.get('/history', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const query = (req.query.q as string)?.trim();
    if (!query || query.length < 1) return res.status(400).json({ error: 'Missing query param ?q=' });
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 30);
    try {
        const queryEmbedding = await generateEmbedding(query);
        const results = await db.execute(sql`
      SELECT
        url,
        title,
        updated_at,
        1 - (
          (SELECT SUM(a * b) FROM UNNEST(embedding, ${sql.raw(`ARRAY[${queryEmbedding.join(',')}]::real[]`)}) AS t(a, b))
          / NULLIF(
            SQRT((SELECT SUM(a * a) FROM UNNEST(embedding) AS t(a)))
            * SQRT((SELECT SUM(b * b) FROM UNNEST(${sql.raw(`ARRAY[${queryEmbedding.join(',')}]::real[]`)}) AS t(b)))
          , 0)
        ) AS similarity
      FROM tab_embeddings
      WHERE user_id = ${userId}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `);
        res.json({
            results: (results as any[]).map((row: any) => ({
                url: row.url,
                title: row.title,
                lastSeen: row.updated_at,
                similarity: Math.round((1 - (row.similarity ?? 1)) * 100) / 100,
            })),
        });
    } catch (error) {
        console.error('History search failed:', error);
        res.status(500).json({ error: 'History search failed' });
    }
});

// GET /api/ai/health
aiRouter.get('/health', async (_req: Request, res: Response) => {
    try {
        getGenAI();
        res.json({ status: 'ok', model: 'gemini-embedding-001' });
    } catch {
        res.status(503).json({ status: 'error', message: 'Gemini API not configured' });
    }
});
