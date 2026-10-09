import { useOutletContext } from 'react-router-dom';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { PageHead } from '../../components/ui';
import { programPitch } from '../../lib/cards';

export default function QrPoster() {
  const { shop, programs } = useOutletContext();
  const live = programs.filter((p) => p.is_active);
  const loyalty = live.find((p) => p.kind === 'loyalty');
  const pack = live.find((p) => p.kind === 'subscription');
  const link = `${window.location.origin}/s/${shop.slug}`;

  function downloadPng() {
    const canvas = document.getElementById('qr-download');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${shop.slug}-qr.png`;
    a.click();
  }

  return (
    <>
      <PageHead title="QR poster" sub="Print it, put it by the till, on tables, on cups.">
        <button className="btn btn-ghost" onClick={downloadPng}>
          Download QR (PNG)
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print poster
        </button>
      </PageHead>

      <div className="qr-page">
        <div className="poster" style={{ '--brand': shop.brand_color, '--brand-fg': shop.text_color, '--brand-accent': shop.accent_color }}>
          <div className="poster-shop">
            {shop.logo_url && <img src={shop.logo_url} alt="" />}
            <span>{shop.name}</span>
          </div>
          {loyalty ? (
            <h2>
              Collect {loyalty.stamps_required} stamps,
              <br />
              <em>{loyalty.reward_text.toLowerCase()}</em>.
            </h2>
          ) : (
            <h2>
              Prepay your coffee,
              <br />
              <em>save on every cup</em>.
            </h2>
          )}
          {pack && loyalty && <p className="poster-extra">Or prepay: {programPitch(pack)}</p>}
          <div className="poster-qr">
            <QRCodeSVG value={link} size={220} marginSize={2} level="M" />
          </div>
          <p>Scan to add our loyalty card to your Apple or Google Wallet.</p>
          <small>No app needed · Takes 10 seconds</small>
        </div>

        <div className="qr-side">
          <h3>Your sign-up link</h3>
          <code className="qr-link">{link}</code>
          <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(link)}>
            Copy link
          </button>
          <p className="muted">
            Share the link on Instagram or in your bio too. The same link works everywhere.
          </p>
          <QRCodeCanvas id="qr-download" value={link} size={1024} marginSize={4} level="M" style={{ display: 'none' }} />
        </div>
      </div>
    </>
  );
}
