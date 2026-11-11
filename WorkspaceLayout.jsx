import { createContext, useContext, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Check, LogOut, Menu, Search, Settings, Sparkles, Users } from 'lucide-react';
import { useApp } from '../../App.jsx';
import { NAV, NOTIFICATIONS, TRACKING, WS_USER } from '../../data/workspace.js';
import Modal from './Modal.jsx';

const WsCtx = createContext(null);
export const useWs = () => useContext(WsCtx);

const CRUMBS = { '/ws': 'Dashboard', '/ws/create': 'Group purchasing', '/ws/deals': 'Deals' };

function NavList({ pathname, onNavigate }) {
  return (
    <nav className="flex flex-col gap-3">
      {NAV.map(({ to, label, Icon, match }) => (
        <Link
          key={to} to={to} onClick={onNavigate}
          className={`flex h-11 items-center gap-3 rounded-[9px] px-4 text-sm font-medium text-navy transition hover:bg-ws-bg ${match(pathname) ? 'bg-violet-soft' : ''}`}
        >
          <Icon size={18} className={match(pathname) ? 'text-violet' : 'text-ws-mute'} />{label}
        </Link>
      ))}
    </nav>
  );
}

export default function WorkspaceLayout() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { logout } = useApp();
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  return (
    <WsCtx.Provider value={{ openModal: setModal }}>
      <div className="min-h-screen bg-ws-bg font-display text-navy lg:grid lg:grid-cols-[232px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-ws-line bg-white px-4 pb-7 pt-7 lg:flex">
          <Link to="/ws" className="flex items-center gap-2 px-2 text-[22px] font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-violet text-white"><Users size={17} /></span>CrowdKart
          </Link>
          <div className="mb-3.5 mt-12 px-2 text-[10px] font-semibold tracking-wider text-ws-mute">WORKSPACE</div>
          <NavList pathname={pathname} />
          <div className="mt-auto rounded-xl bg-violet-soft p-4 text-violet">
            <Sparkles size={18} />
            <b className="mt-4 block text-sm font-semibold text-navy">Better together.</b>
            <span className="text-[11px] text-ws-mute">Your next saving starts here.</span>
          </div>
          <div className="mb-5 mt-6 flex flex-col gap-1 text-sm text-ws-mute">
            <button onClick={() => setModal('settings')} className="flex h-10 items-center gap-3 px-4 hover:text-navy"><Settings size={18} />Settings</button>
            <button onClick={logout} className="flex h-10 items-center gap-3 px-4 hover:text-navy"><LogOut size={18} />Logout</button>
          </div>
          <div className="rounded-xl bg-ws-bg px-4 py-3"><b className="block text-sm font-semibold">{WS_USER.name}</b><span className="text-[11px] text-ws-mute">{WS_USER.org}</span></div>
        </aside>

        <div className="min-w-0">
          {/* Top bar */}
          <header className="flex h-[72px] items-center justify-between border-b border-ws-line bg-white px-5 lg:h-[88px] lg:border-0 lg:px-10">
            <div className="flex items-center gap-3">
              <button className="lg:hidden" aria-label="Open menu" onClick={() => setModal('menu')}><Menu size={22} /></button>
              <span className="whitespace-pre text-[13px] text-ws-mute">{`Workspace  /  ${CRUMBS[pathname] || 'Workspace'}`}</span>
            </div>
            <div className="flex items-center gap-6 text-sm font-medium">
              <button aria-label="Search" className="text-ws-mute hover:text-navy"><Search size={18} /></button>
              <button aria-label="Notifications" onClick={() => setModal('notifications')} className="relative text-ws-mute hover:text-navy">
                <Bell size={18} /><i className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-violet" />
              </button>
              <span className="hidden sm:inline">{WS_USER.name}</span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1208px] px-5 pb-16 pt-6 lg:px-10 lg:pt-8"><Outlet /></main>
        </div>

        {/* Modals */}
        {modal === 'notifications' && (
          <Modal title="Notifications" onClose={close}>
            <ul className="space-y-5">
              {NOTIFICATIONS.map((n) => (
                <li key={n.title}><b className="block text-sm font-semibold">{n.title}</b>{n.body && <p className="mt-1 text-xs text-ws-mute">{n.body}</p>}</li>
              ))}
            </ul>
            <button className="ws-btn-primary mt-6 w-full" onClick={() => setModal('tracking')}>View order updates <ArrowRight size={16} /></button>
          </Modal>
        )}
        {modal === 'settings' && (
          <Modal title="Settings" onClose={close}>
            <b className="text-sm font-semibold">Workspace settings</b>
            <p className="mt-3 text-[13px] leading-6 text-ws-mute">{WS_USER.name}<br />{WS_USER.email}</p>
            <p className="mt-3 text-[13px] leading-6 text-ws-mute">Currency: USD<br />Email notifications: Enabled<br />Payment method: PayPal</p>
            <button className="ws-btn-outline mt-6 w-full" onClick={close}>Done</button>
          </Modal>
        )}
        {modal === 'link' && (
          <Modal title="Invitation link copied" icon={Check} onClose={close}>
            <p className="text-xs text-ws-mute">Share it with your community to start saving.</p>
            <button className="ws-btn-outline mt-5 w-full" onClick={close}>Done</button>
          </Modal>
        )}
        {modal === 'added' && (
          <Modal title="Added to your draft" icon={Check} onClose={close}>
            <p className="text-xs text-ws-mute">Your product is saved with this group draft. Review your selection before creating the group.</p>
            <button className="ws-btn-outline mt-5 w-full" onClick={close}>Done</button>
          </Modal>
        )}
        {modal === 'tracking' && (
          <Modal title="Tracking updates" onClose={close}>
            <b className="text-sm font-semibold">{TRACKING.ref}</b>
            <ul className="mt-4 space-y-3 text-xs text-ws-mute">
              {TRACKING.events.map(([when, what]) => <li key={when}>{when}<br />{what}</li>)}
            </ul>
            <p className="mt-4 text-xs text-ws-mute">{TRACKING.eta}</p>
            <button className="ws-btn-outline mt-6 w-full" onClick={close}>Back to your order</button>
          </Modal>
        )}
        {modal === 'menu' && (
          <Modal title="Mobile menu" onClose={close}>
            <div className="flex flex-col gap-3">
              {NAV.map(({ to, label, match }) => (
                <button key={to} onClick={() => { close(); nav(to); }} className={match(pathname) ? 'ws-btn-primary' : 'ws-btn-outline'}>{label}</button>
              ))}
            </div>
          </Modal>
        )}
      </div>
    </WsCtx.Provider>
  );
}
