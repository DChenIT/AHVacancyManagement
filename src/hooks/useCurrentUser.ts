import { useState, useEffect } from 'react';
import { getContext } from '@microsoft/power-apps/app';

export interface CurrentUser {
  email: string;
  displayName: string;
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getContext().then(ctx => {
      setCurrentUser({
        email: ctx.user.userPrincipalName ?? '',
        displayName: ctx.user.fullName ?? ctx.user.userPrincipalName ?? 'Me',
      });
    }).catch(() => {
      setCurrentUser({ email: '', displayName: 'Me' });
    }).finally(() => setLoading(false));
  }, []);

  return { currentUser, loading };
}
