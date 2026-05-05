const { post } = require('./request.js')

/**
 * 将壁纸加入当前登录用户的收藏（服务端 user_collection）。
 * @param {number|string} wallpapersId
 * @returns {Promise<{ ok?: true; already?: true }>}
 */
function collectAdd(wallpapersId) {
  const u = wx.getStorageSync('wxUser')
  if (!u || !u.id) {
    return Promise.reject(new Error('请先登录'))
  }
  const id = Number(wallpapersId)
  if (!id || id < 1) {
    return Promise.reject(new Error('无效壁纸'))
  }
  return post(
    '/api/v1/wallpaper/wechat/collect/add',
    { uid: u.id, wallpapersId: id },
    { silent: true },
  )
}

/**
 * 将壁纸从当前登录用户的收藏移除（服务端 user_collection）。
 * @param {number|string} wallpapersId
 * @returns {Promise<{ ok?: true; already?: true; collectCount?: number }>}
 */
function collectRemove(wallpapersId) {
  const u = wx.getStorageSync('wxUser')
  if (!u || !u.id) {
    return Promise.reject(new Error('请先登录'))
  }
  const id = Number(wallpapersId)
  if (!id || id < 1) {
    return Promise.reject(new Error('无效壁纸'))
  }
  return post(
    '/api/v1/wallpaper/wechat/collect/remove',
    { uid: u.id, wallpapersId: id },
    { silent: true },
  )
}

/**
 * 批量查询是否已收藏（需登录）。
 * @param {number[]} wallpapersIds
 * @returns {Promise<Array<{ wallpapersId: number }>>}
 */
function collectState(wallpapersIds) {
  const u = wx.getStorageSync('wxUser')
  if (!u || !u.id) {
    return Promise.resolve([])
  }
  const ids = (wallpapersIds || [])
    .map((n) => Number(n))
    .filter((n) => n > 0)
  if (!ids.length) {
    return Promise.resolve([])
  }
  return post(
    '/api/v1/wallpaper/wechat/collect/state',
    { uid: u.id, wallpapersIds: ids },
    { silent: true },
  ).then((data) => (Array.isArray(data) ? data : []))
}

module.exports = { collectAdd, collectRemove, collectState }
