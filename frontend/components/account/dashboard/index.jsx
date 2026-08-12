import Breadcrumbs from '../../ui/Breadcrumbs';
import Card from '../../ui/Card';
import Input from '../../ui/Input';
import Avatar from '../../ui/Avatar';
import DropdownMenu from '../../ui/DropdownMenu';
import ProgressBar from '../../ui/ProgressBar';
import SectionCard from '../_shared/SectionCard';

import Header from '../../layouts/Header';
import Sidebar from '../../layouts/Sidebar';

export function DashboardLayoutContainer({ sidebarItems = [], sidebarOpen = true, onSidebarClose, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar items={sidebarItems} isOpen={sidebarOpen} onClose={onSidebarClose} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

export function SidebarNavigation(props) {
  return <Sidebar {...props} />;
}

export function TopNavigationBar(props) {
  return <Header {...props} />;
}

export function BreadcrumbNavigation({ items }) {
  return <Breadcrumbs items={items} />;
}

export function SearchBarGlobal({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-10 pr-3 py-2 w-72 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}

export function WelcomeBanner({ title = 'Welcome back', subtitle, right }) {
  return (
    <div className="rounded-xl bg-fintranzact-gradient text-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-2xl font-semibold">{title}</div>
          {subtitle ? <div className="text-white/90 mt-1">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

export function QuickStatsCards({ stats = [] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-500">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{s.value}</div>
              {s.delta ? <div className="mt-1 text-sm text-gray-600">{s.delta}</div> : null}
            </div>
            {s.icon ? <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center">{s.icon}</div> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ActivityFeedTimeline({ items = [] }) {
  return (
    <SectionCard title="Activity" subtitle="Latest account events">
      <ol className="space-y-4">
        {items.map((it, idx) => (
          <li key={it.id ?? idx} className="flex gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-600" />
            <div className="min-w-0">
              <div className="text-sm text-gray-900">
                <span className="font-medium">{it.title}</span>
                {it.description ? <span className="text-gray-600"> — {it.description}</span> : null}
              </div>
              {it.time ? <div className="text-xs text-gray-500 mt-0.5">{it.time}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

export function NotificationBellWithDropdown({ count = 0, items = [], onItemClick }) {
  return (
    <DropdownMenu
      trigger={
        <button className="relative p-2 rounded-md text-gray-600 hover:bg-gray-100">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {count ? <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" /> : null}
        </button>
      }
      items={items.map((it) => ({
        key: it.id,
        label: it.title,
        description: it.time,
        onClick: () => onItemClick?.(it),
      }))}
    />
  );
}

export function UserAvatarWithDropdownMenu({ name, src, menuItems = [] }) {
  return (
    <DropdownMenu
      trigger={<div className="cursor-pointer"><Avatar name={name} src={src} /></div>}
      items={menuItems}
    />
  );
}

export function DashboardContainer({ title, breadcrumbs = [], children, actions }) {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      {breadcrumbs?.length ? <BreadcrumbNavigation items={breadcrumbs} /> : null}
      {title ? (
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
