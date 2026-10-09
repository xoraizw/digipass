import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { detectPlatform, rememberCard, savedCard } from '../../lib/wallet';
import { KIND_LABEL, packSavings, price, programPitch } from '../../lib/cards';
import CardPreview from '../../components/CardPreview';
import { Spinner } from '../../components/ui';

const CTA = { apple: 'Add to Apple Wallet', google: 'Add to Google Wallet', web: 'Get my card' };

export default function ShopLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const platform = useMemo(detectPlatform, []);
  const existing = useMemo(() => savedCard(slug), [slug]);

  const [shop, setShop] = useState(null);
  const [status, setStatus] = useState('loading');
  const [picked, setPicked] = useState([]);
  const [form, setForm] = useState({ name: '', age: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('get_public_shop', { p_slug: slug }).then(({ data, error: err }) => {
      if (err || !data || !data.programs.length) return setStatus('missing');
      setShop(data);
      // Pre-select the first loyalty card (free to join); packs are opt-in.
      const first = data.programs.find((p) => p.kind === 'loyalty') ?? data.programs[0];
      setPicked([first.id]);
      setStatus('ready');
      document.title = `${data.name} · Loyalty card`;
    });
  }, [slug]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function submit(e) {
    e.preventDefault();
    setError('');
    const age = parseInt(form.age, 10);
    if (!picked.length) return setError('Pick at least one card.');
    if (!form.name.trim()) return setError('Please tell us your name.');
    if (!(age >= 1 && age <= 120)) return setError('Please enter a valid age.');
    setSubmitting(true);
    const { data, error: err } = await supabase.rpc('join_shop', {
      p_slug: slug,
      p_name: form.name.trim(),
      p_email: form.email.trim(),
      p_age: age,
      p_platform: platform,
      p_program_ids: picked,
    });
    if (err) {
      setSubmitting(false);
      return setError(err.message.includes('email') ? 'Please enter a valid email.' : err.message);
    }
    const first = data.cards[0];
    rememberCard(slug, { id: first.card_id, token: first.token });
    navigate(`/card/${first.card_id}?t=${first.token}&add=1`);
  }

  if (status === 'loading') return <Spinner full />;
  if (status === 'missing') {
    return (
      <div className="setup-screen">
        <h1>This card isn't available.</h1>
        <p>Ask the barista for help — the shop may have paused sign-ups.</p>
      </div>
    );
  }

  const theme = { '--brand': shop.brand_color, '--brand-fg': shop.text_color, '--brand-accent': shop.accent_color };
  const previewProgram = shop.programs.find((p) => p.id === picked[0]) ?? shop.programs[0];
  const previewCard =
    previewProgram.kind === 'subscription'
      ? { name: 'You', credits: previewProgram.cups_included, credits_total: previewProgram.cups_included, packs_purchased: 1 }
      : { name: 'You', stamps: previewProgram.welcome_stamps };

  return (
    <div className="join" style={theme}>
      <div className="join-hero">
        <div className="join-shop">
          {shop.logo_url ? <img src={shop.logo_url} alt="" /> : <span className="join-mono">{shop.name[0]}</span>}
          <span>{shop.name}</span>
        </div>
        <h1 className="join-title">{shop.welcome_title}</h1>
        <p className="join-body">{shop.welcome_body}</p>
        <div className="join-card">
          <CardPreview shop={shop} program={previewProgram} card={previewCard} showQr={false} tilt={-3} />
        </div>
      </div>

      <form className="join-form" onSubmit={submit}>
        {shop.programs.length > 1 && <p className="join-step">Choose your cards (you can pick more than one)</p>}
        <div className="join-programs" role="group" aria-label="Cards">
          {shop.programs.map((p) => {
            const on = picked.includes(p.id);
            const save = p.kind === 'subscription' ? packSavings(p) : 0;
            return (
              <button
                type="button"
                key={p.id}
                className={`join-program${on ? ' on' : ''}`}
                onClick={() => (shop.programs.length > 1 ? toggle(p.id) : null)}
                aria-pressed={on}
              >
                <span className="join-check" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                <span className="join-program-text">
                  <small>{KIND_LABEL[p.kind]}</small>
                  <strong>{p.name}</strong>
                  <span>{programPitch(p)}</span>
                  {p.description && <em>{p.description}</em>}
                </span>
                {p.kind === 'subscription' ? (
                  <span className="join-price">
                    {price(p.pack_price)}
                    {save > 0 && p.regular_cup_price && <small>was {price(p.regular_cup_price * p.cups_included)}</small>}
                  </span>
                ) : (
                  <span className="join-price">
                    Free
                    {p.welcome_stamps > 0 && <small>+{p.welcome_stamps} stamp{p.welcome_stamps > 1 ? 's' : ''}</small>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {shop.programs.some((p) => picked.includes(p.id) && p.kind === 'subscription') && (
          <p className="join-note">Packs are paid at the counter. Show your card and staff will load your cups.</p>
        )}

        <label className="join-field">
          <span>Your name</span>
          <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="First & last name" required />
        </label>
        <div className="join-row">
          <label className="join-field join-age">
            <span>Age</span>
            <input value={form.age} onChange={set('age')} inputMode="numeric" pattern="[0-9]*" maxLength={3} placeholder="25" required />
          </label>
          <label className="join-field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@email.com" required />
          </label>
        </div>

        {error && <p className="join-error">{error}</p>}

        <button className="join-submit" disabled={submitting}>
          {submitting ? <Spinner light /> : picked.length > 1 ? `${CTA[platform]} (${picked.length} cards)` : CTA[platform]}
          {!submitting && <span aria-hidden="true">→</span>}
        </button>
        <p className="join-fine">
          Your cards live in your phone's wallet — no app to download. We'll only use your email for your cards.
        </p>
        {existing && (
          <Link className="join-existing" to={`/card/${existing.id}?t=${existing.token}`}>
            Already joined? Open my cards
          </Link>
        )}
      </form>
      <p className="join-powered">
        Powered by <Link to="/">XtraCup</Link>
      </p>
    </div>
  );
}
