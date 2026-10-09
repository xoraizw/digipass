// Card (program) helpers shared by the customer pages and the dashboard.

export const KIND_LABEL = { loyalty: 'Loyalty card', subscription: 'Coffee pack' };

export const cardColor = (shop, program) => program?.card_color || shop.brand_color;

export const price = (n) =>
  n == null || n === '' ? '' : Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: Number(n) % 1 ? 2 : 0 });

/** pending = joined but not paid yet, active = cups left, empty = used up, expired = past validity. */
export function packStatus(card) {
  if (card.pack_expires_at && new Date(card.pack_expires_at) <= new Date()) return 'expired';
  if (card.credits > 0) return 'active';
  return card.packs_purchased > 0 ? 'empty' : 'pending';
}

export const PACK_STATUS_LABEL = {
  pending: 'Pay at the counter to activate',
  active: 'Active',
  empty: 'Used up, renew at the counter',
  expired: 'Expired, renew at the counter',
};

/** Savings per pack versus buying each cup at the regular price. */
export function packSavings(program) {
  if (!program.regular_cup_price || !program.cups_included) return 0;
  return Math.max(0, program.regular_cup_price * program.cups_included - program.pack_price);
}

/** One-line pitch for a program, e.g. "10 stamps = Free latte" or "10 cups for $35 · save $5". */
export function programPitch(program) {
  if (program.kind === 'subscription') {
    const save = packSavings(program);
    const perCup = program.pack_price / program.cups_included;
    return `${program.cups_included} cups for ${price(program.pack_price)} · ${price(perCup.toFixed(2))}/cup${save ? ` · save ${price(save)}` : ''}`;
  }
  return `${program.stamps_required} stamps = ${program.reward_text}`;
}

/** Short progress text for tables, e.g. "7/10 stamps" or "4 of 10 cups left". */
export function cardProgress(card, program) {
  if (!program) return '';
  if (program.kind === 'subscription') {
    const s = packStatus(card);
    if (s === 'active') return `${card.credits}/${card.credits_total} cups left`;
    return { pending: 'Not paid yet', empty: 'Used up', expired: 'Expired' }[s];
  }
  return `${card.stamps}/${program.stamps_required} stamps`;
}

export const fmtShortDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
