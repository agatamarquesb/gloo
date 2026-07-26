import { Navigate } from 'react-router';

import { useMe } from '@/hooks/queries/auth';
import { strings } from '@/strings/pt-BR';

import { AppShell } from './AppShell';

export function ProtectedRoute() {
  const { data: user, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted">
        {strings.common.loading}
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}
