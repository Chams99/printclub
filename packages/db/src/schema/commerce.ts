import { jsonb, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const assetStatus = pgEnum("asset_status", ["uploaded", "processing", "ready", "failed"]);
export const projectVisibility = pgEnum("project_visibility", ["private", "link", "team"]);
export const orderStatus = pgEnum("order_status", [
	"requested",
	"reviewing",
	"approved",
	"in-production",
	"ready",
	"fulfilled",
	"cancelled",
]);

export const product = pgTable("product", {
	id: text("id").primaryKey(),
	kind: text("kind").notNull(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	widthMm: integer("width_mm").notNull(),
	heightMm: integer("height_mm").notNull(),
	finish: text("finish").notNull(),
	active: integer("active").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const asset = pgTable("asset", {
	id: uuid("id").defaultRandom().primaryKey(),
	ownerId: text("owner_id"),
	storageKey: text("storage_key").notNull().unique(),
	status: assetStatus("status").default("uploaded").notNull(),
	mimeType: text("mime_type").notNull(),
	width: integer("width"),
	height: integer("height"),
	byteSize: integer("byte_size").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const project = pgTable("project", {
	id: uuid("id").defaultRandom().primaryKey(),
	ownerId: text("owner_id"),
	productId: text("product_id").notNull(),
	name: text("name").notNull(),
	visibility: projectVisibility("visibility").default("private").notNull(),
	document: jsonb("document").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectRevision = pgTable("project_revision", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id").notNull(),
	version: integer("version").notNull(),
	document: jsonb("document").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderRequest = pgTable("order_request", {
	id: uuid("id").defaultRandom().primaryKey(),
	ownerId: text("owner_id"),
	projectRevisionId: uuid("project_revision_id"),
	productId: text("product_id").notNull(),
	quantity: integer("quantity").notNull(),
	contactName: text("contact_name").notNull(),
	contactEmail: text("contact_email").notNull(),
	notes: text("notes").notNull().default(""),
	status: orderStatus("status").default("requested").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderEvent = pgTable("order_event", {
	id: uuid("id").defaultRandom().primaryKey(),
	orderId: uuid("order_id").notNull(),
	actorId: text("actor_id"),
	fromStatus: orderStatus("from_status"),
	toStatus: orderStatus("to_status").notNull(),
	note: text("note"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
