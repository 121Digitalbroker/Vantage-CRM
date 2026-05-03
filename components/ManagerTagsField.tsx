import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

type ManagerOption = { id: string; name: string };

/**
 * Tag-style multi-select for assigning one or more GMs / Manager1s to a telecaller.
 */
export function ManagerTagsField({
  label,
  selectedIds,
  onChange,
  managers,
}: {
  label: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  managers: ManagerOption[];
}) {
  const available = managers.filter(m => !selectedIds.includes(m.id));
  const remove = (id: string) => onChange(selectedIds.filter(x => x !== id));
  const add = (id: string) => onChange([...selectedIds, id]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 min-h-[2.5rem] flex flex-wrap gap-1.5 items-center">
        {selectedIds.length === 0 && (
          <span className="text-xs text-slate-400 italic px-1">No managers — use Add below</span>
        )}
        {selectedIds.map(id => {
          const m = managers.find(x => x.id === id);
          return (
            <Badge
              key={id}
              variant="secondary"
              className="pl-2 pr-1 py-0.5 gap-0.5 font-normal text-xs border border-slate-200 max-w-full"
            >
              <span className="truncate">{m?.name ?? id}</span>
              <button
                type="button"
                className="rounded-full p-0.5 shrink-0 hover:bg-slate-300/50 outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                onClick={() => remove(id)}
                aria-label={`Remove ${m?.name ?? id}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      {available.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
          <span className="text-[0.65rem] font-medium text-slate-500 uppercase tracking-wide shrink-0">Add</span>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {available.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => add(m.id)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                + {m.name}
              </button>
            ))}
          </div>
        </div>
      ) : selectedIds.length > 0 ? (
        <p className="text-[0.65rem] text-slate-400">All available managers are assigned.</p>
      ) : null}
    </div>
  );
}
