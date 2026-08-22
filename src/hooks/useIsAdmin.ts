import { useEffect, useState } from 'react';
import { SystemusersService } from '../generated/services/SystemusersService';
import { RolesService } from '../generated/services/RolesService';

const ADMIN_ROLE_NAME = 'APP - AH Vacancy Management Admin';

// Real Dataverse-backed privilege check, replacing the old hardcoded email allow-list.
// Resolves the signed-in user's systemuserid from their UPN, then checks whether they
// have the ADMIN_ROLE_NAME security role via the systemuserroles_association N:N
// relationship (queried with an OData `any()` lambda filter - the generated SDK doesn't
// support $expand, but a plain filter string works fine for this).
export function useIsAdmin(email: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const userResult = await SystemusersService.getAll({
          select: ['systemuserid'],
          filter: `domainname eq '${email.replace(/'/g, "''")}'`,
          top: 1,
        } as any);
        const userId = userResult.data?.[0]?.systemuserid;
        if (!userId) {
          if (!cancelled) { setIsAdmin(false); setLoading(false); }
          return;
        }

        const roleResult = await RolesService.getAll({
          select: ['roleid'],
          filter: `name eq '${ADMIN_ROLE_NAME}' and systemuserroles_association/any(u:u/systemuserid eq ${userId})`,
          top: 1,
        } as any);
        if (!cancelled) {
          setIsAdmin((roleResult.data?.length ?? 0) > 0);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setIsAdmin(false); setLoading(false); }
      }
    }

    check();
    return () => { cancelled = true; };
  }, [email]);

  return { isAdmin, loading };
}
