import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchLeads, fetchCampaigns, fetchProfiles, type Lead, type Campaign, type Profile } from '@/lib/crm';
import { fetchHospitalityLeads, type HospitalityLead } from '@/lib/hospitality';
import { supabase } from '@/lib/supabase';
import Dashboard from '@/components/Dashboard';
import LeadDetail from '@/components/LeadDetail';
import LeadManagement from '@/components/LeadManagement';
import HospitalityLeadManagement from '@/components/HospitalityLeadManagement';
import HospitalityLeadDetail from '@/components/HospitalityLeadDetail';
import CampaignAnalytics from '@/components/CampaignAnalytics';
import AddLeadModal from '@/components/AddLeadModal';
import SearchView from '@/components/SearchView';
import Fab from '@/components/Fab';
import TopBar from '@/components/TopBar';
import Sidebar, { type NavId } from '@/components/Sidebar';
import SiteVisits from '@/components/SiteVisits';
import LeadBank from '@/components/LeadBank';
import DayPlanner from '@/components/DayPlanner';
import LeadReactivation from '@/components/LeadReactivation';
import LiveInventoryBoard from '@/components/LiveInventoryBoard';
import LeadImport from '@/components/LeadImport';
import ActivityLog from '@/components/ActivityLog';
import Settings from '@/components/Settings';
import PublicPlotPage from '@/components/PublicPlotPage';
import { QuoteAlerts } from '@/components/QuoteActivity';
import { TourRemote, TourScreen } from '@/components/Tour';
import Reports from '@/components/Reports';
import { usePermissions, useModuleAccess, setModuleVisibility } from '@/lib/access';
import { fetchModuleVisibility } from '@/lib/appSettings';
import Login from '@/components/Login';
import WelcomeScreen from '@/components/WelcomeScreen';
import HospitalityComingSoon from '@/components/HospitalityComingSoon';
import { Landmark } from 'lucide-react';
import { getSession, onAuthChange, signOutUser, type CurrentUser } from '@/lib/auth';
import { withTimeout } from '@/lib/timeout';

type Route =
  | { name: 'dashboard' }
  | { name: 'leads' }
  | { name: 'leadbank' }
  | { name: 'import' }
  | { name: 'planner' }
  | { name: 'sitevisits' }
  | { name: 'campaigns' }
  | { name: 'reactivation' }
  | { name: 'activitylog' }
  | { name: 'settings' }
  | { name: 'publicPlot'; id: string; to?: string; by?: string }
  | { name: 'quote'; id: string }
  | { name: 'tour-remote' }
  | { name: 'tour-screen' }
  | { name: 'reports' }
  | { name: 'inventory' }
  | { name: 'hospitality-leads' }
  | { name: 'hospitality-leadbank' }
  | { name: 'lead'; id: string }
  | { name: 'hospitality-lead'; id: string }
  | { name: 'search' }
  | { name: 'notfound' };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === '' || h === '/') return { name: 'dashboard' };
  // Public plot page shared with buyers: #/p/<plot id>?to=<buyer>&by=<advisor>
  if (h.startsWith('p/')) {
    const [path, query = ''] = h.slice(2).split('?');
    const q = new URLSearchParams(query);
    return { name: 'publicPlot', id: decodeURIComponent(path), to: q.get('to') ?? undefined, by: q.get('by') ?? undefined };
  }
  // Tracked quote sent to a buyer: #/q/<link id>
  if (h.startsWith('q/')) return { name: 'quote', id: h.slice(2).split('?')[0] };
  if (h.startsWith('lead/')) return { name: 'lead', id: h.slice(5) };
  if (h.startsWith('hospitality-lead/')) return { name: 'hospitality-lead', id: h.slice(17) };
  if (h === 'search') return { name: 'search' };
  if (h === 'leads') return { name: 'leads' };
  if (h === 'leadbank') return { name: 'leadbank' };
  if (h === 'import') return { name: 'import' };
  if (h === 'planner') return { name: 'planner' };
  if (h === 'sitevisits') return { name: 'sitevisits' };
  if (h === 'campaigns') return { name: 'campaigns' };
  if (h === 'reactivation') return { name: 'reactivation' };
  if (h === 'activitylog') return { name: 'activitylog' };
  if (h === 'settings') return { name: 'settings' };
  if (h === 'reports') return { name: 'reports' };
  if (h === 'inventory') return { name: 'inventory' };
  // Live cart tour: phone = tracker/remote, iPad = buyer's screen (?sim=1 simulates a drive)
  if (h.startsWith('tour/remote')) return { name: 'tour-remote' };
  if (h.startsWith('tour/screen')) return { name: 'tour-screen' };
  if (h === 'hospitality-leads') return { name: 'hospitality-leads' };
  if (h === 'hospitality-leadbank') return { name: 'hospitality-leadbank' };
  return { name: 'notfound' };
}

