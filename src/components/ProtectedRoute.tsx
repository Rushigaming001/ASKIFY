import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminGuard } from '@/lib/security';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedAdminRoute({ children }: ProtectedRouteProps) {
  const { isAuthorized, checking } = useAdminGuard();
  const navigate = useNavigate();

  useEffect(() => {
    if (!checking && !isAuthorized) {
      navigate('/', { replace: true });
    }
  }, [checking, isAuthorized, navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
