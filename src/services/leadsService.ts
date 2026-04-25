/**
 * Supabase CRUD service for the `leads` table.
 *
 * When `VITE_USE_DEMO_LEADS=true` (default in .env for local dev), leads are
 * read/written in browser localStorage via `demoLeadsStore` so assignment
 * works without Supabase Row Level Security blocking updates.
 *
 * Set `VITE_USE_DEMO_LEADS=false` to use Supabase only (requires RLS policies
 * — see `supabase-rls-leads.sql`).
 */
import { supabase } from '../lib/supabaseClient';
import { Lead, LeadStatus, LeadLevel } from '@/types';
import {
  demoFetchLeads,
  demoFetchLead,
  demoCreateLead,
  demoUpdateLead,
  demoAssignLead,
  demoDeleteLead,
  demoGetNotes,
  demoAddNote,
  demoGetFollowUps,
  demoAddFollowUp,
  demoDeleteFollowUp,
  demoCompleteFollowUp,
  demoGetAssignmentHistory,
  demoLogAssignment,
  demoGetStatusHistory,
  demoLogStatusChange,
} from '@/src/services/demoLeadsStore';
import type { DemoNote, DemoFollowUp, AssignmentHistory, StatusHistory } from '@/src/services/demoLeadsStore';
import { notificationService } from '@/src/services/notificationService';

const VALID_STATUSES: LeadStatus[] = [
  'New', 'Interested', 'Site Visit Scheduled', 'Busy', 'Not Reachable', 'Fake Query',
  'Not Interested', 'Wrong Number', 'Low Budget',
];

/** Map old CRM status strings from DB/imports to current statuses */
function normalizeLeadStatus(raw: string): LeadStatus {
  const s = String(raw ?? '').trim();
  if ((VALID_STATUSES as readonly string[]).includes(s)) return s as LeadStatus;
  const legacy: Record<string, LeadStatus> = {
    Contacted: 'Interested',
    'Visit Completed': 'Site Visit Scheduled',
    Negotiation: 'Interested',
    Booked: 'Site Visit Scheduled',
  };
  return legacy[s] ?? 'New';
}

const VALID_LEVELS: LeadLevel[] = ['Hot', 'Warm', 'Cold'];

