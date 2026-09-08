import { useCallback } from 'react';
import { Office365UsersService } from '../generated/services/Office365UsersService';

// Live-search-only version of the pattern proven out in the sibling Team Leave Calendar project's
// useOrgUsers.ts - no full-alphabet directory sweep (not needed for a type-to-search people
// picker) and no department restriction (that one was specific to Team Leave Calendar's
// IT-only directory; this app needs the full HumanGood staff directory - RPS/RMS/Director/
// Compliance Specialist are not IT roles).

export interface OrgUser {
  id: string;
  displayName: string;
  email: string;
}

interface RawUser {
  Id: string;
  DisplayName?: string;
  Mail?: string;
  UserPrincipalName?: string;
}

// Terminated employees' UPNs carry a ".TRM" marker - see Team Leave Calendar's useOrgUsers.ts.
function isTerminated(u: RawUser): boolean {
  return (u.UserPrincipalName ?? '').toLowerCase().includes('.trm');
}

// Excludes guests/vendors/other non-employee accounts from tenant-wide search. Tenant-specific -
// change (or remove) this when redeploying to a different organization.
const ALLOWED_EMAIL_DOMAIN = '@humangood.org';
function isCompanyDomain(u: RawUser): boolean {
  const email = (u.Mail ?? u.UserPrincipalName ?? '').toLowerCase();
  return email.endsWith(ALLOWED_EMAIL_DOMAIN);
}

function mapUser(u: RawUser): OrgUser | null {
  const email = u.Mail ?? u.UserPrincipalName ?? '';
  if (!email) return null;
  return { id: u.Id, displayName: u.DisplayName ?? email, email };
}

export function useOrgUserSearch() {
  const search = useCallback(async (term: string): Promise<OrgUser[]> => {
    if (!term.trim()) return [];
    const result = await Office365UsersService.SearchUser(term, 25);
    if (result.error || !result.data) return [];
    return result.data
      .filter(raw => !isTerminated(raw) && isCompanyDomain(raw))
      .map(mapUser)
      .filter((u): u is OrgUser => u !== null);
  }, []);

  return { search };
}
