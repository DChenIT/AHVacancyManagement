import { useCallback, useEffect, useState } from 'react';
import { AHCommunitiesService } from '../generated/services/AHCommunitiesService';

// Separate from Dataverse and read live, not imported like the community roster CSV - this
// SharePoint list changes often, so a periodic import would go stale. Confirmed 2026-09-08: the
// SharePoint connector generates one typed service PER LIST (AHCommunitiesService), the same
// per-table pattern as Dataverse - not a single shared SharePointOnlineService.GetItems/table
// call, which is what an earlier attempt at this file incorrectly assumed based on generic
// connector documentation that didn't match this CLI version's actual output.
//
// Person/Group columns (RPS, RMS, Director, ComplianceSpecialist) come back as rich objects with
// DisplayName + Email (see AHCommunitiesModel.ts's *Value interfaces) - real email is available,
// so matching prefers it over display name.

interface PersonField {
  DisplayName?: string;
  Email?: string;
}

export interface DirectoryPerson {
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

function toPerson(raw?: PersonField): DirectoryPerson | undefined {
  if (!raw?.DisplayName) return undefined;
  return { displayName: raw.DisplayName, email: raw.Email || undefined };
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
      // No `select` here (unlike the Dataverse hooks) - the SharePoint connector's field names
      // include special characters requiring bracket access (e.g. "Administrator#Claims"), and
      // this list is small (~100 rows), so fetching full rows and picking out the 4 fields we
      // want client-side avoids any select-syntax guesswork against a connector we can't test
      // directly from dev.
      const result = await AHCommunitiesService.getAll();
      if (result.error) {
        setError(result.error.message ?? 'Failed to load community directory');
        setEntries([]);
        return;
      }
      const mapped: DirectoryEntry[] = (result.data ?? [])
        .map(raw => ({
          communityTitle: (raw.Title ?? '').trim(),
          rps: toPerson(raw.RPS),
          rms: toPerson(raw.RMS),
          director: toPerson(raw.Director),
          complianceSpecialist: toPerson(raw.ComplianceSpecialist),
        }))
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
