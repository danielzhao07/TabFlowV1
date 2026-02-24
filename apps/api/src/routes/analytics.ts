/**
 * Analytics routes - Track and serve tab usage analytics.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { tabAnalytics } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

export const analyticsRouter = Router();

// POST /api/analytics/visit
const visitSchema = z.object({
    url: z.string(),
    title: z.string().max(512).optional(),
    domain: z.string().max(255),
    durationMs: z.number().int().min(0).optional().default(0),
});

analyticsRouter.post('/visit', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = visitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    await db.execute(sql`
    INSERT INTO tab_analytics (id, user_id, url, domain, title, visit_count, total_duration_ms, last_visited_at, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${parsed.data.url}, ${parsed.data.domain}, ${parsed.data.title ?? null}, 1, ${parsed.data.durationMs}, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      visit_count = tab_analytics.visit_count + 1,
      total_duration_ms = tab_analytics.total_duration_ms + ${parsed.data.durationMs},
      last_visited_at = NOW()
  `);
    res.json({ success: true });
});

// GET /api/analytics/top-domains
analyticsRouter.get('/top-domains', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const results = await db.execute(sql`
    SELECT
      domain,
      SUM(visit_count) as total_visits,
      SUM(total_duration_ms) as total_duration_ms,
      MAX(last_visited_at) as last_visited_at,
      COUNT(DISTINCT url) as unique_pages
    FROM tab_analytics
    WHERE user_id = ${userId}
    GROUP BY domain
    ORDER BY total_visits DESC
    LIMIT ${limit}
  `);
    res.json({ domains: results });
});

// GET /api/analytics/summary
analyticsRouter.get('/summary', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const results = await db.execute(sql`
    SELECT
      COUNT(DISTINCT url) as total_unique_tabs,
      COUNT(DISTINCT domain) as total_domains,
      SUM(visit_count) as total_visits,
      SUM(total_duration_ms) as total_time_ms
    FROM tab_analytics
    WHERE user_id = ${userId}
  `);
    const row = (results as any[])[0];
    res.json({
        summary: {
            totalUniqueTabs: Number(row?.total_unique_tabs ?? 0),
            totalDomains: Number(row?.total_domains ?? 0),
            totalVisits: Number(row?.total_visits ?? 0),
            totalTimeMs: Number(row?.total_time_ms ?? 0),
        },
    });
});

// GET /api/analytics/recent
analyticsRouter.get('/recent', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const results = await db.select()
        .from(tabAnalytics)
        .where(eq(tabAnalytics.userId, userId))
        .orderBy(desc(tabAnalytics.lastVisitedAt))
        .limit(limit);
    res.json({ recent: results });
});
