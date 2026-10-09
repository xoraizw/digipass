import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import { isUuid } from '../../lib/format';
import { cardProgress } from '../../lib/cards';
import CustomerPanel from '../../components/CustomerPanel';
import { Notice, PageHead } from '../../components/ui';

export default function Scan() {
  const { shop, programs } = useOutletContext();
  const programOf = (c) => programs.find((p) => p.id === c.program_id);
  const [customer, setCustomer] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState([]);
  const scanner = useRef(null);

  async function lookup(id) {
    setError('');
    const { data } = await supabase.from('customers').select('*').eq('id', id).eq('shop_id', shop.id).maybeSingle();
    if (!data) return setError('That card doesn’t belong to this shop.');
    setCustomer(data);
    setMatches([]);
  }

  async function stop() {
    if (scanner.current?.isScanning) await scanner.current.stop().catch(() => {});
    setScanning(false);
  }

  async function start() {
    setError('');
    setCustomer(null);
    setScanning(true);
    try {
      scanner.current = scanner.current ?? new Html5Qrcode('qr-reader', { verbose: false });
      await scanner.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (text) => {
          await stop();
          // Pass barcodes contain the customer id.
          if (isUuid(text)) lookup(text.trim());
          else setError('That QR code isn’t an XtraCup card.');
        },
        () => {},
      );
    } catch (e) {
      setScanning(false);
      setError(`Camera unavailable: ${e?.message || e}. Use search instead.`);
    }
  }

  useEffect(() => () => void stop(), []);

  async function search(e) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    if (isUuid(term)) return lookup(term);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shop.id)
      .or(`name.ilike.%${term.replace(/[%,()]/g, '')}%,email.ilike.%${term.replace(/[%,()]/g, '')}%`)
      .limit(8);
    setMatches(data ?? []);
    if (!data?.length) setError('No customer found.');
    else setError('');
  }

  return (
    <>
      <PageHead title="Scan & stamp" sub="Scan the QR code on a customer’s wallet card to add a stamp." />

      <div className="scan">
        <div className="scan-camera">
          <div id="qr-reader" className={scanning ? 'on' : ''} />
          {!scanning && (
            <button className="btn btn-primary btn-lg scan-start" onClick={start}>
              {customer ? 'Scan next customer' : 'Open camera'}
            </button>
          )}
          {scanning && (
            <button className="btn btn-ghost" onClick={stop}>
              Cancel
            </button>
          )}

          <form className="scan-search" onSubmit={search}>
            <input placeholder="…or search name / email" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-ghost">Find</button>
          </form>
          {matches.length > 0 && (
            <ul className="scan-matches">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      setCustomer(m);
                      setMatches([]);
                    }}
                  >
                    <strong>{m.name}</strong> <span className="muted">{programOf(m)?.name} · {cardProgress(m, programOf(m))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <Notice tone="error">{error}</Notice>}
        </div>

        <div className="scan-result">
          {customer ? (
            <CustomerPanel
              key={customer.id}
              customer={customer}
              program={programOf(customer)}
              programs={programs}
              shop={shop}
              onChange={setCustomer}
              onSwitch={setCustomer}
            />
          ) : (
            <div className="scan-empty">
              <span>☕</span>
              <p>Scanned customers appear here.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
