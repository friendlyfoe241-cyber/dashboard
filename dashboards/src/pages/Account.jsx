import { useState } from 'react';
import Profile from './Profile.jsx';
import Tools from './Tools.jsx';
import Certificates from '../components/Certificates.jsx';
import Referrals from '../components/Referrals.jsx';
import { useAuth } from '../auth.jsx';

// Unified account area — profile + résumé/tools + certificates + referrals.
export default function Account() {
  const [tab, setTab] = useState('profile');
  const { user } = useAuth();
  const isResearcher = user?.kind === 'researcher';
  return (
    <div>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <button className={`btn btn-sm ${tab === 'profile' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('profile')}>Profile</button>
        <button className={`btn btn-sm ${tab === 'tools' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('tools')}>Résumé & tools</button>
        {isResearcher && <button className={`btn btn-sm ${tab === 'certs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('certs')}>Certificates</button>}
        <button className={`btn btn-sm ${tab === 'referrals' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('referrals')}>Refer & invite</button>
      </div>
      {tab === 'profile' ? <Profile /> : tab === 'certs' ? <Certificates /> : tab === 'referrals' ? <Referrals /> : <Tools />}
    </div>
  );
}
