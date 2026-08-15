import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../interface/trpc/router.js';

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient(getProjectId: () => string | null) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        transformer: superjson,
        headers() {
          const headers: Record<string, string> = {};
          const token = localStorage.getItem('token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const projectId = getProjectId();
          if (projectId) {
            headers['x-project-id'] = projectId;
          }
          return headers;
        },
      }),
    ],
  });
}
