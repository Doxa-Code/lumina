import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { organizations, organizationMembers, projects } from '../../../infrastructure/database/schema/index.js';
import { eq } from 'drizzle-orm';

export const organizationsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user!;

      const orgSlug = input.name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check if slug already exists
      const existingOrg = await db.query.organizations.findFirst({
        where: eq(organizations.slug, orgSlug),
      });

      if (existingOrg) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An organization with a similar name already exists',
        });
      }

      const [organization] = await db
        .insert(organizations)
        .values({
          name: input.name,
          slug: orgSlug,
        })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
      });

      // Create default production project
      const [project] = await db
        .insert(projects)
        .values({
          organizationId: organization.id,
          name: 'Production',
          slug: 'production',
          environment: 'production',
        })
        .returning();

      return {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: 'OWNER',
        },
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          environment: project.environment,
        },
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
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

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: memberships.find((m) => m.organizationId === org.id)?.role,
    }));
  }),
});
