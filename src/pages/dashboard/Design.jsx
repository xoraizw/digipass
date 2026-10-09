import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { slugify } from '../../lib/format';
import { notifyPassUpdated } from '../../lib/wallet';
import CardPreview from '../../components/CardPreview';
import { Field, Notice, PageHead } from '../../components/ui';

const EDITABLE = [
  'name', 'slug', 'address', 'contact_phone', 'logo_url', 'brand_color', 'accent_color', 'text_color',
  'welcome_title', 'welcome_body', 'promo_text', 'is_live',
];

export default function Design() {
  const { shop, setShop, programs } = useOutletContext();
  const { user } = useAuth();
  const [form, setForm] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, shop[k] ?? ''])));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k, transform = (v) => v) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : transform(e.target.value);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const dirty = EDITABLE.some((k) => String(form[k] ?? '') !== String(shop[k] ?? ''));

  async function uploadLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/png') return setMsg({ tone: 'error', text: 'Wallet cards need a PNG logo.' });
    if (file.size > 1024 * 1024) return setMsg({ tone: 'error', text: 'Logo must be under 1 MB.' });
    setUploading(true);
    const path = `${user.id}/logo-${Date.now()}.png`;
    const { error } = await supabase.storage.from('shop-assets').upload(path, file, { contentType: 'image/png' });
    setUploading(false);
    if (error) return setMsg({ tone: 'error', text: error.message });
    const { data } = supabase.storage.from('shop-assets').getPublicUrl(path);
    setForm((f) => ({ ...f, logo_url: data.publicUrl }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const payload = {
      ...form,
      logo_url: form.logo_url || null,
      promo_text: form.promo_text || null,
    };
    const { data, error } = await supabase.from('shops').update(payload).eq('id', shop.id).select().single();
    setBusy(false);
    if (error) {
      return setMsg({ tone: 'error', text: error.code === '23505' ? 'That link is already taken.' : error.message });
    }
    setShop(data);
    notifyPassUpdated({ shop_id: shop.id });
    setMsg({ tone: 'success', text: 'Saved. Cards already in wallets will refresh with the new design.' });
  }

  return (
    <>
      <PageHead title="Branding" sub="Your logo and colours, the sign-up page, and shop details. Card types live under Cards.">
        <a className="btn btn-ghost" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">
          Open sign-up page ↗
        </a>
      </PageHead>

      <div className="design">
        <form className="design-form" onSubmit={save}>
          <fieldset>
            <legend>Brand</legend>
            <Field label="Shop name">
              <input value={form.name} onChange={set('name')} required maxLength={60} />
            </Field>
            <Field label="Logo" hint="Square PNG, ideally with a transparent background.">
              <div className="logo-upload">
                {form.logo_url ? <img src={form.logo_url} alt="" /> : <span className="logo-empty">No logo</span>}
                <input type="file" accept="image/png" onChange={uploadLogo} disabled={uploading} />
                {form.logo_url && (
                  <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, logo_url: '' }))}>
                    Remove
                  </button>
                )}
              </div>
            </Field>
            <div className="grid-3">
              <Field label="Brand colour">
                <input type="color" value={form.brand_color} onChange={set('brand_color')} />
              </Field>
              <Field label="Text">
                <input type="color" value={form.text_color} onChange={set('text_color')} />
              </Field>
              <Field label="Accent">
                <input type="color" value={form.accent_color} onChange={set('accent_color')} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend>Sign-up page</legend>
            <Field label="Headline">
              <input value={form.welcome_title} onChange={set('welcome_title')} required maxLength={80} />
            </Field>
            <Field label="Intro">
              <textarea rows={2} value={form.welcome_body} onChange={set('welcome_body')} maxLength={240} />
            </Field>
            <Field label="Link" hint="Changing this breaks QR codes you already printed.">
              <input value={form.slug} onChange={set('slug', slugify)} required minLength={3} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={!!form.is_live} onChange={set('is_live')} />
              Accept new sign-ups
            </label>
          </fieldset>

          <fieldset>
            <legend>Offer</legend>
            <Field label="Current offer" hint="Shown on the back of every card and on the customer's card page. Leave blank for none.">
              <input value={form.promo_text} onChange={set('promo_text')} maxLength={140} placeholder="2-for-1 pastries before 9am" />
            </Field>
          </fieldset>

          <fieldset>
            <legend>Details</legend>
            <div className="grid-2">
              <Field label="Address">
                <input value={form.address} onChange={set('address')} />
              </Field>
              <Field label="Phone">
                <input value={form.contact_phone} onChange={set('contact_phone')} />
              </Field>
            </div>
          </fieldset>

          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <div className="design-save">
            <button className="btn btn-primary btn-lg" disabled={busy || !dirty}>
              {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </form>

        <aside className="design-preview">
          <p className="eyebrow">Live preview</p>
          {programs[0] && <CardPreview shop={form} program={programs[0]} />}
          <div className="mini-join" style={{ '--brand': form.brand_color, '--brand-fg': form.text_color, '--brand-accent': form.accent_color }}>
            <strong>{form.welcome_title}</strong>
            <span>{form.welcome_body}</span>
            <em>Name · Age · Email</em>
          </div>
        </aside>
      </div>
    </>
  );
}
