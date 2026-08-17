import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../../../infrastructure/database/connection.js';
import {
  projects,
  organizationMembers,
  projectMembers,
  apiKeys,
  users,
} from '../../../infrastructure/database/schema/index.js';
import { eq, and, or, like } from 'drizzle-orm';
import { hashApiKey } from '../../../infrastructure/auth/index.js';
import { ApiKey } from '../../../domain/identity/entities/ApiKey.js';

export const projectsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
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

      const projectList = await db.query.projects.findMany({
        where: eq(projects.organizationId, input.organizationId),
      });

      return projectList.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        environment: p.environment,
        retentionDays: parseInt(p.retentionDays, 10),
        createdAt: p.createdAt,
      }));
    }),

  get: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this organization',
        });
      }

      return {
        id: project.id,
        organizationId: project.organizationId,
        name: project.name,
        slug: project.slug,
        environment: project.environment,
        retentionDays: parseInt(project.retentionDays, 10),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        name: z.string().min(1),
        slug: z.string().min(1).optional(),
        retentionDays: z.number().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to create projects',
        });
      }

      const slug =
        input.slug ||
        input.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

      const existing = await db.query.projects.findFirst({
        where: and(
          eq(projects.organizationId, input.organizationId),
          eq(projects.slug, slug)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Project with this slug already exists',
        });
      }

      const [project] = await db
        .insert(projects)
        .values({
          organizationId: input.organizationId,
          name: input.name,
          slug,
          retentionDays: String(input.retentionDays || 30),
        })
        .returning();

      return {
        id: project.id,
        name: project.name,
        slug: project.slug,
        retentionDays: parseInt(project.retentionDays, 10),
        createdAt: project.createdAt,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).optional(),
        environment: z.enum(['production', 'staging', 'development']).optional(),
        retentionDays: z.number().min(7).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to update this project',
        });
      }

      const updateData: Partial<{
        name: string;
        environment: string;
        retentionDays: string;
        updatedAt: Date;
      }> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.environment !== undefined) {
        updateData.environment = input.environment;
      }
      if (input.retentionDays !== undefined) {
        updateData.retentionDays = String(input.retentionDays);
      }

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, input.projectId))
        .returning();

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        environment: updated.environment,
        retentionDays: parseInt(updated.retentionDays, 10),
        updatedAt: updated.updatedAt,
      };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership || membership.role !== 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only organization owners can delete projects',
        });
      }

      // Delete API keys first
      await db.delete(apiKeys).where(eq(apiKeys.projectId, input.projectId));

      // Delete the project
      await db.delete(projects).where(eq(projects.id, input.projectId));

      return { success: true };
    }),

  createApiKey: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1),
        permissions: z.array(z.enum(['ingest', 'read', 'admin'])).optional(),
        expiresInDays: z.number().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership || membership.role === 'VIEWER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to create API keys',
        });
      }

      const { key, prefix } = ApiKey.generateKey();
      const keyHash = await hashApiKey(key);

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const [apiKey] = await db
        .insert(apiKeys)
        .values({
          projectId: input.projectId,
          name: input.name,
          keyHash,
          keyPrefix: prefix,
          permissions: input.permissions || ['ingest'],
          expiresAt,
          createdBy: ctx.user!.id,
        })
        .returning();

      return {
        id: apiKey.id,
        name: apiKey.name,
        key,
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      };
    }),

  listApiKeys: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this organization',
        });
      }

      const keys = await db.query.apiKeys.findMany({
        where: eq(apiKeys.projectId, input.projectId),
      });

      return keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        permissions: k.permissions,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      }));
    }),

  deleteApiKey: protectedProcedure
    .input(
      z.object({
        keyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, input.keyId),
      });

      if (!apiKey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, apiKey.projectId),
      });

      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, project!.organizationId),
          eq(organizationMembers.userId, ctx.user!.id)
        ),
      });

      if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to delete API keys',
        });
      }

      await db.delete(apiKeys).where(eq(apiKeys.id, input.keyId));

      return { success: true };
    }),

  // ============================================
  // PROJECT MEMBERS MANAGEMENT
  // ============================================

  listMembers: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Check if user has access (org member or project member)
      const hasAccess = await checkProjectAccess(ctx.user!.id, input.projectId, project.organizationId);
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to view project members',
        });
      }

      const members = await db
        .select({
          id: projectMembers.id,
          userId: projectMembers.userId,
          role: projectMembers.role,
          createdAt: projectMembers.createdAt,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, input.projectId));

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
        projectId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).default('VIEWER'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Check if user is admin of the project or org
      const canManage = await canManageProjectMembers(ctx.user!.id, input.projectId, project.organizationId);
      if (!canManage) {
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
      const existingMember = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, userToAdd.id)
        ),
      });

      if (existingMember) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User is already a member of this project',
        });
      }

      const [member] = await db
        .insert(projectMembers)
        .values({
          projectId: input.projectId,
          userId: userToAdd.id,
          role: input.role,
          invitedBy: ctx.user!.id,
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
        role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await db.query.projectMembers.findFirst({
        where: eq(projectMembers.id, input.memberId),
      });

      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, member.projectId),
      });

      const canManage = await canManageProjectMembers(ctx.user!.id, member.projectId, project!.organizationId);
      if (!canManage) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to update member roles',
        });
      }

      const [updated] = await db
        .update(projectMembers)
        .set({ role: input.role })
        .where(eq(projectMembers.id, input.memberId))
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
      const member = await db.query.projectMembers.findFirst({
        where: eq(projectMembers.id, input.memberId),
      });

      if (!member) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, member.projectId),
      });

      const canManage = await canManageProjectMembers(ctx.user!.id, member.projectId, project!.organizationId);
      if (!canManage) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to remove members',
        });
      }

      await db.delete(projectMembers).where(eq(projectMembers.id, input.memberId));

      return { success: true };
    }),

  searchUsers: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2),
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Get existing member IDs to exclude
      const existingMembers = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.projectId));

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

// Helper functions
async function checkProjectAccess(userId: string, projectId: string, organizationId: string): Promise<boolean> {
  // Check org membership
  const orgMember = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId)
    ),
  });

  if (orgMember) return true;

  // Check project membership
  const projectMember = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ),
  });

  return !!projectMember;
}

async function canManageProjectMembers(userId: string, projectId: string, organizationId: string): Promise<boolean> {
  // Org admins/owners can manage
  const orgMember = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId)
    ),
  });

  if (orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role)) {
    return true;
  }

  // Project admins can manage
  const projectMember = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ),
  });

  return projectMember?.role === 'ADMIN';
}
