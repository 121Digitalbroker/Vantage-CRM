import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Phone, Flame, ChevronRight, User } from 'lucide-react';
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
import { updateLead } from '@/src/services/leadsService';
import { useRole } from '@/src/contexts/RoleContext';
import { useNavigate } from 'react-router-dom';

// ── Pipeline stages — maps directly to your existing LeadStatus values ────────
const PIPELINE_STAGES: { id: LeadStatus; label: string; color: string; bg: string; border: string }[] = [
  { id: 'New',                  label: 'New',              color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  { id: 'Contacted',            label: 'Contacted',        color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  { id: 'Interested',           label: 'Interested',       color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  { id: 'Site Visit Scheduled', label: 'Site Visit',       color: 'text-cyan-700',   bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  { id: 'Visit Completed',      label: 'Visit Done',       color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200' },
  { id: 'Negotiation',          label: 'Negotiation',      color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  { id: 'Booked',               label: 'Booked ✓',         color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200' },
];

const DEAD_STAGES: LeadStatus[] = ['Not Interested', 'Wrong Number', 'Low Budget'];

const getLevelDot = (level: string) => {
  switch (level) {
    case 'Hot':  return 'bg-red-500';
    case 'Warm': return 'bg-amber-500';
    default:     return 'bg-blue-400';
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
      <a
        href={`tel:${lead.phoneNumber}`}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-2"
      >
        <Phone className="w-3 h-3 shrink-0" />
        <span className="truncate">{lead.phoneNumber}</span>
      </a>

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
}

export default function PipelineView({ leads, onLeadsChange }: PipelineViewProps) {
  const { allUsers, telecallers } = useRole();
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
      await updateLead(leadId, { status: targetStage });
      toast.success(`Moved to "${targetStage}"`);
    } catch {
      toast.error('Failed to update stage');
      onLeadsChange(leads); // Revert
    }
  };

  const deadLeads = leads.filter(l => DEAD_STAGES.includes(l.status));

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

      {/* Dead leads — collapsed at bottom */}
      {deadLeads.length > 0 && (
        <details className="bg-slate-100 rounded-xl border border-slate-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-500 select-none list-none flex items-center gap-2">
            <span className="text-slate-400">▸</span>
            Inactive Leads
            <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded-full">{deadLeads.length}</span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-3 max-h-[300px] overflow-y-auto">
            {DEAD_STAGES.map(stage => {
              const stageLeads = deadLeads.filter(l => l.status === stage);
              if (stageLeads.length === 0) return null;
              return (
                <div key={stage} className="min-w-[200px]">
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{stage} ({stageLeads.length})</p>
                  <div className="space-y-2">
                    {stageLeads.map(lead => (
                      <div key={lead.id} className="bg-white border border-slate-200 rounded-lg p-2.5 opacity-60">
                        <p className="text-sm font-semibold text-slate-700">{lead.clientName}</p>
                        <p className="text-xs text-slate-400">{lead.project}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
