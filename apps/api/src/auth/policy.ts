export const API_ORIGIN = 'http://127.0.0.1:5890';
export const ADMIN_ORIGIN = 'http://127.0.0.1:5891';
export const SESSION_SECONDS = 8 * 60 * 60;
export const REAUTH_SECONDS = 5 * 60;

export function validateDatabaseUrl(value: string | undefined, role: string): string {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    const dockerLocal = process.env.GCMS_DOCKER_LOCAL === '1';
    const localEndpoint = url.hostname === '127.0.0.1' && url.port === '5888';
    const containerEndpoint = dockerLocal && url.hostname === 'postgres' && url.port === '5432';
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!localEndpoint && !containerEndpoint) ||
        url.pathname !== '/gcms_s01' || decodeURIComponent(url.username) !== role || !url.password || url.hash || url.search) throw new Error();
    return value;
  } catch { throw new Error(`Invalid S02 database configuration for ${role}`); }
}

export function validateAuthRequest(request: Request): boolean {
  if (new URL(request.url).origin !== API_ORIGIN) return false;
  if (request.headers.has('x-forwarded-host') || request.headers.has('forwarded')) return false;
  const origin = request.headers.get('origin');
  if (origin && origin !== ADMIN_ORIGIN) return false;
  return ['GET', 'HEAD', 'OPTIONS'].includes(request.method) || origin === ADMIN_ORIGIN;
}

export function isRecent(instant: Date, now = new Date()): boolean {
  const age = now.getTime() - instant.getTime();
  return Number.isFinite(age) && age >= 0 && age < REAUTH_SECONDS * 1000;
}
