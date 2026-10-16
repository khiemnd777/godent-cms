export interface LocalConfig {
  databaseUrl: string;
  redisUrl: string;
  s3Endpoint: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  authSecret: string;
}

// S01 is a loopback-only technical scaffold. Production configuration is deferred.
export function readConfig(env: Record<string, string | undefined> = process.env): LocalConfig {
  function required(key: string): string {
    const value = env[key];
    if (!value?.trim()) throw new Error(`Invalid configuration: ${key}`);
    return value;
  }
  function localUrl(key: string, protocols: string[], endpoint = false): string {
    const value = required(key);
    try {
      const url = new URL(value);
      if (!protocols.includes(url.protocol) || url.hostname !== '127.0.0.1' || url.hash ||
          (endpoint && (url.pathname !== '/' || url.search || url.username || url.password))) throw new Error();
    } catch { throw new Error(`Invalid configuration: ${key}`); }
    return value;
  }
  const authSecret = required('BETTER_AUTH_SECRET');
  if (authSecret.length < 32) throw new Error('Invalid configuration: BETTER_AUTH_SECRET');
  return {
    databaseUrl: localUrl('DATABASE_URL', ['postgres:', 'postgresql:']),
    redisUrl: localUrl('REDIS_URL', ['redis:']),
    s3Endpoint: localUrl('S3_ENDPOINT', ['http:'], true),
    s3Region: required('S3_REGION'), s3AccessKeyId: required('S3_ACCESS_KEY_ID'),
    s3SecretAccessKey: required('S3_SECRET_ACCESS_KEY'), authSecret,
  };
}