function normalizePhoneForMatch(phone: string): string {
  const digits = String(phone ?? '').replace(/\D+/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeNameForMatch(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Use local demo store (no Supabase writes). Default true so assignment always works locally. */
export function useDemoLeads(): boolean {
  const v = import.meta.env.VITE_USE_DEMO_LEADS;
  return v !== 'false' && v !== '0';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToLead(row: Record<string, any>): Lead {
  const rawStatus = normalizeLeadStatus(String(row.status ?? ''));
  const rawLevel  = String(row.lead_level ?? '');

  return {
    id:              String(row.id ?? ''),
    clientName:      String(row.name  ?? ''),
    phoneNumber:     String(row.phone ?? ''),
    email:           row.email   ?? undefined,
    project:         String(row.project ?? ''),
    leadSource:      String(row.source  ?? ''),
    campaignName:    row.campaign_name  ?? undefined,
    campaignId:      row.campaign_id    ?? undefined,
    adsetName:       row.adset_name     ?? undefined,
    adsetId:         row.adset_id       ?? undefined,
    adName:          row.ad_name        ?? undefined,
    adId:            row.ad_id          ?? undefined,
    formName:        row.form_name      ?? undefined,
    formId:          row.form_id        ?? undefined,
    isOrganic:       row.is_organic     ?? undefined,
    assignedUserId:  String(row.assigned_to ?? ''),
    leadLevel:       VALID_LEVELS.includes(rawLevel  as LeadLevel)  ? (rawLevel  as LeadLevel)  : 'Cold',
    status:          rawStatus,
    followUpDate:    row.follow_up_date   ?? new Date().toISOString(),
    lastContactedAt: row.last_contacted_at ?? undefined,
    createdAt:       row.created_at        ?? new Date().toISOString(),
    investmentBudget: row.investment_budget ?? undefined,
    city:            row.city              ?? undefined,
    bestTimeToContact: row.best_time_to_contact ?? undefined,
    planningToBuy:   row.planning_to_buy   ?? undefined,
    facebookLeadId:  row.facebook_lead_id  ?? undefined,
    // Assignment timer fields
    assignedAt:      row.assigned_at        ?? undefined,
    lastStatusUpdate: row.last_status_update ?? undefined,
    assignmentExpiresAt: row.assignment_expires_at ?? undefined,
  };
}

function mapToRow(updates: Partial<Lead>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.clientName       !== undefined) row.name                 = updates.clientName;
  if (updates.phoneNumber      !== undefined) row.phone                = updates.phoneNumber;
  if (updates.email            !== undefined) row.email                = updates.email;
  if (updates.project          !== undefined) row.project              = updates.project;
  if (updates.leadSource       !== undefined) row.source               = updates.leadSource;
  if (updates.campaignName     !== undefined) row.campaign_name        = updates.campaignName;
  if (updates.campaignId       !== undefined) row.campaign_id          = updates.campaignId;
  if (updates.adsetName        !== undefined) row.adset_name           = updates.adsetName;
  if (updates.adsetId          !== undefined) row.adset_id             = updates.adsetId;
  if (updates.adName           !== undefined) row.ad_name              = updates.adName;
  if (updates.adId             !== undefined) row.ad_id                = updates.adId;
  if (updates.formName         !== undefined) row.form_name            = updates.formName;
  if (updates.formId           !== undefined) row.form_id              = updates.formId;
  if (updates.isOrganic        !== undefined) row.is_organic           = updates.isOrganic;
  if (updates.assignedUserId   !== undefined) row.assigned_to          = updates.assignedUserId;
  if (updates.leadLevel        !== undefined) row.lead_level           = updates.leadLevel;
  if (updates.status           !== undefined) row.status               = updates.status;
  if (updates.followUpDate     !== undefined) row.follow_up_date       = updates.followUpDate;
  if (updates.lastContactedAt  !== undefined) row.last_contacted_at    = updates.lastContactedAt;
  if (updates.investmentBudget !== undefined) row.investment_budget    = updates.investmentBudget;
  if (updates.city             !== undefined) row.city                 = updates.city;
  if (updates.bestTimeToContact !== undefined) row.best_time_to_contact = updates.bestTimeToContact;
  if (updates.planningToBuy    !== undefined) row.planning_to_buy      = updates.planningToBuy;
  if (updates.facebookLeadId   !== undefined) row.facebook_lead_id     = updates.facebookLeadId;
  // Assignment timer fields
  if (updates.assignedAt       !== undefined) row.assigned_at          = updates.assignedAt;
  if (updates.lastStatusUpdate !== undefined) row.last_status_update   = updates.lastStatusUpdate;
  if (updates.assignmentExpiresAt !== undefined) row.assignment_expires_at = updates.assignmentExpiresAt;
  return row;
}

/** Fetch all leads. Pass `assignedToUserId` to filter by telecaller. */
export async function fetchLeads(assignedToUserId?: string): Promise<Lead[]> {
  if (useDemoLeads()) return demoFetchLeads(assignedToUserId);

  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (assignedToUserId) {
    query = query.eq('assigned_to', assignedToUserId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapToLead);
}

/** Update arbitrary fields on a lead. */
export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  // If status is being updated, mark the time
  if (updates.status !== undefined) {
    updates.lastStatusUpdate = new Date().toISOString();
    // Any pipeline status change counts as engagement for "Last contacted"
    if (updates.lastContactedAt === undefined) {
      updates.lastContactedAt = new Date().toISOString();
    }
  }

  if (useDemoLeads()) return demoUpdateLead(id, updates);

  const { data, error } = await supabase
    .from('leads')
    .update(mapToRow(updates))
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapToLead(data);
}

/** Update a lead and log status change (who + when) if status changed. */
export async function updateLeadWithAudit(
  id: string,
  updates: Partial<Lead>,
  updatedBy: string = 'system'
): Promise<Lead> {
  const prev = updates.status !== undefined ? await fetchLead(id) : null;
  const updated = await updateLead(id, updates);

  if (updates.status !== undefined && prev && prev.status !== updated.status) {
    await logStatusChange(id, prev.status, updated.status, updatedBy);
  }

  return updated;
}

/** Assign a lead to a telecaller, or clear assignment when `userId` is empty. */
export async function assignLead(leadId: string, userId: string, assignedBy: string = 'system'): Promise<void> {
  const currentLead = await fetchLead(leadId);
  const previousUserId = currentLead?.assignedUserId || '';
  const isUnassign = !userId?.trim();

  const timerMinutes = parseInt(localStorage.getItem('crm_assignment_timer_minutes') || '60', 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timerMinutes * 60 * 1000);

  const assignmentUpdate: Partial<Lead> = isUnassign
    ? {
        assignedUserId: '',
        assignedAt: undefined,
        assignmentExpiresAt: undefined,
        lastStatusUpdate: undefined,
      }
    : {
        assignedUserId: userId,
        assignedAt: now.toISOString(),
        assignmentExpiresAt: expiresAt.toISOString(),
        lastStatusUpdate: undefined,
      };

  const nextUserId = isUnassign ? '' : userId;

  if (useDemoLeads()) {
    await demoUpdateLead(leadId, assignmentUpdate);
  } else {
    const { error } = await supabase
      .from('leads')
      .update(
        isUnassign
          ? {
              assigned_to: null,
              assigned_at: null,
              assignment_expires_at: null,
              last_status_update: null,
            }
          : {
              assigned_to: userId,
              assigned_at: assignmentUpdate.assignedAt,
              assignment_expires_at: assignmentUpdate.assignmentExpiresAt,
              last_status_update: null,
            }
      )
      .eq('id', leadId);
    if (error) throw new Error(error.message);
  }

  if (previousUserId !== nextUserId) {
    await logAssignment(leadId, previousUserId, nextUserId, assignedBy);
  }

  if (currentLead && !isUnassign) {
    notificationService.notifyLeadAssignment(leadId, currentLead.name || 'Unknown Lead', userId, assignedBy);
  }
}

/** Fetch a single lead by id. */
export async function fetchLead(id: string): Promise<Lead | null> {
  if (useDemoLeads()) return demoFetchLead(id);

  const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
  if (error) return null;
  return mapToLead(data);
}

/** Create a new lead. */
export async function createLead(lead: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead> {
  if (useDemoLeads()) return demoCreateLead(lead);

  const { data, error } = await supabase
    .from('leads')
    .insert(mapToRow(lead as Partial<Lead>))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapToLead(data);
}

/** Create a new lead with custom createdAt (for imports). */
export async function createLeadWithDate(lead: Omit<Lead, 'id'> & { createdAt: string }): Promise<Lead> {
  if (useDemoLeads()) return demoCreateLead(lead);

  const row = mapToRow(lead as Partial<Lead>);
  row.created_at = lead.createdAt;

  const { data, error } = await supabase
    .from('leads')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapToLead(data);
}

export async function findLeadByNameAndPhone(clientName: string, phoneNumber: string): Promise<Lead | null> {
  const cleanPhone = normalizePhoneForMatch(phoneNumber);
  const normalizedName = normalizeNameForMatch(clientName);

  if (!cleanPhone || !normalizedName) return null;

  if (useDemoLeads()) {
    const leads = await demoFetchLeads();
    return leads.find(l =>
      normalizePhoneForMatch(l.phoneNumber) === cleanPhone
      && normalizeNameForMatch(l.clientName) === normalizedName
    ) ?? null;
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*');
  if (error) return null;
  const rows = (data ?? []).map(mapToLead);
  return rows.find(l =>
    normalizePhoneForMatch(l.phoneNumber) === cleanPhone
    && normalizeNameForMatch(l.clientName) === normalizedName
  ) ?? null;
}

/** Check if a lead already exists by facebookLeadId or by exact name+phone pair. */
export async function checkDuplicateLead(
  facebookLeadId?: string,
  phoneNumber?: string,
  clientName?: string
): Promise<boolean> {
  if (useDemoLeads()) {
    const leads = await demoFetchLeads();
    if (facebookLeadId) {
      if (leads.some(l => l.facebookLeadId === facebookLeadId)) return true;
    }
    if (phoneNumber && clientName?.trim()) {
      const cleanPhone = normalizePhoneForMatch(phoneNumber);
      const normalizedName = normalizeNameForMatch(clientName);
      if (leads.some(l =>
        normalizePhoneForMatch(l.phoneNumber) === cleanPhone
        && normalizeNameForMatch(l.clientName) === normalizedName
      )) return true;
    }
    return false;
  }

  if (facebookLeadId) {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('facebook_lead_id', facebookLeadId);
    if ((count ?? 0) > 0) return true;
  }

  if (phoneNumber && clientName?.trim()) {
    const cleanPhone = normalizePhoneForMatch(phoneNumber);
    const normalizedName = normalizeNameForMatch(clientName);
    const { data, error } = await supabase
      .from('leads')
      .select('name, phone');
    if (!error && (data ?? []).some(row =>
      normalizePhoneForMatch(String(row.phone ?? '')) === cleanPhone
      && normalizeNameForMatch(String(row.name ?? '')) === normalizedName
    )) {
      return true;
    }
  }

  return false;
}

/** Delete a lead. */
export async function deleteLead(id: string): Promise<void> {
  if (useDemoLeads()) return demoDeleteLead(id);

  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Notes & Follow-ups (demo-only; extend for Supabase later) ───────────────
export type { DemoNote, DemoFollowUp, AssignmentHistory, StatusHistory };

export async function getNotes(leadId: string): Promise<DemoNote[]> {
  return demoGetNotes(leadId);
}

export async function addNote(leadId: string, content: string, userName: string): Promise<DemoNote> {
  const note = await demoAddNote(leadId, content, userName);
  const now = new Date().toISOString();
  // Persist last contacted on the lead (notes were only in local store; DB must still update)
  if (useDemoLeads()) {
    await demoUpdateLead(leadId, { lastContactedAt: now });
  } else {
    await updateLead(leadId, { lastContactedAt: now });
  }
  return note;
}

export async function getFollowUps(leadId: string): Promise<DemoFollowUp[]> {
  return demoGetFollowUps(leadId);
}

export async function addFollowUp(
  leadId: string,
  data: { type: string; date: string; notes: string },
  userName: string
): Promise<DemoFollowUp> {
  const fu = await demoAddFollowUp(leadId, data, userName);
  const now = new Date().toISOString();
  // Update follow-up date and last contacted (scheduling counts as engagement)
  if (useDemoLeads()) {
    await demoUpdateLead(leadId, { followUpDate: data.date, lastContactedAt: now });
  } else {
    await updateLead(leadId, { followUpDate: data.date, lastContactedAt: now });
  }
  return fu;
}

export async function deleteFollowUp(followUpId: string): Promise<void> {
  return demoDeleteFollowUp(followUpId);
}

export async function completeFollowUp(followUpId: string, leadId: string): Promise<DemoFollowUp> {
  const fu = await demoCompleteFollowUp(followUpId);
  // Update the lead's lastContactedAt
  if (useDemoLeads()) {
    await demoUpdateLead(leadId, { lastContactedAt: new Date().toISOString() });
  } else {
    await updateLead(leadId, { lastContactedAt: new Date().toISOString() });
  }
  return fu;
}

// ── Assignment History ────────────────────────────────────────────────────────
export async function getAssignmentHistory(leadId: string): Promise<AssignmentHistory[]> {
  return demoGetAssignmentHistory(leadId);
}

export async function logAssignment(
  leadId: string,
  fromUserId: string,
  toUserId: string,
  assignedBy: string,
  reason?: string
): Promise<AssignmentHistory> {
  return demoLogAssignment(leadId, fromUserId, toUserId, assignedBy, reason);
}

export async function getStatusHistory(leadId: string): Promise<StatusHistory[]> {
  return demoGetStatusHistory(leadId);
}

export async function logStatusChange(
  leadId: string,
  fromStatus: LeadStatus,
  toStatus: LeadStatus,
  updatedBy: string
): Promise<StatusHistory> {
  return demoLogStatusChange(leadId, fromStatus, toStatus, updatedBy);
}

// ── Assignment Timer Functions ───────────────────────────────────────────────
/**
 * Check if a lead's assignment has expired (1 hour passed without status update)
 */
export function isAssignmentExpired(lead: Lead): boolean {
  if (!lead.assignmentExpiresAt || !lead.assignedAt) return false;
  if (lead.lastStatusUpdate) return false; // Status was updated, timer is stopped

  const now = new Date();
  const expiresAt = new Date(lead.assignmentExpiresAt);
  return now > expiresAt;
}

/**
 * Get all leads with expired assignments
 */
export async function getExpiredAssignments(): Promise<Lead[]> {
  const leads = await fetchLeads();
  return leads.filter(lead => 
    lead.assignedUserId && 
    isAssignmentExpired(lead)
  );
}

/**
 * Auto-reassign an expired lead to another available telecaller
 */
export async function autoReassignExpiredLead(
  lead: Lead,
  availableTelecallers: { id: string; name: string }[],
  adminName: string = 'System'
): Promise<void> {
  if (availableTelecallers.length === 0) {
    console.warn('No available telecallers for reassignment');
    // Notify admin that no telecallers available
    notificationService.notifyTimerExpired(lead.id, lead.name || 'Unknown Lead', 'Unknown');
    return;
  }

  // Send notification to admin about expired assignment
  const previousTelecaller = availableTelecallers.find(t => t.id === lead.assignedUserId)?.name || 'Unknown Telecaller';
  notificationService.notifyTimerExpired(lead.id, lead.name || 'Unknown Lead', previousTelecaller);

  // Find telecaller with least leads or pick next in rotation
  const nextTelecaller = availableTelecallers[0]; // Simple: pick first available
  
  await assignLead(lead.id, nextTelecaller.id, adminName);
  await logAssignment(
    lead.id,
    lead.assignedUserId,
    nextTelecaller.id,
    adminName,
    'Auto-reassigned due to expired assignment (1 hour)'
  );
}

/** Export leads to CSV and trigger download. */
export function exportLeadsCSV(leads: Lead[], getUserName: (id: string) => string) {
  const headers = [
    'Client Name', 'Phone', 'Email', 'Project', 'Source', 'Campaign',
    'Assigned To', 'Level', 'Status', 'Follow-up Date', 'Last Contacted', 'Created',
  ];
  const rows = leads.map(l => [
    l.clientName, l.phoneNumber, l.email ?? '', l.project, l.leadSource,
    l.campaignName ?? '', getUserName(l.assignedUserId), l.leadLevel, l.status,
    l.followUpDate, l.lastContactedAt ?? '', l.createdAt,
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
