import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { slugify } from '../../lib/format';
import CardPreview from '../../components/CardPreview';
import { Field, Logo, Notice } from '../../components/ui';

const SWATCHES = ['#2b1a10', '#1f3a2e', '#b8492b', '#20304f', '#5b2a4a', '#0f0f0f', '#c9a227', '#3d5a40'];

export default function Onboarding({ user, onCreated, isAdmin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    contact_phone: '',
    address: '',
    brand_color: SWATCHES[0],
    accent_color: '#e0a15e',
    text_color: '#fbf3e6',
    stamps_required: 10,
    reward_text: 'Free drink of your choice',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === 'name' && !slugTouched ? { slug: slugify(v) } : {}) }));
  };

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { stamps_required, reward_text, ...shopFields } = form;
    const { data, error: err } = await supabase
      .from('shops')
      .insert({ ...shopFields, owner_id: user.id, contact_email: user.email })
      .select()
      .single();
    if (!err) {
      // Every shop starts with a free stamp card; packs can be added under Cards.
      await supabase
        .from('programs')
        .insert({ shop_id: data.id, kind: 'loyalty', name: 'Loyalty card', stamps_required: Number(stamps_required), reward_text });
    }
    setBusy(false);
    if (err) {
      return setError(
        err.code === '23505' ? 'That link is taken — try another.' : err.message.includes('slug') ? 'Link must be 3–40 lowercase letters, numbers or dashes.' : err.message,
      );
    }
    await onCreated(data);
    navigate('/dashboard/guide');
  }

  return (
    <div className="onboard">
      <div className="onboard-form">
        <Logo />
        <p className="eyebrow">Step 1 of 2</p>
        <h1>Tell us about the shop</h1>
        <form className="stack" onSubmit={create}>
          <Field label="Shop name">
            <input value={form.name} onChange={set('name')} required maxLength={60} placeholder="Marrow & Bean" />
          </Field>
          <Field label="Customer link" hint={`${window.location.origin}/s/${form.slug || 'your-shop'}`}>
            <input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              }}
              required
              minLength={3}
            />
          </Field>
          <div className="grid-2">
            <Field label="Phone">
              <input value={form.contact_phone} onChange={set('contact_phone')} />
            </Field>
            <Field label="Address">
              <input value={form.address} onChange={set('address')} />
            </Field>
          </div>
          <Field label="Card colour">
            <div className="swatches">
              {SWATCHES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`swatch${form.brand_color === c ? ' on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm((f) => ({ ...f, brand_color: c }))}
                  aria-label={c}
                />
              ))}
              <input type="color" value={form.brand_color} onChange={set('brand_color')} aria-label="Custom colour" />
            </div>
          </Field>
          <div className="grid-2">
            <Field label="Stamps for a reward">
              <input type="number" min={1} max={30} value={form.stamps_required} onChange={set('stamps_required')} />
            </Field>
            <Field label="Reward">
              <input value={form.reward_text} onChange={set('reward_text')} required />
            </Field>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Creating…' : 'Create shop & design card →'}
          </button>
          {isAdmin && (
            <Link to="/admin" className="link-btn">
              Go to platform admin instead
            </Link>
          )}
        </form>
      </div>
      <div className="onboard-preview">
        <CardPreview
          shop={{ ...form, name: form.name || 'Your coffee house' }}
          program={{ kind: 'loyalty', name: 'Loyalty card', stamps_required: Number(form.stamps_required) || 10, reward_text: form.reward_text }}
          tilt={-2}
        />
      </div>
    </div>
  );
}
