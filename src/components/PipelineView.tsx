import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Phone, Flame, ChevronRight, User } from 'lucide-react';
import { obfuscatePhoneNumber, triggerCall } from '@/src/utils/phoneUtils';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead, LeadStatus } from '@/types';
import { updateLeadWithAudit } from '@/src/services/leadsService';

/** Dump / disqualified only — Not Interested is a separate outcome (no dump grace on Leads). */
const DUMP_STATUSES = new Set<LeadStatus>(['Fake Query', 'Wrong Number', 'Low Budget', 'Switch off']);

function farFutureFollowUpIso(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}
import { useRole } from '@/src/contexts/RoleContext';
import { useNavigate } from 'react-router-dom';

// ── Pipeline stages — includes all status options from the dropdown ───────────
const PIPELINE_STAGES: { id: LeadStatus; label: string; color: string; bg: string; border: string }[] = [
  { id: 'New', label: 'New', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'Interested', label: 'Interested', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  { id: 'Site Visit Scheduled', label: 'Site Visit', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  { id: 'Busy', label: 'Busy', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'Not Reachable', label: 'Not Reachable', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
  { id: 'Not Answering Call', label: 'Not Answering', color: 'text-orange-800', bg: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'Fake Query', label: 'Fake Query', color: 'text-rose-800', bg: 'bg-rose-50', border: 'border-rose-200' },
  { id: 'Not Interested', label: 'Not Interested', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  { id: 'Wrong Number', label: 'Wrong Number', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  { id: 'Low Budget', label: 'Low Budget', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { id: 'Switch off', label: 'Switch off', color: 'text-zinc-700', bg: 'bg-zinc-100', border: 'border-zinc-300' },
];

const getLevelDot = (level: string) => {
  switch (level) {
    case 'Hot': return 'bg-red-500';
    case 'Warm': return 'bg-amber-500';
    default: return 'bg-blue-400';
  }
};

// ── Single Lead Card ──────────────────────────────────────────────────────────
interface LeadCardProps {
  lead: Lead;
  getUserName: (id: string) => string;
  isDragging?: boolean;
  key?: React.Key;
}

function LeadCard({ lead, getUserName, isDragging }: LeadCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg border border-slate-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow ${isDragging ? 'shadow-xl ring-2 ring-blue-400 rotate-1' : 'hover:shadow-md hover:border-blue-200'}`}
    >
      {/* Level dot + name */}
      <div className="flex items-start justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${getLevelDot(lead.leadLevel)}`} />
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{lead.clientName}</p>
        </div>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); navigate(`/leads/${lead.id}`); }}
          className="shrink-0 text-slate-400 hover:text-blue-500 transition-colors p-0.5 rounded"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Project */}
      <p className="text-xs text-slate-500 truncate mb-2">{lead.project}</p>

      {/* Phone */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          triggerCall(lead.phoneNumber);
        }}
        className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-2 bg-transparent border-0 p-0 cursor-pointer"
      >
        <Phone className="w-3 h-3 shrink-0" />
        <span className="truncate">{obfuscatePhoneNumber(lead.phoneNumber)}</span>
      </button>

      {/* Footer: assignee + follow-up */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1 text-[0.68rem] text-slate-500 min-w-0">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{getUserName(lead.assignedUserId)}</span>
        </div>
        <span className="text-[0.65rem] text-slate-400 shrink-0">
          {(() => { try { return format(parseISO(lead.followUpDate), 'MMM d'); } catch { return '—'; } })()}
        </span>
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────
interface ColumnProps {
  stage: typeof PIPELINE_STAGES[0];
  leads: Lead[];
  getUserName: (id: string) => string;
  key?: React.Key;
}

function PipelineColumn({ stage, leads, getUserName }: ColumnProps) {
  const { setNodeRef } = useSortable({ id: stage.id });

  return (
    <div className="flex flex-col min-w-[220px] max-w-[240px]">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${stage.border} ${stage.bg} mb-0`}>
        <span className={`text-xs font-bold uppercase tracking-wide ${stage.color}`}>{stage.label}</span>
        <span className={`text-xs font-bold ${stage.color} bg-white/70 px-1.5 py-0.5 rounded-full`}>
          {leads.length}
        </span>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] p-2 bg-slate-50 rounded-b-lg border-x border-b ${stage.border} space-y-2`}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-slate-300 text-xs">
              Drop here
            </div>
          ) : (
            leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} getUserName={getUserName} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ── Main PipelineView ────────────────────────────────────────────────────────
interface PipelineViewProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  /** Called after a lead is moved to a dump/closed status (for delayed hide on Active list) */
  onDumpStatusApplied?: (leadId: string) => void;
}

export default function PipelineView({ leads, onLeadsChange, onDumpStatusApplied }: PipelineViewProps) {
  const { currentUser, allUsers, telecallers } = useRole();
  const [activeId, setActiveId] = useState<string | null>(null);

  const getUserName = (id: string) => {
    if (!id?.trim()) return 'Unassigned';
    return allUsers.find(u => u.id === id)?.name ?? telecallers.find(u => u.id === id)?.name ?? 'Unknown';
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // Need to drag 5px before it activates
    })
  );

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  const getLeadsByStage = (stageId: LeadStatus) =>
    leads.filter(l => l.status === stageId);

  const getLeadStage = (leadId: string): LeadStatus | null => {
    const lead = leads.find(l => l.id === leadId);
    return lead ? lead.status : null;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Determine the target stage
    let targetStage: LeadStatus | null = null;

    // Check if dropped directly onto a stage column
    const stageMatch = PIPELINE_STAGES.find(s => s.id === overId);
    if (stageMatch) {
      targetStage = stageMatch.id;
    } else {
      // Dropped onto another lead — use that lead's stage
      targetStage = getLeadStage(overId);
    }

    if (!targetStage) return;

    const currentStage = getLeadStage(leadId);
    if (currentStage === targetStage) return; // No change

    // Optimistic update
    const updatedLeads = leads.map(l =>
      l.id === leadId ? { ...l, status: targetStage! } : l
    );
    onLeadsChange(updatedLeads);

    // Persist to store/Supabase
    try {
      const updates: Partial<Lead> = { status: targetStage };
      if (DUMP_STATUSES.has(targetStage) || targetStage === 'Not Interested') {
        updates.followUpDate = farFutureFollowUpIso();
      }
      const updated = await updateLeadWithAudit(leadId, updates, currentUser.name);
      onLeadsChange(leads.map(l => (l.id === leadId ? updated : l)));
      if (DUMP_STATUSES.has(targetStage)) {
        onDumpStatusApplied?.(leadId);
      }
      toast.success(`Moved to "${targetStage}"`);
    } catch {
      toast.error('Failed to update stage');
      onLeadsChange(leads); // Revert
    }
  };

  return (
    <div className="space-y-4">
      {/* Pipeline board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
          {PIPELINE_STAGES.map(stage => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              leads={getLeadsByStage(stage.id)}
              getUserName={getUserName}
            />
          ))}
        </div>

        {/* Drag overlay (card that follows cursor) */}
        <DragOverlay>
          {activeLead ? (
            <LeadCard lead={activeLead} getUserName={getUserName} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
