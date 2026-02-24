/**
 * Database connection using Drizzle ORM + PostgreSQL (Neon serverless).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;

// Neon requires SSL — postgres.js detects sslmode=require from the URL,
// but we also set ssl explicitly for safety.
const queryClient = postgres(connectionString, {
    ssl: 'require',
    max: 10,
});

export const db = drizzle(queryClient, { schema });
