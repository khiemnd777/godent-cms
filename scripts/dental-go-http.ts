import type { DentalGoIdentity } from './dental-go-fixtures';

const API = 'http://127.0.0.1:5890';
export class DentalGoHttp {
  private readonly jar = new Map<string, string>();
  private csrf = '';
  constructor(readonly tenantId: string, readonly slug: string, private readonly actor: DentalGoIdentity) {}
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<{ status: number; value: T }> {
    const allowed = path.startsWith(`/api/tenants/${this.tenantId}/`) || path.startsWith(`/api/cms/tenants/${this.tenantId}/`) || path.startsWith(`/api/public/builder/${this.slug}/`) || ['/api/session', '/api/session/reauth', '/api/auth/sign-in/email'].includes(path);
    if (!allowed || /[\\\s]/.test(path) || path.split('/').includes('..')) throw new Error('Outside owned clinic HTTP scope');
    const multipart = body instanceof FormData, headers: Record<string, string> = { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', accept: 'application/json' };
    if (!path.startsWith('/api/public/') && this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined && !multipart) headers['content-type'] = 'application/json';
    if (method !== 'GET' && this.csrf) headers['x-csrf-token'] = this.csrf;
    const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : multipart ? body as FormData : JSON.stringify(body), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(multipart ? 30_000 : 20_000) });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], at = pair.indexOf('=');
      if (at > 0) { const k = pair.slice(0, at), v = pair.slice(at + 1); if (v) this.jar.set(k, v); else this.jar.delete(k); }
    }
    const text = await response.text();
    if (text.length > 2_097_152) throw new Error('Clinic response budget exceeded');
    let value: T;
    try { value = JSON.parse(text) as T; } catch { throw new Error(`Clinic HTTP ${response.status} returned invalid JSON`); }
    return { status: response.status, value };
  }
  async login() {
    const signed = await this.request('/api/auth/sign-in/email', 'POST', { email: this.actor.email, password: this.actor.password, rememberMe: false });
    if (signed.status !== 200) throw new Error(`Clinic sign-in failed ${signed.status}`);
    const session = await this.request<{ user: { id: string }; csrfToken: string; tenantMemberships: { tenantId: string }[] }>('/api/session');
    if (session.status !== 200 || session.value.user.id !== this.actor.userId || typeof session.value.csrfToken !== 'string' || !session.value.tenantMemberships.some(t => t.tenantId === this.tenantId)) throw new Error('Clinic session scope mismatch');
    this.csrf = session.value.csrfToken;
  }
  async reauth() {
    const r = await this.request('/api/session/reauth', 'POST', { password: this.actor.password });
    if (r.status !== 200) throw new Error(`Clinic reauthentication failed ${r.status}`);
  }
  async get<T>(path: string): Promise<T> {
    const r = await this.request<T>(path);
    if (r.status !== 200) throw new Error(`Clinic read failed ${r.status}`);
    return r.value;
  }
  async command<T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
    let r = await this.request<T & { code?: string }>(path, method, body);
    if (r.status === 403 && r.value.code === 'REAUTH_REQUIRED') { await this.reauth(); r = await this.request(path, method, body); }
    if (![200, 201].includes(r.status)) throw new Error(`Clinic command failed ${r.status} ${r.value.code ?? ''}`);
    return r.value;
  }
}
