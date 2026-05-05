const { apiBase, post } = require('../../utils/request.js')
const routes = require('../../utils/routes.js')

const HOME_AUTO_LOGIN_TIMEOUT_MS = 20000
const HOME_AUTO_LOGIN_POLL_MS = 400

const PLATFORM_NAME_MAP = {
  douyin: '\u6296\u97f3',
  wechat: '\u516c\u4f17\u53f7',
  xiaohongshu: '\u5c0f\u7ea2\u4e66',
}

const MEDIA_EXTRACT_PATH = '/api/v1/wallpaper/wechat/media/extract'

function trimText(value) {
  return String(value || '').replace(/\u200b/g, '').trim()
}

function isM3u8Url(url) {
  return /\.m3u8(?:[?#]|$)/i.test(String(url || ''))
}

function isLikelyVideoUrl(url) {
  return /(\.m3u8|\.mp4|\.mov|\.webm|\.m4s|\/aweme\/v1\/play|\/video\/tos\/)/i.test(
    String(url || ''),
  )
}

function detectPlatform(input) {
  const text = trimText(input)
  if (/(?:https?:\/\/)?mp\.weixin\.qq\.com\//i.test(text)) {
    return 'wechat'
  }
  if (
    /(?:https?:\/\/)?(?:v\.)?douyin\.com\//i.test(text) ||
    /(?:https?:\/\/)?(?:www\.)?iesdouyin\.com\//i.test(text) ||
    /(?:https?:\/\/)?(?:www\.)?amemv\.com\//i.test(text)
  ) {
    return 'douyin'
  }
  if (
    /(?:https?:\/\/)?(?:www\.)?xiaohongshu\.com\//i.test(text) ||
    /(?:https?:\/\/)?xhslink\.com\//i.test(text) ||
    /(?:https?:\/\/)?xhs\.cn\//i.test(text)
  ) {
    return 'xiaohongshu'
  }
  return ''
}

function buildProxyUrl(rawUrl, referer) {
  const mediaUrl = trimText(rawUrl)
  const base = apiBase()
  if (!mediaUrl || !base) return mediaUrl
  let url = `${base}/api/v1/open/media/asset?url=${encodeURIComponent(mediaUrl)}`
  const refererText = trimText(referer)
  if (refererText) {
    url += `&referer=${encodeURIComponent(refererText)}`
  }
  return url
}

function readLocalLoginState() {
  const token = wx.getStorageSync('accessToken')
  const user = wx.getStorageSync('wxUser')
  const isReady = !!(token && user && user.id)
  return {
    token: token || '',
    user: isReady ? user : null,
    isReady,
  }
}

function syncCachedUser(user) {
  if (!user || !user.id) return
  const current = wx.getStorageSync('wxUser') || {}
  const merged = { ...current, ...user }
  wx.setStorageSync('wxUser', merged)
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.user = merged
  }
}

function requestExtract(input) {
  const platform = detectPlatform(input)
  if (!platform) {
    return Promise.reject(
      new Error(
        '\u9996\u9875\u76ee\u524d\u53ea\u652f\u6301\u516c\u4f17\u53f7\u3001\u6296\u97f3\u548c\u5c0f\u7ea2\u4e66\u94fe\u63a5',
      ),
    )
  }

  const body = {
    input,
    videoPreference: 'resolution',
    ...(platform === 'xiaohongshu' ? { imageFormat: 'jpeg' } : {}),
  }

  return post(MEDIA_EXTRACT_PATH, body, {
    silent: true,
    timeoutMs: 120000,
  }).then((result) => {
    const payload = result || {}
    return {
      platform,
      detail: payload.detail || payload,
      user: payload.user || null,
    }
  })
}

function normalizeResult(payload) {
  const platform = trimText(payload && payload.platform)
  const detail = payload && payload.detail ? payload.detail : {}
  const sourceUrl = trimText(detail && (detail.source_url || detail.url))
  const resultTitle =
    trimText(
      detail &&
        (detail.title ||
          detail.summary ||
          detail.content_text ||
          detail.author ||
          detail.account_name),
    ) || '\u5df2\u63d0\u53d6\u5a92\u4f53\u5185\u5bb9'

  const imageList = (Array.isArray(detail && detail.images) ? detail.images : [])
    .map((item, index) => {
      const mediaUrl = trimText(item && item.url)
      if (!mediaUrl) return null
      return {
        id: `image-${index}`,
        title: trimText(item && item.alt) || resultTitle || `\u56fe\u7247 ${index + 1}`,
        url: mediaUrl,
        downloadUrl: buildProxyUrl(mediaUrl, sourceUrl),
      }
    })
    .filter(Boolean)

  const videoList = (Array.isArray(detail && detail.videos) ? detail.videos : [])
    .map((item, index) => {
      const mediaUrl = trimText(item && item.url)
      if (!mediaUrl) return null
      const referer = trimText(item && item.referer) || sourceUrl
      const posterUrl = trimText(item && item.poster)
      const audioUrl = trimText(item && item.audio_url)
      const proxyUrl = buildProxyUrl(mediaUrl, referer)
      return {
        id: `video-${index}`,
        title: `\u89c6\u9891 ${index + 1}`,
        url: mediaUrl,
        proxyUrl,
        downloadUrl: proxyUrl,
        posterUrl,
        posterProxyUrl: posterUrl ? buildProxyUrl(posterUrl, referer) : '',
        quality:
          item && item.quality != null ? String(item.quality) : '',
        codec: trimText(item && item.codec),
        audioUrl: audioUrl ? buildProxyUrl(audioUrl, referer) : '',
        unsupportedSave: isM3u8Url(mediaUrl),
        warningText: isM3u8Url(mediaUrl)
          ? '\u8be5\u89c6\u9891\u662f\u6d41\u5a92\u4f53\u5730\u5740\uff0c\u5c0f\u7a0b\u5e8f\u5185\u6682\u4e0d\u652f\u6301\u76f4\u63a5\u4fdd\u5b58\u3002'
          : '',
      }
    })
    .filter(Boolean)

  return {
    platform,
    platformLabel:
      PLATFORM_NAME_MAP[platform] || '\u89e3\u6790\u7ed3\u679c',
    title: resultTitle,
    imageList,
    videoList,
    mediaTotal: imageList.length + videoList.length,
  }
}

Page({
  data: {
    statusBarHeight: 20,
    navBlockHeight: 88,
    inputText: '',
    hasInput: false,
    assistButtonText: '\u7c98\u8d34',
    loginReady: false,
    extracting: false,
    extracted: false,
    result: null,
    imageList: [],
    videoList: [],
    mediaTotal: 0,
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
    this.ensureAutoLogin({ force: true })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.ensureAutoLogin()
  },

  onHide() {
    this.clearLoginWatcher()
  },

  onUnload() {
    this.clearLoginWatcher()
  },

  onShareAppMessage() {
    return {
      title:
        '\u53bb\u6c34\u5370\u4e0b\u8f7d\uff0c\u652f\u6301\u516c\u4f17\u53f7\u3001\u6296\u97f3\u548c\u5c0f\u7ea2\u4e66',
      path: '/pages/home/home',
    }
  },

  buildResetState() {
    return {
      extracting: false,
      extracted: false,
      result: null,
      imageList: [],
      videoList: [],
      mediaTotal: 0,
    }
  },

  syncLoginState() {
    const state = readLocalLoginState()
    if (state.isReady) {
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.user = state.user
      }
    }
    if (this.data.loginReady !== state.isReady) {
      this.setData({ loginReady: state.isReady })
    }
    return state
  },

  clearLoginWatcher() {
    if (this._loginWatchTimer) {
      clearTimeout(this._loginWatchTimer)
      this._loginWatchTimer = null
    }
  },

  watchLoginReady() {
    this.clearLoginWatcher()
    const startedAt = Date.now()
    const poll = () => {
      const state = this.syncLoginState()
      if (state.isReady) {
        this._loginWatchTimer = null
        return
      }
      if (Date.now() - startedAt >= HOME_AUTO_LOGIN_TIMEOUT_MS) {
        this._loginWatchTimer = null
        return
      }
      this._loginWatchTimer = setTimeout(poll, HOME_AUTO_LOGIN_POLL_MS)
    }
    poll()
  },

  ensureAutoLogin(options) {
    const opts = options || {}
    const state = this.syncLoginState()
    if (!opts.force && state.isReady) return
    const app = getApp()
    if (app && typeof app.doLogin === 'function') {
      app.doLogin()
    }
    this.watchLoginReady()
  },

  syncComposerState(inputText, extraData) {
    const nextInput = String(inputText || '')
    const hasInput = !!trimText(nextInput)
    this.setData({
      inputText: nextInput,
      hasInput,
      assistButtonText: hasInput ? '\u6e05\u7a7a' : '\u7c98\u8d34',
      ...(extraData || {}),
    })
  },

  onInputChange(e) {
    this.syncComposerState(e.detail.value || '')
  },

  onAssistTap() {
    if (trimText(this.data.inputText)) {
      this.syncComposerState('', this.buildResetState())
      return
    }

    wx.getClipboardData({
      success: (res) => {
        const clipboardText = String((res && res.data) || '')
        if (!trimText(clipboardText)) {
          wx.showToast({
            title: '\u526a\u8d34\u677f\u6682\u65e0\u53ef\u7c98\u8d34\u5185\u5bb9',
            icon: 'none',
          })
          return
        }
        this.syncComposerState(clipboardText, this.buildResetState())
        wx.showToast({
          title: '\u5df2\u7c98\u8d34',
          icon: 'success',
        })
      },
      fail: () => {
        wx.showToast({
          title: '\u8bfb\u53d6\u526a\u8d34\u677f\u5931\u8d25',
          icon: 'none',
        })
      },
    })
  },

  goUsageGuide() {
    wx.navigateTo({ url: routes.usageGuide })
  },

  goGallery() {
    wx.switchTab({ url: '/pages/gallery/gallery' })
  },

  onExtractTap() {
    if (this.data.extracting) return
    const input = trimText(this.data.inputText)
    if (!input) {
      wx.showToast({
        title: '\u8bf7\u5148\u7c98\u8d34\u5206\u4eab\u94fe\u63a5',
        icon: 'none',
      })
      return
    }

    const loginState = this.syncLoginState()
    if (!loginState.isReady) {
      this.ensureAutoLogin({ force: true })
      wx.showToast({
        title: '\u6b63\u5728\u767b\u5f55\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5',
        icon: 'none',
      })
      return
    }

    if (typeof wx.hideKeyboard === 'function') wx.hideKeyboard()

    this.setData({
      extracting: true,
      extracted: false,
      result: null,
      imageList: [],
      videoList: [],
      mediaTotal: 0,
    })

    requestExtract(input)
      .then((data) => {
        const result = normalizeResult(data || {})
        syncCachedUser(data && data.user)
        this.setData({
          extracted: true,
          result,
          imageList: result.imageList,
          videoList: result.videoList,
          mediaTotal: result.mediaTotal,
        })
        if (!result.mediaTotal) {
          wx.showToast({
            title: '\u672a\u63d0\u53d6\u5230\u53ef\u4e0b\u8f7d\u5185\u5bb9',
            icon: 'none',
          })
        }
      })
      .catch((error) => {
        wx.showToast({
          title:
            trimText(error && error.message) ||
            '\u89e3\u6790\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5',
          icon: 'none',
          duration: 3200,
        })
      })
      .finally(() => {
        this.setData({ extracting: false })
      })
  },

  onCopyMediaTap(e) {
    const url = trimText(e.currentTarget.dataset.url)
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({
          title: '\u5df2\u590d\u5236\u5730\u5740',
          icon: 'success',
        })
      },
    })
  },

  onPreviewImageTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const images = this.data.imageList || []
    if (!images.length) return
    const urls = images.map((item) => item.url).filter(Boolean)
    if (!urls.length) return
    wx.previewImage({
      current: urls[index] || urls[0],
      urls,
    })
  },

  onSaveImageTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = (this.data.imageList || [])[index]
    if (!item) return
    this.downloadAndSave(item.downloadUrl || item.url, 'image')
  },

  onSaveVideoTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = (this.data.videoList || [])[index]
    if (!item) return
    if (item.unsupportedSave) {
      wx.setClipboardData({
        data: item.url,
        success: () => {
          wx.showToast({
            title: '\u5df2\u590d\u5236\u89c6\u9891\u5730\u5740',
            icon: 'success',
          })
        },
      })
      return
    }
    this.downloadAndSave(item.downloadUrl || item.url, 'video')
  },

  downloadAndSave(url, mediaType) {
    const targetUrl = trimText(url)
    if (!targetUrl) {
      wx.showToast({
        title: '\u8d44\u6e90\u5730\u5740\u65e0\u6548',
        icon: 'none',
      })
      return
    }

    wx.showLoading({
      title:
        mediaType === 'video'
          ? '\u4e0b\u8f7d\u89c6\u9891\u4e2d'
          : '\u4e0b\u8f7d\u56fe\u7247\u4e2d',
      mask: true,
    })

    wx.downloadFile({
      url: targetUrl,
      timeout: 120000,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          wx.showToast({
            title: '\u4e0b\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5',
            icon: 'none',
          })
          return
        }
        if (mediaType === 'video') {
          this.saveVideo(res.tempFilePath)
          return
        }
        this.saveImage(res.tempFilePath)
      },
      fail: () => {
        wx.showToast({
          title: '\u4e0b\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5',
          icon: 'none',
        })
      },
      complete: () => {
        wx.hideLoading()
      },
    })
  },

  saveImage(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        wx.showToast({
          title: '\u56fe\u7247\u5df2\u4fdd\u5b58\u5230\u76f8\u518c',
          icon: 'success',
        })
      },
      fail: (err) => {
        this.handleAlbumSaveFail(err, '\u56fe\u7247')
      },
    })
  },

  saveVideo(filePath) {
    wx.saveVideoToPhotosAlbum({
      filePath,
      success: () => {
        wx.showToast({
          title: '\u89c6\u9891\u5df2\u4fdd\u5b58\u5230\u76f8\u518c',
          icon: 'success',
        })
      },
      fail: (err) => {
        this.handleAlbumSaveFail(err, '\u89c6\u9891')
      },
    })
  },

  handleAlbumSaveFail(err, mediaName) {
    const message = String((err && err.errMsg) || '')
    if (/auth deny|authorize|permission/i.test(message)) {
      wx.showModal({
        title: '\u9700\u8981\u76f8\u518c\u6743\u9650',
        content: `\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u5141\u8bb8\u4fdd\u5b58${mediaName}\u5230\u76f8\u518c\u3002`,
        confirmText: '\u53bb\u8bbe\u7f6e',
        success: (res) => {
          if (res.confirm) wx.openSetting()
        },
      })
      return
    }
    wx.showToast({
      title: `${mediaName}\u4fdd\u5b58\u5931\u8d25`,
      icon: 'none',
    })
  },
})
