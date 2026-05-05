const { post } = require('./utils/request.js')

const LOGIN_RETRY_DELAYS = [0, 1200, 3000]

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

  onLaunch() {
    this._syncUserFromStorage()
    this.doLogin()
  },

  onShow() {
    if (!this._hasLocalLogin()) this.doLogin()
  },

  syncSession(user) {
    if (!user || !user.id || !user.accessToken) return
    wx.setStorageSync('accessToken', user.accessToken)
    wx.setStorageSync('wxUser', user)
    this.globalData.user = user
  },

  clearSession() {
    wx.removeStorageSync('accessToken')
    wx.removeStorageSync('wxUser')
    this.globalData.user = null
  },

  ensureLoginReady() {
    if (this._hasLocalLogin()) {
      this._syncUserFromStorage()
      return Promise.resolve(this.globalData.user)
    }
    return this.doLogin().then(() => {
      this._syncUserFromStorage()
      return this.globalData.user
    })
  },

  doLogin() {
    if (this._loginPromise) return this._loginPromise
    this._loginPromise = new Promise((resolve, reject) => {
      const run = (attempt) => {
        wx.login({
          success: (res) => {
            if (!res.code) {
              this._retryLogin(attempt, run, reject)
              return
            }
            post(
              '/api/v1/diary/wechat/login',
              { code: res.code },
              { auth: false, silent: true },
            )
              .then((user) => {
                this.syncSession(user)
                resolve(user)
              })
              .catch((error) => {
                this._retryLogin(attempt, run, reject, error)
              })
          },
          fail: (error) => {
            this._retryLogin(attempt, run, reject, error)
          },
        })
      }
      run(0)
    }).finally(() => {
      this._loginPromise = null
    })
    return this._loginPromise
  },

  _retryLogin(attempt, run, reject, error) {
    const next = attempt + 1
    if (next >= LOGIN_RETRY_DELAYS.length) {
      reject(error || new Error('login failed'))
      return
    }
    setTimeout(() => run(next), LOGIN_RETRY_DELAYS[next])
  },

  globalData: {
    apiBase: 'http://127.0.0.1:4010',
    user: null,
    pendingEntriesFilter: '',
    bootstrapCache: null,
  },
})
