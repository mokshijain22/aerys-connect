'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

type ClaimDetail = {
  claim_id: number;
  claim_number: string;
  component: string;
  warranty_status_at_claim: string;
  status: string;
  submitted_at: string;
  resolved_at: string | null;
  remarks: string | null;
  chassis_number: string;
  full_name: string;
  phone: string;
  dealer_name: string;
};

const statusLabelMap: Record<string, string> = {
  submitted: 'Submitted',
  dealer_approved: 'Under review',
  company_approved: 'Approved',
  rejected: 'Rejected',
};

export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const claimId = params.claimId as string;

  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  function loadClaim() {
    setLoading(true);
    fetch(`/api/warranty-claims/${claimId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setClaim(json.data);
        } else {
          setError(json.error || 'Claim not found');
        }
      })
      .finally(() => setLoading(false));
  }

  function loadAttachments() {
    if (!claim) return;
    fetch(`/api/warranty-claims/${claim.claim_id}/attachments`)
      .then((res) => res.json())
      .then((data) => setAttachments(Array.isArray(data) ? data : []))
      .catch(() => setAttachments([]));
  }

  useEffect(() => {
    loadClaim();
  }, [claimId]);

  useEffect(() => {
    if (claim) loadAttachments();
  }, [claim?.claim_id]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/warranty-claims/${claim?.claim_id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        loadAttachments();
      }
    } catch (err) {
      setError('Upload failed — try again');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function updateStatus(newStatus: string) {
    if (!claim) return;
    setUpdating(true);
    setError('');

    try {
      const res = await fetch('/api/warranty-claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: claim.claim_id, newStatus }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Failed to update status');
        return;
      }

      loadClaim();
    } catch (err) {
      setError('Network error — try again');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-400 text-sm">Loading...</div>;
  }

  if (!claim) {
    return (
      <div className="h-screen overflow-y-auto bg-slate-50 p-6">
        <p className="text-sm text-red-600">{error || 'Claim not found'}</p>
      </div>
    );
  }

  const statusLabel = statusLabelMap[claim.status] ?? claim.status;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <button
        onClick={() => router.push('/warranty-claims')}
        className="text-sm text-emerald-600 font-medium mb-4"
      >
        ← Back to claims
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">{claim.claim_number}</h1>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {statusLabel}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <dt className="text-slate-400">Chassis number</dt>
            <dd className="text-slate-700">{claim.chassis_number}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Component</dt>
            <dd className="text-slate-700">{claim.component}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Warranty status at claim</dt>
            <dd className="text-slate-700 capitalize">{claim.warranty_status_at_claim}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Customer</dt>
            <dd className="text-slate-700">{claim.full_name} · {claim.phone}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Dealer</dt>
            <dd className="text-slate-700">{claim.dealer_name}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Submitted</dt>
            <dd className="text-slate-700">{new Date(claim.submitted_at).toLocaleString('en-GB')}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Resolved</dt>
            <dd className="text-slate-700">
              {claim.resolved_at ? new Date(claim.resolved_at).toLocaleString('en-GB') : '—'}
            </dd>
          </div>
        </dl>

        <div className="mb-6">
          <dt className="text-slate-400 text-sm mb-1">Remarks</dt>
          <dd className="text-slate-700 text-sm">{claim.remarks || 'No remarks provided.'}</dd>
        </div>

        <div className="mb-6 pt-4 border-t border-slate-100">
          <dt className="text-slate-400 text-sm mb-2">Attachments</dt>
          {attachments.length === 0 && (
            <p className="text-sm text-slate-400 mb-2">No files uploaded yet.</p>
          )}
          {attachments.length > 0 && (
            <ul className="mb-3 space-y-1">
              {attachments.map((att) => (
                <li key={att.attachment_id}>
                  
                    <a href={att.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline"
                  >
                    {att.file_path.split('/').pop().replace(/^\d+_/, '')}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <label className="inline-block text-sm font-medium text-emerald-600 cursor-pointer">
            {uploading ? 'Uploading...' : '+ Upload file'}
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          {claim.status === 'submitted' && (
            <>
              <button
                onClick={() => updateStatus('dealer_approved')}
                disabled={updating}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Mark under review
              </button>
              <button
                onClick={() => updateStatus('rejected')}
                disabled={updating}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Reject
              </button>
            </>
          )}

          {claim.status === 'dealer_approved' && (
            <>
              <button
                onClick={() => updateStatus('company_approved')}
                disabled={updating}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Approve
              </button>
              <button
                onClick={() => updateStatus('rejected')}
                disabled={updating}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Reject
              </button>
            </>
          )}

          {(claim.status === 'company_approved' || claim.status === 'rejected') && (
            <p className="text-sm text-slate-400">This claim has been finalized.</p>
          )}
        </div>
      </div>
    </div>
  );
}