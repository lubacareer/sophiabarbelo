import { createHash, randomUUID } from 'node:crypto';
import { AppError } from './errors.js';

export const PUBLIC_LIMITS = Object.freeze({
  burstCount: 5,
  burstWindowMs: 600_000,
  dailyCount: 30,
  dailyWindowMs: 86_400_000,
  clientConcurrency: 2,
  globalConcurrency: 3,
  leaseMs: 330_000,
});

// Redis executes this script atomically. Using Redis' clock avoids relying on
// synchronization between serverless instances. Leases outlive Vercel's
// maximum 300-second function duration, so a live invocation cannot lose one.
const ACQUIRE = `
-- Validate every key before mutating: Redis script errors do not roll back writes.
for index = 1, 4 do
  local kind = redis.call('TYPE', KEYS[index]).ok
  local expected = index <= 2 and 'zset' or 'string'
  if kind ~= 'none' and kind ~= expected then return {-1, 0} end
  if index <= 2 and kind ~= 'none' and redis.call('PTTL', KEYS[index]) < 0 then return {-1, 0} end
end
local function counter(key)
  local value = redis.call('GET', key)
  if not value then return 0, -2, true end
  local count = tonumber(value)
  local ttl = redis.call('PTTL', key)
  if not count or not string.match(value, '^[1-9]%d*$') or count > 9007199254740991 or ttl < 0 then
    return 0, 0, false
  end
  return count, ttl, true
end
local burst, burstTtl, burstValid = counter(KEYS[3])
local daily, dailyTtl, dailyValid = counter(KEYS[4])
if not burstValid or not dailyValid then return {-1, 0} end
if daily >= ${PUBLIC_LIMITS.dailyCount} then return {3, math.max(1, math.ceil(dailyTtl / 1000))} end
if burst >= ${PUBLIC_LIMITS.burstCount} then return {0, math.max(1, math.ceil(burstTtl / 1000))} end
local time = redis.call('TIME')
local now = time[1] * 1000 + math.floor(time[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= ${PUBLIC_LIMITS.globalConcurrency} or redis.call('ZCARD', KEYS[2]) >= ${PUBLIC_LIMITS.clientConcurrency} then return {2, 10} end
if burst == 0 then
  redis.call('SET', KEYS[3], '1', 'PX', ${PUBLIC_LIMITS.burstWindowMs})
else
  redis.call('INCR', KEYS[3])
end
if daily == 0 then
  redis.call('SET', KEYS[4], '1', 'PX', ${PUBLIC_LIMITS.dailyWindowMs})
else
  redis.call('INCR', KEYS[4])
end
for index = 1, 2 do
  redis.call('ZADD', KEYS[index], now + ${PUBLIC_LIMITS.leaseMs}, ARGV[1])
  redis.call('PEXPIRE', KEYS[index], ${PUBLIC_LIMITS.leaseMs})
end
return {1, 0}`;

const RELEASE = `
for index = 1, 2 do
  local kind = redis.call('TYPE', KEYS[index]).ok
  if kind ~= 'none' and kind ~= 'zset' then return -1 end
end
return redis.call('ZREM', KEYS[1], ARGV[1]) + redis.call('ZREM', KEYS[2], ARGV[1])`;

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
      const identity = createHash('sha256').update(clientKey).digest('hex');
      const clientLeases = `sophia:public:client-leases:${identity}`;
      const burstKey = `sophia:public:rate:${identity}`;
      const dailyKey = `sophia:public:daily:${identity}`;
      const result = await command(['EVAL', ACQUIRE, 4, CONCURRENCY_KEY, clientLeases, burstKey, dailyKey, lease]);
      if (!Array.isArray(result) || result.length !== 2 || ![0, 1, 2, 3].includes(result[0]) || !Number.isSafeInteger(result[1]) || result[1] < 0) {
        throw new AppError(503, 'Analysis is temporarily unavailable. Please try again later.');
      }
      if (result[0] !== 1) {
        const message = result[0] === 3 ? 'Daily analysis limit reached. Please try again later.'
          : result[0] === 0 ? 'Too many analyses. Please try again later.' : 'The analyzer is busy. Please try again shortly.';
        const error = new AppError(429, message);
        error.retryAfter = Math.max(1, result[1]);
        throw error;
      }
      return async () => {
        const removed = await command(['EVAL', RELEASE, 2, CONCURRENCY_KEY, clientLeases, lease]);
        if (!Number.isSafeInteger(removed) || removed < 0 || removed > 2) {
          throw new AppError(503, 'Analysis is temporarily unavailable. Please try again later.');
        }
      };
    },
  };
}
