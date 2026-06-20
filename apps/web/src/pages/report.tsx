import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import GuestLayout from './guest/layout';

const INCIDENT_TYPES = [
  { id: 'flooding',   label: 'Flooding',   icon: '🌊' },
  { id: 'congestion', label: 'Congestion', icon: '🚗' },
  { id: 'security',   label: 'Security',   icon: '🛡️' },
  { id: 'streetlight',label: 'Streetlight',icon: '💡' },
  { id: 'trash',      label: 'Trash',      icon: '🗑️' },
  { id: 'other',      label: 'Other',      icon: '📍' },
];

export default function ReportPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Mimic API call for now or wire to real one if available
    try {
      const res = await fetch('/api/v1/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          description,
          lat: 6.9271, // Mock current location
          lon: 3.3958,
          severity: 'medium',
        }),
      });
      if (res.ok) setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <GuestLayout>
        <div className="report-success">
          <div className="success-icon">✓</div>
          <h1>Report Submitted</h1>
          <p>Thank you for helping us keep Redemption City safe.</p>
          <Link to="/" className="btn btn-primary">Back to Map</Link>
        </div>
      </GuestLayout>
    );
  }

  return (
    <GuestLayout>
      <div className="report-page">
        <div className="report-head">
          <Link to="/" className="report-back">←</Link>
          <h1 className="report-title">Report an Incident</h1>
        </div>

        <form className="report-form" onSubmit={handleSubmit}>
          <div className="report-section">
            <label className="input-label">What's happening?</label>
            <div className="type-grid">
              {INCIDENT_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`type-card${type === t.id ? ' active' : ''}`}
                  onClick={() => setType(t.id)}
                >
                  <span className="type-icon">{t.icon}</span>
                  <span className="type-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="report-section">
            <label className="input-label">Description (optional)</label>
            <textarea
              className="input textarea"
              placeholder="Provide more details about the issue..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary report-submit"
            type="submit"
            disabled={!type || loading}
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </GuestLayout>
  );
}
