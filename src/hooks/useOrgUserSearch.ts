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

export interface OrgSearchResult {
  users: OrgUser[];
  /** Why the list is empty when it isn't simply "no one by that name" - shown instead of a bare "No matches". */
  note?: string;
}

export function useOrgUserSearch() {
  const search = useCallback(async (term: string): Promise<OrgSearchResult> => {
    if (!term.trim()) return { users: [] };
    try {
      const result = await Office365UsersService.SearchUser(term, 25);
      if (result.error || !result.data) {
        const raw = result.error?.message ?? 'no response';
        return { users: [], note: `The directory lookup failed: ${raw.length > 160 ? `${raw.slice(0, 160)}…` : raw}` };
      }
      const users = result.data
        .filter(raw => !isTerminated(raw) && isCompanyDomain(raw))
        .map(mapUser)
        .filter((u): u is OrgUser => u !== null);
      if (users.length === 0 && result.data.length > 0) {
        return { users: [], note: `Found ${result.data.length} in the directory, but none with a ${ALLOWED_EMAIL_DOMAIN} address (or they're marked terminated), so they're hidden.` };
      }
      return { users };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      return { users: [], note: `The directory lookup failed: ${raw.length > 160 ? `${raw.slice(0, 160)}…` : raw}` };
    }
  }, []);

  return { search };
}
