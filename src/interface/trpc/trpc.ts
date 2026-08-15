import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const hasProject = middleware(async ({ ctx, next }) => {
  if (!ctx.project) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Project not specified',
    });
  }
  return next({
    ctx: {
      ...ctx,
      project: ctx.project,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
export const projectProcedure = t.procedure.use(isAuthenticated).use(hasProject);
