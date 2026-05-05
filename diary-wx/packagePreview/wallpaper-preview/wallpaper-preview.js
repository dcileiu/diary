const { post, wallpaperSrc, wallpaperThumbSrc } = require('../../utils/request.js')
const { collectAdd, collectRemove } = require('../../utils/collect.js')

/** 与后端 WALLPAPER_DOWNLOAD_POINTS_COST 一致 */
const SAVE_COST_POINTS = 2

function isVipUser(u) {
  return u && String(u.isVip) === '2'
}

function resolvePreviewImageMode(item) {
  const t = String((item && item.type) || '').trim()
  return t.includes('手机壁纸') ? 'aspectFill' : 'aspectFit'
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n)
}

function formatNowText() {
  const d = new Date()
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return {
    clockTime: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    dateText: `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`,
  }
}

function trimText(value) {
  return String(value || '').trim()
}

function buildSharePayload(page) {
  const { list, current } = page.data || {}
  const item = Array.isArray(list) ? list[current] : null
  const user = wx.getStorageSync('wxUser')
  const inviterId = user && user.id ? String(user.id) : ''
  const path = inviterId
    ? `/pages/home/home?inviterId=${encodeURIComponent(inviterId)}`
    : '/pages/home/home'
  const imageUrl = trimText(item && (item.imgFull || item.img))
  return {
    title: '这张壁纸神了，分享给你',
    path,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

Page({
  data: {
    statusBarHeight: 20,
    list: [],
    current: 0,
    downloading: false,
    mungBean: 0,
    saveCostPoints: SAVE_COST_POINTS,
    /** 当前张是否已在收藏夹（仅展示文案，切换 swiper 会刷新） */
    currentCollected: false,
    /** 点击收藏后短时播放心形弹出动画 */
    collectHeartPop: false,
    toastShow: false,
    toastText: '',
    insufficientModalVisible: false,
    previewMode: false,
    clockTime: '',
    dateText: '',
  },

  _toastTimer: null,
  _videoAd: null,

  showGlassToast(text, durationMs) {
    const ms = durationMs != null ? durationMs : 2200
    if (this._toastTimer) {
      clearTimeout(this._toastTimer)
      this._toastTimer = null
    }
    this.setData({ toastShow: true, toastText: text })
    this._toastTimer = setTimeout(() => {
      this.setData({ toastShow: false, toastText: '' })
      this._toastTimer = null
    }, ms)
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: win.statusBarHeight || 20,
      ...formatNowText(),
    })
    const app = getApp()
    const adUnitId = app.globalData.rewardVideoAdUnitId
    if (adUnitId && wx.createRewardedVideoAd) {
      const videoAd = wx.createRewardedVideoAd({ adUnitId })
      videoAd.onClose((res) => {
        if (res && res.isEnded) this.grantPoints('3')
      })
      videoAd.onError(() => {})
      this._videoAd = videoAd
    }
    const p = app.globalData.pendingWallpaperPreview
    app.globalData.pendingWallpaperPreview = null
    if (!p || !Array.isArray(p.list) || p.list.length === 0) {
      wx.navigateBack()
      return
    }
    let index = Number(p.index)
    if (Number.isNaN(index) || index < 0) index = 0
    if (index >= p.list.length) index = p.list.length - 1
    const list = p.list.map((it) => ({
      ...it,
      img: (it && it.img) || (it && it.fileName ? wallpaperThumbSrc(it.fileName) : ''),
      imgFull: (it && it.imgFull) || (it && it.fileName ? wallpaperSrc(it.fileName) : ''),
      _previewImageMode: resolvePreviewImageMode(it),
    }))
    this.setData({ list, current: index }, () => {
      this.fetchCollectStateForCurrent()
    })
  },

  onShow() {
    const u = wx.getStorageSync('wxUser')
    const pts = u && u.points != null ? u.points : 0
    this.setData({ mungBean: pts })
  },

  fetchCollectStateForCurrent() {
    const { list, current } = this.data
    const item = list && list[current]
    const id = item && item.wallpapersId
    if (!id) {
      this.setData({ currentCollected: false, collectHeartPop: false })
      return
    }
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) {
      this.setData({ currentCollected: false, collectHeartPop: false })
      return
    }
    post(
      '/api/v1/wallpaper/wechat/collect/state',
      { uid: u.id, wallpapersIds: [Number(id)] },
      { silent: true },
    )
      .then((rows) => {
        const nid = Number(id)
        const collected =
          Array.isArray(rows) &&
          rows.some((r) => Number(r.wallpapersId) === nid)
        this.setData({ currentCollected: !!collected, collectHeartPop: false })
      })
      .catch(() => this.setData({ currentCollected: false, collectHeartPop: false }))
  },

  onUnload() {
    if (this._toastTimer) {
      clearTimeout(this._toastTimer)
      this._toastTimer = null
    }
    this._videoAd = null
  },

  onClose() {
    wx.navigateBack()
  },

  onTogglePreviewMode() {
    this.setData({ previewMode: !this.data.previewMode })
  },

  onPreviewImageTap() {
    if (!this.data.previewMode) {
      this.setData({ previewMode: true })
      return
    }
    this.setData({ previewMode: false })
  },

  noop() {},

  onDownloadTap() {
    if (this.data.downloading) return
    this.onDownload()
  },

  onSwiperChange(e) {
    const i = e.detail && e.detail.current
    if (typeof i === 'number' && i >= 0) {
      this.setData({ current: i, collectHeartPop: false }, () =>
        this.fetchCollectStateForCurrent(),
      )
    }
  },

  onCollectTap() {
    const { list, current, currentCollected } = this.data
    const item = list[current]
    const id = item && item.wallpapersId
    if (!id) {
      this.showGlassToast('无效壁纸')
      return
    }
    const now = Date.now()
    if (!this._collectTapAt) this._collectTapAt = 0
    if (this._collectInFlight) return
    if (now - this._collectTapAt < 1000) return
    this._collectTapAt = now
    this._collectInFlight = true
    setTimeout(() => {
      this._collectInFlight = false
    }, 1000)

    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) {
      this.showGlassToast('请先登录')
      this._collectInFlight = false
      return
    }
    this.setData({ collectHeartPop: true })
    const clearPop = () => {
      setTimeout(() => this.setData({ collectHeartPop: false }), 1000)
    }
    const op = currentCollected ? collectRemove : collectAdd
    op(id)
      .then((data) => {
        if (data && data.already) {
          this.showGlassToast(currentCollected ? '已取消收藏' : '已在收藏夹')
          this.setData({ currentCollected: !currentCollected, collectHeartPop: false })
          return
        }
        this.showGlassToast(currentCollected ? '已取消收藏' : '已收藏')
        this.setData({ currentCollected: !currentCollected })
        clearPop()
      })
      .catch((err) => {
        this.setData({ collectHeartPop: false })
        this.showGlassToast((err && err.message) || (currentCollected ? '取消收藏失败' : '收藏失败'))
      })
  },

  showInsufficientMungModal() {
    this.setData({ insufficientModalVisible: true })
  },

  closeInsufficientMungModal() {
    this.setData({ insufficientModalVisible: false })
  },

  ensureLogin() {
    const u = wx.getStorageSync('wxUser')
    if (u && u.id) return u
    this.showGlassToast('正在登录，请稍后再试')
    return null
  },

  grantPoints(operation) {
    const u = this.ensureLogin()
    if (!u) return
    post('/api/v1/wallpaper/wechat/points', {
      type: '1',
      operation,
      uid: u.id,
    })
      .then((user) => {
        const merged = { ...u, ...user }
        wx.setStorageSync('wxUser', merged)
        const tip = operation === '3' ? '发财鸭+8' : operation === '1' ? '签到成功，发财鸭+3' : '已发放'
        this.showGlassToast(tip)
        this.setData({ insufficientModalVisible: false })
      })
      .catch((err) => {
        this.showGlassToast((err && err.message) || '领取失败')
      })
  },

  onInsufficientSignTap() {
    this.grantPoints('1')
  },

  onInsufficientInviteTap() {
    this.showGlassToast('发送给好友，好友首次注册成功你将获得发财鸭+15')
    this.setData({ insufficientModalVisible: false })
  },

  onInsufficientWatchAdTap() {
    const u = this.ensureLogin()
    if (!u) return
    const app = getApp()
    if (!app.globalData.rewardVideoAdUnitId) {
      // 请在 app.js 配置激励视频广告位 ID
      this.showGlassToast('暂无激励视频广告，先试试其他方式获取发财鸭。')
      return
    }
    if (!this._videoAd) {
      this.showGlassToast('当前环境不支持激励视频')
      return
    }
    this._videoAd
      .show()
      .catch(() => {
        return this._videoAd
          .load()
          .then(() => this._videoAd.show())
          .catch(() => {
            this.showGlassToast('广告暂时不可用')
          })
      })
  },

  onShareAppMessage() {
    return buildSharePayload(this)
  },

  /** 保存成功后由后端原子记录下载并处理扣减，避免前端拆成两次请求。 */
  finalizeDownloadAfterSave(wallpapersId, retryLeft) {
    const u = wx.getStorageSync('wxUser')
    const wid = Number(wallpapersId)
    if (!u || !u.id || !wid) return Promise.resolve()
    const retries = retryLeft != null ? retryLeft : 1
    return post(
      '/api/v1/wallpaper/wechat/download/complete',
      { uid: u.id, wallpapersId: wid },
      { silent: true },
    ).then((user) => {
      const merged = { ...u, ...user }
      wx.setStorageSync('wxUser', merged)
      this.setData({ mungBean: merged.points != null ? merged.points : 0 })
    }).catch((err) => {
      if (retries > 0) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.finalizeDownloadAfterSave(wid, retries - 1)
              .then(resolve)
              .catch(reject)
          }, 1200)
        })
      }
      this.showGlassToast('已保存到相册，但服务器同步失败，请稍后重试')
      throw err
    })
  },

  runDownloadAndSave(url) {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          this.showGlassToast('下载失败')
          return
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            this.showGlassToast('已保存到相册')
            const { list, current } = this.data
            const item = list && list[current]
            const wid = item && item.wallpapersId
            this.finalizeDownloadAfterSave(wid).catch(() => { })
          },
          fail: (err) => {
            const msg = (err && err.errMsg) || ''
            if (/auth deny|authorize|permission/i.test(msg)) {
              wx.showModal({
                title: '需要相册权限',
                content: '请在设置中允许保存图片到相册',
                confirmText: '去设置',
                success: (r) => {
                  if (r.confirm) wx.openSetting()
                },
              })
            } else {
              this.showGlassToast('保存失败')
            }
          },
        })
      },
      fail: () => {
        this.showGlassToast('下载失败')
      },
      complete: () => {
        this.setData({ downloading: false })
      },
    })
  },

  onDownload() {
    if (this.data.downloading) return
    const { list, current } = this.data
    const item = list[current]
    const url = item && (item.imgFull || item.img)
    if (!url) {
      this.showGlassToast('图片地址无效')
      return
    }

    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) {
      this.showGlassToast('正在登录，请稍后再试')
      return
    }

    if (isVipUser(u)) {
      this.setData({ downloading: true })
      this.runDownloadAndSave(url)
      return
    }

    this.setData({ downloading: true })
    post('/api/v1/wallpaper/wechat/points', { type: '0', uid: u.id }, { silent: true })
      .then((user) => {
        const merged = { ...u, ...user }
        wx.setStorageSync('wxUser', merged)
        const pts = user.points != null ? user.points : 0
        if (pts < SAVE_COST_POINTS) {
          this.setData({ downloading: false })
          this.showInsufficientMungModal()
          return
        }
        this.runDownloadAndSave(url)
      })
      .catch((err) => {
        this.setData({ downloading: false })
        this.showGlassToast((err && err.message) || '获取发财鸭信息失败')
      })
  },
})
