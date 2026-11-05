import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey, index, check } from 'drizzle-orm/sqlite-core';

export const communityEvents = sqliteTable('community_events', {
  id: text('id').primaryKey(), title: text('title').notNull(), venue: text('venue').notNull(),
  zone: text('zone').notNull(), category: text('category').notNull(),
  date: text('event_date').notNull(), time: text('event_time').notNull(), price: integer('price').notNull(),
  description: text('description').notNull(), lat: real('lat').notNull(), lng: real('lng').notNull(),
  imageData: text('image_data').notNull().default(''), groupEligible: integer('group_eligible', { mode: 'boolean' }).notNull().default(false),
  creatorSessionHash: text('creator_session_hash').notNull(), createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, table => [index('community_events_date_idx').on(table.date, table.time), index('community_events_creator_idx').on(table.creatorSessionHash, table.createdAt), check('price_nonnegative', sql`${table.price} >= 0`)]);

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(), eventId: text('event_id').notNull(), eventTitle: text('event_title').notNull(),
  hostName: text('host_name').notNull(), hostSessionHash: text('host_session_hash').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, table => [index('groups_host_idx').on(table.hostSessionHash, table.createdAt)]);

export const groupMembers = sqliteTable('group_members', {
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  sessionHash: text('session_hash').notNull(), name: text('name').notNull(),
  joinedAt: text('joined_at').notNull().default(sql`(datetime('now'))`),
}, table => [primaryKey({ columns: [table.groupId, table.sessionHash] })]);
