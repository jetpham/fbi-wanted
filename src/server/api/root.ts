import { fbiRouter } from "~/server/api/routers/fbi";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  fbi: fbiRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.fbi.getAllWithImages();
 *       ^? Array<{ image: WantedImage; name: string; detailUrl: string }>
 */
export const createCaller = createCallerFactory(appRouter);
