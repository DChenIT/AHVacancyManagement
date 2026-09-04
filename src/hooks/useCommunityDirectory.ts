import { useCallback, useEffect, useState } from 'react';
import { SharePointOnlineService } from '../generated/services/SharePointOnlineService';

// Separate from Dataverse and read live, not imported like the community roster CSV - this
// SharePoint list changes often, so a periodic import would go stale. Confirm the exact list
// display name below once you can check it directly (List Settings -> List name); it's inferred
// here from the Directory *view* URL, which may not be the list's actual display name.
const DIRECTORY_SITE_URL = 'https://humangood.sharepoint.com/sites/AHCommunitiesAnalyst';
const DIRECTORY_LIST_NAME = 'AH Communities';

export interface DirectoryPerson {
  id?: number;
  displayName: string;
  email?: string;
}

export interface DirectoryEntry {
  communityTitle: string;
  rps?: DirectoryPerson;
  rms?: DirectoryPerson;
  director?: DirectoryPerson;
  complianceSpecialist?: DirectoryPerson;
}

// Person/Group columns come back as a lookup-style object ({Id, Value}) per the SharePoint
// connector's documented shape - Value is the display name. Some connector versions also
// surface Email/Claims alongside it; checked defensively here since this can't be verified
// against a real connection from this dev environment (cross-tenant). If email never shows up
// once this runs for real, matching falls back to display-name comparison automatically.
function toPerson(raw: unknown): DirectoryPerson | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const displayName = (r.Value ?? r.DisplayName ?? r.displayName) as string | undefined;
  if (!displayName) return undefined;
  const email = (r.Email ?? r.EMail ?? r.email) as string | undefined;
  const id = (r.Id ?? r.id) as number | undefined;
  return { id, displayName, email };
}

export function personMatchesUser(person: DirectoryPerson | undefined, userEmail?: string, userDisplayName?: string): boolean {
  if (!person) return false;
  if (userEmail && person.email && person.email.toLowerCase() === userEmail.toLowerCase()) return true;
  if (userDisplayName && person.displayName.toLowerCase() === userDisplayName.toLowerCase()) return true;
  return false;
}

export function useCommunityDirectory() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await SharePointOnlineService.GetItems({
        dataset: DIRECTORY_SITE_URL,
        table: DIRECTORY_LIST_NAME,
      });
      if (result.error) {
        setError(result.error.message ?? 'Failed to load community directory');
        setEntries([]);
        return;
      }
      const mapped: DirectoryEntry[] = (result.value ?? [])
        .map((raw): DirectoryEntry => {
          const item = raw as Record<string, unknown>;
          return {
            communityTitle: String(item.Title ?? '').trim(),
            rps: toPerson(item.RPS),
            rms: toPerson(item.RMS),
            director: toPerson(item.Director),
            complianceSpecialist: toPerson(item.ComplianceSpecialist),
          };
        })
        .filter(e => e.communityTitle);
      setEntries(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, loading, error, refresh };
}
