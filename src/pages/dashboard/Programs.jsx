import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { notifyPassUpdated } from '../../lib/wallet';
import { KIND_LABEL, packSavings, price, programPitch } from '../../lib/cards';
import CardPreview from '../../components/CardPreview';
import { Field, Notice, PageHead } from '../../components/ui';

const TEMPLATES = {
  loyalty: {
    kind: 'loyalty',
    name: 'Loyalty card',
    description: '',
    stamps_required: 10,
    reward_text: 'Free drink of your choice',
    welcome_stamps: 0,
  },
  subscription: {
    kind: 'subscription',
    name: '10-Coffee Pack',
    description: 'Any regular coffee, any size.',
    cups_included: 10,
    pack_price: 35,
    regular_cup_price: 4,
    valid_days: 90,
  },
};

const FIELDS = [
  'kind', 'name', 'description', 'card_color', 'is_active', 'stamps_required', 'reward_text', 'welcome_stamps',
  'cups_included', 'pack_price', 'regular_cup_price', 'valid_days',
];

const num = (v) => (v === '' || v == null ? null : Number(v));

function ProgramEditor({ shop, initial, onSaved, onCancel, onDeleted }) {
  const [form, setForm] = useState(() => ({ card_color: '', is_active: true, ...initial }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPack = form.kind === 'subscription';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = Object.fromEntries(FIELDS.map((k) => [k, form[k] ?? null]));
    Object.assign(payload, {
      card_color: form.card_color || null,
      description: form.description || null,
      stamps_required: isPack ? null : num(form.stamps_required),
      reward_text: isPack ? null : form.reward_text,
      welcome_stamps: isPack ? 0 : num(form.welcome_stamps) ?? 0,
      cups_included: isPack ? num(form.cups_included) : null,
      pack_price: isPack ? num(form.pack_price) : null,
      regular_cup_price: isPack ? num(form.regular_cup_price) : null,
      valid_days: isPack ? num(form.valid_days) : null,
    });
    const query = form.id
      ? supabase.from('programs').update(payload).eq('id', form.id)
      : supabase.from('programs').insert({ ...payload, shop_id: shop.id });
    const { error: err } = await query;
    setBusy(false);
    if (err) return setError(err.message);
    notifyPassUpdated({ shop_id: shop.id });
    onSaved();
  }

  async function remove() {
    if (!window.confirm(`Delete "${form.name}"? This can't be undone.`)) return;
    const { error: err } = await supabase.from('programs').delete().eq('id', form.id);
    if (err) {
      return setError(
        err.code === '23503' ? 'Customers already hold this card. Untick "Offer on sign-up page" to hide it instead.' : err.message,
      );
    }
    onDeleted();
  }

  const savings = isPack ? packSavings({ ...form, pack_price: num(form.pack_price), regular_cup_price: num(form.regular_cup_price), cups_included: num(form.cups_included) }) : 0;

  return (
    <div className="editor">
      <form className="design-form" onSubmit={save}>
        <fieldset>
          <legend>{form.id ? `Edit ${KIND_LABEL[form.kind].toLowerCase()}` : `New ${KIND_LABEL[form.kind].toLowerCase()}`}</legend>
          <Field label="Card name" hint="Shown on the wallet card and the sign-up page.">
            <input value={form.name} onChange={set('name')} required maxLength={40} />
          </Field>
          <Field label="Short description" hint="Optional, e.g. what drinks it covers.">
            <input value={form.description ?? ''} onChange={set('description')} maxLength={120} />
          </Field>

          {isPack ? (
            <>
              <div className="grid-2">
                <Field label="Cups in the pack">
                  <input type="number" min={1} max={200} value={form.cups_included} onChange={set('cups_included')} required />
                </Field>
                <Field label="Pack price ($)">
                  <input type="number" min={0} step="0.01" value={form.pack_price} onChange={set('pack_price')} required />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Normal price per cup ($)" hint="Used to show customers what they save.">
                  <input type="number" min={0} step="0.01" value={form.regular_cup_price ?? ''} onChange={set('regular_cup_price')} />
                </Field>
                <Field label="Valid for (days)" hint="Leave blank to never expire.">
                  <input type="number" min={1} max={730} value={form.valid_days ?? ''} onChange={set('valid_days')} />
                </Field>
              </div>
              {savings > 0 && (
                <Notice tone="success">
                  Customers save {price(savings)} per pack ({price((num(form.pack_price) / num(form.cups_included)).toFixed(2))} per cup).
                </Notice>
              )}
            </>
          ) : (
            <>
              <div className="grid-2">
                <Field label="Stamps for a reward">
                  <input type="number" min={1} max={30} value={form.stamps_required} onChange={set('stamps_required')} required />
                </Field>
                <Field label="Welcome stamps" hint="Given on sign-up.">
                  <input type="number" min={0} max={10} value={form.welcome_stamps} onChange={set('welcome_stamps')} />
                </Field>
              </div>
              <Field label="Reward">
                <input value={form.reward_text ?? ''} onChange={set('reward_text')} required maxLength={60} />
              </Field>
            </>
          )}

          <div className="grid-2">
            <Field label="Card colour" hint="Defaults to your brand colour.">
              <div className="color-row">
                <input type="color" value={form.card_color || shop.brand_color} onChange={set('card_color')} />
                {form.card_color && (
                  <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, card_color: '' }))}>
                    Reset
                  </button>
                )}
              </div>
            </Field>
            <label className="check check-field">
              <input type="checkbox" checked={!!form.is_active} onChange={set('is_active')} />
              Offer on sign-up page
            </label>
          </div>
        </fieldset>

        {error && <Notice tone="error">{error}</Notice>}
        <div className="editor-actions">
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Saving…' : 'Save card'}
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel}>
            Cancel
          </button>
          {form.id && (
            <button type="button" className="link-btn danger" onClick={remove}>
              Delete
            </button>
          )}
        </div>
      </form>
      <aside className="design-preview">
        <p className="eyebrow">Preview</p>
        <CardPreview
          shop={shop}
          program={{
            ...form,
            stamps_required: num(form.stamps_required) || 10,
            cups_included: num(form.cups_included) || 10,
            pack_price: num(form.pack_price) || 0,
          }}
        />
      </aside>
    </div>
  );
}

