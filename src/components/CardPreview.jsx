import { QRCodeSVG } from 'qrcode.react';
import { cardColor, fmtShortDate, packStatus, PACK_STATUS_LABEL, price } from '../lib/cards';

const DEMO_CARD = { name: 'Alex Morgan', stamps: 3, credits: 7, credits_total: 10, packs_purchased: 1 };

export function Cup({ filled }) {
  return (
    <svg viewBox="0 0 32 32" className={`cup${filled ? ' cup-filled' : ''}`} aria-hidden="true">
      <circle cx="16" cy="16" r="13" />
      {filled && <path d="M10.5 14.5h9.5v3.2a4.3 4.3 0 0 1-4.3 4.3h-.9a4.3 4.3 0 0 1-4.3-4.3z M20 15.3h1.2a1.9 1.9 0 0 1 0 3.8H20" />}
    </svg>
  );
}

function CupGrid({ total, filled }) {
  if (total > 15) {
    return (
      <div className="pass-progress">
        <span style={{ width: `${Math.min(100, (filled / total) * 100)}%` }} />
      </div>
    );
  }
  const cols = total > 10 ? Math.ceil(total / 2) : Math.min(total, 5);
  return (
    <div className="pass-stamps" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: total }, (_, i) => (
        <Cup key={i} filled={i < filled} />
      ))}
    </div>
  );
}

/** A Wallet-style card for a loyalty program or a prepaid coffee pack. */
export default function CardPreview({ shop, program, card, showQr = true, tilt }) {
  const c = card ?? DEMO_CARD;
  const isPack = program?.kind === 'subscription';
  const style = {
    '--pass-bg': cardColor(shop, program),
    '--pass-fg': shop.text_color,
    '--pass-accent': shop.accent_color,
    transform: tilt ? `rotate(${tilt}deg)` : undefined,
  };

  let head, grid, label, title;
  if (isPack) {
    const status = packStatus(c);
    const total = c.credits_total || program.cups_included;
    head = { label: 'Cups left', value: status === 'active' ? `${c.credits}/${c.credits_total}` : '—' };
    grid = <CupGrid total={total} filled={status === 'active' ? c.credits : 0} />;
    label =
      status === 'active'
        ? c.pack_expires_at
          ? `Valid until ${fmtShortDate(c.pack_expires_at)}`
          : 'Pack active'
        : PACK_STATUS_LABEL[status];
    title = program.name;
  } else {
    const required = program?.stamps_required || 10;
    head = { label: 'Stamps', value: `${c.stamps}/${required}` };
    grid = <CupGrid total={required} filled={c.stamps} />;
    label = c.stamps >= required ? 'Reward ready' : `${required - c.stamps} more for`;
    title = program?.reward_text || 'A free drink';
  }

  return (
    <article className="pass" style={style}>
      <div className="pass-grain" />
      <header className="pass-top">
        {shop.logo_url ? (
          <img className="pass-logo" src={shop.logo_url} alt="" />
        ) : (
          <span className="pass-monogram">{(shop.name || 'C').trim()[0]}</span>
        )}
        <div className="pass-names">
          <span className="pass-shopname">{shop.name || 'Your coffee house'}</span>
          {program?.name && <span className="pass-program">{program.name}</span>}
        </div>
        <div className="pass-head-field">
          <small>{head.label}</small>
          <strong>{head.value}</strong>
        </div>
      </header>

      {grid}

      <div className="pass-reward">
        <small>{label}</small>
        <span>{title}</span>
      </div>

      <footer className="pass-bottom">
        <div className="pass-fields">
          <div>
            <small>Member</small>
            <span>{c.name}</span>
          </div>
          {isPack && (
            <div>
              <small>Pack</small>
              <span>
                {program.cups_included} cups · {price(program.pack_price)}
              </span>
            </div>
          )}
        </div>
        {showQr && (
          <div className="pass-qr">
            <QRCodeSVG value={c.id || 'xtracup-preview'} size={84} marginSize={0} bgColor="#ffffff" fgColor="#111111" />
          </div>
        )}
      </footer>
    </article>
  );
}
