import { useState } from 'react';
import GuestPage from './pages/GuestPage';
import AdminPage from './pages/AdminPage';

type View = 'guest' | 'admin';

export default function App() {
  const [view, setView] = useState<View>('guest');

  return (
    <div>
      <header className="topbar">
        <span className="brand">Календарь встреч</span>
        <nav className="nav">
          <button
            className={view === 'guest' ? 'active' : ''}
            onClick={() => setView('guest')}
          >
            Гость
          </button>
          <button
            className={view === 'admin' ? 'active' : ''}
            onClick={() => setView('admin')}
          >
            Владелец
          </button>
        </nav>
      </header>
      <main className="container">
        {view === 'guest' ? <GuestPage /> : <AdminPage />}
      </main>
    </div>
  );
}