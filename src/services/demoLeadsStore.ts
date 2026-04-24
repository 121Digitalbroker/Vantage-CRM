import type { Lead } from '@/types';
import { DEMO_LEADS_SEED } from '@/src/data/demoLeadsSeed';

const STORAGE_KEY = 'crm_demo_leads';
const NOTES_KEY   = 'crm_demo_notes';
const FOLLOWUP_KEY = 'crm_demo_followups';
const ASSIGNMENT_HISTORY_KEY = 'crm_assignment_history';
const STATUS_HISTORY_KEY = 'crm_status_history';

const LEGACY_STATUS_MAP: Record<string, Lead['status']> = {
  Contacted: 'Interested',
  'Visit Completed': 'Site Visit Scheduled',
  Negotiation: 'Interested',
  Booked: 'Site Visit Scheduled',
};
const VALID_STATUSES: Lead['status'][] = [
  'New',
  'Interested',
  'Site Visit Scheduled',
  'Busy',
  'Not Reachable',
  'Fake Query',
  'Not Interested',
  'Wrong Number',
  'Low Budget',
];

export interface DemoNote {
  id: string;
  leadId: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface DemoFollowUp {
  id: string;
  leadId: string;
  type: string;
  date: string;
  notes: string;
  completed: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AssignmentHistory {
  id: string;
  leadId: string;
  fromUserId: string;
  toUserId: string;
  assignedBy: string;
  createdAt: string;
  reason?: string;
}

export interface StatusHistory {
  id: string;
  leadId: string;
  fromStatus: Lead['status'];
  toStatus: Lead['status'];
  updatedBy: string;
  createdAt: string;
}

function cloneLeads(leads: Lead[]): Lead[] {
  return leads.map(l => ({ ...l }));
}

function normalizeLeadStatus(status: string): Lead['status'] {
  if (VALID_STATUSES.includes(status as Lead['status'])) return status as Lead['status'];
  return LEGACY_STATUS_MAP[status] ?? 'New';
}

function normalizeLeadSchema(lead: Lead): Lead {
  return {
    ...lead,
    status: normalizeLeadStatus(String(lead.status ?? '')),
  };
}

function load(): Lead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Lead[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(normalizeLeadSchema);
        const hadLegacyStatus = parsed.some((lead, index) => lead.status !== normalized[index].status);
        if (hadLegacyStatus) save(normalized);
        return normalized;
      }
    }
  } catch { /* ignore */ }
  const seed = cloneLeads(DEMO_LEADS_SEED).map(normalizeLeadSchema);
  save(seed);
  return seed;
}

