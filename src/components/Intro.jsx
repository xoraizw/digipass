import { useEffect, useRef, useState } from 'react';

// Web port of the XtraCup app's IntroScreen: a rope of coffee pours onto the mark,
// splashes, fills it, then the wordmark fades in. Same timings, easings and shapes.

const MARK_SIZE = 96;
const STREAM_HEIGHT = 60;
const STREAM_GAP = 4;
const STREAM_WIDTH = 60;

const ACCENT = '#c9a06a';
const BACKGROUND = '#1b140c';
const SURFACE_RAISED = '#2d2113';
const HAIRLINE_STRONG = 'rgba(240, 230, 213, 0.22)';

// Timeline (ms), mirroring the Animated.sequence in the app
const MARK_IN = 300;
const POUR_START = MARK_IN;
const POUR_DURATION = 750;
const IMPACT = POUR_START + POUR_DURATION;
const SPLASH_DURATION = 260;
const FILL_DURATION = 550;
const SETTLE_START = IMPACT + FILL_DURATION;
const SETTLE_DURATION = 350;
const HOLD_DURATION = 350;
const TOTAL = SETTLE_START + SETTLE_DURATION + HOLD_DURATION;
const FADE_OUT = 300;

const clamp = (v) => Math.min(1, Math.max(0, v));
const seg = (t, start, dur) => clamp((t - start) / dur);
const easeOutQuad = (x) => 1 - (1 - x) * (1 - x);
const easeInQuad = (x) => x * x;
const easeOutCubic = (x) => 1 - (1 - x) ** 3;
// Easing.out(Easing.back(1.2))
const easeOutBack = (x, s = 1.2) => 1 - (1 - x) ** 2 * ((s + 1) * (1 - x) - s);

// Rope keyframes: [progress, tipY, drift]
const ROPE_KEYS = [
  [0, 10, -1],
  [0.25, 24, -2],
  [0.5, 38, 1],
  [0.75, 50, -1],
  [1, STREAM_HEIGHT, 0],
];

function ropeAt(progress) {
  for (let i = 1; i < ROPE_KEYS.length; i++) {
    const [p1, y1, d1] = ROPE_KEYS[i];
    const [p0, y0, d0] = ROPE_KEYS[i - 1];
    if (progress <= p1) {
      const k = (progress - p0) / (p1 - p0);
      return ropePath(y0 + (y1 - y0) * k, d0 + (d1 - d0) * k);
    }
  }
  return ropePath(STREAM_HEIGHT, 0);
}

// A falling rope of liquid: wide source, pinched waist, bulbous droplet tip.
function ropePath(tipY, drift) {
  const cx = STREAM_WIDTH / 2;
  const sourceHalfWidth = 9;
  const waistY = tipY * 0.55;
  const waistHalfWidth = Math.max(2, 4 - tipY * 0.03);
  const tipX = cx + drift;
  const tipHalfWidth = 6;
  const tipTop = Math.max(waistY + 2, tipY - 9);
  return [
    `M${cx - sourceHalfWidth} 0`,
    `C${cx - sourceHalfWidth} 4 ${cx - waistHalfWidth} ${waistY - 6} ${cx - waistHalfWidth} ${waistY}`,
    `C${cx - waistHalfWidth} ${waistY + 6} ${tipX - tipHalfWidth} ${tipTop - 4} ${tipX - tipHalfWidth} ${tipTop}`,
    `C${tipX - tipHalfWidth} ${tipY - 2} ${tipX - tipHalfWidth * 0.5} ${tipY} ${tipX} ${tipY}`,
    `C${tipX + tipHalfWidth * 0.5} ${tipY} ${tipX + tipHalfWidth} ${tipY - 2} ${tipX + tipHalfWidth} ${tipTop}`,
    `C${tipX + tipHalfWidth} ${tipTop - 4} ${cx + waistHalfWidth} ${waistY + 6} ${cx + waistHalfWidth} ${waistY}`,
    `C${cx + waistHalfWidth} ${waistY - 6} ${cx + sourceHalfWidth} 4 ${cx + sourceHalfWidth} 0`,
    'Z',
  ].join(' ');
}

// Rounded-square fill with a soft wavy top edge, so the coffee reads as liquid settling.
function wavePath(fillHeight) {
  const top = MARK_SIZE - fillHeight;
  const waveAmp = fillHeight > 4 ? 2.5 : 0;
  const w = MARK_SIZE;
  return [
    `M0 ${MARK_SIZE}`,
    `L0 ${top + waveAmp}`,
    `Q${w * 0.17} ${top - waveAmp} ${w * 0.34} ${top}`,
    `Q${w * 0.5} ${top + waveAmp} ${w * 0.67} ${top}`,
    `Q${w * 0.83} ${top - waveAmp} ${w} ${top + waveAmp}`,
    `L${w} ${MARK_SIZE}`,
    'Z',
  ].join(' ');
}

