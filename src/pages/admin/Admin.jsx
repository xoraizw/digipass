import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { fmtDate, money } from '../../lib/format';
import { Logo, Notice, PageHead, Spinner } from '../../components/ui';

const STATUSES = ['trial', 'active', 'past_due', 'cancelled'];

export default function Admin() {
  const { user, signOut } = useAuth();
  const [allowed, setAllowed] = useState(null);
  const [shops, setShops] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('is_platform_admin').then(({ data }) => {
      setAllowed(Boolean(data));
      if (!data) return;
      supabase
        .from('shops')
        .select('*, customers(count)')
        .order('created_at', { ascending: false })
        .then(({ data: rows, error: err }) => (err ? setError(err.message) : setShops(rows)));
    });
  }, []);

  async function update(id, patch) {
    setShops((rows) => rows.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error: err } = await supabase.from('shops').update(patch).eq('id', id);
    if (err) setError(err.message);
  }

  if (allowed === null) return <Spinner full />;
  if (!allowed) {
    return (
      <div className="setup-screen">
        <h1>Platform admins only.</h1>
        <p>
          Add your user id (<code>{user.id}</code>) to the <code>platform_admins</code> table in Supabase.
        </p>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }

  const active = shops?.filter((s) => s.plan_status === 'active') ?? [];
  const mrr = active.reduce((sum, s) => sum + Number(s.monthly_fee), 0);
  const members = shops?.reduce((sum, s) => sum + (s.customers?.[0]?.count ?? 0), 0) ?? 0;
  const unpaidSetup = shops?.filter((s) => !s.setup_fee_paid && s.plan_status !== 'cancelled').length ?? 0;

  return (
    <div className="admin">
      <header className="admin-top">
        <Logo to="/admin" />
        <nav>
          <Link to="/dashboard">My shop</Link>
          <button className="link-btn" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="admin-main">
        <PageHead title="Platform" sub="Every coffee house on XtraCup, and what they pay." />
        {error && <Notice tone="error">{error}</Notice>}
        {!shops && !error && <Spinner />}
        {shops && (
          <>
            <section className="tiles">
              <div className="tile tile-hero">
                <small>Monthly recurring</small>
                <strong>{money(mrr)}</strong>
                <span>{active.length} paying shops</span>
              </div>
              <div className="tile">
                <small>Shops</small>
                <strong>{shops.length}</strong>
                <span>{shops.filter((s) => s.plan_status === 'trial').length} on trial</span>
              </div>
              <div className="tile">
                <small>Cards issued</small>
                <strong>{members}</strong>
                <span>across all shops</span>
              </div>
              <div className="tile">
                <small>Setup fee owed</small>
                <strong>{unpaidSetup}</strong>
                <span>shops not yet paid</span>
              </div>
            </section>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Cards</th>
                    <th>Plan</th>
                    <th>Monthly</th>
                    <th>Setup paid</th>
                    <th>Live</th>
                    <th className="hide-sm">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <div className="muted small">
                          <a href={`/s/${s.slug}`} target="_blank" rel="noreferrer">
                            /s/{s.slug}
                          </a>{' '}
                          · {s.contact_email}
                          {s.contact_phone ? ` · ${s.contact_phone}` : ''}
                        </div>
                      </td>
                      <td>{s.customers?.[0]?.count ?? 0}</td>
                      <td>
                        <select value={s.plan_status} onChange={(e) => update(s.id, { plan_status: e.target.value })}>
                          {STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="money-input"
                          type="number"
                          min={0}
                          step="1"
                          defaultValue={s.monthly_fee}
                          onBlur={(e) => Number(e.target.value) !== Number(s.monthly_fee) && update(s.id, { monthly_fee: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input type="checkbox" checked={s.setup_fee_paid} onChange={(e) => update(s.id, { setup_fee_paid: e.target.checked })} />
                      </td>
                      <td>
                        <input type="checkbox" checked={s.is_live} onChange={(e) => update(s.id, { is_live: e.target.checked })} />
                      </td>
                      <td className="hide-sm">{fmtDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