function save(leads: Lead[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch { /* ignore */ }
}

function loadNotes(): DemoNote[] {
  try { const raw = localStorage.getItem(NOTES_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveNotes(n: DemoNote[]) {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(n)); } catch { /* ignore */ }
}

function loadFollowUps(): DemoFollowUp[] {
  try { const raw = localStorage.getItem(FOLLOWUP_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveFollowUps(f: DemoFollowUp[]) {
  try { localStorage.setItem(FOLLOWUP_KEY, JSON.stringify(f)); } catch { /* ignore */ }
}

function loadAssignmentHistory(): AssignmentHistory[] {
  try { const raw = localStorage.getItem(ASSIGNMENT_HISTORY_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveAssignmentHistory(h: AssignmentHistory[]) {
  try { localStorage.setItem(ASSIGNMENT_HISTORY_KEY, JSON.stringify(h)); } catch { /* ignore */ }
}

function loadStatusHistory(): StatusHistory[] {
  try { const raw = localStorage.getItem(STATUS_HISTORY_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveStatusHistory(h: StatusHistory[]) {
  try { localStorage.setItem(STATUS_HISTORY_KEY, JSON.stringify(h)); } catch { /* ignore */ }
}

export function resetDemoLeadsToSeed() {
  const seed = cloneLeads(DEMO_LEADS_SEED);
  save(seed);
  return seed;
}

// ── Lead CRUD ─────────────────────────────────────────────────────────────────
export async function demoFetchLeads(assignedToUserId?: string): Promise<Lead[]> {
  let list = load();
  if (assignedToUserId) list = list.filter(l => l.assignedUserId === assignedToUserId);
  return cloneLeads(list);
}

export async function demoFetchLead(id: string): Promise<Lead | null> {
  const list = load();
  return list.find(l => l.id === id) ?? null;
}

export async function demoCreateLead(lead: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead> {
  const list = load();
  const newLead: Lead = {
    ...lead,
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  list.unshift(newLead);
  save(list);
  return { ...newLead };
}

export async function demoUpdateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  const list = load();
  const idx = list.findIndex(l => l.id === id);
  if (idx === -1) throw new Error('Lead not found');
  const updated = { ...list[idx], ...updates };
  list[idx] = updated;
  save(list);
  return { ...updated };
}

export async function demoAssignLead(leadId: string, userId: string): Promise<void> {
  await demoUpdateLead(leadId, { assignedUserId: userId });
}

export async function demoDeleteLead(id: string): Promise<void> {
  const list = load().filter(l => l.id !== id);
  save(list);
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export async function demoGetNotes(leadId: string): Promise<DemoNote[]> {
  return loadNotes().filter(n => n.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function demoAddNote(leadId: string, content: string, userName: string): Promise<DemoNote> {
  const notes = loadNotes();
  const note: DemoNote = {
    id: `note-${Date.now()}`,
    leadId,
    content,
    createdAt: new Date().toISOString(),
    createdBy: userName,
  };
  notes.unshift(note);
  saveNotes(notes);
  return note;
}

// ── Follow-ups ────────────────────────────────────────────────────────────────
export async function demoGetFollowUps(leadId: string): Promise<DemoFollowUp[]> {
  return loadFollowUps().filter(f => f.leadId === leadId).sort((a, b) => a.date.localeCompare(b.date));
}

export async function demoAddFollowUp(
  leadId: string,
  data: { type: string; date: string; notes: string },
  userName: string
): Promise<DemoFollowUp> {
  const followups = loadFollowUps();
  const fu: DemoFollowUp = {
    id: `fu-${Date.now()}`,
    leadId,
    ...data,
    completed: false,
    createdAt: new Date().toISOString(),
    createdBy: userName,
  };
  followups.push(fu);
  saveFollowUps(followups);
  return fu;
}

export async function demoDeleteFollowUp(followUpId: string): Promise<void> {
  const followups = loadFollowUps().filter(f => f.id !== followUpId);
  saveFollowUps(followups);
}

export async function demoCompleteFollowUp(followUpId: string): Promise<DemoFollowUp> {
  const followups = loadFollowUps();
  const idx = followups.findIndex(f => f.id === followUpId);
  if (idx === -1) throw new Error('Follow-up not found');
  followups[idx].completed = true;
  saveFollowUps(followups);
  return followups[idx];
}

// ── Assignment History ────────────────────────────────────────────────────────
export async function demoGetAssignmentHistory(leadId: string): Promise<AssignmentHistory[]> {
  return loadAssignmentHistory()
    .filter(h => h.leadId === leadId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function demoLogAssignment(
  leadId: string,
  fromUserId: string,
  toUserId: string,
  assignedBy: string,
  reason?: string
): Promise<AssignmentHistory> {
  const history = loadAssignmentHistory();
  const record: AssignmentHistory = {
    id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    leadId,
    fromUserId,
    toUserId,
    assignedBy,
    createdAt: new Date().toISOString(),
    reason,
  };
  history.push(record);
  saveAssignmentHistory(history);
  return record;
}

export async function demoGetStatusHistory(leadId: string): Promise<StatusHistory[]> {
  return loadStatusHistory()
    .filter(h => h.leadId === leadId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function demoLogStatusChange(
  leadId: string,
  fromStatus: Lead['status'],
  toStatus: Lead['status'],
  updatedBy: string
): Promise<StatusHistory> {
  const history = loadStatusHistory();
  const record: StatusHistory = {
    id: `status-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    leadId,
    fromStatus,
    toStatus,
    updatedBy,
    createdAt: new Date().toISOString(),
  };
  history.push(record);
  saveStatusHistory(history);
  return record;
}
