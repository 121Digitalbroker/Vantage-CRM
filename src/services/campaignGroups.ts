import type { Lead } from '@/types';

export const CAMPAIGN_GROUPS_KEY = 'crm_campaign_groups';

/** Admin-defined display name that rolls up multiple Meta/CSV campaign labels. */
export interface CampaignGroup {
  id: string;
  name: string;
  members: string[];
}

export function campaignLabel(lead: Lead): string {
  const c = (lead.campaignName || '').trim();
  const s = (lead.leadSource || '').trim();
  if (c) return c;
  if (s) return s;
  return 'Not specified';
}

export function loadCampaignGroups(): CampaignGroup[] {
  try {
    const raw = localStorage.getItem(CAMPAIGN_GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (g): g is CampaignGroup =>
          !!g &&
          typeof g === 'object' &&
          typeof (g as CampaignGroup).id === 'string' &&
          typeof (g as CampaignGroup).name === 'string' &&
          Array.isArray((g as CampaignGroup).members)
      )
      .map(g => ({
        id: g.id,
        name: g.name.trim(),
        members: g.members.map(m => String(m).trim()).filter(Boolean),
      }))
      .filter(g => g.name.length > 0);
  } catch {
    return [];
  }
}

export function saveCampaignGroups(groups: CampaignGroup[]): void {
  localStorage.setItem(CAMPAIGN_GROUPS_KEY, JSON.stringify(groups));
}

/** Distinct campaign/source/project labels from leads, sorted. */
export function distinctCampaignLabels(leads: Lead[]): string[] {
  const set = new Set<string>();
  for (const lead of leads) {
    const label = campaignLabel(lead);
    if (label && label !== 'Not specified') set.add(label);
    const project = (lead.project || '').trim();
    if (project) set.add(project);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Map raw label → group display name (exact member match). */
export function groupNameForLabel(label: string, groups: CampaignGroup[]): string | null {
  const ll = label.trim().toLowerCase();
  if (!ll) return null;
  for (const g of groups) {
    if (g.members.some(m => m.trim().toLowerCase() === ll)) return g.name;
  }
  return null;
}

/** Labels already claimed by any group (optionally excluding one group when editing). */
export function claimedMemberLabels(groups: CampaignGroup[], exceptGroupId?: string): Set<string> {
  const claimed = new Set<string>();
  for (const g of groups) {
    if (exceptGroupId && g.id === exceptGroupId) continue;
    for (const m of g.members) claimed.add(m.trim().toLowerCase());
  }
  return claimed;
}

/** Sentinel in Leads project multi-filter: all Admin campaign groups. */
export const PREVIOUS_FILTER_ALL = '__previous__';

/** Sentinel prefix for a single campaign group in the Leads project filter. */
export const PREVIOUS_GROUP_PREFIX = '__prevgrp__:';

export function previousGroupFilterToken(groupId: string): string {
  return `${PREVIOUS_GROUP_PREFIX}${groupId}`;
}

export function isPreviousFilterToken(value: string): boolean {
  return value === PREVIOUS_FILTER_ALL || value.startsWith(PREVIOUS_GROUP_PREFIX);
}

/** Whether a lead belongs to any of the selected Previous group filter tokens. */
export function leadMatchesPreviousFilter(
  lead: Lead,
  filterTokens: string[],
  groups: CampaignGroup[]
): boolean {
  if (filterTokens.length === 0 || groups.length === 0) return false;

  const wantAll = filterTokens.includes(PREVIOUS_FILTER_ALL);
  const selectedIds = new Set(
    filterTokens
      .filter(t => t.startsWith(PREVIOUS_GROUP_PREFIX))
      .map(t => t.slice(PREVIOUS_GROUP_PREFIX.length))
  );
  const selected = wantAll
    ? groups
    : groups.filter(g => selectedIds.has(g.id));
  if (selected.length === 0) return false;

  const project = (lead.project || '').trim().toLowerCase();
  const campaign = (lead.campaignName || '').trim().toLowerCase();
  const label = campaignLabel(lead).trim().toLowerCase();

  for (const g of selected) {
    const gname = g.name.trim().toLowerCase();
    if (project === gname || campaign === gname || label === gname) return true;
    for (const m of g.members) {
      const ml = m.trim().toLowerCase();
      if (!ml) continue;
      if (project === ml || campaign === ml || label === ml) return true;
    }
  }
  return false;
}

/** Display name of the Previous campaign group this lead belongs to, if any. */
export function previousGroupNameForLead(lead: Lead, groups: CampaignGroup[]): string | null {
  if (groups.length === 0) return null;
  const project = (lead.project || '').trim().toLowerCase();
  const campaign = (lead.campaignName || '').trim().toLowerCase();
  const label = campaignLabel(lead).trim().toLowerCase();

  for (const g of groups) {
    const gname = g.name.trim().toLowerCase();
    if (project === gname || campaign === gname || label === gname) return g.name;
    for (const m of g.members) {
      const ml = m.trim().toLowerCase();
      if (!ml) continue;
      if (project === ml || campaign === ml || label === ml) return g.name;
    }
  }
  return null;
}
