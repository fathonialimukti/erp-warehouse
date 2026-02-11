import { createRouter, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from './routes/__root';
import { Route as indexRoute } from './routes/index';
import { Route as loginRoute } from './routes/login';

interface AuthContext {
  isAuthenticated: boolean;
  user: any | null;
  token: string | null;
}

const routeTree = rootRoute.addChildren([indexRoute, loginRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    auth: undefined! as AuthContext,
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
