import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyPassUpdated } from '../lib/wallet';
import { fmtDate, timeAgo } from '../lib/format';
import { cardProgress, fmtShortDate, KIND_LABEL, packStatus, PACK_STATUS_LABEL, price } from '../lib/cards';
import { Cup } from './CardPreview';

/** Staff actions for one card: stamps/rewards for loyalty cards, sell/use cups for packs. */
export default function CustomerPanel({ customer, program, programs, shop, onChange, onSwitch }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [others, setOthers] = useState([]);
  const isPack = program.kind === 'subscription';

  useEffect(() => {
    supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shop.id)
      .eq('email', customer.email)
      .neq('id', customer.id)
      .then(({ data }) => setOthers(data ?? []));
  }, [customer.id, customer.email, shop.id]);

  async function run(label, rpc, args, message) {
    setBusy(label);
    setError('');
    const { data, error: err } = await supabase.rpc(rpc, args);
    setBusy(null);
    if (err) return setError(err.message);
    onChange(data);
    notifyPassUpdated({ customer_id: customer.id });
    setFlash(message);
    setTimeout(() => setFlash(''), 2200);
  }

  const id = { p_customer_id: customer.id };
  const programById = (pid) => programs.find((p) => p.id === pid);

  return (
    <div className="cpanel">
      <div className="cpanel-head">
        <div>
          <h3>{customer.name}</h3>
          <p>
            {customer.email}
            {customer.age ? ` · ${customer.age}` : ''} · joined {fmtDate(customer.created_at)}
          </p>
        </div>
        <span className={`chip chip-${customer.wallet_added_at ? customer.platform : 'web'}`}>
          {customer.wallet_added_at ? (customer.platform === 'apple' ? 'Apple Wallet' : 'Google Wallet') : 'Web card'}
        </span>
      </div>

      <div className="cpanel-card" style={{ '--pass-bg': program.card_color || shop.brand_color }}>
        <span className={`chip chip-${program.kind}`}>{KIND_LABEL[program.kind]}</span>
        <strong>{program.name}</strong>
        {isPack && <span className="muted small">{PACK_STATUS_LABEL[packStatus(customer)]}</span>}
      </div>

      {isPack ? (
        <PackBody customer={customer} program={program} />
      ) : (
        <div className="cpanel-stamps">
          {Array.from({ length: Math.min(program.stamps_required, 15) }, (_, i) => (
            <Cup key={i} filled={i < customer.stamps} />
          ))}
          <strong>
            {customer.stamps}/{program.stamps_required}
          </strong>
        </div>
      )}

      {flash && <div className="cpanel-flash">{flash}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <div className="cpanel-actions">
        {isPack ? (
          <>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => run('cup', 'use_cup', { ...id, p_count: 1 }, '−1 cup ☕')}
              disabled={!!busy || packStatus(customer) !== 'active'}
            >
              {busy === 'cup' ? 'Saving…' : 'Use 1 cup'}
            </button>
            <button
              className="btn btn-reward btn-lg"
              onClick={() => {
                if (window.confirm(`Take ${price(program.pack_price)} for ${program.cups_included} cups, then confirm.`)) {
                  run('sell', 'sell_pack', id, `Pack loaded: +${program.cups_included} cups`);
                }
              }}
              disabled={!!busy}
            >
              {customer.packs_purchased ? 'Renew pack' : 'Sell pack'} · {price(program.pack_price)}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-lg" onClick={() => run('s1', 'add_stamps', { ...id, p_count: 1 }, '+1 stamp')} disabled={!!busy}>
              {busy === 's1' ? 'Adding…' : '+1 stamp'}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => run('s2', 'add_stamps', { ...id, p_count: 2 }, '+2 stamps')} disabled={!!busy}>
              +2
            </button>
            <button
              className="btn btn-reward btn-lg"
              onClick={() => run('redeem', 'redeem_reward', id, 'Reward redeemed ☕')}
              disabled={customer.stamps < program.stamps_required || !!busy}
              title={customer.stamps < program.stamps_required ? `Needs ${program.stamps_required - customer.stamps} more stamps` : ''}
            >
              Redeem reward
            </button>
          </>
        )}
      </div>

      <dl className="cpanel-stats">
        <div>
          <dt>Visits</dt>
          <dd>{customer.visits}</dd>
        </div>
        {isPack ? (
          <div>
            <dt>Packs bought</dt>
            <dd>{customer.packs_purchased}</dd>
          </div>
        ) : (
          <div>
            <dt>Rewards</dt>
            <dd>{customer.rewards_redeemed}</dd>
          </div>
        )}
        <div>
          <dt>Last visit</dt>
          <dd>{timeAgo(customer.last_visit_at)}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{fmtDate(customer.created_at)}</dd>
        </div>
      </dl>

      {others.length > 0 && (
        <div className="cpanel-others">
          <span className="muted small">Also holds</span>
          {others.map((o) => {
            const p = programById(o.program_id);
            return (
              <button key={o.id} className="btn btn-ghost" onClick={() => onSwitch?.(o)} disabled={!onSwitch}>
                {p?.name ?? 'Card'} · {cardProgress(o, p)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PackBody({ customer, program }) {
  const status = packStatus(customer);
  const total = Math.max(customer.credits_total, program.cups_included);
  return (
    <div className="cpanel-pack">
      <div className="cpanel-meter" aria-label={`${customer.credits} cups left`}>
        <span style={{ width: `${status === 'active' ? (customer.credits / total) * 100 : 0}%` }} />
      </div>
      <div className="cpanel-pack-row">
        <strong>{status === 'active' ? `${customer.credits} of ${customer.credits_total} cups left` : PACK_STATUS_LABEL[status]}</strong>
        {customer.pack_expires_at && (
          <span className="muted small">
            {status === 'expired' ? 'Expired' : 'Valid until'} {fmtShortDate(customer.pack_expires_at)}
          </span>
        )}
      </div>
    </div>
  );
}
