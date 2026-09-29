export default function NavBar({ tab, setTab }) {
  const tabs = [
    { id: 'shop', label: '🛍 Shop' },
    { id: 'orders', label: '📦 Orders' },
    { id: 'support', label: '💬 Live Support' },
    { id: 'agent', label: '🎧 Agent' },
  ];
  return (
    <nav className="navbar">
      {tabs.map((t) => (
        <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
