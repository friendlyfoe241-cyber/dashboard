import { useState } from 'react';
import Profile from './Profile.jsx';
import Tools from './Tools.jsx';

// Unified account area — profile + résumé/tools under one tab (sub-tabs inside).
export default function Account() {
  const [tab, setTab] = useState('profile');
  return (
    <div>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <button className={`btn btn-sm ${tab === 'profile' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('profile')}>Profile</button>
        <button className={`btn btn-sm ${tab === 'tools' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('tools')}>Résumé & tools</button>
      </div>
      {tab === 'profile' ? <Profile /> : <Tools />}
    </div>
  );
}
