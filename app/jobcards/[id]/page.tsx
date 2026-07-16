'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const VIOLET = '#6C5CE7';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const RED = '#E24B4A';
const GREEN = '#34C759';

const STATUS_LABEL: Record<string, string> = {
  registered: 'Registered',
  acknowledged: 'Acknowledged',
  rejected_by_dealer: 'Rejected',
  technician_assigned: 'Technician assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  delivered: 'Delivered',
};

function fmt(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function JobCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [jc, setJc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/jobcards/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setJc(json.data);
        else setError(json.error || 'Job card not found');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="min-h-screen p-6 text-sm" style={{ color: MUTED }}>Loading...</div>;
  }

  if (!jc) {
    return (
      <div className="min-h-screen p-6">
        <p className="text-sm" style={{ color: RED }}>{error || 'Job card not found'}</p>
      </div>
    );
  }

  const complaintPhotos = jc.attachments.filter((a: any) => a.stage === 'complaint');

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#FAFAFF', fontFamily: 'Inter, sans-serif' }}>
      <button onClick={() => router.push('/jobcards')} className="text-sm font-medium mb-4" style={{ color: VIOLET }}>
        ← Back to job cards
      </button>

      <div className="bg-white rounded-2xl border p-8 max-w-3xl" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: INK }}>Job Card #{jc.job_card_id}</h1>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
            {STATUS_LABEL[jc.status] ?? jc.status}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <dt style={{ color: MUTED }}>Customer</dt>
            <dd style={{ color: INK }}>{jc.full_name} · {jc.phone}</dd>
          </div>
          <div>
            <dt style={{ color: MUTED }}>Vehicle (chassis)</dt>
            <dd style={{ color: INK }}>{jc.chassis_number}</dd>
          </div>
          <div>
            <dt style={{ color: MUTED }}>Service type</dt>
            <dd style={{ color: INK }} className="capitalize">{jc.service_type}</dd>
          </div>
          <div>
            <dt style={{ color: MUTED }}>Dealer</dt>
            <dd style={{ color: INK }}>{jc.dealer_name}</dd>
          </div>
          <div>
            <dt style={{ color: MUTED }}>Part</dt>
            <dd style={{ color: INK }}>{jc.part_category || '—'}</dd>
          </div>
          <div>
            <dt style={{ color: MUTED }}>Symptom</dt>
            <dd style={{ color: INK }}>{jc.symptom_type || '—'}</dd>
          </div>
        </dl>

        <div className="mb-6">
          <dt className="text-sm mb-1" style={{ color: MUTED }}>Complaint description</dt>
          <dd className="text-sm" style={{ color: INK }}>{jc.complaint_text}</dd>
        </div>

        {complaintPhotos.length > 0 && (
          <div className="mb-6">
            <dt className="text-sm mb-2" style={{ color: MUTED }}>Complaint photos</dt>
            <div className="flex flex-wrap gap-3">
              {complaintPhotos.map((p: any) => (
                <a key={p.attachment_id} href={p.file_path} target="_blank" rel="noopener noreferrer">
                  <img src={p.file_path} alt="complaint" className="w-24 h-24 object-cover rounded-xl border" style={{ borderColor: BORDER }} />
                </a>
              ))}
            </div>
          </div>
        )}

        {jc.technician_name && ['in_progress', 'completed', 'delivered'].includes(jc.status) && (
          <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: VIOLET_DIM }}>
            <p className="text-sm font-semibold mb-1" style={{ color: VIOLET }}>Assigned Technician</p>
            <p className="text-sm" style={{ color: INK }}>{jc.technician_name} · {jc.technician_phone}</p>
          </div>
        )}

        {jc.status === 'rejected_by_dealer' && jc.dealer_rejection_reason && (
          <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: 'rgba(226,75,74,0.08)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: RED }}>Rejection reason</p>
            <p className="text-sm" style={{ color: INK }}>{jc.dealer_rejection_reason}</p>
          </div>
        )}

        <div className="pt-4 border-t" style={{ borderColor: BORDER }}>
          <p className="text-sm font-semibold mb-3" style={{ color: INK }}>Timeline</p>
          <div className="space-y-2 text-xs" style={{ color: MUTED }}>
            <p>Registered: {fmt(jc.registered_at)}</p>
            <p>Acknowledged: {fmt(jc.acknowledged_at)}</p>
            <p>Technician assigned: {fmt(jc.technician_assigned_at)}</p>
            <p>Service started: {fmt(jc.service_started_at)}</p>
            <p>Service completed: {fmt(jc.service_completed_at)}</p>
            <p>Delivered: {fmt(jc.delivered_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}