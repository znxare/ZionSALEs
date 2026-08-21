import { useState } from 'react';
import { X, Phone, Flame, CalendarClock, Check, Pencil } from 'lucide-react';
import type { ActivityType, LeadStatus, Lead } from '@/lib/supabase';
import { daysFromNow } from '@/lib/crm';

interface Props {
  onClose: () => void;
  onComplete: (result: {
    type: ActivityType;
    summary: string;
    patch: Partial<Lead>;
    followUpInDays?: number;
    siteVisitAt?: string;
    notes?: string;
  }) => void;
}

type Step = 'answered' | 'interest' | 'sitevisit' | 'followup' | 'notes' | 'done';

export default function GuidedFlow({ onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>('answered');
  const [answered, setAnswered] = useState<'yes' | 'no' | null>(null);
  const [interest, setInterest] = useState<'Hot' | 'Warm' | 'Cold' | null>(null);
  const [pendingResult, setPendingResult] = useState<Parameters<Props['onComplete']>[0] | null>(null);
  const [notes, setNotes] = useState('');

  function reset() {
    setStep('answered');
    setAnswered(null);
    setInterest(null);
    setPendingResult(null);
    setNotes('');
  }

  function finish(result: Parameters<Props['onComplete']>[0]) {
    onComplete(result);
    reset();
  }

  function goToNotes(result: Parameters<Props['onComplete']>[0]) {
    setPendingResult(result);
    setStep('notes');
  }

  return (
    <Sheet onClose={onClose} title="Guided call flow">
      {step === 'answered' && (
        <Question
          icon={Phone}
          question="Did the customer answer?"
          options={[
            { label: 'Yes', value: 'yes', color: 'bg-emerald-600' },
            { label: 'No', value: 'no', color: 'bg-gray-400' },
          ]}
          onPick={(v) => {
            setAnswered(v as 'yes' | 'no');
            if (v === 'no') {
              goToNotes({ type: 'No Answer', summary: 'Called — no answer', patch: {}, followUpInDays: 1 });
            } else {
              setStep('interest');
            }
          }}
        />
      )}

      {step === 'interest' && (
        <Question
          icon={Flame}
          question="How interested are they?"
          options={[
            { label: 'Hot', value: 'Hot', color: 'bg-red-500', emoji: '🔥' },
            { label: 'Warm', value: 'Warm', color: 'bg-amber-500', emoji: '🙂' },
            { label: 'Cold', value: 'Cold', color: 'bg-sky-400', emoji: '❄️' },
          ]}
          onPick={(v) => {
            setInterest(v as 'Hot' | 'Warm' | 'Cold');
            if (v === 'Hot') {
              setStep('sitevisit');
            } else {
              setStep('followup');
            }
          }}
        />
      )}

      {step === 'sitevisit' && (
        <Question
          icon={CalendarClock}
          question="Schedule a site visit?"
          options={[
            { label: 'Today', value: 'today', color: 'bg-violet-500' },
            { label: 'Tomorrow', value: 'tomorrow', color: 'bg-violet-500' },
            { label: 'Skip for now', value: 'skip', color: 'bg-gray-300' },
          ]}
          onPick={(v) => {
            const status: LeadStatus = interest === 'Hot' ? 'Hot' : 'Warm';
            if (v === 'today') {
              goToNotes({
                type: 'Site Visit Scheduled',
                summary: 'Site visit scheduled for today',
                patch: { status },
                siteVisitAt: daysFromNow(0),
                followUpInDays: 0,
              });
            } else if (v === 'tomorrow') {
              goToNotes({
                type: 'Site Visit Scheduled',
                summary: 'Site visit scheduled for tomorrow',
                patch: { status },
                siteVisitAt: daysFromNow(1),
                followUpInDays: 1,
              });
            } else {
              setStep('followup');
            }
          }}
        />
      )}

      {step === 'followup' && (
        <Question
          icon={CalendarClock}
          question="When should we follow up?"
          options={[
            { label: 'Tomorrow', value: '1', color: 'bg-emerald-600' },
            { label: 'In 2 days', value: '2', color: 'bg-emerald-600' },
            { label: 'Next week', value: '7', color: 'bg-emerald-600' },
          ]}
          onPick={(v) => {
            const days = parseInt(v, 10);
            const status: LeadStatus = interest === 'Hot' ? 'Hot' : interest === 'Cold' ? 'Cold' : 'Warm';
            goToNotes({
              type: 'Called',
              summary: `Called — customer is ${interest?.toLowerCase() ?? 'warm'}`,
              patch: { status },
              followUpInDays: days,
            });
          }}
        />
      )}
      {step === 'notes' && pendingResult && (
        <div className="animate-fade-in px-5 py-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl brand-gradient text-white">
              <Pencil className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold tracking-tight text-gray-900">Call Notes</h3>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Write notes from the call…"
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-300"
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => finish(pendingResult)}
              className="flex-1 rounded-full bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
            >
              Skip
            </button>
            <button
              onClick={() => finish({ ...pendingResult, summary: notes.trim() ? `${pendingResult.summary} — ${notes.trim()}` : pendingResult.summary, notes: notes.trim() || undefined })}
              disabled={!notes.trim()}
              className="flex flex-[1.5] items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> Save Notes
            </button>
          </div>
        </div>
      )}

    </Sheet>
  );
}

function Question({ icon: Icon, question, options, onPick }: {
  icon: typeof Phone;
  question: string;
  options: { label: string; value: string; color: string; emoji?: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="animate-fade-in px-5 py-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl brand-gradient text-white">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-display text-lg font-bold tracking-tight text-gray-900">{question}</h3>
      </div>
      <div className="grid gap-2.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onPick(o.value)}
            className="flex items-center justify-between rounded-2xl border border-gray-150 bg-white px-4 py-3.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
          >
            <span className="flex items-center gap-2 font-semibold text-gray-800">
              {o.emoji && <span className="text-lg">{o.emoji}</span>}
              {o.label}
            </span>
            <span className={`grid h-7 w-7 place-items-center rounded-full ${o.color} text-white`}>
              <Check className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md animate-slide-up overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:animate-scale-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
