import { supabase } from './supabase';

// Buyer showcase: the pictures, videos and host details shown to buyers —
// in the personal welcome on the iPad, on the premium quote page and at tour
// stops. Stored as one JSON value in app_settings (key `showcase`); files live
// in the public `showcase` storage bucket. Run
// supabase/migrations/20261005000000_showcase_and_quote_tracking.sql first.

export interface HostCard {
  photo?: string;
  phone?: string;
  /** e.g. "Senior Sales Advisor" */
  title?: string;
}

export interface TourStop {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** Shows when the cart is within this many metres. */
  radiusM: number;
  image: string;
  caption?: string;
}

export interface Showcase {
  /** Owner testimonial video — an uploaded file or a YouTube / Google Drive link. */
  testimonial?: { url: string; caption?: string };
  /** Big image behind the "Welcome to Zion Hills" title. */
  welcomeImage?: string;
  /** What the finished villa looks like, by size (used for every plot of that size). */
  villaRenders?: { 3?: string; 4?: string };
  /** Per plot: its own render and/or the view from the plot (override the above). */
  plots?: Record<string, { render?: string; view?: string }>;
  /** Per team member (profile id). */
  hosts?: Record<string, HostCard>;
  stops?: TourStop[];
}

const KEY = 'showcase';

function missingSetup(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|not find the function/i.test(e.message ?? ''));
}

export const SETUP_MESSAGE = 'Run the showcase SQL in Supabase first (supabase/migrations/20261005000000_showcase_and_quote_tracking.sql).';

/** For signed-in screens. */
export async function loadShowcase(): Promise<Showcase> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
  if (error || !data) return {};
  return (data.value as Showcase) ?? {};
}

/** For the public buyer page (no login). */
export async function loadPublicShowcase(): Promise<Showcase> {
  const { data, error } = await supabase.rpc('public_showcase');
  if (error || !data) return {};
  return data as Showcase;
}

/** Re-reads the latest value, applies the change and saves — so two people
 *  editing different parts at once don't overwrite each other. */
export async function updateShowcase(change: (s: Showcase) => Showcase): Promise<Showcase> {
  const latest = await loadShowcase();
  const next = change(latest);
  const { error } = await supabase.from('app_settings').upsert({ key: KEY, value: next, updated_at: new Date().toISOString() });
  if (error) throw missingSetup(error) || error.code === '42501' ? new Error(SETUP_MESSAGE) : error;
  return next;
}

/** Uploads a picture or video to the showcase bucket; returns its public URL. */
export async function uploadShowcaseFile(file: File, folder: string): Promise<string> {
  if (file.size > 50 * 1024 * 1024) throw new Error('That file is over 50 MB. For long videos, upload to YouTube (unlisted) and paste the link instead.');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('showcase').upload(path, file, { cacheControl: '31536000', contentType: file.type || undefined });
  if (error) throw /bucket not found/i.test(error.message) ? new Error(SETUP_MESSAGE) : error;
  return supabase.storage.from('showcase').getPublicUrl(path).data.publicUrl;
}

/** Best picture of the finished home for a plot. */
export function renderFor(s: Showcase, plotId: string, bedrooms: number): string | undefined {
  return s.plots?.[plotId]?.render ?? s.villaRenders?.[bedrooms as 3 | 4];
}

export function viewFor(s: Showcase, plotId: string): string | undefined {
  return s.plots?.[plotId]?.view;
}

export type VideoSource = { kind: 'embed'; src: string } | { kind: 'file'; src: string };

/** Turns a YouTube / Google Drive / direct video link into something playable. */
export function videoSource(url: string | undefined): VideoSource | null {
  if (!url) return null;
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1` };
  const drive = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return { kind: 'embed', src: `https://drive.google.com/file/d/${drive[1]}/preview` };
  return { kind: 'file', src: u };
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}
