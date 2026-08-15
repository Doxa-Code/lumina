import type { Request, Response } from 'express';
import type { User } from '../../domain/identity/entities/User.js';
import { db } from '../../infrastructure/database/connection.js';
import { projects, organizationMembers } from '../../infrastructure/database/schema/index.js';
import { eq, and } from 'drizzle-orm';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  environment: string;
}

export interface Context {
  req: Request;
  res: Response;
  user?: User;
  project?: Project;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  const projectId = req.headers['x-project-id'] as string | undefined;
  let project: Project | undefined;

  if (projectId && req.user) {
    const dbProject = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (dbProject) {
      // Verify user has access to this project's organization
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, dbProject.organizationId),
          eq(organizationMembers.userId, req.user.id)
        ),
      });

      if (membership) {
        project = {
          id: dbProject.id,
          organizationId: dbProject.organizationId,
          name: dbProject.name,
          slug: dbProject.slug,
          environment: dbProject.environment,
        };
      }
    }
  }

  return {
    req,
    res,
    user: req.user,
    project,
  };
}
