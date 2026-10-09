export function AppleWalletButton({ onClick, disabled }) {
  return (
    <button type="button" className="wallet-btn" onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="3.5" fill="#fff" />
        <rect x="2" y="4" width="20" height="5" rx="2" fill="#3fa9f5" />
        <rect x="2" y="8" width="20" height="4" fill="#f5c443" />
        <rect x="2" y="11" width="20" height="4" fill="#5cc96b" />
        <path d="M2 14h6.5a3.5 3.5 0 0 0 7 0H22v2.5A3.5 3.5 0 0 1 18.5 20h-13A3.5 3.5 0 0 1 2 16.5z" fill="#ec5b4e" />
      </svg>
      <span>
        <small>Add to</small>Apple Wallet
      </span>
    </button>
  );
}

export function GoogleWalletButton({ onClick, disabled }) {
  return (
    <button type="button" className="wallet-btn" onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M3 7.5A3.5 3.5 0 0 1 6.5 4h11A3.5 3.5 0 0 1 21 7.5V9H3z" fill="#4285f4" />
        <path d="M3 9h18v4H3z" fill="#34a853" />
        <path d="M3 13h18v3.5a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16.5z" fill="#fbbc04" />
        <path d="M14 12.5h7v4.5h-7a2.25 2.25 0 0 1 0-4.5z" fill="#ea4335" />
      </svg>
      <span>
        <small>Add to</small>Google Wallet
      </span>
    </button>
  );
}
