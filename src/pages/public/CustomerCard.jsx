import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { addToAppleWallet, addToGoogleWallet, detectPlatform, walletAvailability } from '../../lib/wallet';
import { KIND_LABEL, packStatus, programPitch } from '../../lib/cards';
import CardPreview from '../../components/CardPreview';
import { AppleWalletButton, GoogleWalletButton } from '../../components/WalletButtons';
import { Spinner } from '../../components/ui';

export default function CustomerCard() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const token = params.get('t');
  const platform = useMemo(detectPlatform, []);

  const [card, setCard] = useState(null);
  const [status, setStatus] = useState('loading');
  const [wallet, setWallet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const autoTried = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_card', { p_customer_id: id, p_token: token });
    if (!data) return setStatus('missing');
    setCard(data);
    setStatus('ready');
    document.title = `${data.shop.name} · ${data.program.name}`;
  }, [id, token]);

  useEffect(() => {
    setStatus('loading');
    load();
    // Keep the web card fresh while it's open at the counter.
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    walletAvailability().then(setWallet);
  }, []);

  // Every card this person holds at the shop goes into the wallet in one tap.
  const allCards = useMemo(() => (card ? [{ id, token }, ...card.others] : []), [card, id, token]);

  const add = useCallback(
    async (which) => {
      setError('');
      setBusy(true);
      try {
        if (which === 'apple') addToAppleWallet(allCards);
        else await addToGoogleWallet(allCards);
      } catch (e) {
        setError(e.message);
      } finally {
        setTimeout(() => setBusy(false), 1500);
      }
    },
    [allCards],
  );

  // Coming straight from the sign-up form: open the native wallet sheet automatically.
  useEffect(() => {
    if (autoTried.current || !wallet || status !== 'ready' || params.get('add') !== '1') return;
    autoTried.current = true;
    params.delete('add');
    setParams(params, { replace: true });
    if (platform !== 'web' && wallet[platform]) add(platform);
  }, [wallet, status, params, setParams, platform, add]);

  if (status === 'loading') return <Spinner full />;
  if (status === 'missing') {
    return (
      <div className="setup-screen">
        <h1>Card not found.</h1>
        <p>Scan the QR code at the counter again to get your card.</p>
      </div>
    );
  }

  const { shop, program, customer, others } = card;
  const isPack = program.kind === 'subscription';
  const ready = !isPack && customer.stamps >= program.stamps_required;
  const pack = isPack ? packStatus(customer) : null;
  const showApple = wallet?.apple && platform !== 'google';
  const showGoogle = wallet?.google && platform !== 'apple';
  const theme = { '--brand': shop.brand_color, '--brand-fg': shop.text_color, '--brand-accent': shop.accent_color };
  const hello = ready
    ? 'Your reward is ready 🎉'
    : pack === 'pending'
      ? 'Pay at the counter to load your cups.'
      : `Hi ${customer.name.split(' ')[0]}, welcome to the club.`;

  return (
    <div className="mycard" style={theme}>
      <p className="mycard-hello">{hello}</p>

      {others.length > 0 && (
        <nav className="mycard-tabs" aria-label="Your cards">
          {[{ id, token, name: program.name }, ...others].map((o) => (
            <Link key={o.id} to={`/card/${o.id}?t=${o.token}`} className={o.id === id ? 'on' : ''} replace>
              {o.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="mycard-pass" key={id}>
        <CardPreview shop={shop} program={program} card={customer} />
      </div>

      <p className="mycard-hint">
        {isPack ? 'Show this QR code at the counter and staff deduct one cup.' : 'Show this QR code at the counter to collect stamps.'}
      </p>

      {(showApple || showGoogle) && (
        <div className="mycard-wallets">
          {showApple && <AppleWalletButton onClick={() => add('apple')} disabled={busy} />}
          {showGoogle && <GoogleWalletButton onClick={() => add('google')} disabled={busy} />}
          {allCards.length > 1 && <p className="mycard-note">Adds all {allCards.length} of your cards.</p>}
        </div>
      )}
      {customer.wallet_added_at && <p className="mycard-note">✓ This card is saved in your wallet.</p>}
      {error && <p className="join-error">{error}</p>}
      {wallet && !wallet.apple && !wallet.google && (
        <p className="mycard-note">Bookmark this page or add it to your home screen to keep your cards handy.</p>
      )}

      <section className="mycard-info">
        <div>
          <h4>{program.name}</h4>
          <p>
            {KIND_LABEL[program.kind]} · {programPitch(program)}
          </p>
          {program.description && <p>{program.description}</p>}
        </div>
        {shop.promo_text && (
          <div>
            <h4>Current offer</h4>
            <p>{shop.promo_text}</p>
          </div>
        )}
        <div>
          <h4>How it works</h4>
          <p>
            {isPack
              ? `Pay for the pack at the counter and staff load ${program.cups_included} cups onto this card. Each drink uses one cup.${program.valid_days ? ` Cups are valid for ${program.valid_days} days.` : ''}`
              : `One stamp per visit. Collect ${program.stamps_required} and enjoy: ${program.reward_text}.`}
          </p>
        </div>
        {shop.address && (
          <div>
            <h4>Find us</h4>
            <p>{shop.address}</p>
          </div>
        )}
        <div className="mycard-tally">
          <span>
            <strong>{customer.visits}</strong> {customer.visits === 1 ? 'visit' : 'visits'}
          </span>
          {isPack ? (
            <span>
              <strong>{customer.packs_purchased}</strong> {customer.packs_purchased === 1 ? 'pack' : 'packs'}
            </span>
          ) : (
            <span>
              <strong>{customer.rewards_redeemed}</strong> {customer.rewards_redeemed === 1 ? 'reward' : 'rewards'}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
