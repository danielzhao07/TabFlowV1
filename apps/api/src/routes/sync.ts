/**
 * Sync routes - Handle cloud sync for workspaces, bookmarks, notes, and settings.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { workspaces, bookmarks, notes, userSettings } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const syncRouter = Router();

// ---- Workspaces ----

syncRouter.get('/workspaces', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await db.select().from(workspaces).where(eq(workspaces.userId, userId));
    res.json({ workspaces: result });
});

const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(255),
    tabs: z.array(z.object({
        url: z.string(),
        title: z.string(),
        faviconUrl: z.string().optional(),
    })),
});

syncRouter.post('/workspaces', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const [workspace] = await db.insert(workspaces).values({
        userId,
        name: parsed.data.name,
        tabs: parsed.data.tabs,
    }).returning();
    res.status(201).json({ workspace });
});

syncRouter.delete('/workspaces/:id', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = req.params.id as string;
    await db.delete(workspaces).where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)));
    res.json({ success: true });
});

// ---- Bookmarks ----

syncRouter.get('/bookmarks', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
    res.json({ bookmarks: result });
});

const createBookmarkSchema = z.object({
    url: z.string().url(),
    title: z.string().max(512),
    faviconUrl: z.string().optional(),
});

syncRouter.post('/bookmarks', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createBookmarkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const [bookmark] = await db.insert(bookmarks).values({
        userId,
        ...parsed.data,
    }).returning();
    res.status(201).json({ bookmark });
});

syncRouter.delete('/bookmarks/:id', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = req.params.id as string;
    await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
    res.json({ success: true });
});

// ---- Notes ----

syncRouter.get('/notes', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await db.select().from(notes).where(eq(notes.userId, userId));
    res.json({ notes: result });
});

const createNoteSchema = z.object({
    url: z.string(),
    content: z.string().max(2000),
});

syncRouter.post('/notes', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const [note] = await db.insert(notes).values({
        userId,
        ...parsed.data,
    }).returning();
    res.status(201).json({ note });
});

// ---- Settings ----

syncRouter.get('/settings', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    res.json({ settings: result[0]?.settings ?? null });
});

syncRouter.put('/settings', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const [setting] = await db.insert(userSettings).values({
        userId,
        settings: req.body,
    }).onConflictDoUpdate({
        target: userSettings.userId,
        set: { settings: req.body, updatedAt: new Date() },
    }).returning();
    res.json({ settings: setting.settings });
});
