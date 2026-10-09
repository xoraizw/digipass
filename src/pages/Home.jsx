import { Link } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import { Logo } from '../components/ui';
import { useAuth } from '../lib/auth';

const DEMOS = [
  { name: 'Marrow & Bean', brand_color: '#1f3a2e', accent_color: '#e8c07a', text_color: '#f4ecd8' },
  { name: 'Kiln Coffee', brand_color: '#b8492b', accent_color: '#ffd9a8', text_color: '#fff6ea' },
];

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="home">
      <header className="home-nav">
        <Logo />
        <nav>
          <Link to="/how-it-works">How it works</Link>
          {user ? (
            <Link className="btn btn-primary" to="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="btn btn-primary" to="/login?mode=signup">
                Onboard a shop
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="home-hero">
        <div className="home-copy">
          <p className="eyebrow">Loyalty for independent coffee houses</p>
          <h1>
            The paper stamp card, <em>poured</em> into your customer's phone.
          </h1>
          <p className="lede">
            One QR code on the counter. Customers scan it, type their name, and a loyalty card with your branding
            goes straight into Apple Wallet or Google Wallet. You see every visit, every reward and every regular.
          </p>
          <div className="home-cta">
            <Link className="btn btn-primary btn-lg" to="/login?mode=signup">
              Set up a shop in 3 minutes
            </Link>
            <Link className="btn btn-ghost btn-lg" to="/how-it-works">
              How it works
            </Link>
          </div>
        </div>
        <div className="home-visual" aria-hidden="true">
          <div className="home-card home-card-a">
            <CardPreview
              shop={DEMOS[0]}
              program={{ kind: 'loyalty', name: 'Loyalty card', stamps_required: 8, reward_text: 'Free flat white' }}
              card={{ name: 'Priya S.', stamps: 6 }}
            />
          </div>
          <div className="home-card home-card-b">
            <CardPreview
              shop={DEMOS[1]}
              program={{ kind: 'subscription', name: '10-Coffee Pack', cups_included: 10, pack_price: 35 }}
              card={{ name: 'Tom R.', credits: 7, credits_total: 10, packs_purchased: 1 }}
            />
          </div>
        </div>
      </main>

      <section className="home-steps">
        {[
          ['01', 'Scan', 'A table tent with your QR code. No app download, no paper cards.'],
          ['02', 'Join', 'Pick a stamp card, a prepaid coffee pack, or both. It opens in Apple or Google Wallet.'],
          ['03', 'Collect', 'Staff scan the card to add stamps. It updates on the phone.'],
          ['04', 'Grow', 'See regulars, redemptions and who has stopped coming back.'],
        ].map(([n, t, d]) => (
          <div key={n} className="home-step">
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
