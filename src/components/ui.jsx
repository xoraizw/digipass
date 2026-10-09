import { Link } from 'react-router-dom';

export function Spinner({ full, light }) {
  const s = <span className={`spinner${light ? ' spinner-light' : ''}`} aria-label="Loading" />;
  return full ? <div className="spinner-page">{s}</div> : s;
}

/** The XtraCup mark: a caramel rounded square with an "X" of two crossing rounded strokes. */
export function Mark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="24" fill="#c9a06a" />
      <path d="M28 28 72 72M72 28 28 72" stroke="#1b140c" strokeWidth="16" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ to = '/', light }) {
  return (
    <Link to={to} className={`logo${light ? ' logo-light' : ''}`}>
      <Mark />
      <span>XtraCup</span>
    </Link>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  );
}

export function Notice({ tone = 'info', children }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}
