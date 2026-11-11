import { Link } from 'react-router-dom';

/** Placeholder for workspace pages that have no Figma design yet (Group Buys, Orders, Payments, AI Assistant). */
export default function ComingSoon() {
  return (
    <div className="ws-card mx-auto mt-10 max-w-lg text-center">
      <h1 className="text-2xl font-semibold">Coming soon</h1>
      <p className="mb-6 mt-2 text-sm text-ws-mute">This page isn’t designed yet. Head back to your dashboard.</p>
      <Link to="/ws" className="ws-btn-primary">Back to dashboard</Link>
    </div>
  );
}