export default function Programs() {
  const { shop, programs, reloadPrograms } = useOutletContext();
  const [editing, setEditing] = useState(null);

  const done = async () => {
    await reloadPrograms();
    setEditing(null);
  };

  if (editing) {
    return (
      <>
        <PageHead title="Cards" sub="Design what customers carry in their wallet." />
        <ProgramEditor key={editing.id ?? editing.kind} shop={shop} initial={editing} onSaved={done} onCancel={() => setEditing(null)} onDeleted={done} />
      </>
    );
  }

  return (
    <>
      <PageHead title="Cards" sub="Offer a free stamp card, prepaid coffee packs, or both. Customers can hold several.">
        <button className="btn btn-ghost" onClick={() => setEditing({ ...TEMPLATES.loyalty })}>
          + Loyalty card
        </button>
        <button className="btn btn-primary" onClick={() => setEditing({ ...TEMPLATES.subscription })}>
          + Coffee pack
        </button>
      </PageHead>

      {!programs.length && <Notice>You have no cards yet. Add a loyalty card to start collecting customers.</Notice>}

      <div className="program-grid">
        {programs.map((p) => (
          <button key={p.id} className={`program-tile${p.is_active ? '' : ' off'}`} onClick={() => setEditing(p)}>
            <CardPreview shop={shop} program={p} showQr={false} />
            <div className="program-meta">
              <span className={`chip chip-${p.kind}`}>{KIND_LABEL[p.kind]}</span>
              {!p.is_active && <span className="chip">Hidden</span>}
              <strong>{p.name}</strong>
              <span className="muted small">{programPitch(p)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
