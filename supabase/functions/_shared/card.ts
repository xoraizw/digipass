// What a card shows, shared by the Apple and Google pass builders.
import type { Row } from './http.ts';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const cardColor = (shop: Row, program: Row) => program.card_color || shop.brand_color;

export function packStatus(c: Row): 'pending' | 'active' | 'empty' | 'expired' {
  if (c.pack_expires_at && new Date(c.pack_expires_at) <= new Date()) return 'expired';
  if (c.credits > 0) return 'active';
  return c.packs_purchased > 0 ? 'empty' : 'pending';
}

export function cardSummary(c: Row, program: Row) {
  if (program.kind === 'subscription') {
    const status = packStatus(c);
    return {
      balanceLabel: 'Cups left',
      balance: status === 'active' ? `${c.credits}/${c.credits_total}` : '0',
      changeMessage: 'Cups left: %@',
      headline: {
        pending: 'Pay at the counter to activate',
        active: c.pack_expires_at ? `Valid until ${fmtDate(c.pack_expires_at)}` : 'Your pack is active',
        empty: 'Pack used up, renew at the counter',
        expired: 'Pack expired, renew at the counter',
      }[status],
      title: program.name,
      howItWorks: `Prepaid pack: ${program.cups_included} cups for $${Number(program.pack_price).toFixed(2)}. Show this card at the counter and staff deduct one cup per drink.`,
    };
  }
  const required = program.stamps_required;
  const ready = c.stamps >= required;
  return {
    balanceLabel: 'Stamps',
    balance: `${c.stamps}/${required}`,
    changeMessage: 'Stamp added! You now have %@',
    headline: ready ? 'Reward ready' : `${required - c.stamps} more for`,
    title: program.reward_text,
    howItWorks: `Show this card at the counter. Collect ${required} stamps and get: ${program.reward_text}.`,
  };
}