function frameAt(t) {
  const markIn = seg(t, 0, MARK_IN);
  const pour = seg(t, POUR_START, POUR_DURATION);
  const splashGrow = seg(t, IMPACT, SPLASH_DURATION);
  return {
    markOpacity: easeOutQuad(markIn),
    markScale: 0.85 + 0.15 * easeOutBack(markIn),
    streamOpacity: t < IMPACT ? seg(t, POUR_START, 90) : 1 - seg(t, IMPACT, 120),
    stream: ropeAt(easeInQuad(pour)),
    splashOpacity: t < IMPACT + SPLASH_DURATION ? seg(t, IMPACT, 60) : 1 - seg(t, IMPACT + SPLASH_DURATION, 240),
    splashScaleX: 0.3 + 0.7 * easeOutQuad(splashGrow),
    fill: wavePath(MARK_SIZE * easeOutCubic(seg(t, IMPACT, FILL_DURATION))),
    wordmarkOpacity: easeOutQuad(seg(t, SETTLE_START, SETTLE_DURATION)),
  };
}

export default function Intro({ onDone }) {
  const [t, setT] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    markIntroSeen();
    // The page renders underneath; keep it from scrolling while the intro covers it.
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    let raf;
    let timer;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      setT(elapsed);
      if (elapsed < TOTAL) raf = requestAnimationFrame(tick);
      else {
        setLeaving(true);
        timer = setTimeout(() => done.current(), FADE_OUT);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      document.documentElement.style.overflow = overflow;
    };
  }, []);

  const f = frameAt(t);

  return (
    <div className={`intro${leaving ? ' intro-leaving' : ''}`} role="presentation" aria-hidden="true">
      <div className="intro-group">
        <svg
          className="intro-stream"
          width={STREAM_WIDTH}
          height={STREAM_HEIGHT}
          viewBox={`0 0 ${STREAM_WIDTH} ${STREAM_HEIGHT}`}
          style={{ opacity: f.streamOpacity, marginBottom: STREAM_GAP }}
        >
          <path d={f.stream} fill={ACCENT} />
        </svg>

        <svg
          className="intro-splash"
          width="44"
          height="12"
          viewBox="0 0 44 12"
          style={{ top: STREAM_HEIGHT + STREAM_GAP - 6, opacity: f.splashOpacity, transform: `translateX(-50%) scaleX(${f.splashScaleX})` }}
        >
          <ellipse cx="22" cy="6" rx="20" ry="4" fill={ACCENT} />
        </svg>

        <svg
          width={MARK_SIZE}
          height={MARK_SIZE}
          viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
          style={{ opacity: f.markOpacity, transform: `scale(${f.markScale})` }}
        >
          <defs>
            <clipPath id="intro-mark-clip">
              <rect width={MARK_SIZE} height={MARK_SIZE} rx={MARK_SIZE * 0.24} ry={MARK_SIZE * 0.24} />
            </clipPath>
          </defs>
          <rect
            width={MARK_SIZE}
            height={MARK_SIZE}
            rx={MARK_SIZE * 0.24}
            ry={MARK_SIZE * 0.24}
            fill={SURFACE_RAISED}
            stroke={HAIRLINE_STRONG}
            strokeWidth="1.5"
          />
          <path d={f.fill} fill={ACCENT} clipPath="url(#intro-mark-clip)" />
          <path
            d={`M${MARK_SIZE * 0.28} ${MARK_SIZE * 0.28} L${MARK_SIZE * 0.72} ${MARK_SIZE * 0.72} M${MARK_SIZE * 0.72} ${MARK_SIZE * 0.28} L${MARK_SIZE * 0.28} ${MARK_SIZE * 0.72}`}
            stroke={BACKGROUND}
            strokeWidth={MARK_SIZE * 0.16}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="intro-wordmark" style={{ opacity: f.wordmarkOpacity }}>
        XtraCup
      </span>
    </div>
  );
}

const SEEN_KEY = 'xtracup:intro-seen';

/** Show once per browser session, never on shop-branded customer pages, and not for reduced-motion users. */
export function shouldShowIntro(pathname) {
  if (/^\/(s|card)\//.test(pathname)) return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}
