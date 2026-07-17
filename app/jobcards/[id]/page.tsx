'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

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

  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';

  const [jc, setJc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reviews, setReviews] = useState<Record<string, any>>({});
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const REVIEW_LABELS: Record<string, string> = {
    customer: 'Customer review (of the service)',
    technician: "Technician's review (of the customer)",
    dealer: "Dealer's review (of the technician)",
  };

  useEffect(() => {
    fetch(`/api/jobcards/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setJc(json.data);
        else setError(json.error || 'Job card not found');
      })
      .finally(() => setLoading(false));
  }, [id]);

  function loadReviews() {
    fetch(`/api/jobcards/${id}/review`)
      .then((res) => res.json())
      .then((json) => { if (json.success) setReviews(json.data); });
  }

  useEffect(() => {
    if (jc?.status === 'delivered') loadReviews();
  }, [jc?.status, id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const res = await fetch(`/api/jobcards/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, reviewText }),
      });
      const json = await res.json();
      if (!json.success) { setReviewError(json.error); return; }
      setReviewText('');
      loadReviews();
    } finally {
      setReviewSubmitting(false);
    }
  }

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
  const arrivalPhotos = jc.attachments.filter((a: any) => a.stage === 'arrival');
  const completionPhotos = jc.attachments.filter((a: any) => a.stage === 'completion');

  return (
    <div className="h-screen overflow-y-auto p-6" style={{ backgroundColor: '#FAFAFF', fontFamily: 'Inter, sans-serif' }}>
      <button onClick={() => router.push('/jobcards')} className="text-sm font-medium mb-4" style={{ color: VIOLET }}>
        ← Back to job cards
      </button>

      <div className="bg-white rounded-2xl border p-8 max-w-3xl" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: INK }}>Job Card #{jc.job_card_id}</h1>
          <div className="flex items-center gap-2">
            {jc.auto_assigned === 1 && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(245,166,35,0.12)', color: '#F5A623' }}>
                ⚡ Auto-assigned
              </span>
            )}
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: VIOLET_DIM, color: VIOLET }}>
              {STATUS_LABEL[jc.status] ?? jc.status}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6">
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

        {arrivalPhotos.length > 0 && (
          <div className="mb-6">
            <dt className="text-sm mb-2" style={{ color: MUTED }}>Technician arrival photo</dt>
            <div className="flex flex-wrap gap-3">
              {arrivalPhotos.map((p: any) => (
                <a key={p.attachment_id} href={p.file_path} target="_blank" rel="noopener noreferrer">
                  <img src={p.file_path} alt="arrival" className="w-24 h-24 object-cover rounded-xl border" style={{ borderColor: BORDER }} />
                </a>
              ))}
            </div>
            {jc.arrived_at && <p className="text-xs mt-1" style={{ color: MUTED }}>Arrived: {fmt(jc.arrived_at)}</p>}
          </div>
        )}

        {completionPhotos.length > 0 && (
          <div className="mb-6">
            <dt className="text-sm mb-2" style={{ color: MUTED }}>Completion photo</dt>
            <div className="flex flex-wrap gap-3">
              {completionPhotos.map((p: any) => (
                <a key={p.attachment_id} href={p.file_path} target="_blank" rel="noopener noreferrer">
                  <img src={p.file_path} alt="completion" className="w-24 h-24 object-cover rounded-xl border" style={{ borderColor: BORDER }} />
                </a>
              ))}
            </div>
          </div>
        )}

        {jc.technician_name && ['technician_assigned', 'in_progress', 'completed', 'delivered'].includes(jc.status) && (
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
            <p>Technician arrived: {fmt(jc.arrived_at)}</p>
            <p>Service completed: {fmt(jc.service_completed_at)}</p>
            <p>Delivered: {fmt(jc.delivered_at)}</p>
          </div>
        </div>

        {jc.customer_verified_at && (
          <div className="pt-4 border-t mt-4" style={{ borderColor: BORDER }}>
            <p className="text-sm font-semibold mb-3" style={{ color: INK }}>Customer verification</p>
            <p className="text-xs mb-1" style={{ color: MUTED }}>OTP sent to: <span style={{ color: INK }}>{jc.verification_phone || '—'}</span></p>
            <p className="text-xs mb-3" style={{ color: MUTED }}>Verified at: <span style={{ color: INK }}>{fmt(jc.customer_verified_at)}</span></p>
            {jc.signature_path && (
              <img src={jc.signature_path} alt="Customer signature" className="rounded-xl border max-w-xs" style={{ borderColor: BORDER, backgroundColor: '#FAFAFF' }} />
            )}
          </div>
        )}

        {jc.status === 'delivered' && ['customer', 'technician', 'dealer'].includes(role) && (
          <div className="pt-4 border-t mt-4" style={{ borderColor: BORDER }}>
            <p className="text-sm font-semibold mb-3" style={{ color: INK }}>{REVIEW_LABELS[role]}</p>
            {reviews[role] ? (
              <div>
                <p style={{ color: '#F5A623' }}>{'★'.repeat(reviews[role].rating)}{'☆'.repeat(5 - reviews[role].rating)}</p>
                {reviews[role].review_text && <p className="text-sm mt-1" style={{ color: INK }}>{reviews[role].review_text}</p>}
              </div>
            ) : (
              <form onSubmit={submitReview} className="space-y-3">
                <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: BORDER }}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
                </select>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Optional feedback..." rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm border resize-none" style={{ borderColor: BORDER }} />
                {reviewError && <p className="text-sm" style={{ color: RED }}>{reviewError}</p>}
                <button type="submit" disabled={reviewSubmitting}
                  className="text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50" style={{ backgroundColor: VIOLET }}>
                  {reviewSubmitting ? 'Submitting...' : 'Submit review'}
                </button>
              </form>
            )}

            {/* Show other completed reviews as read-only context, if any exist */}
            {Object.entries(reviews).filter(([r]) => r !== role).length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: BORDER }}>
                {Object.entries(reviews).filter(([r]) => r !== role).map(([r, rv]: any) => (
                  <div key={r}>
                    <p className="text-xs font-medium mb-1" style={{ color: MUTED }}>{REVIEW_LABELS[r]}</p>
                    <p style={{ color: '#F5A623' }}>{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</p>
                    {rv.review_text && <p className="text-sm mt-0.5" style={{ color: INK }}>{rv.review_text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}