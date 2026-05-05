/**
 * 列表「♥ + 数字」展示用：使用接口返回的真实值（不再生成随机值）。
 *
 * 兼容不同历史字段命名：优先取收藏/点赞相关字段，其次取 downloading/hotScore。
 */
function ensureDisplayHotLabel(w) {
  if (w == null) return '0'

  const candidates = [
    w.collectCount,
    w.collectNum,
    w.collectSum,
    w.favoriteCount,
    w.favorCount,
    w.likeCount,
    w.likes,
    w.downloading,
    w.hotScore,
  ]

  for (const v of candidates) {
    const n = typeof v === 'string' ? Number(v) : v
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
      return String(Math.floor(n))
    }
  }

  return '0'
}

module.exports = { ensureDisplayHotLabel }
