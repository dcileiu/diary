/** 进程内短时缓存（小程序单实例），用于减少重复请求 */
const store = Object.create(null)

function get(key) {
  const e = store[key]
  if (!e) return undefined
  if (Date.now() > e.exp) {
    delete store[key]
    return undefined
  }
  return e.value
}

function set(key, value, ttlMs) {
  const ttl = ttlMs != null ? ttlMs : 60000
  store[key] = { value, exp: Date.now() + ttl }
}

module.exports = { get, set }
