import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import { organizations, organizationMembers, projects, users } from '../../../infrastructure/database/schema/index.js';
import { eq, and, or, like } from 'drizzle-orm';

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

  // ============================================
  // ORGANIZATION MEMBERS MANAGEMENT
  // ============================================

  listMembers: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check if user is member of the organization
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this organization',
        });
      }

      const members = await db
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
          createdAt: organizationMembers.createdAt,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(eq(organizationMembers.organizationId, input.organizationId));

      return members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: {
          name: m.userName,
          email: m.userEmail,
          avatarUrl: m.userAvatar,
        },
      }));
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin/owner of the organization
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to add members',
        });
      }

      // Find user by email
      const userToAdd = await db.query.users.findFirst({
        where: eq(users.email, input.email),
      });

      if (!userToAdd) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found with this email',
        });
      }

      // Check if already a member
      const existingMember = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.userId, userToAdd.id)
        ),
      });

      if (existingMember) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User is already a member of this organization',
        });
      }

      const [member] = await db
        .insert(organizationMembers)
        .values({
          organizationId: input.organizationId,
          userId: userToAdd.id,
          role: input.role,
        })
        .returning();

      return {
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        user: {
          name: userToAdd.name,
          email: userToAdd.email,
          avatarUrl: userToAdd.avatarUrl,
        },
      };
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        memberId: z.string().uuid(),
        role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await db.query.organizationMembers.findFirst({
        where: eq(organizationMembers.id, input.memberId),
      });

      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }

      // Cannot change owner role
      if (member.role === 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot change owner role',
        });
      }

      // Check if user is admin/owner
      const currentUserMembership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, member.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!currentUserMembership || !['OWNER', 'ADMIN'].includes(currentUserMembership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to update member roles',
        });
      }

      const [updated] = await db
        .update(organizationMembers)
        .set({ role: input.role })
        .where(eq(organizationMembers.id, input.memberId))
        .returning();

      return {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
      };
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        memberId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await db.query.organizationMembers.findFirst({
        where: eq(organizationMembers.id, input.memberId),
      });

      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }

      // Cannot remove owner
      if (member.role === 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot remove organization owner',
        });
      }

      // Check if user is admin/owner
      const currentUserMembership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, member.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!currentUserMembership || !['OWNER', 'ADMIN'].includes(currentUserMembership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to remove members',
        });
      }

      await db.delete(organizationMembers).where(eq(organizationMembers.id, input.memberId));

      return { success: true };
    }),

  searchUsers: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2),
        organizationId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get existing member IDs to exclude
      const existingMembers = await db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, input.organizationId));

      const existingUserIds = existingMembers.map((m) => m.userId);

      // Search users by name or email
      const foundUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          or(
            like(users.email, `%${input.query}%`),
            like(users.name, `%${input.query}%`)
          )
        )
        .limit(10);

      // Filter out existing members
      return foundUsers.filter((u) => !existingUserIds.includes(u.id));
    }),
});
