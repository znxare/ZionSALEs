import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarClock, Plus, Trash2, Check, X, Loader2, ListTodo, ArrowRight, MapPin,
} from 'lucide-react';
import type { Lead, Todo } from '@/lib/supabase';
import {
  fetchTodos, createTodo, updateTodo, deleteTodo,
  isToday, isOverdue, relativeDay, formatTime,
} from '@/lib/crm';
import { statusStyles } from '@/lib/styles';

interface Props {
  leads: Lead[];
  onOpenLead: (id: string) => void;
}

export default function DayPlanner({ leads, onOpenLead }: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTodos();
      setTodos(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Next to contact: leads with upcoming or overdue follow-ups
  const nextToContact = useMemo(() => {
    const active = leads.filter(
      (l) => l.status !== 'Dead' && l.status !== 'Junk' && !l.booked_at
    );
    return active
      .sort((a, b) => {
        const ao = isOverdue(a.next_followup_at) ? 0 : isToday(a.next_followup_at) ? 1 : 2;
        const bo = isOverdue(b.next_followup_at) ? 0 : isToday(b.next_followup_at) ? 1 : 2;
        if (ao !== bo) return ao - bo;
        return new Date(a.next_followup_at ?? 0).getTime() - new Date(b.next_followup_at ?? 0).getTime();
      })
      .slice(0, 15);
  }, [leads]);

  const todayCount = nextToContact.filter((l) => isToday(l.next_followup_at)).length;
  const overdueCount = nextToContact.filter((l) => isOverdue(l.next_followup_at) && !isToday(l.next_followup_at)).length;

  async function addTodo() {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await createTodo({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        due_date: newDue || null,
        assignee: newAssignee.trim() || null,
      });
      setNewTitle(''); setNewDesc(''); setNewDue(''); setNewAssignee('');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(t: Todo) {
    await updateTodo(t.id, { done: !t.done });
    await load();
  }

  async function removeTodo(id: string) {
    await deleteTodo(id);
    await load();
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Day Planner</h1>
        <p className="text-[13px] text-gray-400">Your daily follow-up priorities and team to-do list.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Next to contact */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-gray-900">Next to Contact</h2>
            <div className="flex gap-2 text-[11px] font-semibold">
              {overdueCount > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-600">{overdueCount} overdue</span>}
              {todayCount > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-600">{todayCount} today</span>}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white card-shadow">
            {nextToContact.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">No pending follow-ups. You are all caught up!</div>
            ) : (
              nextToContact.map((lead, i) => {
                const overdue = isOverdue(lead.next_followup_at) && !isToday(lead.next_followup_at);
                const today = isToday(lead.next_followup_at);
                const ss = statusStyles(lead.status);
                const indicator = overdue ? 'bg-red-500' : today ? 'bg-emerald-500' : 'bg-gray-300';

                return (
                  <button
                    key={lead.id}
                    onClick={() => onOpenLead(lead.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50/80 ${i !== 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${indicator}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900">{lead.name}</span>
                        <span className={`hidden shrink-0 rounded-full ${ss.bg} ${ss.text} px-2 py-0.5 text-[11px] font-medium ring-1 ${ss.ring} sm:inline`}>
                          {lead.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-gray-400">
                        <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-red-600' : ''}`}>
                          <CalendarClock className="h-3 w-3" />
                          {overdue ? relativeDay(lead.next_followup_at) : today ? `Today · ${formatTime(lead.next_followup_at)}` : relativeDay(lead.next_followup_at)}
                        </span>
                        {lead.site_visit_at && isToday(lead.site_visit_at) && (
                          <span className="inline-flex items-center gap-1 text-violet-600">
                            <MapPin className="h-3 w-3" /> Site visit today
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Team to-do list */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-gray-900">Team To-Do List</h2>
            <span className="text-[11px] font-semibold text-gray-400">{todos.filter((t) => !t.done).length} pending</span>
          </div>

          {/* Add new todo */}
          <div className="mb-3 rounded-2xl border border-black/5 bg-white p-4 card-shadow">
            <div className="space-y-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Add a new task…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-emerald-300"
                onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) addTodo(); }}
              />
              {(newTitle.trim() || newDesc || newDue || newAssignee) && (
                <div className="animate-fade-up space-y-2">
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-emerald-300"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newDue}
                      onChange={(e) => setNewDue(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-emerald-300"
                    />
                    <input
                      value={newAssignee}
                      onChange={(e) => setNewAssignee(e.target.value)}
                      placeholder="Assignee"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-emerald-300"
                    />
                  </div>
                  <button
                    onClick={addTodo}
                    disabled={adding || !newTitle.trim()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full brand-gradient py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                  >
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Task
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Todo list */}
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
          ) : todos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <ListTodo className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-400">No tasks yet. Add one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todos.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-4 card-shadow transition ${t.done ? 'opacity-60' : ''}`}
                >
                  <button
                    onClick={() => toggleDone(t)}
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${t.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}
                  >
                    {t.done && <Check className="h-3 w-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold text-gray-900 ${t.done ? 'line-through' : ''}`}>{t.title}</div>
                    {t.description && <p className="mt-0.5 text-[12px] text-gray-400">{t.description}</p>}
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      {t.due_date && (
                        <span className={`rounded-full px-2 py-0.5 font-medium ${isOverdue(t.due_date) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          Due: {new Date(t.due_date).toLocaleDateString('en-IN')}
                        </span>
                      )}
                      {t.assignee && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600">{t.assignee}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTodo(t.id)}
                    className="rounded-lg p-1 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
