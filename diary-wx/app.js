// app.js
const { post } = require('./utils/request.js')

/** 静默登录最多尝试次数（含首次） */
const SILENT_LOGIN_MAX_ATTEMPTS = 6
/** 第 1 次失败后间隔 ms，依次递增，超出数组则用最后一档 */
const SILENT_LOGIN_RETRY_DELAYS_MS = [2000, 4000, 8000, 15000, 30000]

App({
  _hasLocalLogin() {
    const token = wx.getStorageSync('accessToken')
    const user = wx.getStorageSync('wxUser')
    return !!(token && user && user.id)
  },

  _syncUserFromStorage() {
    const user = wx.getStorageSync('wxUser')
    if (user && user.id) this.globalData.user = user
  },

  onLaunch(options) {
    this._captureInviterIdFromOptions(options)
    if (this._hasLocalLogin()) {
      this.globalData.pendingInviterId = null
      this._syncUserFromStorage()
      this.refreshSessionSilently()
      return
    }
    /** 推迟到下一事件循环，避免与首屏页面注入、首帧渲染抢主线程（弱机冷启动白屏感会轻一点） */
    const runLogin = () => this.doLogin()
    if (typeof wx.nextTick === 'function') wx.nextTick(runLogin)
    else setTimeout(runLogin, 0)
  },

  /** 从后台回到前台时若无 token，再静默拉一次登录（与 onLaunch 互补） */
  onShow(options) {
    this._captureInviterIdFromOptions(options)
    if (this._hasLocalLogin()) {
      this.globalData.pendingInviterId = null
      this._syncUserFromStorage()
      this.refreshSessionSilently()
      return
    }
    this.doLogin()
  },

  refreshSessionSilently(force) {
    const now = Date.now()
    const lastAt = this.globalData.lastSessionRefreshAt || 0
    if (!force && now - lastAt < 60 * 1000) return
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) return
    this.globalData.lastSessionRefreshAt = now
    post(
      '/api/v1/wallpaper/wechat/points',
      { type: '0', uid: u.id },
      { silent: true },
    )
      .then((user) => {
        if (!user || !user.id) return
        const merged = { ...u, ...user }
        wx.setStorageSync('wxUser', merged)
        this.globalData.user = merged
      })
      .catch(() => {})
  },

  /** 取消未执行的静默重试（新开一轮登录时调用） */
  _clearLoginRetryTimer() {
    const t = this.globalData.loginRetryTimer
    if (t != null) {
      clearTimeout(t)
      this.globalData.loginRetryTimer = null
    }
  },

  /**
   * 打开小程序即静默注册/登录；失败不 Toast，按间隔后台重试，每次重试重新 wx.login。
   */
  doLogin() {
    if (this.globalData.loginInProgress) return
    this.globalData.loginInProgress = true
    this._clearLoginRetryTimer()
    this._silentLoginAttempt(0)
  },

  _captureInviterIdFromOptions(options) {
    const q = options && options.query
    const raw =
      q && (q.inviterId != null ? q.inviterId : q.inviter != null ? q.inviter : '')
    const s = String(raw || '').trim()
    const n = Number(s)
    if (Number.isFinite(n) && n > 0) {
      this.globalData.pendingInviterId = String(Math.floor(n))
    }
  },

  _silentLoginAttempt(attemptIndex) {
    if (attemptIndex >= SILENT_LOGIN_MAX_ATTEMPTS) {
      this.globalData.loginInProgress = false
      return
    }
    wx.login({
      success: (res) => {
        if (!res.code) {
          this._scheduleSilentLoginRetry(attemptIndex)
          return
        }
        const apiBase = this.globalData.apiBase
        const inviterId = this.globalData.pendingInviterId || ''
        post(
          '/api/v1/wallpaper/wechat/login',
          inviterId ? { code: res.code, inviterId } : { code: res.code },
          { auth: false, apiBase, silent: true },
        )
          .then((user) => {
            if (!user || !user.id || !user.accessToken) {
              throw new Error('bad login payload')
            }
            this._clearLoginRetryTimer()
            this.globalData.pendingInviterId = null
            this.globalData.loginInProgress = false
            wx.setStorageSync('accessToken', user.accessToken)
            wx.setStorageSync('wxUser', user)
            this.globalData.user = user
            this.globalData.lastSessionRefreshAt = Date.now()
          })
          .catch(() => {
            this._scheduleSilentLoginRetry(attemptIndex)
          })
      },
      fail: () => {
        this._scheduleSilentLoginRetry(attemptIndex)
      },
    })
  },

  _scheduleSilentLoginRetry(failedAttemptIndex) {
    const next = failedAttemptIndex + 1
    if (next >= SILENT_LOGIN_MAX_ATTEMPTS) {
      this.globalData.loginInProgress = false
      return
    }
    const delays = SILENT_LOGIN_RETRY_DELAYS_MS
    const delay =
      delays[failedAttemptIndex] ?? delays[delays.length - 1]
    this._clearLoginRetryTimer()
    this.globalData.loginRetryTimer = setTimeout(() => {
      this.globalData.loginRetryTimer = null
      this._silentLoginAttempt(next)
    }, delay)
  },

  globalData: {
    apiBase: 'https://wallpaper.api.itianci.cn',
    /** 图片/静态资源域名（如七牛 CDN）。后端列表接口会返回 assetBase，写入此处后拼图走 CDN。 */
    assetBase: '',
    user: null,
    /** 邀请：从分享链接带入，登录请求时透传给后端（仅首次注册发奖） */
    pendingInviterId: null,
    /** 图集 tab 可由其他页写入，用于带条件进入（首页分类已改为本页请求，不再写入） */
    pendingGalleryNav: null,
    /** 全屏预览：{ list: 含 img 的项[], index: 起始下标 } */
    pendingWallpaperPreview: null,
    /** 静默登录重试定时器 id */
    loginRetryTimer: null,
    /** 静默登录是否进行中（防止并发触发重复 wx.login） */
    loginInProgress: false,
    /** 最近一次静默校验本地会话时间 */
    lastSessionRefreshAt: 0,
    /** 流量主 → 激励视频广告位 ID，填入后「播放广告」才可发发财鸭 */
    rewardVideoAdUnitId: '',
    /**
     * Tab 页被系统回收后再进入会重新 onLoad；缓存上次界面数据，先还原再静默拉接口，避免白屏/空列表。
     * 仅内存，关小程序即失效。
     */
    tabPageCache: {
      home: null,
      gallery: null,
    },
  },
})
