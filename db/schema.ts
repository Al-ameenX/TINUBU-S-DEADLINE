import { pgTable, text, integer, jsonb, timestamp, serial } from 'drizzle-orm/pg-core';
export const results = pgTable('election_results', {
  id: text().primaryKey(), state: text().notNull(), lga: text().notNull(),
  registered: integer().notNull(), accredited: integer().notNull(), rejected: integer().notNull(),
  votes: jsonb().$type<Record<string, number>>().notNull(), source: text().notNull(),
  status: text().notNull().default('pending'), uploader: text().notNull(),
  reviewer: text(), notes: text().notNull().default(''), version: integer().notNull().default(1),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
export const reviews = pgTable('result_reviews', {
  id: serial().primaryKey(), resultId: text('result_id').notNull(), version: integer().notNull(),
  action: text().notNull(), actor: text().notNull(), notes: text().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
