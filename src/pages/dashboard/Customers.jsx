import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { downloadCsv, fmtDate, timeAgo } from '../../lib/format';
import { cardProgress, packStatus } from '../../lib/cards';
import CustomerPanel from '../../components/CustomerPanel';
import { Notice, PageHead, Spinner } from '../../components/ui';

// Each row is one card a customer holds; a person with two cards appears twice.
const FILTERS = {
  all: () => true,
  ready: (c, p) => p?.kind === 'loyalty' && c.stamps >= p.stamps_required,
  packs: (c, p) => p?.kind === 'subscription' && packStatus(c) === 'active',
  unpaid: (c, p) => p?.kind === 'subscription' && packStatus(c) !== 'active',
  lapsed: (c) => !c.last_visit_at || Date.now() - new Date(c.last_visit_at) > 30 * 864e5,
};

export default function Customers() {
  const { shop, programs } = useOutletContext();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [programId, setProgramId] = useState('');
  const [openId, setOpenId] = useState(null);

  const programOf = (c) => programs.find((p) => p.id === c.program_id);
  const hasPacks = programs.some((p) => p.kind === 'subscription');

  useEffect(() => {
    supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error: err }) => (err ? setError(err.message) : setRows(data)));
  }, [shop.id]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((c) => {
      const p = programs.find((x) => x.id === c.program_id);
      return (
        FILTERS[filter](c, p) &&
        (!programId || c.program_id === programId) &&
        (!needle || c.name.toLowerCase().includes(needle) || c.email.includes(needle))
      );
    });
  }, [rows, q, filter, programId, programs]);

  const people = useMemo(() => new Set((rows ?? []).map((r) => r.email)).size, [rows]);
  const update = (c) => setRows((rs) => rs.map((r) => (r.id === c.id ? c : r)));

  function exportCsv() {
    downloadCsv(
      `${shop.slug}-customers.csv`,
      visible.map((c) => ({
        name: c.name,
        email: c.email,
        age: c.age,
        card: programOf(c)?.name,
        progress: cardProgress(c, programOf(c)),
        visits: c.visits,
        rewards_redeemed: c.rewards_redeemed,
        packs_purchased: c.packs_purchased,
        wallet: c.wallet_added_at ? c.platform : 'web',
        joined: c.created_at,
        last_visit: c.last_visit_at,
      })),
    );
  }

  const filterButtons = [
    ['all', 'All'],
    ['ready', 'Reward ready'],
    ...(hasPacks ? [['packs', 'Active packs'], ['unpaid', 'Pack unpaid / used up']] : []),
    ['lapsed', 'Not seen 30d'],
  ];

  return (
    <>
      <PageHead title="Customers" sub={rows ? `${people} people holding ${rows.length} cards.` : ''}>
        <button className="btn btn-ghost" onClick={exportCsv} disabled={!visible.length}>
          Export CSV
        </button>
      </PageHead>

      <div className="toolbar">
        <input className="search" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        {programs.length > 1 && (
          <select className="select" value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Card">
            <option value="">All cards</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <div className="seg">
          {filterButtons.map(([k, label]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!rows && !error && <Spinner />}

      {rows && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Card</th>
                <th className="hide-sm">Visits</th>
                <th className="hide-sm">Wallet</th>
                <th className="hide-sm">Joined</th>
                <th className="hide-sm">Last visit</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <Row
                  key={c.id}
                  c={c}
                  program={programOf(c)}
                  programs={programs}
                  shop={shop}
                  open={openId === c.id}
                  onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                  onChange={update}
                  onSwitch={(o) => setOpenId(o.id)}
                />
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6} className="muted center">
                    No customers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Row({ c, program, programs, shop, open, onToggle, onChange, onSwitch }) {
  const ready = program?.kind === 'loyalty' && c.stamps >= program.stamps_required;
  return (
    <>
      <tr className={`row${open ? ' row-open' : ''}`} onClick={onToggle}>
        <td>
          <strong>{c.name}</strong>
          <div className="muted small">{c.email}</div>
        </td>
        <td>
          <span className="small">{program?.name}</span>
          <div className={ready ? 'stamp-count ready' : 'stamp-count'}>{cardProgress(c, program)}</div>
        </td>
        <td className="hide-sm">{c.visits}</td>
        <td className="hide-sm">
          <span className={`chip chip-${c.wallet_added_at ? c.platform : 'web'}`}>
            {c.wallet_added_at ? (c.platform === 'apple' ? 'Apple' : 'Google') : 'Web'}
          </span>
        </td>
        <td className="hide-sm">{fmtDate(c.created_at)}</td>
        <td className="hide-sm">{timeAgo(c.last_visit_at)}</td>
      </tr>
      {open && program && (
        <tr className="row-detail">
          <td colSpan={6}>
            <CustomerPanel key={c.id} customer={c} program={program} programs={programs} shop={shop} onChange={onChange} onSwitch={onSwitch} />
          </td>
        </tr>
      )}
    </>
  );
}
