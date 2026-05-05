const { post } = require('../../utils/request.js')
const routes = require('../../utils/routes.js')

Page({
  data: {
    statusBarHeight: 20,
    navBlockHeight: 88,
    user: {},
    collectSum: 0,
    downloadSum: 0,
    mungBean: 0,
  },

  _videoAd: null,
  _mineRefreshTimer: null,

  /**
   * 停在「我的」时首页/图集 WebView 常被回收；切回去会冷启动。
   * 自定义 Tab 下多次 preloadWebview，尽量提前拉起兄弟页（无参数 API，多打几次覆盖首页+图集）。
   */
  _burstPreloadSiblingWebviews() {
    if (typeof wx.preloadWebview !== 'function') return
    const fire = () => {
      try {
        wx.preloadWebview()
      } catch (e) { }
    }
    fire()
    setTimeout(fire, 80)
    setTimeout(fire, 280)
    setTimeout(fire, 700)
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const sh = win.statusBarHeight || 20
    const w = win.windowWidth || win.screenWidth || 375
    const barPx = (88 / 750) * w
    this.setData({
      statusBarHeight: sh,
      navBlockHeight: sh + barPx,
    })
    const app = getApp()
    const adUnitId = app.globalData.rewardVideoAdUnitId
    if (adUnitId && wx.createRewardedVideoAd) {
      const videoAd = wx.createRewardedVideoAd({ adUnitId })
      videoAd.onClose((res) => {
        if (res && res.isEnded) {
          this.grantPoints('3')
        }
      })
      videoAd.onError(() => { })
      this._videoAd = videoAd
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.refreshMineData(3)
    this._burstPreloadSiblingWebviews()
  },

  onHide() {
    if (this._mineRefreshTimer) {
      clearTimeout(this._mineRefreshTimer)
      this._mineRefreshTimer = null
    }
  },

  onUnload() {
    if (this._mineRefreshTimer) {
      clearTimeout(this._mineRefreshTimer)
      this._mineRefreshTimer = null
    }
  },

  onReady() {
    this._burstPreloadSiblingWebviews()
  },

  onPullDownRefresh() {
    this.refreshMineData(1)
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 700)
  },

  refreshMineData(retryLeft) {
    const u = wx.getStorageSync('wxUser') || {}
    this.setData({
      user: u,
      mungBean: u.points != null ? u.points : 0,
    })
    if (u && u.id) {
      this.refreshPoints()
      this.loadCounts()
      return
    }
    if (!retryLeft || retryLeft <= 0) return
    const app = getApp()
    if (app && typeof app.doLogin === 'function') app.doLogin()
    if (this._mineRefreshTimer) clearTimeout(this._mineRefreshTimer)
    this._mineRefreshTimer = setTimeout(() => {
      this._mineRefreshTimer = null
      this.refreshMineData(retryLeft - 1)
    }, 800)
  },

  onShareAppMessage() {
    const u = wx.getStorageSync('wxUser')
    const title = '壁纸图集侠 · 去水印下载'
    const inviterId = u && u.id ? String(u.id) : ''
    const path = inviterId
      ? `/pages/home/home?inviterId=${encodeURIComponent(inviterId)}`
      : '/pages/home/home'
    return { title, path }
  },

  refreshPoints() {
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) return
    post('/api/v1/wallpaper/wechat/points', {
      type: '0',
      uid: u.id,
    })
      .then((user) => {
        const merged = { ...u, ...user }
        wx.setStorageSync('wxUser', merged)
        this.setData({
          user: merged,
          mungBean: user.points != null ? user.points : 0,
        })
      })
      .catch(() => { })
  },

  loadCounts() {
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) return
    post('/api/v1/wallpaper/wechat/action/count', { uid: u.id })
      .then((data) => {
        this.setData({
          collectSum: data.collectSum || 0,
          downloadSum: data.downloadSum || 0,
        })
      })
      .catch(() => { })
  },

  ensureLogin() {
    const u = wx.getStorageSync('wxUser')
    if (u && u.id) return u
    wx.showToast({ title: '正在登录，请稍后再试', icon: 'none' })
    return null
  },

  /** 收藏 / 下载：进入两列瀑布流列表 */
  onStatTap(e) {
    const kind = e.currentTarget.dataset.kind
    if (kind !== 'collect' && kind !== 'download') return
    const u = this.ensureLogin()
    if (!u) return
    wx.navigateTo({ url: `${routes.mineList}?kind=${kind}` })
  },

  onMungBeanTap() {
    const u = this.ensureLogin()
    if (!u) return
    wx.navigateTo({ url: routes.pointsRecord })
  },

  onDailySign() {
    const u = this.ensureLogin()
    if (!u) return
    post('/api/v1/wallpaper/wechat/points', {
      type: '1',
      operation: '1',
      uid: u.id,
    })
      .then((user) => {
        const merged = { ...u, ...user }
        wx.setStorageSync('wxUser', merged)
        this.setData({
          user: merged,
          mungBean: user.points != null ? user.points : 0,
        })
        wx.showToast({ title: '签到成功，发财鸭+3', icon: 'success' })
      })
      .catch(() => { })
  },

  onShareEarnTap() {
    const u = this.ensureLogin()
    if (!u) return
    wx.showToast({
      title: '发送给好友，好友首次注册成功你将获得发财鸭+15',
      icon: 'none',
      duration: 3000,
    })
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
        this.setData({
          user: merged,
          mungBean: user.points != null ? user.points : 0,
        })
        const tip = operation === '3' ? '发财鸭+8' : ''
        wx.showToast({ title: tip || '已发放', icon: 'success' })
      })
      .catch(() => { })
  },

  onWatchAd() {
    const u = this.ensureLogin()
    if (!u) return
    const app = getApp()
    if (!app.globalData.rewardVideoAdUnitId) {
      // 请在 app.js 配置激励视频广告位 ID
      wx.showToast({
        title: '暂无激励视频广告，先试试其他方式获取发财鸭。',
        icon: 'none',
      })
      return
    }
    if (!this._videoAd) {
      wx.showToast({ title: '当前环境不支持激励视频', icon: 'none' })
      return
    }
    this._videoAd
      .show()
      .catch(() => {
        return this._videoAd
          .load()
          .then(() => this._videoAd.show())
          .catch(() => {
            wx.showToast({ title: '广告暂时不可用', icon: 'none' })
          })
      })
  },

  onMenuTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'upload') {
      wx.navigateTo({ url: routes.upload })
      return
    }
    if (key === 'contact') {
      wx.navigateTo({ url: routes.contactService })
      return
    }
    if (key === 'privacy') {
      wx.navigateTo({ url: routes.privacyPolicy })
      return
    }
    if (key === 'cache') {
      wx.showModal({
        title: '清除缓存',
        content: '将清除本地缓存（不含登录信息）',
        success: (res) => {
          if (res.confirm) {
            const token = wx.getStorageSync('accessToken')
            const user = wx.getStorageSync('wxUser')
            try {
              wx.clearStorageSync()
            } catch (err) {
              wx.showToast({ title: '清除失败', icon: 'none' })
              return
            }
            if (token) wx.setStorageSync('accessToken', token)
            if (user) wx.setStorageSync('wxUser', user)
            wx.showToast({ title: '已完成', icon: 'success' })
          }
        },
      })
      return
    }
    wx.showToast({ title: '敬请期待', icon: 'none' })
  },
})
