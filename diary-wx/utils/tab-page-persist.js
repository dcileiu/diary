/**
 * Tab 页（首页 / 图集）持久化快照：冷启动可先展示上次内容，再请求刷新。
 * 与 globalData.tabPageCache 字段一致；wx.clearStorageSync 会一并清掉。
 */

const SCHEMA = 1
const KEY_HOME = 'wallpaper_tab_page_home_v1'
const KEY_GALLERY = 'wallpaper_tab_page_gallery_v1'
/** 超过则丢弃，避免用过期数据 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
/** 控制体积，避免逼近 storage 上限；截断后列表可继续触底加载 */
const MAX_LIST_ITEMS = 100

function splitCols2(list) {
  const left = []
  const right = []
  ;(list || []).forEach((item, i) => {
    if (i % 2 === 0) left.push(item)
    else right.push(item)
  })
  return { left, right }
}

function trimListPayload(p) {
  if (!p || !Array.isArray(p.allRecords)) return p
  if (p.allRecords.length <= MAX_LIST_ITEMS) return p
  const allRecords = p.allRecords.slice(0, MAX_LIST_ITEMS)
  const { left, right } = splitCols2(allRecords)
  return {
    ...p,
    allRecords,
    leftCol: left,
    rightCol: right,
    noMore: false,
  }
}

function hasListRecords(list) {
  return Array.isArray(list) && list.length > 0
}

function hasTagStateRecords(tagStates) {
  if (!tagStates || typeof tagStates !== 'object') return false
  return Object.keys(tagStates).some((key) => {
    const state = tagStates[key]
    return state && hasListRecords(state.allRecords)
  })
}

function trimGalleryPayload(payload) {
  const base = trimListPayload({ ...payload })
  if (!payload || !payload.tagStates || typeof payload.tagStates !== 'object') {
    return base
  }
  const trimmedStates = {}
  Object.keys(payload.tagStates).forEach((key) => {
    const state = payload.tagStates[key]
    if (!state || !hasListRecords(state.allRecords)) return
    trimmedStates[key] = trimListPayload({ ...state })
  })
  return {
    ...base,
    tagStates: trimmedStates,
  }
}

function wrap(data) {
  return { _s: SCHEMA, _t: Date.now(), data }
}

function unwrap(raw) {
  if (!raw || typeof raw !== 'object' || raw._s !== SCHEMA) return null
  if (!raw._t || Date.now() - raw._t > MAX_AGE_MS) return null
  return raw.data
}

function save(key, data) {
  try {
    wx.setStorageSync(key, wrap(data))
  } catch (e) {
    try {
      const smaller = trimListPayload(data)
      wx.setStorageSync(key, wrap(smaller))
    } catch (e2) {}
  }
}

function load(key) {
  try {
    return unwrap(wx.getStorageSync(key))
  } catch (e) {
    return null
  }
}

module.exports = {
  KEY_HOME,
  KEY_GALLERY,
  saveHome(payload) {
    if (
      !payload ||
      !Array.isArray(payload.allRecords) ||
      !payload.allRecords.length
    ) {
      try {
        wx.removeStorageSync(KEY_HOME)
      } catch (e) {}
      return
    }
    save(KEY_HOME, trimListPayload({ ...payload }))
  },
  loadHome() {
    return load(KEY_HOME)
  },
  saveGallery(payload) {
    if (!payload || (!hasListRecords(payload.allRecords) && !hasTagStateRecords(payload.tagStates))) {
      try {
        wx.removeStorageSync(KEY_GALLERY)
      } catch (e) {}
      return
    }
    save(KEY_GALLERY, trimGalleryPayload(payload))
  },
  loadGallery() {
    return load(KEY_GALLERY)
  },
}
