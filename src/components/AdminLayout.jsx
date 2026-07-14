import Sidebar from './Sidebar.jsx';

export default function AdminLayout({ children }) {
  return (
    <div style={s.shell}>
      <Sidebar />
      <main style={s.content}>
        <div style={s.inner}>{children}</div>
      </main>
    </div>
  );
}

const s = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  content: { flex: 1, overflowY: 'auto' },
  inner: { maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' },
};
