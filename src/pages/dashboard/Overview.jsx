import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../../lib/supabase';
import { KIND_LABEL, price } from '../../lib/cards';
import { Notice, PageHead, Spinner } from '../../components/ui';

const MARK = '#c9a06a';
const GRID = 'rgba(240, 230, 213, 0.1)';
const AXIS = '#9a8566';
const RANGES = [7, 30, 90];

const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const plain = (unit) => (v) => `${v} ${unit}`;
const count = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function ChartTip({ active, payload, format }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tip">
      <span>{dayLabel(p.payload.day)}</span>
      <strong>{format(p.value)}</strong>
    </div>
  );
}

function DailyBars({ data, dataKey, format }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="day"
          tickFormatter={dayLabel}
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(201,160,106,0.14)' }} content={<ChartTip format={format} />} />
        <Bar dataKey={dataKey} fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarList({ rows, format = (n) => n }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.n)}`}>
          <span className="barlist-label">{r.label}</span>
          <span className="barlist-track">
            <span style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="barlist-value">{format(r.n)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Overview() {
  const { shop, programs } = useOutletContext();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const hasPacks = programs.some((p) => p.kind === 'subscription');

  useEffect(() => {
    setStats(null);
    supabase.rpc('shop_analytics', { p_shop_id: shop.id, p_days: days }).then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setStats(data);
    });
  }, [shop.id, days]);

  const t = stats?.totals;
  const p = stats?.period;
  const walletPct = t?.cards ? Math.round((t.in_wallet / t.cards) * 100) : 0;

  return (
    <>
      <PageHead title={`Good to see you, ${shop.name}`} sub="How your cards are brewing.">
        <div className="seg" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} className={days === r ? 'on' : ''} onClick={() => setDays(r)}>
              {r}d
            </button>
          ))}
        </div>
      </PageHead>

      {error && <Notice tone="error">{error}</Notice>}
      {!stats && !error && <Spinner />}

      {stats && (
        <>
          {t.members === 0 && (
            <Notice>
              No members yet. Print your <Link to="/dashboard/qr">QR poster</Link> and put it by the till, or read{' '}
              <Link to="/dashboard/guide">How it works</Link>.
            </Notice>
          )}

          <section className="tiles">
            <div className="tile tile-hero">
              <small>Members</small>
              <strong>{t.members}</strong>
              <span>
                +{stats.new_members} in {days} days · {count(t.cards, 'card')}
              </span>
            </div>
            <div className="tile">
              <small>Visits ({days}d)</small>
              <strong>{p.visits}</strong>
              <span>{count(t.active, 'person', 'people')} came back</span>
            </div>
            <div className="tile">
              <small>Rewards redeemed</small>
              <strong>{p.redeems}</strong>
              <span>{t.reward_ready} ready to claim now</span>
            </div>
            {hasPacks && (
              <>
                <div className="tile">
                  <small>Pack sales ({days}d)</small>
                  <strong>{price(p.pack_revenue)}</strong>
                  <span>{count(p.packs_sold, 'pack')} sold</span>
                </div>
                <div className="tile">
                  <small>Prepaid cups owed</small>
                  <strong>{t.prepaid_cups}</strong>
                  <span>
                    on {count(t.active_packs, 'active pack')} · {p.cups_used} poured
                  </span>
                </div>
              </>
            )}
            <div className="tile">
              <small>In a wallet</small>
              <strong>{walletPct}%</strong>
              <span>
                {t.in_wallet} of {t.cards} cards
              </span>
            </div>
          </section>

          <section className="panels">
            <div className="panel">
              <h2>Sign-ups per day</h2>
              <DailyBars data={stats.daily} dataKey="signups" format={plain('sign-ups')} />
            </div>
            <div className="panel">
              <h2>Visits per day</h2>
              <DailyBars data={stats.daily} dataKey="visits" format={plain('visits')} />
            </div>
            {hasPacks && (
              <div className="panel">
                <h2>Pack sales per day</h2>
                <DailyBars data={stats.daily} dataKey="revenue" format={price} />
              </div>
            )}
            <div className="panel">
              <h2>Your cards</h2>
              <ul className="prog-stats">
                {stats.programs.map((pr) => (
                  <li key={pr.id}>
                    <div>
                      <strong>{pr.name}</strong>
                      <span className="muted small">
                        {KIND_LABEL[pr.kind]}
                        {!pr.is_active && ' · hidden'}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>Cards</dt>
                        <dd>{pr.cards}</dd>
                      </div>
                      <div>
                        <dt>Visits</dt>
                        <dd>{pr.visits}</dd>
                      </div>
                      {pr.kind === 'subscription' ? (
                        <div>
                          <dt>Sales</dt>
                          <dd>{price(pr.revenue)}</dd>
                        </div>
                      ) : (
                        <div>
                          <dt>Rewards</dt>
                          <dd>{pr.redeems}</dd>
                        </div>
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h2>Where cards live</h2>
              <BarList
                rows={[
                  { label: 'Apple Wallet', n: t.apple },
                  { label: 'Google Wallet', n: t.google },
                  { label: 'Web card', n: t.web },
                ]}
              />
            </div>
            <div className="panel">
              <h2>
                Age groups {stats.avg_age && <span className="panel-aside">avg {stats.avg_age}</span>}
              </h2>
              {stats.ages.length ? (
                <BarList rows={stats.ages.map((a) => ({ label: a.bucket, n: a.n }))} />
              ) : (
                <p className="muted">No data yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
