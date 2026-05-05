const {
  post,
  wallpaperSrc,
  wallpaperThumbSrc,
} = require('../../utils/request.js')
const galleryTabsFallback = require('../../utils/gallery-tabs.js')
const { ensureDisplayHotLabel } = require('../../utils/display-hot.js')
const { collectAdd, collectRemove, collectState } = require('../../utils/collect.js')
const memCache = require('../../utils/memory-cache.js')
const tabPersist = require('../../utils/tab-page-persist.js')
const routes = require('../../utils/routes.js')

const CACHE_KEY_TAGS = 'wechat_gallery_tags_v1'
const CACHE_TTL_TAGS_MS = 5 * 60 * 1000
const IMG_ERROR_PLACEHOLDER = '/images/tab/placeholder.png'
const HOT_TAG_KEY = '__hot__'

function toTagStateKey(tag) {
  const value = String(tag || '').trim()
  return value || HOT_TAG_KEY
}

function hasListRecords(list) {
  return Array.isArray(list) && list.length > 0
}

function hasStateRecords(state) {
  return !!(state && hasListRecords(state.allRecords))
}

function hasAnyTagStateRecords(tagStates) {
  if (!tagStates || typeof tagStates !== 'object') return false
  return Object.keys(tagStates).some((key) => hasStateRecords(tagStates[key]))
}

function firstSavedTagState(tagStates) {
  if (!tagStates || typeof tagStates !== 'object') return null
  const key = Object.keys(tagStates).find((item) => hasStateRecords(tagStates[item]))
  return key ? tagStates[key] : null
}

function splitColumns(list) {
  const left = []
  const right = []
  list.forEach((item, i) => {
    if (i % 2 === 0) left.push(item)
    else right.push(item)
  })
  return { left, right }
}

