import type { Request, Response, NextFunction } from 'express';
import { db } from '../../../infrastructure/database/connection.js';
import { users } from '../../../infrastructure/database/schema/index.js';
import { verifyToken, extractTokenFromHeader } from '../../../infrastructure/auth/index.js';
import { User } from '../../../domain/identity/entities/User.js';
import { Email } from '../../../domain/identity/value-objects/Email.js';
import { eq } from 'drizzle-orm';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    next();
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    next();
    return;
  }

  try {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (dbUser) {
      req.user = User.reconstitute({
        id: dbUser.id,
        email: Email.create(dbUser.email),
        passwordHash: dbUser.passwordHash,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl || undefined,
        emailVerified: dbUser.emailVerified,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
  }

  next();
}