function navigate(route: Route) {
  if (route.name === 'dashboard') window.location.hash = '/';
  else if (route.name === 'lead') window.location.hash = `/lead/${route.id}`;
  else if (route.name === 'hospitality-lead') window.location.hash = `/hospitality-lead/${route.id}`;
  else if (route.name === 'search') window.location.hash = '/search';
  else if (route.name === 'leads') window.location.hash = '/leads';
  else if (route.name === 'leadbank') window.location.hash = '/leadbank';
  else if (route.name === 'import') window.location.hash = '/import';
  else if (route.name === 'planner') window.location.hash = '/planner';
  else if (route.name === 'sitevisits') window.location.hash = '/sitevisits';
  else if (route.name === 'campaigns') window.location.hash = '/campaigns';
  else if (route.name === 'reactivation') window.location.hash = '/reactivation';
  else if (route.name === 'activitylog') window.location.hash = '/activitylog';
  else if (route.name === 'settings') window.location.hash = '/settings';
  else if (route.name === 'reports') window.location.hash = '/reports';
  else if (route.name === 'inventory') window.location.hash = '/inventory';
  else if (route.name === 'hospitality-leads') window.location.hash = '/hospitality-leads';
  else if (route.name === 'hospitality-leadbank') window.location.hash = '/hospitality-leadbank';
}

// The module a route belongs to, for Settings → Module access.
function moduleOf(route: Route): string {
  if (route.name === 'lead') return 'leads';
  if (route.name === 'hospitality-lead') return 'hospitality-leads';
  if (route.name === 'tour-remote' || route.name === 'tour-screen') return 'inventory';
  return route.name;
}

function NotAvailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-black/5 bg-white p-8 text-center card-shadow">
      <h1 className="font-display text-lg font-bold text-gray-900">Not available</h1>
      <p className="mt-1 text-sm text-gray-500">The admin hasn't given your role access to this page.</p>
      <button onClick={onBack} className="mt-4 rounded-full brand-gradient px-5 py-2.5 text-sm font-semibold text-white">Back to dashboard</button>
    </div>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const can = usePermissions();
  const canSee = useModuleAccess();
  const [route, setRoute] = useState<Route>(parseHash);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hospitalityLeads, setHospitalityLeads] = useState<HospitalityLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Only true right after an active sign-in this session — never on a page reload
  // with an already-persisted session, so the welcome moment isn't shown every visit.
  const [justSignedIn, setJustSignedIn] = useState(false);

  // Keep the previous array (same reference) when a refresh returns identical
  // rows, so background refreshes don't re-render screens or re-trigger the
  // extra fetches that components run whenever `leads` changes.
  const keepIfSame = <T,>(next: T) => (prev: T) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
  const loadedOnce = useRef(false);
  const inFlight = useRef(false);
  const rerun = useRef(false);
  const lastLoadAt = useRef(0);

  // Only the very first load shows the full-screen spinner. Later refreshes
  // (after an edit, on a timer, or when the tab regains focus) swap data in
  // place, and a failed background refresh keeps the data already on screen.
  const load = useCallback(async () => {
    // A refresh is already running (e.g. the 30s timer) — its data may predate
    // the edit that asked for this one, so run once more when it finishes.
    if (inFlight.current) { rerun.current = true; return; }
    inFlight.current = true;
    const firstLoad = !loadedOnce.current;
    try {
      if (firstLoad) setLoading(true);
      // Timed out so a hung request on a flaky mobile connection can't leave the
      // dashboard spinning forever — it surfaces as a normal, retryable error instead.
      const [leadData, campaignData, profileData] = await withTimeout(
        Promise.all([fetchLeads(), fetchCampaigns(), fetchProfiles()]),
        20000,
        () => { throw new Error('This is taking longer than expected — check your connection and try again.'); },
      );
      setLeads(keepIfSame(leadData));
      setCampaigns(keepIfSame(campaignData));
      setProfiles(keepIfSame(profileData));
      setError(null);
      loadedOnce.current = true;
    } catch (e) {
      if (firstLoad) setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      if (firstLoad) setLoading(false);
      lastLoadAt.current = Date.now();
    }

    // Fetched separately so a missing/unmigrated hospitality_leads table
    // (or any other hospitality-side failure) can never block Real Estate
    // data from loading — the two divisions stay fully independent.
    // Admin-set page visibility; falls back to the defaults if unavailable.
    fetchModuleVisibility().then(setModuleVisibility).catch(() => {});

    try {
      setHospitalityLeads(keepIfSame(await withTimeout(fetchHospitalityLeads(), 20000, () => [] as HospitalityLead[])));
    } catch {
      if (firstLoad) setHospitalityLeads([]);
    }

    inFlight.current = false;
    if (rerun.current) {
      rerun.current = false;
      await load();
    }
  }, []);

  useEffect(() => {
    // Supabase's session lock can occasionally hang indefinitely after a mobile
    // browser suspends a backgrounded tab — timing out here guarantees the app
    // always reaches the login/dashboard screen instead of spinning forever.
    const sessionCheck = getSession();
    withTimeout(sessionCheck, 10000, () => null)
      .then(setCurrentUser)
      .finally(() => setAuthChecked(true));
    // If the real check was only slow (not actually hung) and resolves after the
    // timeout already showed Login, adopt it instead of leaving the user stuck
    // on a stale "logged out" view — but never clobber a fresher sign-in/out that
    // happened in the meantime, so only fill in if nothing else has set a user yet.
    sessionCheck.then((user) => setCurrentUser((current) => current ?? user)).catch(() => {});
    const { data: sub } = onAuthChange((user, event) => {
      setCurrentUser(user);
      if (event === 'PASSWORD_RECOVERY') window.location.hash = '/settings';
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const authed = currentUser !== null;

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  // Live updates: Supabase Realtime tells this screen the moment anyone changes
  // a lead, site visit or campaign, and only then do we refetch — nothing is
  // downloaded while nothing changes. If the live connection drops (or Realtime
  // isn't enabled for these tables), fall back to refreshing every 30s; while
  // it's up, a 5-minute safety refresh covers any missed event. Coming back to
  // the tab (e.g. after a phone call) always refreshes straight away.
  useEffect(() => {
    if (!authed) return;
    let live = false;
    let debounce: number | undefined;
    const refreshSoon = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => load(), 800);
    };
    const channel = supabase.channel('crm-live');
    for (const table of ['leads', 'hospitality_leads', 'site_visits', 'campaigns']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refreshSoon);
    }
    channel.subscribe((status) => {
      const wasLive = live;
      live = status === 'SUBSCRIBED';
      // Reconnected after a drop — catch up on anything missed meanwhile.
      if (live && !wasLive && loadedOnce.current) load();
    });

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const stale = Date.now() - lastLoadAt.current > (live ? 5 * 60000 : 30000);
      if (stale) load();
    };
    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadAt.current > 5000) load();
    };
    const timer = window.setInterval(tick, 30000);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      window.clearTimeout(debounce);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      supabase.removeChannel(channel);
    };
  }, [authed, load]);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback((r: Route) => navigate(r), []);

  const handleSignOut = useCallback(() => {
    // Update the visible state immediately rather than waiting on the async
    // auth-change listener — if that listener (or the network sign-out call
    // it's paired with) ever hangs, the user must not be stuck looking logged in.
    setCurrentUser(null);
    setJustSignedIn(false);
    signOutUser().catch(() => {});
  }, []);

  const sidebarCurrent: NavId =
    route.name === 'leads' ? 'leads' :
    route.name === 'leadbank' ? 'leadbank' :
    route.name === 'import' ? 'import' :
    route.name === 'planner' ? 'planner' :
    route.name === 'sitevisits' ? 'sitevisits' :
    route.name === 'campaigns' ? 'campaigns' :
    route.name === 'reactivation' ? 'reactivation' :
    route.name === 'activitylog' ? 'activitylog' :
    route.name === 'settings' ? 'settings' :
    route.name === 'reports' ? 'reports' :
    route.name === 'inventory' ? 'inventory' :
    route.name === 'hospitality-leads' ? 'hospitality-leads' :
    route.name === 'hospitality-leadbank' ? 'hospitality-leadbank' :
    route.name === 'lead' ? 'leads' :
    route.name === 'hospitality-lead' ? 'hospitality-leads' : 'dashboard';

  // Buyer-facing plot page: no login, no CRM data.
  if (route.name === 'publicPlot') {
    return <PublicPlotPage plotId={route.id} buyerName={route.to} senderName={route.by} />;
  }
  if (route.name === 'quote') {
    return <PublicPlotPage linkId={route.id} />;
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-600" />
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={() => setJustSignedIn(true)} />;
  }

  // Live tour screens are full-screen, outside the CRM layout.
  if ((route.name === 'tour-remote' || route.name === 'tour-screen') && canSee('inventory')) {
    const exit = () => go({ name: 'inventory' });
    return route.name === 'tour-remote' ? <TourRemote onExit={exit} /> : <TourScreen onExit={exit} />;
  }

  return (
    <div className="min-h-screen bg-warm-bg">
      {currentUser && <QuoteAlerts user={currentUser} />}
      {justSignedIn && currentUser && (
        <WelcomeScreen user={currentUser} onDone={() => setJustSignedIn(false)} />
      )}

      <TopBar
        user={currentUser}
        onSearch={() => setSearchOpen(true)}
        onAdd={can.canWrite ? () => setAddOpen(true) : undefined}
        onSignOut={handleSignOut}
      />

      <div className="mx-auto flex w-full max-w-[1400px]">
        <Sidebar
          current={sidebarCurrent}
          onNavigate={(r) => go({ name: r })}
        />

        <main className="min-w-0 flex-1 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Keyed on route section only (not id) so switching between two records of the
              same type — e.g. one lead to another — updates in place exactly as before,
              instead of remounting and re-fetching. */}
          <div key={route.name} className="animate-fade-up">
          {!canSee(moduleOf(route)) ? (
            <NotAvailable onBack={() => go({ name: 'dashboard' })} />
          ) : (<>
          {route.name === 'dashboard' && (
            <Dashboard
              leads={leads}
              hospitalityLeads={hospitalityLeads}
              campaigns={campaigns}
              loading={loading}
              onOpenLead={(id) => go({ name: 'lead', id })}
              onOpenHospitalityLead={(id) => go({ name: 'hospitality-lead', id })}
              onAdd={() => setAddOpen(true)}
              onRefresh={load}
            />
          )}

          {route.name === 'leads' && (
            <LeadManagement
              leads={leads}
              campaigns={campaigns}
              profiles={profiles}
              onOpenLead={(id) => go({ name: 'lead', id })}
              onChanged={load}
            />
          )}

          {route.name === 'leadbank' && (
            <LeadBank
              campaigns={campaigns}
              onChanged={load}
            />
          )}

          {route.name === 'import' && (
            <LeadImport
              campaigns={campaigns}
              onImported={load}
            />
          )}

          {route.name === 'planner' && (
            <DayPlanner
              leads={leads}
              onOpenLead={(id) => go({ name: 'lead', id })}
            />
          )}

          {route.name === 'sitevisits' && (
            <SiteVisits
              leads={leads}
              campaigns={campaigns}
              onOpenLead={(id) => go({ name: 'lead', id })}
              onChanged={load}
            />
          )}

          {route.name === 'reports' && (
            <Reports
              leads={leads}
              hospitalityLeads={hospitalityLeads}
              campaigns={campaigns}
              profiles={profiles}
              onOpenCampaigns={() => go({ name: 'campaigns' })}
              onOpenLead={(v, id) => go(v === 'Hospitality' ? { name: 'hospitality-lead', id } : { name: 'lead', id })}
            />
          )}

          {route.name === 'campaigns' && (
            <CampaignAnalytics
              leads={leads}
              onLeadsChanged={load}
            />
          )}

          {route.name === 'reactivation' && (
            <LeadReactivation
              leads={leads}
              campaigns={campaigns}
              onOpenLead={(id) => go({ name: 'lead', id })}
              onChanged={load}
            />
          )}


          {route.name === 'inventory' && <LiveInventoryBoard />}

          {route.name === 'hospitality-leads' && (
            <HospitalityLeadManagement
              leads={hospitalityLeads}
              profiles={profiles}
              onOpenLead={(id) => go({ name: 'hospitality-lead', id })}
              onChanged={load}
            />
          )}

          {route.name === 'hospitality-lead' && (
            <HospitalityLeadDetail
              id={route.id}
              leads={hospitalityLeads}
              profiles={profiles}
              onBack={() => go({ name: 'hospitality-leads' })}
              onChanged={load}
            />
          )}

          {route.name === 'hospitality-leadbank' && (
            <HospitalityComingSoon
              icon={Landmark}
              title="Hospitality Lead Bank"
              description="Raw hospitality enquiries will sit here until someone qualifies them into a lead, mirroring the Real Estate Lead Bank."
            />
          )}

          {route.name === 'activitylog' && (
            <ActivityLog onOpenLead={(id) => go({ name: 'lead', id })} />
          )}

          {route.name === 'settings' && currentUser && (
            <Settings user={currentUser} profiles={profiles} onSignOut={handleSignOut} onTeamChanged={load} />
          )}

          {route.name === 'lead' && (
            <LeadDetail
              id={route.id}
              leads={leads}
              campaigns={campaigns}
              profiles={profiles}
              onBack={() => go({ name: 'leads' })}
              onChanged={load}
            />
          )}

          {route.name === 'search' && (
            <SearchView
              leads={leads}
              onOpenLead={(id) => go({ name: 'lead', id })}
            />
          )}

          {route.name === 'notfound' && (
            <div className="py-24 text-center">
              <p className="font-display text-lg font-bold text-gray-900">Page not found</p>
              <p className="mt-1 text-sm text-gray-500">There's nothing at this address.</p>
              <button onClick={() => go({ name: 'dashboard' })} className="mt-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                Back to Dashboard
              </button>
            </div>
          )}
          </>)}
          </div>
        </main>
      </div>

      {can.canWrite && <Fab onAdd={() => setAddOpen(true)} />}

      {addOpen && (
        <AddLeadModal
          campaigns={campaigns}
          profiles={profiles}
          onClose={() => setAddOpen(false)}
          onCreated={(lead) => {
            setAddOpen(false);
            load();
            go({ name: 'lead', id: lead.id });
          }}
        />
      )}

      {searchOpen && (
        <SearchView
          leads={leads}
          onOpenLead={(id) => {
            setSearchOpen(false);
            go({ name: 'lead', id });
          }}
          overlay
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
