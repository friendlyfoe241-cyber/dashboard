import { useState } from 'react';
import Profile from './Profile.jsx';
import Tools from './Tools.jsx';
import Certificates from '../components/Certificates.jsx';
import { useAuth } from '../auth.jsx';

// Unified account area — profile + résumé/tools + certificates (sub-tabs inside).
export default function Account() {
  const [tab, setTab] = useState('profile');
  const { user } = useAuth();
  return (
    <div>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <button className={`btn btn-sm ${tab === 'profile' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('profile')}>Profile</button>
        <button className={`btn btn-sm ${tab === 'tools' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('tools')}>Résumé & tools</button>
        {user?.kind === 'researcher' && (
          <button className={`btn btn-sm ${tab === 'certs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('certs')}>Certificates</button>
        )}
      </div>
      {tab === 'profile' ? <Profile /> : tab === 'certs' ? <Certificates /> : <Tools />}
    </div>
  );
}
