import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

/** Auth guard stub — always renders children in M0. */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
