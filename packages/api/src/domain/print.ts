import { z } from "zod";

export const productKinds = [
	"classic-print",
	"square-print",
	"photo-strip",
	"poster",
	"framed-print",
] as const;

export type ProductKind = (typeof productKinds)[number];

export const productVariantSchema = z.object({
	id: z.string().trim().min(1).max(80),
	kind: z.enum(productKinds),
	name: z.string().min(1).max(80),
	description: z.string().min(1).max(240),
	widthMm: z.number().positive(),
	heightMm: z.number().positive(),
	finish: z.string().min(1).max(60),
	startingPriceLabel: z.string().min(1).max(60),
	qualityDpi: z.number().int().min(72).max(1200).default(300),
	bleedMm: z.number().min(0).max(20).default(3),
});

export type ProductVariant = z.infer<typeof productVariantSchema>;

export const designElementSchema = z.discriminatedUnion("type", [
	z.object({
		id: z.string().trim().min(1).max(128),
		type: z.literal("image"),
		assetId: z.string().trim().min(1).max(128),
		x: z.number().finite().min(-100_000).max(100_000),
		y: z.number().finite().min(-100_000).max(100_000),
		width: z.number().finite().positive().max(10_000),
		height: z.number().finite().positive().max(10_000),
		rotation: z.number().finite().min(-360_000).max(360_000),
		cropX: z.number().finite().min(0).max(1),
		cropY: z.number().finite().min(0).max(1),
		cropWidth: z.number().finite().positive().max(1),
		cropHeight: z.number().finite().positive().max(1),
	}),
	z.object({
		id: z.string().trim().min(1).max(128),
		type: z.literal("text"),
		text: z.string().min(1).max(240),
		x: z.number().finite().min(-100_000).max(100_000),
		y: z.number().finite().min(-100_000).max(100_000),
		width: z.number().finite().positive().max(10_000).optional(),
		height: z.number().finite().positive().max(10_000).optional(),
		fontSize: z.number().finite().positive().max(400),
		color: z.string().min(1).max(40),
		rotation: z.number().finite().min(-360_000).max(360_000),
	}),
	z.object({
		id: z.string().trim().min(1).max(128),
		type: z.literal("shape"),
		shape: z.enum(["rectangle", "circle", "triangle", "star", "blob", "line"]),
		x: z.number().finite().min(-100_000).max(100_000),
		y: z.number().finite().min(-100_000).max(100_000),
		width: z.number().finite().positive().max(10_000),
		height: z.number().finite().positive().max(10_000),
		fill: z.string().min(1).max(40),
		rotation: z.number().finite().min(-360_000).max(360_000),
	}),
]);

export type DesignElement = z.infer<typeof designElementSchema>;

export const designDocumentSchema = z.object({
	schemaVersion: z.literal(1),
	id: z.string().trim().min(1).max(128),
	productId: z.string().trim().min(1).max(80),
	width: z.number().finite().positive().max(10_000),
	height: z.number().finite().positive().max(10_000),
	background: z.string().min(1).max(40),
	elements: z.array(designElementSchema).max(100),
	updatedAt: z.string().datetime(),
});

export type DesignDocument = z.infer<typeof designDocumentSchema>;

export const orderRequestSchema = z.object({
	designId: z.string().trim().min(1).max(128),
	productId: z.string().trim().min(1).max(80),
	quantity: z.number().int().min(1).max(100),
	contactName: z.string().trim().min(2).max(80),
	contactEmail: z.string().email().max(254),
	notes: z.string().trim().max(1000).default(""),
});

export type OrderRequest = z.infer<typeof orderRequestSchema>;

export const catalog: readonly ProductVariant[] = [
	{
		id: "classic-10x15",
		kind: "classic-print",
		name: "Classic print",
		description:
			"A timeless 10 × 15 cm print for albums, frames, and the fridge.",
		widthMm: 100,
		heightMm: 150,
		finish: "Soft-touch matte",
		startingPriceLabel: "Demo request",
		qualityDpi: 300,
		bleedMm: 3,
	},
	{
		id: "square-10x10",
		kind: "square-print",
		name: "Square print",
		description:
			"A balanced square format that gives everyday photos a gallery feel.",
		widthMm: 100,
		heightMm: 100,
		finish: "Textured matte",
		startingPriceLabel: "Demo request",
		qualityDpi: 300,
		bleedMm: 3,
	},
	{
		id: "strip-5x15",
		kind: "photo-strip",
		name: "Photo strip",
		description:
			"Three small frames in one keepsake, made for weekends and celebrations.",
		widthMm: 50,
		heightMm: 150,
		finish: "Satin photo paper",
		startingPriceLabel: "Demo request",
		qualityDpi: 300,
		bleedMm: 3,
	},
	{
		id: "poster-a3",
		kind: "poster",
		name: "A3 poster",
		description:
			"A statement-sized print for a wall, studio, or thoughtful gift.",
		widthMm: 297,
		heightMm: 420,
		finish: "Museum matte",
		startingPriceLabel: "Demo request",
		qualityDpi: 240,
		bleedMm: 5,
	},
	{
		id: "framed-20x30",
		kind: "framed-print",
		name: "Framed print",
		description:
			"A ready-to-display 20 × 30 cm print with a quiet oak frame preview.",
		widthMm: 200,
		heightMm: 300,
		finish: "Fine-art matte",
		startingPriceLabel: "Demo request",
		qualityDpi: 240,
		bleedMm: 5,
	},
] as const;

export function getProduct(productId: string): ProductVariant | undefined {
	return catalog.find((product) => product.id === productId);
}
