import { supabase } from './supabase';
import type { Plot } from './inventory';
import { formatCrore } from './plotMap';

// Tracked quote links: each quote sent to a buyer gets its own short link
// (#/q/<id>), so the team can see when — and how often — the buyer opens it.

export interface QuoteLink {
  id: string;
  plot_id: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  sender_id: string | null;
  sender_name: string | null;
  created_at: string;
}

export interface QuoteActivity extends QuoteLink {
  views: number;
  last_viewed_at: string | null;
}

export function quoteUrl(id: string): string {
  return `${window.location.origin}/#/q/${id}`;
}

/** Records a new quote for this buyer; null if tracking isn't set up yet. */
export async function createQuoteLink(plot: Plot, buyerName: string, buyerPhone: string, senderName?: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('quote_links')
    .insert({ plot_id: plot.id, buyer_name: buyerName.trim() || null, buyer_phone: buyerPhone.replace(/\D/g, '') || null, sender_name: senderName ?? null })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id as string;
}

export function quoteMessage(plot: Plot, buyerName: string, link: string): string {
  const name = buyerName.trim();
  return [
    `Dear${name ? ` ${name}` : ''},`,
    `It was a pleasure hosting you. As promised, here is Plot ${plot.plotNo} at Zion Hills Golf County — a ${plot.bedrooms}BHK villa on ${Math.round(plot.landAreaSft).toLocaleString('en-IN')} sq ft, ${formatCrore(plot.cost.totalCostLacs)} all-inclusive.`,
    `Your personal invitation: ${link}`,
  ].join('\n\n');
}

export function whatsappTo(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** The buyer opening their quote. Counts a view unless it's a team member previewing it. */
export async function openQuote(id: string): Promise<{ plot_id: string; buyer_name: string | null; sender_id: string | null; sender_name: string | null } | null> {
  const { data: session } = await supabase.auth.getSession();
  const { data, error } = await supabase.rpc('open_quote', {
    link: id,
    count_view: !session.session,
    device: navigator.userAgent,
  });
  if (error || !data) return null;
  return data as { plot_id: string; buyer_name: string | null; sender_id: string | null; sender_name: string | null };
}

/** Recent quotes with how often each was opened (newest activity first). */
export async function fetchQuoteActivity(limit = 100): Promise<QuoteActivity[]> {
  const { data: links, error } = await supabase.from('quote_links').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error || !links?.length) return [];
  const ids = links.map((l) => l.id as string);
  const { data: views } = await supabase.from('quote_views').select('link_id, viewed_at').in('link_id', ids).order('viewed_at', { ascending: false });
  const byLink = new Map<string, { n: number; last: string }>();
  for (const v of views ?? []) {
    const cur = byLink.get(v.link_id as string);
    if (cur) cur.n++;
    else byLink.set(v.link_id as string, { n: 1, last: v.viewed_at as string });
  }
  return (links as QuoteLink[])
    .map((l) => ({ ...l, views: byLink.get(l.id)?.n ?? 0, last_viewed_at: byLink.get(l.id)?.last ?? null }))
    .sort((a, b) => (b.last_viewed_at ?? b.created_at).localeCompare(a.last_viewed_at ?? a.created_at));
}

export async function fetchQuoteLink(id: string): Promise<QuoteLink | null> {
  const { data } = await supabase.from('quote_links').select('*').eq('id', id).maybeSingle();
  return (data as QuoteLink) ?? null;
}

export async function countViews(id: string): Promise<number> {
  const { count } = await supabase.from('quote_views').select('id', { count: 'exact', head: true }).eq('link_id', id);
  return count ?? 0;
}

/** Calls back whenever any buyer opens a quote. Returns an unsubscribe function. */
export function onQuoteOpened(cb: (linkId: string) => void): () => void {
  const ch = supabase
    .channel('quote-views')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quote_views' }, (p) => cb((p.new as { link_id: string }).link_id))
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}
