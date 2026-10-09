import { lazy, Suspense, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './lib/auth';
import { supabaseConfigured } from './lib/supabase';
import { Spinner } from './components/ui';
import Intro, { shouldShowIntro } from './components/Intro';
import Home from './pages/Home';
import Login from './pages/Login';
import ShopLanding from './pages/public/ShopLanding';
import CustomerCard from './pages/public/CustomerCard';
const DashboardLayout = lazy(() => import('./pages/dashboard/Layout'));
const Overview = lazy(() => import('./pages/dashboard/Overview'));
const Customers = lazy(() => import('./pages/dashboard/Customers'));
const Scan = lazy(() => import('./pages/dashboard/Scan'));
const Design = lazy(() => import('./pages/dashboard/Design'));
const QrPoster = lazy(() => import('./pages/dashboard/QrPoster'));
const Programs = lazy(() => import('./pages/dashboard/Programs'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const Guide = lazy(() => import('./pages/Guide'));
const PublicGuide = lazy(() => import('./pages/Guide').then((m) => ({ default: m.PublicGuide })));

export default function App() {
  const [intro, setIntro] = useState(() => shouldShowIntro(window.location.pathname));

  if (!supabaseConfigured) {
    return (
      <div className="setup-screen">
        <h1>Connect Supabase</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>. See README.md.
        </p>
      </div>
    );
  }

  return (
    <>
    {intro && <Intro onDone={() => setIntro(false)} />}
    <Suspense fallback={<Spinner full />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/how-it-works" element={<PublicGuide />} />
      <Route path="/s/:slug" element={<ShopLanding />} />
      <Route path="/card/:id" element={<CustomerCard />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Overview />} />
        <Route path="customers" element={<Customers />} />
        <Route path="scan" element={<Scan />} />
        <Route path="design" element={<Design />} />
        <Route path="qr" element={<QrPoster />} />
        <Route path="cards" element={<Programs />} />
        <Route path="guide" element={<Guide inDashboard />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Admin />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={
          <div className="setup-screen">
            <h1>Nothing brewing here.</h1>
            <Link to="/">Back home</Link>
          </div>
        }
      />
    </Routes>
    </Suspense>
    </>
  );
}
