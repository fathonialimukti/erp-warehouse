import { Navigate } from "react-router";
import { useAtomValue } from "jotai";
import { authBootstrapReadyAtom, isAuthenticatedAtom } from "../lib/atoms";
import type { ReactNode } from "react";

type ProtectedRouteProps = {
  children: ReactNode;
};

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const authBootstrapReady = useAtomValue(authBootstrapReadyAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  if (!authBootstrapReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export { ProtectedRoute };
