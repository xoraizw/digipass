import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Logo, Spinner } from '../../components/ui';
import Onboarding from './Onboarding';

const NAV = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/scan', label: 'Scan' },
  { to: '/dashboard/customers', label: 'Customers' },
  { to: '/dashboard/cards', label: 'Cards' },
  { to: '/dashboard/design', label: 'Branding' },
  { to: '/dashboard/qr', label: 'QR poster' },
  { to: '/dashboard/guide', label: 'How it works' },
];

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const [shop, setShop] = useState(undefined);
  const [programs, setPrograms] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadPrograms = useCallback(async (shopId) => {
    const { data } = await supabase
      .from('programs')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order')
      .order('created_at');
    setPrograms(data ?? []);
  }, []);

  useEffect(() => {
    supabase
      .from('shops')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) await loadPrograms(data.id);
        setShop(data ?? null);
      });
    supabase.rpc('is_platform_admin').then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user.id, loadPrograms]);

  if (shop === undefined) return <Spinner full />;
  if (shop === null) {
    return (
      <Onboarding
        user={user}
        isAdmin={isAdmin}
        onCreated={async (s) => {
          await loadPrograms(s.id);
          setShop(s);
        }}
      />
    );
  }

  return (
    <div className="dash">
      <aside className="side">
        <Logo to="/dashboard" light />
        <div className="side-shop">
          <span className="side-dot" style={{ background: shop.brand_color }} />
          <div>
            <strong>{shop.name}</strong>
            <a href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">
              /s/{shop.slug} ↗
            </a>
          </div>
        </div>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
          {isAdmin && <Link to="/admin">Platform admin</Link>}
        </nav>
        <div className="side-foot">
          {shop.plan_status !== 'active' && <span className="side-plan">Plan: {shop.plan_status.replace('_', ' ')}</span>}
          <button className="link-btn link-light" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="dash-main">
        <Outlet context={{ shop, setShop, programs, reloadPrograms: () => loadPrograms(shop.id) }} />
      </main>
    </div>
  );
}
