import { TRPCError } from "@trpc/server";
import { catalog, getProduct, orderRequestSchema } from "../domain/print";
import { protectedProcedure, publicProcedure, router } from "../index";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	catalog: publicProcedure.query(() => catalog),
	submitDemoOrder: protectedProcedure
		.input(orderRequestSchema)
		.mutation(async ({ ctx, input }) => {
			const [userLimit, ipLimit] = await Promise.all([
				ctx.rateLimit({
					key: `demo-order:user:${ctx.session.user.id}`,
					windowMs: 60 * 60 * 1_000,
					max: 10,
				}),
				ctx.rateLimit({
					key: `demo-order:ip:${ctx.clientIp}`,
					windowMs: 60 * 60 * 1_000,
					max: 25,
				}),
			]);
			const retryAfterSeconds = Math.max(
				userLimit.retryAfterSeconds,
				ipLimit.retryAfterSeconds,
			);
			if (!userLimit.allowed || !ipLimit.allowed) {
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message: `Too many demo requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
				});
			}
			if (!getProduct(input.productId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Unknown product",
				});
			}
			const orderId = `demo-${crypto.randomUUID()}`;
			console.info("Demo order request received", {
				orderId,
				designId: input.designId,
				productId: input.productId,
				quantity: input.quantity,
			});
			return {
				orderId,
				status: "received" as const,
				message:
					"Your demo request is ready for review. No payment has been taken.",
			};
		}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
});
export type AppRouter = typeof appRouter;
