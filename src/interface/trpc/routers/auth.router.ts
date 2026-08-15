import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { users, organizations, organizationMembers, projects } from '../../../infrastructure/database/schema/index.js';
import { hashPassword, verifyPassword, generateToken } from '../../../infrastructure/auth/index.js';
import { eq } from 'drizzle-orm';

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        organizationName: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already registered',
        });
      }

      const passwordHash = await hashPassword(input.password);

      const [user] = await db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
        })
        .returning();

      const orgName = input.organizationName || `${input.name}'s Organization`;
      const orgSlug = orgName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const [organization] = await db
        .insert(organizations)
        .values({
          name: orgName,
          slug: orgSlug,
        })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
      });

      const [project] = await db
        .insert(projects)
        .values({
          organizationId: organization.id,
          name: 'Production',
          slug: 'production',
          environment: 'production',
        })
        .returning();

      const token = generateToken({ userId: user.id });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
        },
        token,
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      const memberships = await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.userId, user.id),
      });

      const orgs = await db.query.organizations.findMany({
        where: (org, { inArray }) =>
          inArray(
            org.id,
            memberships.map((m) => m.organizationId)
          ),
      });

      const token = generateToken({ userId: user.id });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        organizations: orgs.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: memberships.find((m) => m.organizationId === org.id)?.role,
        })),
        token,
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user!;

    const memberships = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, user.id),
    });

    const orgs = await db.query.organizations.findMany({
      where: (org, { inArray }) =>
        inArray(
          org.id,
          memberships.map((m) => m.organizationId)
        ),
    });

    return {
      user: user.toJSON(),
      organizations: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: memberships.find((m) => m.organizationId === org.id)?.role,
      })),
    };
  }),
});
