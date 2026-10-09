import { Link } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import { Logo } from '../components/ui';
import { useAuth } from '../lib/auth';

const DEMO_SHOP = { name: 'Marrow & Bean', brand_color: '#1f3a2e', accent_color: '#e8c07a', text_color: '#f4ecd8' };
const DEMO_LOYALTY = { kind: 'loyalty', name: 'Loyalty card', stamps_required: 8, reward_text: 'Free flat white' };
const DEMO_PACK = {
  kind: 'subscription', name: '10-Coffee Pack', cups_included: 10, pack_price: 35, card_color: '#3b2a1e',
};

const TOC = [
  ['idea', 'The idea'],
  ['modes', 'Two kinds of card'],
  ['setup', 'Set up in 10 minutes'],
  ['counter', 'At the counter'],
  ['pricing', 'Pricing a coffee pack'],
  ['numbers', 'Reading your numbers'],
  ['faq', 'Questions'],
];

/** The owner's guide. `inDashboard` swaps sign-up calls to action for links into the dashboard. */
export default function Guide({ inDashboard }) {
  const to = (dash, pub = '/login?mode=signup') => (inDashboard ? dash : pub);

  return (
    <article className="guide">
      <header className="guide-hero">
        <p className="eyebrow">The XtraCup guide</p>
        <h1>
          Turn first-timers into <em>regulars</em>, one cup at a time.
        </h1>
        <p className="guide-lede">
          Everything a coffee house needs to know: how the cards work, how to set them up, and what your team
          does at the counter. It takes about five minutes to read.
        </p>
        <nav className="guide-toc" aria-label="Contents">
          {TOC.map(([id, label], i) => (
            <a key={id} href={`#${id}`}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {label}
            </a>
          ))}
        </nav>
      </header>

      <section id="idea" className="guide-section">
        <h2>
          <span className="guide-num">01</span>The idea
        </h2>
        <p>
          Paper stamp cards get lost, forgotten and faked. XtraCup puts your card where your customers already keep
          their boarding passes and concert tickets: <strong>Apple Wallet</strong> and <strong>Google Wallet</strong>.
          Nobody has to download an app.
        </p>
        <ol className="guide-flow">
          <li>
            <b>Scan</b>A QR code on your counter, table or cup sleeve.
          </li>
          <li>
            <b>Join</b>Name, age and email, about ten seconds.
          </li>
          <li>
            <b>Wallet</b>Your branded card drops into their phone.
          </li>
          <li>
            <b>Return</b>Staff scan the card on every visit. It updates on the phone.
          </li>
        </ol>
      </section>

      <section id="modes" className="guide-section">
        <h2>
          <span className="guide-num">02</span>Two kinds of card
        </h2>
        <p>
          You can run one or both. Customers pick on the sign-up page, and someone can carry your loyalty card
          <em> and</em> a coffee pack at the same time. Each card has its own name and colour.
        </p>

        <div className="guide-modes">
          <div className="guide-mode">
            <div className="guide-mode-card">
              <CardPreview shop={DEMO_SHOP} program={DEMO_LOYALTY} card={{ name: 'Priya S.', stamps: 5 }} showQr={false} />
            </div>
            <span className="chip chip-loyalty">Loyalty card</span>
            <h3>Digital stamp card</h3>
            <p>Free to join. One stamp per visit, and a reward when the card is full.</p>
            <ul>
              <li>Best for bringing people back</li>
              <li>You choose the stamps (e.g. 8) and the reward</li>
              <li>Optional welcome stamps to get people started</li>
            </ul>
          </div>

          <div className="guide-mode">
            <div className="guide-mode-card">
              <CardPreview
                shop={DEMO_SHOP}
                program={DEMO_PACK}
                card={{ name: 'Tom R.', credits: 7, credits_total: 10, packs_purchased: 1 }}
                showQr={false}
              />
            </div>
            <span className="chip chip-subscription">Coffee pack</span>
            <h3>Prepaid subscription</h3>
            <p>
              Customers pay up front for a bundle of coffees at a discount, e.g. <strong>10 coffees for $35</strong>{' '}
              instead of $40. Each visit uses one cup.
            </p>
            <ul>
              <li>Cash in the till today, a regular for weeks</li>
              <li>Offer several packs: 5, 10 or 20 cups</li>
              <li>Optional expiry (e.g. 90 days)</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="setup" className="guide-section">
        <h2>
          <span className="guide-num">03</span>Set up in 10 minutes
        </h2>
        <div className="guide-steps">
          <div className="guide-step">
            <span>1</span>
            <div>
              <h3>Make it yours</h3>
              <p>
                Upload your logo (a square PNG) and pick your colours. Write a short welcome line for the sign-up
                page.
              </p>
              <Link to={to('/dashboard/design')}>{inDashboard ? 'Open Branding →' : 'Get started →'}</Link>
            </div>
          </div>
          <div className="guide-step">
            <span>2</span>
            <div>
              <h3>Create your cards</h3>
              <p>
                Every shop starts with a loyalty card. Under <b>Cards</b>, change the stamps and reward, or tap{' '}
                <b>+ Coffee pack</b> to add prepaid bundles. You set the cups, price and how long it's valid.
              </p>
              <Link to={to('/dashboard/cards')}>{inDashboard ? 'Open Cards →' : 'Get started →'}</Link>
            </div>
          </div>
          <div className="guide-step">
            <span>3</span>
            <div>
              <h3>Put up your QR code</h3>
              <p>
                Print the ready-made poster for the till. Put the same code on tables, receipts and Instagram, since
                one link works everywhere.
              </p>
              <Link to={to('/dashboard/qr')}>{inDashboard ? 'Open QR poster →' : 'Get started →'}</Link>
            </div>
          </div>
          <div className="guide-step">
            <span>4</span>
            <div>
              <h3>Show your team</h3>
              <p>
                Sign in on the counter tablet or phone and open <b>Scan</b>. That's the only screen baristas
                need. The next section shows the whole routine.
              </p>
              <Link to={to('/dashboard/scan')}>{inDashboard ? 'Open Scan →' : 'Get started →'}</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="counter" className="guide-section">
        <h2>
          <span className="guide-num">04</span>At the counter
        </h2>
        <p>
          Customers pay the way they always do: cash, card, Apple Pay or Google Pay through your normal till.
          XtraCup doesn't take payments. It keeps track of what each customer has earned or prepaid.
        </p>
        <div className="guide-routines">
          <div className="guide-routine">
            <h3>Loyalty card</h3>
            <ol>
              <li>Customer orders and pays as usual.</li>
              <li>
                Scan their card, then tap <b>+1 stamp</b>.
              </li>
              <li>
                When it shows <b>Reward ready</b>, tap <b>Redeem reward</b> and hand over the treat.
              </li>
            </ol>
          </div>
          <div className="guide-routine">
            <h3>Coffee pack</h3>
            <ol>
              <li>
                <b>Buying a pack:</b> take payment at the till, scan their pack card, then tap <b>Sell pack</b>. The
                cups load straight away.
              </li>
              <li>
                <b>Each visit:</b> scan, then tap <b>Use 1 cup</b>. No payment needed.
              </li>
              <li>
                <b>Running low:</b> when the card says <i>Used up</i>, sell another pack. Unused cups carry over if
                the old pack hasn't expired.
              </li>
            </ol>
          </div>
        </div>
        <p className="guide-tip">
          <b>No phone?</b> Search the customer by name or email on the Scan screen.
        </p>
      </section>

      <section id="pricing" className="guide-section">
        <h2>
          <span className="guide-num">05</span>Pricing a coffee pack
        </h2>
        <p>A simple rule: give a discount big enough to notice and small enough to stay profitable.</p>
        <div className="guide-table">
          <div className="guide-row guide-row-head">
            <span>Pack</span>
            <span>Normal</span>
            <span>Pack price</span>
            <span>They save</span>
          </div>
          <div className="guide-row">
            <span>5 coffees</span>
            <span>$20</span>
            <span>$18</span>
            <span>10%</span>
          </div>
          <div className="guide-row">
            <span>10 coffees</span>
            <span>$40</span>
            <span>$35</span>
            <span>12.5%</span>
          </div>
          <div className="guide-row">
            <span>20 coffees</span>
            <span>$80</span>
            <span>$66</span>
            <span>17.5%</span>
          </div>
        </div>
        <ul className="guide-list">
          <li>
            Give bigger packs bigger discounts. Customers who prepay for 20 cups will keep coming back to use them.
          </li>
          <li>
            Set an expiry (60–90 days is common) so packs don't sit unused for a year. Enter the normal cup price
            and the sign-up page shows customers exactly what they save.
          </li>
          <li>
            Say clearly what's included ("any regular coffee, any size") in the card's description.
          </li>
          <li>
            Prepaid cups are coffee you still owe. The Overview page shows the total under <b>Prepaid cups owed</b>.
          </li>
        </ul>
      </section>

      <section id="numbers" className="guide-section">
        <h2>
          <span className="guide-num">06</span>Reading your numbers
        </h2>
        <dl className="guide-defs">
          <div>
            <dt>Members</dt>
            <dd>Unique people. One person with two cards counts once.</dd>
          </div>
          <div>
            <dt>Visits</dt>
            <dd>Every stamp or cup your team gives out.</dd>
          </div>
          <div>
            <dt>Rewards ready</dt>
            <dd>Customers with a full card. A good reason to send them a nudge.</dd>
          </div>
          <div>
            <dt>Pack sales</dt>
            <dd>Money taken for packs in the selected period.</dd>
          </div>
          <div>
            <dt>Not seen 30d</dt>
            <dd>A filter on the Customers page that finds regulars who've drifted away.</dd>
          </div>
          <div>
            <dt>In a wallet</dt>
            <dd>Cards saved to Apple or Google Wallet. These customers are the most likely to come back.</dd>
          </div>
        </dl>
      </section>

      <section id="faq" className="guide-section">
        <h2>
          <span className="guide-num">07</span>Questions
        </h2>
        <div className="guide-faq">
          <details>
            <summary>Do customers need to download an app?</summary>
            <p>No. The card lives in Apple Wallet or Google Wallet, which are already on their phone.</p>
          </details>
          <details>
            <summary>Can customers pay through the card?</summary>
            <p>
              No. Payments go through your till as normal. The card records what they've earned or prepaid, so
              staff tap <b>Sell pack</b> after taking payment for a pack.
            </p>
          </details>
          <details>
            <summary>Can one customer have more than one card?</summary>
            <p>
              Yes. They can pick several cards when they sign up, or scan your QR code again later to add another.
              In the dashboard you'll see all their cards together.
            </p>
          </details>
          <details>
            <summary>What if a customer loses their phone?</summary>
            <p>
              They scan your QR code again and sign up with the same email. Their existing cards come back, with
              stamps and cups intact.
            </p>
          </details>
          <details>
            <summary>Can I change the design or the reward later?</summary>
            <p>
              Yes. Edits update the cards already in your customers' wallets. To stop offering a card, hide it
              rather than deleting it, and people who hold it keep it.
            </p>
          </details>
          <details>
            <summary>What does it cost?</summary>
            <p>A one-off setup fee and a monthly plan. Your XtraCup contact will go through the details with you.</p>
          </details>
        </div>
      </section>

      <footer className="guide-end">
        <h2>Ready to pour?</h2>
        {inDashboard ? (
          <Link className="btn btn-primary btn-lg" to="/dashboard/cards">
            Set up your cards
          </Link>
        ) : (
          <Link className="btn btn-primary btn-lg" to="/login?mode=signup">
            Set up your shop
          </Link>
        )}
      </footer>
    </article>
  );
}

export function PublicGuide() {
  const { user } = useAuth();
  return (
    <div className="guide-page">
      <header className="home-nav">
        <Logo />
        <nav>
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
      <Guide />
    </div>
  );
}
