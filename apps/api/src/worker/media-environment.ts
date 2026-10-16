const forbiddenCredentialKeys = new Set([
  'BETTER_AUTH_SECRET',
  'S04_HMAC_SECRET',
  'S07_MEDIA_SIGNING_SECRET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_SECURITY_TOKEN',
  'AWS_PROFILE',
  'AWS_SHARED_CREDENTIALS_FILE',
  'AWS_CONFIG_FILE',
  'AWS_WEB_IDENTITY_TOKEN_FILE',
  'AWS_ROLE_ARN',
  'AWS_CONTAINER_CREDENTIALS_FULL_URI',
  'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI',
]);

export function assertIsolatedMediaWorkerEnvironment(env: Record<string, string | undefined>) {
  // Reject presence, including an empty value, before creating storage or database clients.
  const forbidden = Object.keys(env).some(key =>
    (/DATABASE_URL$/.test(key) && key !== 'S07_WORKER_DATABASE_URL') || forbiddenCredentialKeys.has(key),
  );
  if (forbidden) throw new Error('Media worker credential isolation required');
}