function enrichHot(w) {
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

function normalizeTagRows(rows) {
  return (rows || [])
    .map((item, index) => {
      const label = String(item && (item.name || item.label || item.tags) || '').trim()
      const tag = String(item && (item.tags || item.name || item.label) || '').trim()
      if (!label || !tag) return null
      return {
        id: item && item.id != null ? item.id : `tag-${index}`,
        label,
        tag,
      }
    })
    .filter(Boolean)
}

function fallbackTagRows() {
  return normalizeTagRows(galleryTabsFallback)
}

Page({
  data: {
    statusBarHeight: 20,
    navBlockHeight: 88,
    swiperList: [],
    leftCol: [],
    rightCol: [],
    allRecords: [],
    nextPage: 1,
    loading: false,
    noMore: false,
    tags: [],
    activeTag: '',
    tagSticky: false,
    indexLoading: true,
    hotLoading: true,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    const all = this.data.allRecords || []
    const u = wx.getStorageSync('wxUser')
    if (all.length && u && u.id) {
      this.syncFavoritedFromServer(all)
    }
  },

  onHide() {
    this.saveCurrentTagState()
    this.syncGallerySession(true)
    try {
      if (typeof wx.preloadWebview === 'function') wx.preloadWebview()
    } catch (e) { }
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const sh = win.statusBarHeight || 20
    const w = win.windowWidth || win.screenWidth || 375
    const barPx = (88 / 750) * w
    const app = getApp()
    this._pageScrollTop = 0
    this._pendingRestoreScrollTop = 0
    this._tagStates = {}
    let snap = app.globalData.tabPageCache && app.globalData.tabPageCache.gallery
    const hasSnapList = snap && hasListRecords(snap.allRecords)
    const hasSnapTagLists = snap && hasAnyTagStateRecords(snap.tagStates)
    if (!snap || (!hasSnapList && !hasSnapTagLists)) {
      const disk = tabPersist.loadGallery()
      if (disk && (hasListRecords(disk.allRecords) || hasAnyTagStateRecords(disk.tagStates))) {
        snap = disk
        if (!app.globalData.tabPageCache) {
          app.globalData.tabPageCache = { home: null, gallery: null }
        }
        app.globalData.tabPageCache.gallery = disk
      }
    }
    const canSoft =
      snap &&
      (hasListRecords(snap.allRecords) || hasAnyTagStateRecords(snap.tagStates))
    const patch = {
      statusBarHeight: sh,
      navBlockHeight: sh + barPx,
    }
    if (snap && snap.tagStates && typeof snap.tagStates === 'object') {
      this._tagStates = snap.tagStates
    }
    if (canSoft) {
      const preferredActiveTag =
        snap.activeTag != null
          ? snap.activeTag
          : snap.activeType != null
            ? snap.activeType
            : ''
      const visibleTagKey =
        snap.currentTag != null
          ? String(snap.currentTag)
          : snap.listTagKey != null
            ? String(snap.listTagKey)
            : preferredActiveTag
      let resolvedActiveTag = String(preferredActiveTag || '')
      let initialState = this.getSavedTagState(resolvedActiveTag)
      if (!initialState && visibleTagKey !== resolvedActiveTag) {
        initialState = this.getSavedTagState(visibleTagKey)
        if (initialState) resolvedActiveTag = visibleTagKey
      }
      if (!initialState && hasListRecords(snap.allRecords)) {
        resolvedActiveTag = String(visibleTagKey || resolvedActiveTag || '')
        initialState = {
          activeTag: resolvedActiveTag,
          leftCol: Array.isArray(snap.leftCol) ? snap.leftCol.slice() : [],
          rightCol: Array.isArray(snap.rightCol) ? snap.rightCol.slice() : [],
          allRecords: snap.allRecords.slice(),
          nextPage: snap.nextPage != null ? snap.nextPage : 1,
          noMore: !!snap.noMore,
          scrollTop:
            snap.scrollTop != null && Number.isFinite(Number(snap.scrollTop))
              ? Number(snap.scrollTop)
              : 0,
        }
      }
      if (!initialState) {
        const fallbackState = firstSavedTagState(this._tagStates)
        if (fallbackState) {
          initialState = fallbackState
          resolvedActiveTag = String(fallbackState.activeTag || '')
        }
      }
      const initialAllRecords =
        initialState && Array.isArray(initialState.allRecords)
          ? initialState.allRecords.slice()
          : []
      const hasInitialCols =
        initialState &&
        Array.isArray(initialState.leftCol) &&
        Array.isArray(initialState.rightCol)
      const initialCols = hasInitialCols
        ? {
          left: initialState.leftCol.slice(),
          right: initialState.rightCol.slice(),
        }
        : splitColumns(initialAllRecords)
      Object.assign(patch, {
        swiperList: snap.swiperList || [],
        tags: snap.tags || snap.categories || [],
        activeTag: resolvedActiveTag,
        leftCol: initialCols.left,
        rightCol: initialCols.right,
        allRecords: initialAllRecords,
        nextPage:
          initialState && initialState.nextPage != null
            ? initialState.nextPage
            : snap.nextPage != null
              ? snap.nextPage
              : 1,
        noMore: !!(initialState ? initialState.noMore : snap.noMore),
        indexLoading: false,
        hotLoading: false,
        tagSticky: false,
      })
      this._pendingRestoreScrollTop =
        initialState &&
          initialState.scrollTop != null &&
          Number.isFinite(Number(initialState.scrollTop))
          ? Number(initialState.scrollTop)
          : 0
      const stateKey = toTagStateKey(resolvedActiveTag)
      if (!this._tagStates[stateKey] && initialState) {
        this._tagStates[stateKey] = {
          activeTag: resolvedActiveTag,
          leftCol: initialCols.left.slice(),
          rightCol: initialCols.right.slice(),
          allRecords: initialAllRecords.slice(),
          nextPage:
            initialState.nextPage != null ? initialState.nextPage : 1,
          noMore: !!initialState.noMore,
          scrollTop: this._pendingRestoreScrollTop,
        }
      }
    }
    this.setData(patch)
    this.syncGallerySession(false)
    this.loadTags()
    setTimeout(() => this.loadIndex({ soft: !!canSoft }), 200)
    const hasCachedCurrentList = hasListRecords(patch.allRecords)
    if (!hasCachedCurrentList) {
      setTimeout(() => this.loadMoreHot(true, { soft: !!canSoft }), 450)
    }
  },

  onReady() {
    wx.nextTick(() => {
      this.scheduleMeasureSticky()
      setTimeout(() => this.restoreInitialPageScroll(), 140)
    })
  },

  scheduleMeasureSticky() {
    setTimeout(() => this.measureStickyThreshold(), 80)
  },

  measureStickyThreshold() {
    wx.createSelectorQuery()
      .in(this)
      .select('.home-tab-sentinel')
      .boundingClientRect()
      .selectViewport()
      .scrollOffset()
      .exec((res) => {
        const rect = res && res[0]
        const viewport = res && res[1]
        if (!rect) return
        const stickyTop = 0
        const scrollTop =
          viewport && typeof viewport.scrollTop === 'number'
            ? viewport.scrollTop
            : 0
        const offsetTop = rect.top + scrollTop
        this._stickyScrollThreshold = Math.max(0, offsetTop - stickyTop)
      })
  },

  onPageScroll(e) {
    this._pageScrollTop =
      e && typeof e.scrollTop === 'number' ? e.scrollTop : 0
    const scrollState = this.getSavedTagState(this.data.activeTag)
    if (scrollState) {
      scrollState.scrollTop = this._pageScrollTop
    }
    const th = this._stickyScrollThreshold
    if (th == null) return
    const sticky = e.scrollTop >= th
    if (sticky !== this.data.tagSticky) {
      this.setData({ tagSticky: sticky })
    }
  },

  withStickyStateForTarget(target, callback) {
    const shouldSticky =
      typeof this._stickyScrollThreshold === 'number' &&
      target >= this._stickyScrollThreshold
    if (shouldSticky === this.data.tagSticky) {
      callback()
      return
    }
    this.setData({ tagSticky: shouldSticky }, callback)
  },

  stabilizePageScrollTo(target) {
    const finalTop = Math.max(0, Math.floor(Number(target) || 0))
    const seq = (this._scrollRestoreSeq || 0) + 1
    this._scrollRestoreSeq = seq
    const apply = () => {
      if (seq !== this._scrollRestoreSeq) return
      this._pageScrollTop = finalTop
      wx.pageScrollTo({
        scrollTop: finalTop,
        duration: 0,
      })
    }
    apply()
      ;[80, 220].forEach((delay) => {
        setTimeout(apply, delay)
      })
  },

  restoreInitialPageScroll() {
    const target = Math.max(0, Math.floor(Number(this._pendingRestoreScrollTop) || 0))
    this._pendingRestoreScrollTop = 0
    if (!target) return
    this._pageScrollTop = target
    this.withStickyStateForTarget(target, () => {
      this.stabilizePageScrollTo(target)
    })
  },

  saveCurrentTagState() {
    if (!this._tagStates) this._tagStates = {}
    const sourceTag = String(this.data.activeTag || '')
    const key = toTagStateKey(sourceTag)
    const allRecords = Array.isArray(this.data.allRecords)
      ? this.data.allRecords.slice()
      : []
    const hadState = !!this._tagStates[key]
    if (!allRecords.length && !hadState && !this.data.noMore) return
    this._tagStates[key] = {
      activeTag: sourceTag,
      leftCol: Array.isArray(this.data.leftCol) ? this.data.leftCol.slice() : [],
      rightCol: Array.isArray(this.data.rightCol) ? this.data.rightCol.slice() : [],
      allRecords,
      nextPage: this.data.nextPage != null ? this.data.nextPage : 1,
      noMore: !!this.data.noMore,
      scrollTop: Math.max(0, Number(this._pageScrollTop) || 0),
    }
    this.syncGallerySession(false)
  },

  getSavedTagState(tag) {
    const key = toTagStateKey(tag)
    return this._tagStates && this._tagStates[key]
      ? this._tagStates[key]
      : null
  },

  cancelPendingListRequest() {
    this._listRequestSeq = (this._listRequestSeq || 0) + 1
    this.setData({
      loading: false,
      hotLoading: false,
    })
  },

  syncGallerySession(persist) {
    const app = getApp()
    if (!app.globalData.tabPageCache) {
      app.globalData.tabPageCache = { home: null, gallery: null }
    }
    const tagStates = this._tagStates || {}
    if (!hasAnyTagStateRecords(tagStates)) {
      app.globalData.tabPageCache.gallery = null
      if (persist) tabPersist.saveGallery(null)
      return
    }
    const currentTag = String(this.data.activeTag || '')
    const currentState = this.getSavedTagState(currentTag)
    const payload = {
      swiperList: this.data.swiperList || [],
      tags: this.data.tags || [],
      activeTag: currentTag,
      currentTag,
      leftCol: currentState ? currentState.leftCol : this.data.leftCol || [],
      rightCol: currentState ? currentState.rightCol : this.data.rightCol || [],
      allRecords: currentState ? currentState.allRecords : this.data.allRecords || [],
      nextPage:
        currentState && currentState.nextPage != null
          ? currentState.nextPage
          : this.data.nextPage,
      noMore: currentState ? currentState.noMore : this.data.noMore,
      scrollTop:
        currentState && currentState.scrollTop != null
          ? currentState.scrollTop
          : this._pageScrollTop || 0,
      tagStates,
    }
    app.globalData.tabPageCache.gallery = payload
    if (persist) tabPersist.saveGallery(payload)
  },

  restoreSavedTagState(tag) {
    const state = this.getSavedTagState(tag)
    if (!state) return false
    const allRecords = Array.isArray(state.allRecords) ? state.allRecords.slice() : []
    const hasCols =
      Array.isArray(state.leftCol) && Array.isArray(state.rightCol)
    const cols = hasCols
      ? {
        left: state.leftCol.slice(),
        right: state.rightCol.slice(),
      }
      : splitColumns(allRecords)
    const target = Math.max(
      0,
      Math.floor(
        state.scrollTop != null && Number.isFinite(Number(state.scrollTop))
          ? Number(state.scrollTop)
          : typeof this._stickyScrollThreshold === 'number'
            ? this._stickyScrollThreshold
            : 0,
      ),
    )
    this._pageScrollTop = target
    this.setData(
      {
        activeTag: String(tag || ''),
        allRecords,
        leftCol: cols.left,
        rightCol: cols.right,
        nextPage: state.nextPage != null ? state.nextPage : 1,
        noMore: !!state.noMore,
        loading: false,
        hotLoading: false,
      },
      () => {
        this.withStickyStateForTarget(target, () => {
          this.stabilizePageScrollTo(target)
          this.syncGallerySession(false)
          if (allRecords.length) this.syncFavoritedFromServer(allRecords)
        })
      },
    )
    return true
  },

  scrollToHotListTop() {
    const target = Math.max(
      0,
      Math.floor(
        typeof this._stickyScrollThreshold === 'number'
          ? this._stickyScrollThreshold
          : 0,
      ),
    )
    this._pageScrollTop = target
    this.withStickyStateForTarget(target, () => {
      wx.pageScrollTo({
        scrollTop: target,
        duration: 0,
      })
    })
  },

  loadTags() {
    const hit = memCache.get(CACHE_KEY_TAGS)
    if (hit) {
      this.setData({ tags: hit }, () => this.scheduleMeasureSticky())
      return Promise.resolve()
    }
    if (this._tagsPending) return this._tagsPending
    this._tagsPending = post('/api/v1/wallpaper/wechat/tags', {}, { silent: true })
      .then((data) => {
        const mapped = normalizeTagRows(data.list || [])
        const finalRows = mapped.length ? mapped : fallbackTagRows()
        memCache.set(CACHE_KEY_TAGS, finalRows, CACHE_TTL_TAGS_MS)
        this.setData({ tags: finalRows }, () => this.scheduleMeasureSticky())
      })
      .catch(() => {
        const finalRows = fallbackTagRows()
        this.setData({ tags: finalRows }, () => this.scheduleMeasureSticky())
      })
      .finally(() => {
        this._tagsPending = null
      })
    return this._tagsPending
  },

  loadIndex(opts) {
    const soft = opts && opts.soft
    const keepHero =
      soft &&
      this.data.swiperList &&
      this.data.swiperList.length > 0
    if (!keepHero) this.setData({ indexLoading: true })
    post('/api/v1/wallpaper/wechat/index', {})
      .then((data) => {
        const app = getApp()
        if (data && data.assetBase) {
          app.globalData.assetBase = String(data.assetBase).replace(/\/$/, '')
        }
        const swiperList = (data.swiperImages || []).map((w) => enrichHot(w))
        this.setData({ swiperList }, () => {
          this.syncGallerySession(false)
          this.scheduleMeasureSticky()
          this.preloadHeroAdjacent(0)
        })
      })
      .catch(() => { })
      .finally(() => {
        this.setData({ indexLoading: false })
      })
  },

  preloadHeroAdjacent(currentIndex) {
    const list = this.data.swiperList
    if (!list || list.length < 2) return
    const n = list.length
    const cur = Number(currentIndex)
    if (Number.isNaN(cur) || cur < 0) return
    const next = (cur + 1) % n
    const prev = (cur - 1 + n) % n
      ;[list[next], list[prev]].forEach((item) => {
        const src = item && item.img
        if (src) wx.getImageInfo({ src }).catch(() => { })
      })
  },

  onHeroSwiperChange(e) {
    const i = e.detail && e.detail.current
    if (typeof i === 'number' && i >= 0) this.preloadHeroAdjacent(i)
  },

  onHeroImgError(e) {
    const id = e.currentTarget.dataset.id
    if (id == null || id === '') return
    const swiperList = this.data.swiperList.map((w) =>
      String(w.wallpapersId) === String(id)
        ? { ...w, img: IMG_ERROR_PLACEHOLDER }
        : w,
    )
    this.setData({ swiperList }, () => this.scheduleMeasureSticky())
  },

  onHotImgError(e) {
    const id = e.currentTarget.dataset.id
    if (id == null || id === '') return
    const all = this.data.allRecords.map((w) =>
      String(w.wallpapersId) === String(id)
        ? { ...w, img: IMG_ERROR_PLACEHOLDER }
        : w,
    )
    this._applyHotCols(all)
  },

  loadMoreHot(isFirst, opts) {
    if ((!isFirst && this.data.loading) || (!isFirst && this.data.noMore)) return
    const requestSeq = (this._listRequestSeq || 0) + 1
    this._listRequestSeq = requestSeq
    const page = isFirst ? 1 : this.data.nextPage
    const requestTag = String(this.data.activeTag || '')
    if (isFirst) {
      this.setData({
        hotLoading: true,
        allRecords: [],
        leftCol: [],
        rightCol: [],
        nextPage: 1,
        noMore: false,
      })
    }
    this.setData({ loading: true })
    const body = {
      page,
      limit: 20,
      selectFlag: 3,
    }
    const activeTag = this.data.activeTag
    if (activeTag) body.tags = activeTag
    post('/api/v1/wallpaper/wechat/page', body)
      .then((data) => {
        if (requestSeq !== this._listRequestSeq) return
        const batch = data.records || []
        const total = data.total || 0
        const enrichedBatch = batch.map((w) => enrichHot(w))
        const priorState = this.getSavedTagState(requestTag)
        const baseRecords =
          !isFirst && priorState && Array.isArray(priorState.allRecords)
            ? priorState.allRecords
            : !isFirst
              ? this.data.allRecords
              : []
        const all = isFirst ? enrichedBatch : baseRecords.concat(enrichedBatch)
        const { left, right } = splitColumns(all)
        const noMore = batch.length < 20 || all.length >= total
        this.setData(
          {
            allRecords: all,
            leftCol: left,
            rightCol: right,
            nextPage: page + 1,
            loading: false,
            noMore,
          },
          () => {
            this.saveCurrentTagState()
            this.syncFavoritedFromServer(all)
          },
        )
      })
      .catch(() => {
        if (requestSeq !== this._listRequestSeq) return
        this.setData({
          loading: false,
        })
      })
      .finally(() => {
        if (requestSeq !== this._listRequestSeq) return
        const patch = {}
        if (isFirst) patch.hotLoading = false
        if (Object.keys(patch).length) this.setData(patch)
      })
  },

  onReachBottom() {
    this.loadMoreHot(false)
  },

  onPullDownRefresh() {
    this.loadTags()
    this.loadIndex({ soft: false })
    this.loadMoreHot(true, { soft: false })
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 700)
  },

  goSearch() {
    wx.navigateTo({ url: routes.search })
  },

  openWallpaperPreview(list, index) {
    if (!list || !list.length) return
    let i = Number(index)
    if (Number.isNaN(i) || i < 0) i = 0
    if (i >= list.length) i = list.length - 1
    getApp().globalData.pendingWallpaperPreview = { list, index: i }
    wx.navigateTo({ url: routes.wallpaperPreview })
  },

  onHeroWallpaperTap(e) {
    const idx = e.currentTarget.dataset.index
    const list = this.data.swiperList
    this.openWallpaperPreview(list, idx)
  },

  onHotWallpaperTap(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.allRecords
    const index = list.findIndex((w) => String(w.wallpapersId) === String(id))
    if (index < 0) return
    this.openWallpaperPreview(list, index)
  },

  syncFavoritedFromServer(allRecords) {
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id || !allRecords.length) return Promise.resolve()
    const seq = (this._favoritedSyncSeq || 0) + 1
    this._favoritedSyncSeq = seq
    const ids = Array.from(
      new Set(
        allRecords.map((w) => Number(w.wallpapersId)).filter((n) => n > 0),
      ),
    )
    const chunkSize = 80
    const chunks = []
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize))
    }
    return Promise.all(chunks.map((c) => collectState(c)))
      .then((results) => {
        if (seq !== this._favoritedSyncSeq) return
        const set = new Set()
        results.forEach((rows) => {
          (rows || []).forEach((r) => set.add(Number(r.wallpapersId)))
        })
        const latest = this.data.allRecords || []
        if (!latest.length) return
        const merged = latest.map((w) => ({
          ...w,
          favorited: set.has(Number(w.wallpapersId)),
        }))
        const { left, right } = splitColumns(merged)
        this.setData(
          {
            allRecords: merged,
            leftCol: left,
            rightCol: right,
          },
          () => {
            this.saveCurrentTagState()
          },
        )
      })
      .catch(() => { })
  },

  _applyHotCols(allRecords) {
    const { left, right } = splitColumns(allRecords)
    this.setData({ allRecords, leftCol: left, rightCol: right }, () => {
      this.saveCurrentTagState()
    })
  },

  onHotCollectTap(e) {
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
    this._applyHotCols(withPop)
    const clearPopLater = () => {
      setTimeout(() => {
        const all = this.data.allRecords.map((w) =>
          String(w.wallpapersId) === String(id) ? { ...w, _heartJustLiked: false } : w,
        )
        this._applyHotCols(all)
      }, 1000)
    }
    const op = wasFav ? collectRemove : collectAdd
    op(id)
      .then((data) => {
        const serverCount =
          data && data.collectCount != null ? Number(data.collectCount) : null
        if (data && data.already) {
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
          this._applyHotCols(all)
          wx.showToast({
            title: wasFav ? '已取消收藏' : '已在收藏夹',
            icon: 'none',
          })
          return
        }
        const all = this.data.allRecords.map((w) =>
          String(w.wallpapersId) === String(id)
            ? {
              ...w,
              favorited: !wasFav,
              ...(serverCount != null && Number.isFinite(serverCount)
                ? { collectCount: serverCount, hotLabel: String(serverCount) }
                : {}),
            }
            : w,
        )
        this._applyHotCols(all)
        wx.showToast({
          title: wasFav ? '已取消收藏' : '已收藏',
          icon: 'success',
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
        this._applyHotCols(all)
        wx.showToast({
          title: (err && err.message) || (wasFav ? '取消收藏失败' : '收藏失败'),
          icon: 'none',
        })
      })
  },

  onTagTap(e) {
    const ds = e.currentTarget.dataset
    const nextValue = ds.kind === 'hot' ? '' : String(ds.tag || '').trim()
    if (ds.kind !== 'hot' && !nextValue) return
    const cur = this.data.activeTag
    const next = cur === nextValue ? '' : nextValue
    if (next === cur) return
    this.saveCurrentTagState()
    this.cancelPendingListRequest()
    if (this.getSavedTagState(next)) {
      this.restoreSavedTagState(next)
      return
    }
    this.setData({
      activeTag: next,
      allRecords: [],
      leftCol: [],
      rightCol: [],
      nextPage: 1,
      noMore: false,
      loading: false,
      hotLoading: true,
    }, () => {
      this.syncGallerySession(false)
      this.scrollToHotListTop()
      this.loadMoreHot(true, { soft: false, tagSwitch: true })
    })
  },
})
