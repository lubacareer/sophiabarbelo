import { createHash, randomUUID } from 'node:crypto';
import { AppError } from './errors.js';

// Redis executes this script atomically. Using Redis' clock avoids relying on
// synchronization between serverless instances. Leases outlive Vercel's
// maximum 300-second function duration, so a live invocation cannot lose one.
const ACQUIRE = `
local time = redis.call('TIME')
local now = time[1] * 1000 + math.floor(time[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local count = tonumber(redis.call('GET', KEYS[2]) or '0')
if count >= 10 then
  local ttl = redis.call('PTTL', KEYS[2])
  if ttl < 0 then return {-1, 0} end
  return {0, math.max(1, math.ceil(ttl / 1000))}
end
if redis.call('ZCARD', KEYS[1]) >= 3 then return {2, 10} end
if count == 0 then
  redis.call('SET', KEYS[2], '1', 'PX', 600000)
else
  if redis.call('PTTL', KEYS[2]) < 0 then return {-1, 0} end
  redis.call('INCR', KEYS[2])
end
redis.call('ZADD', KEYS[1], now + 330000, ARGV[1])
redis.call('PEXPIRE', KEYS[1], 330000)
return {1, 0}`;

const CONCURRENCY_KEY = 'sophia:public:leases';

export function createSharedLimiter({ url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN, fetchImpl = fetch } = {}) {
  async function command(args) {
    try {
      const endpoint = new URL(url);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || !token) throw new Error('Invalid configuration');
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(args), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Store unavailable');
      const payload = await response.json();
      if (!payload || payload.error || !Object.hasOwn(payload, 'result')) throw new Error('Invalid store response');
      return payload.result;
    } catch {
      throw new AppError(503, 'Analysis is temporarily unavailable. Please try again later.');
    }
  }

  return {
    async acquire(clientKey) {
      const lease = randomUUID();
      const key = `sophia:public:rate:${createHash('sha256').update(clientKey).digest('hex')}`;
      const result = await command(['EVAL', ACQUIRE, 2, CONCURRENCY_KEY, key, lease]);
      if (!Array.isArray(result) || result.length !== 2 || ![0, 1, 2].includes(result[0]) || !Number.isSafeInteger(result[1]) || result[1] < 0) {
        throw new AppError(503, 'Analysis is temporarily unavailable. Please try again later.');
      }
      if (result[0] !== 1) {
        const error = new AppError(429, result[0] === 0 ? 'Too many analyses. Please try again later.' : 'The analyzer is busy. Please try again shortly.');
        error.retryAfter = Math.max(1, result[1]);
        throw error;
      }
      return async () => { await command(['ZREM', CONCURRENCY_KEY, lease]); };
    },
  };
}
