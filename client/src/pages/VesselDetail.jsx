import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import VesselDashboard from './VesselDashboard';

export default function VesselDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const isManager = user?.role === 'manager';

  return (
    <div>
      <div className="px-6 pt-4">
        <button onClick={() => nav('/admin')} className="px-3 py-1.5 rounded-lg text-xs text-cyan-300 bg-cyan-900/20 border border-cyan-800/30 hover:bg-cyan-900/30 transition-colors">
          ← Back to Fleet Overview
        </button>
      </div>
      <VesselDashboard vesselIdProp={parseInt(id)} hideIndents={isManager} />
    </div>
  );
}
