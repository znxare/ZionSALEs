import { useEffect, useState, useCallback } from 'react';
import { fetchLeads, fetchCampaigns, fetchProfiles, type Lead, type Campaign, type Profile } from '@/lib/crm';
import Dashboard from '@/components/Dashboard';
import LeadDetail from '@/components/LeadDetail';
import LeadManagement from '@/components/LeadManagement';
import CampaignAnalytics from '@/components/CampaignAnalytics';
import AddLeadModal from '@/components/AddLeadModal';
import SearchView from '@/components/SearchView';
import Fab from '@/components/Fab';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import SiteVisits from '@/components/SiteVisits';
import LeadBank from '@/components/LeadBank';
import DayPlanner from '@/components/DayPlanner';
import LeadReactivation from '@/components/LeadReactivation';
import SalesBattleCard from '@/components/SalesBattleCard';
import LeadImport from '@/components/LeadImport';
import ActivityLog from '@/components/ActivityLog';
import Login from '@/components/Login';
import { getSession, onAuthChange, type CurrentUser } from '@/lib/auth';

type Route =
  | { name: 'dashboard' }
  | { name: 'leads' }
  | { name: 'leadbank' }
  | { name: 'import' }
  | { name: 'planner' }
  | { name: 'sitevisits' }
  | { name: 'campaigns' }
  | { name: 'reactivation' }
  | { name: 'battlecard' }
  | { name: 'activitylog' }
  | { name: 'lead'; id: string }
  | { name: 'search' }
  | { name: 'notfound' };

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === '' || h === '/') return { name: 'dashboard' };
  if (h.startsWith('lead/')) return { name: 'lead', id: h.slice(5) };
  if (h === 'search') return { name: 'search' };
  if (h === 'leads') return { name: 'leads' };
  if (h === 'leadbank') return { name: 'leadbank' };
  if (h === 'import') return { name: 'import' };
  if (h === 'planner') return { name: 'planner' };
  if (h === 'sitevisits') return { name: 'sitevisits' };
  if (h === 'campaigns') return { name: 'campaigns' };
  if (h === 'reactivation') return { name: 'reactivation' };
  if (h === 'battlecard') return { name: 'battlecard' };
  if (h === 'activitylog') return { name: 'activitylog' };
  return { name: 'notfound' };
}

function navigate(route: Route) {
  if (route.name === 'dashboard') window.location.hash = '/';
  else if (route.name === 'lead') window.location.hash = `/lead/${route.id}`;
  else if (route.name === 'search') window.location.hash = '/search';
  else if (route.name === 'leads') window.location.hash = '/leads';
  else if (route.name === 'leadbank') window.location.hash = '/leadbank';
  else if (route.name === 'import') window.location.hash = '/import';
  else if (route.name === 'planner') window.location.hash = '/planner';
  else if (route.name === 'sitevisits') window.location.hash = '/sitevisits';
  else if (route.name === 'campaigns') window.location.hash = '/campaigns';
  else if (route.name === 'reactivation') window.location.hash = '/reactivation';
  else if (route.name === 'battlecard') window.location.hash = '/battlecard';
  else if (route.name === 'activitylog') window.location.hash = '/activitylog';
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [route, setRoute] = useState<Route>(parseHash);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [leadData, campaignData, profileData] = await Promise.all([fetchLeads(), fetchCampaigns(), fetchProfiles()]);
      setLeads(leadData);
      setCampaigns(campaignData);
      setProfiles(profileData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSession()
      .then(setCurrentUser)
      .finally(() => setAuthChecked(true));
    const { data: sub } = onAuthChange((user) => setCurrentUser(user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const authed = currentUser !== null;

  useEffect(() => {
    if (authed) load();
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

  const sidebarCurrent: 'dashboard' | 'leads' | 'sitevisits' | 'campaigns' | 'leadbank' | 'import' | 'planner' | 'reactivation' | 'battlecard' | 'activitylog' =
    route.name === 'leads' ? 'leads' :
    route.name === 'leadbank' ? 'leadbank' :
    route.name === 'import' ? 'import' :
    route.name === 'planner' ? 'planner' :
    route.name === 'sitevisits' ? 'sitevisits' :
    route.name === 'campaigns' ? 'campaigns' :
    route.name === 'reactivation' ? 'reactivation' :
    route.name === 'battlecard' ? 'battlecard' :
    route.name === 'activitylog' ? 'activitylog' :
    route.name === 'lead' ? 'leads' : 'dashboard';

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-600" />
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-warm-bg">
      <TopBar
        user={currentUser}
        onSearch={() => setSearchOpen(true)}
        onAdd={() => setAddOpen(true)}
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

          {route.name === 'dashboard' && (
            <Dashboard
              leads={leads}
              campaigns={campaigns}
              loading={loading}
              onOpenLead={(id) => go({ name: 'lead', id })}
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

          {route.name === 'battlecard' && <SalesBattleCard />}

          {route.name === 'activitylog' && (
            <ActivityLog onOpenLead={(id) => go({ name: 'lead', id })} />
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
        </main>
      </div>

      <Fab onAdd={() => setAddOpen(true)} />

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
