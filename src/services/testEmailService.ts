import { getApiBaseUrl } from '@/src/lib/apiBase';

export async function sendTestEmail(params: {
  to: string;
  subject?: string;
  secret?: string;
}): Promise<{ ok: boolean; message?: string; error?: string; id?: string }> {
  const base = getApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      error:
        'Set VITE_API_BASE_URL to your Express URL, or run locally with dev:all (defaults to localhost:4000)',
    };
  }

  const res = await fetch(`${base}/api/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: params.to.trim(),
      subject: params.subject?.trim(),
      secret: params.secret?.trim() || undefined,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    id?: string;
  };

  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }

  return { ok: true, message: data.message, id: data.id };
}
