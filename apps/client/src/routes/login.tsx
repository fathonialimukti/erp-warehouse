import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import LoginPage from '../login';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({
        to: '/',
      });
    }
  },
  component: LoginPage,
});
