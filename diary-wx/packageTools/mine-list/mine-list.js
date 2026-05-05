const { post, wallpaperSrc, wallpaperThumbSrc } = require('../../utils/request.js')
const { ensureDisplayHotLabel } = require('../../utils/display-hot.js')
const { collectAdd, collectRemove, collectState } = require('../../utils/collect.js')
const routes = require('../../utils/routes.js')

const IMG_ERROR_PLACEHOLDER = '/images/tab/placeholder.png'
const PAGE_LIMIT = 20

function splitColumnsTwo(list) {
  const left = []
  const right = []
  list.forEach((item, i) => {
    if (i % 2 === 0) left.push(item)
    else right.push(item)
  })
  return { left, right }
}

function enrichItem(w) {
  const fullFile = w.fileName
  return {
    ...w,
    img: (w && w.img) || wallpaperThumbSrc(fullFile),
    imgFull: (w && w.imgFull) || wallpaperSrc(fullFile),
    hotLabel: ensureDisplayHotLabel(w),
    favorited: !!w.favorited,
    _heartJustLiked: !!w._heartJustLiked,
  }
}

Page({
  data: {
    kind: 'collect', // collect | download
    leftCol: [],
    rightCol: [],
    nextPage: 1,
    loading: false,
    noMore: false,
    allRecords: [],
    emptyHint: '暂无记录',
  },

  onLoad(options) {
    const kind = options && options.kind === 'download' ? 'download' : 'collect'
    const title = kind === 'download' ? '我的下载' : '我的收藏'
    wx.setNavigationBarTitle({ title })
    this.setData({
      kind,
      emptyHint: kind === 'download' ? '暂无下载记录' : '暂无收藏记录',
    })
    this.loadMore(true)
  },

  onPullDownRefresh() {
    this.loadMore(true)
  },

  onReachBottom() {
    this.loadMore(false)
  },

  openWallpaperPreview(list, index) {
    if (!list || !list.length) return
    let i = Number(index)
    if (Number.isNaN(i) || i < 0) i = 0
    if (i >= list.length) i = list.length - 1
    getApp().globalData.pendingWallpaperPreview = { list, index: i }
    wx.navigateTo({ url: routes.wallpaperPreview })
  },

  onWallpaperTap(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.allRecords
    const index = list.findIndex((w) => String(w.wallpapersId) === String(id))
    if (index < 0) return
    this.openWallpaperPreview(list, index)
  },

  onCollectTap(e) {
    const id = e.currentTarget.dataset.id
    if (id == null || id === '') return
    const now = Date.now()
    if (!this._collectTapAt) this._collectTapAt = new Map()
    if (!this._collectInFlight) this._collectInFlight = new Set()
    const lastAt = this._collectTapAt.get(String(id)) || 0
    if (this._collectInFlight.has(String(id)) || now - lastAt < 1000) return
    this._collectTapAt.set(String(id), now)
    this._collectInFlight.add(String(id))
    setTimeout(() => this._collectInFlight && this._collectInFlight.delete(String(id)), 1000)

    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      this._collectInFlight.delete(String(id))
      return
    }
    const row = this.data.allRecords.find((w) => String(w.wallpapersId) === String(id))
    const wasFav = !!(row && row.favorited)
    const baseCountRaw =
      row && row.collectCount != null
        ? Number(row.collectCount)
        : row && row.hotLabel != null
          ? Number(row.hotLabel)
          : 0
    const baseCount = Number.isFinite(baseCountRaw) && baseCountRaw >= 0 ? Math.floor(baseCountRaw) : 0
    const optimisticCount = wasFav ? Math.max(0, baseCount - 1) : baseCount + 1

    const withPop = this.data.allRecords.map((w) =>
      String(w.wallpapersId) === String(id)
        ? {
            ...w,
            favorited: !wasFav,
            collectCount: optimisticCount,
            hotLabel: String(optimisticCount),
            _heartJustLiked: true,
          }
        : w,
    )
    this._applyCols(withPop)
    const clearPopLater = () => {
      setTimeout(() => {
        const all = this.data.allRecords.map((w) =>
          String(w.wallpapersId) === String(id) ? { ...w, _heartJustLiked: false } : w,
        )
        this._applyCols(all)
      }, 1000)
    }
    const op = wasFav ? collectRemove : collectAdd
    op(id)
      .then((data) => {
        const serverCount =
          data && data.collectCount != null ? Number(data.collectCount) : null

        if (this.data.kind === 'collect' && wasFav) {
          const idx = this.data.allRecords.findIndex((w) => String(w.wallpapersId) === String(id))
          const removed = this.data.allRecords[idx]
          const kept = this.data.allRecords
            .filter((w) => String(w.wallpapersId) !== String(id))
            .map((w) => ({ ...w, _heartJustLiked: false }))
          this._applyCols(kept)
          wx.showToast({ title: '已取消收藏', icon: 'success' })
          clearPopLater()
          // 若服务端返回了最新收藏数，也顺手更新一下（不依赖展示，但保证预览回退/复用数据时一致）
          if (serverCount != null && Number.isFinite(serverCount) && removed) {
            removed.collectCount = serverCount
            removed.hotLabel = String(serverCount)
          }
          return
        }

        const all = this.data.allRecords.map((w) =>
          String(w.wallpapersId) === String(id)
            ? {
                ...w,
                favorited: !wasFav,
                _heartJustLiked: false,
                ...(serverCount != null && Number.isFinite(serverCount)
                  ? { collectCount: serverCount, hotLabel: String(serverCount) }
                  : {}),
              }
            : w,
        )
        this._applyCols(all)
        wx.showToast({
          title:
            wasFav
              ? '已取消收藏'
              : data && data.already
                ? '已在收藏夹'
                : '已收藏',
          icon: data && data.already ? 'none' : 'success',
        })
        clearPopLater()
      })
      .catch((err) => {
        const all = this.data.allRecords.map((w) =>
          String(w.wallpapersId) === String(id)
            ? {
                ...w,
                favorited: wasFav,
                collectCount: baseCount,
                hotLabel: String(baseCount),
                _heartJustLiked: false,
              }
            : w,
        )
        this._applyCols(all)
        wx.showToast({
          title: (err && err.message) || (wasFav ? '取消收藏失败' : '收藏失败'),
          icon: 'none',
        })
      })
  },

  _applyCols(allRecords) {
    const { left, right } = splitColumnsTwo(allRecords)
    this.setData({ allRecords, leftCol: left, rightCol: right })
  },

  syncFavoritedFromServer(allRecords) {
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id || !allRecords.length) return Promise.resolve()
    if (this.data.kind === 'collect') {
      const merged = allRecords.map((w) => ({ ...w, favorited: true }))
      this._applyCols(merged)
      return Promise.resolve()
    }
    const ids = Array.from(
      new Set(allRecords.map((w) => Number(w.wallpapersId)).filter((n) => n > 0)),
    )
    const chunkSize = 80
    const chunks = []
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize))
    }
    return Promise.all(chunks.map((c) => collectState(c)))
      .then((results) => {
        const set = new Set()
        results.forEach((rows) => {
          (rows || []).forEach((r) => set.add(Number(r.wallpapersId)))
        })
        const merged = allRecords.map((w) => ({
          ...w,
          favorited: set.has(Number(w.wallpapersId)),
        }))
        this._applyCols(merged)
      })
      .catch(() => { })
  },

  loadMore(isFirst) {
    if (this.data.loading || (!isFirst && this.data.noMore)) return
    const page = isFirst ? 1 : this.data.nextPage
    const kind = this.data.kind
    this.setData({ loading: true })

    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) {
      this.setData({ loading: false, allRecords: [], leftCol: [], rightCol: [] })
      wx.stopPullDownRefresh()
      return
    }

    const api =
      kind === 'download'
        ? '/api/v1/wallpaper/wechat/action/page'
        : '/api/v1/wallpaper/wechat/collect/page'
    const body =
      kind === 'download'
        ? { uid: u.id, type: '2', page, limit: PAGE_LIMIT }
        : { uid: u.id, page, limit: PAGE_LIMIT }

    post(api, body, { silent: true })
      .then((data) => {
        const batch = (data && data.records) || []
        const total = (data && data.total) || 0
        const enrichedBatch = batch.map((w) => enrichItem(w))
        const all = isFirst ? enrichedBatch : this.data.allRecords.concat(enrichedBatch)
        const { left, right } = splitColumnsTwo(all)
        const noMore = batch.length < PAGE_LIMIT || all.length >= total
        this.setData({
          allRecords: all,
          leftCol: left,
          rightCol: right,
          nextPage: page + 1,
          loading: false,
          noMore,
        })
        this.syncFavoritedFromServer(all)
      })
      .catch(() => {
        this.setData({ loading: false })
      })
      .finally(() => {
        wx.stopPullDownRefresh()
      })
  },
})