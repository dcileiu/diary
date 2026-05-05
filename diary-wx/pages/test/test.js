const { apiBase } = require('../../utils/request.js')

const EXTRACT_API_BASE = 'https://wallpaper-wx.vercel.app'

const PLATFORM_NAME_MAP = {
  wechat: '公众号',
  douyin: '抖音',
  bilibili: 'B站',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  generic: '网页',
}

function trimText(value) {
  return String(value || '').replace(/\u200b/g, '').trim()
}

function isM3u8Url(url) {
  return /\.m3u8(?:[?#]|$)/i.test(String(url || ''))
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

function parseJsonBody(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      return null
    }
  }
  return raw && typeof raw === 'object' ? raw : null
}

function requestExtract(input) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${EXTRACT_API_BASE}/api/extract`,
      method: 'POST',
      data: { input },
      header: { 'content-type': 'application/json' },
      timeout: 120000,
      success(res) {
        const body = parseJsonBody(res.data)
        if (res.statusCode >= 400) {
          reject(
            new Error(
              (body && (body.error || body.message)) ||
                `服务异常(${res.statusCode})`,
            ),
          )
          return
        }
        if (!body || body.ok !== true) {
          reject(
            new Error(
              (body && (body.error || body.message)) || '解析失败，请稍后再试',
            ),
          )
          return
        }
        resolve(body.data || {})
      },
      fail(err) {
        const msg = String((err && err.errMsg) || '')
        reject(new Error(/timeout/i.test(msg) ? '请求超时，请稍后再试' : '网络错误'))
      },
    })
  })
}

function normalizeResult(data) {
  const sourceUrl = trimText(data && (data.source_url || data.url))
  const coverImage = trimText(data && data.cover_image)
  const images = Array.isArray(data && data.images) ? data.images : []
  const videos = Array.isArray(data && data.videos) ? data.videos : []

  const imageList = images
    .map((item, index) => {
      const url = trimText(item && item.url)
      if (!url) return null
      return {
        id: `image-${index}`,
        title: trimText(item && item.alt) || `图片 ${index + 1}`,
        url,
        downloadUrl: buildProxyUrl(url),
      }
    })
    .filter(Boolean)

  const videoList = videos
    .map((item, index) => {
      const url = trimText(item && item.url)
      if (!url) return null
      const posterUrl = trimText(item && item.poster) || coverImage
      const audioUrl = trimText(item && item.audio_url)
      const source = trimText(item && item.source)
      const referer = trimText(item && item.referer) || sourceUrl
      const quality = item && item.quality != null ? String(item.quality) : ''
      const codec = trimText(item && item.codec)
      return {
        id: `video-${index}`,
        title: `视频 ${index + 1}`,
        url,
        downloadUrl: buildProxyUrl(url, referer || source),
        posterUrl,
        quality,
        codec,
        audioUrl,
        unsupportedSave: isM3u8Url(url),
        warningText: isM3u8Url(url)
          ? '该视频为流媒体地址，小程序内暂不支持直接保存。'
          : audioUrl
            ? '该视频可能是分离音轨，保存后可能无声。'
            : '',
      }
    })
    .filter(Boolean)

  return {
    platform: trimText(data && data.platform),
    platformLabel:
      PLATFORM_NAME_MAP[trimText(data && data.platform)] ||
      trimText(data && data.platform_name) ||
      '解析结果',
    title: trimText(data && data.title) || '已提取媒体内容',
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
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  onShareAppMessage() {
    return {
      title: '去水印下载，支持公众号、抖音、小红书、B站',
      path: '/pages/home/home',
    }
  },

  onInputChange(e) {
    this.setData({ inputText: e.detail.value || '' })
  },

  onClearTap() {
    this.setData({
      inputText: '',
      extracting: false,
      extracted: false,
      result: null,
      imageList: [],
      videoList: [],
      mediaTotal: 0,
    })
  },

  goGallery() {
    wx.switchTab({ url: '/pages/gallery/gallery' })
  },

  onExtractTap() {
    if (this.data.extracting) return
    const input = trimText(this.data.inputText)
    if (!input) {
      wx.showToast({ title: '请先粘贴分享链接', icon: 'none' })
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
        this.setData({
          extracted: true,
          result,
          imageList: result.imageList,
          videoList: result.videoList,
          mediaTotal: result.mediaTotal,
        })
        if (!result.mediaTotal) {
          wx.showToast({ title: '未提取到可下载内容', icon: 'none' })
        }
      })
      .catch((error) => {
        wx.showToast({
          title: trimText(error && error.message) || '解析失败，请稍后再试',
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
        wx.showToast({ title: '已复制地址', icon: 'success' })
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
          wx.showToast({ title: '已复制视频地址', icon: 'success' })
        },
      })
      return
    }
    this.downloadAndSave(item.downloadUrl || item.url, 'video')
  },

  downloadAndSave(url, mediaType) {
    const targetUrl = trimText(url)
    if (!targetUrl) {
      wx.showToast({ title: '资源地址无效', icon: 'none' })
      return
    }

    wx.showLoading({
      title: mediaType === 'video' ? '下载视频中' : '下载图片中',
      mask: true,
    })

    wx.downloadFile({
      url: targetUrl,
      timeout: 120000,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          wx.showToast({ title: '下载失败，请稍后再试', icon: 'none' })
          return
        }
        if (mediaType === 'video') {
          this.saveVideo(res.tempFilePath)
          return
        }
        this.saveImage(res.tempFilePath)
      },
      fail: () => {
        wx.showToast({ title: '下载失败，请稍后再试', icon: 'none' })
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
        wx.showToast({ title: '图片已保存到相册', icon: 'success' })
      },
      fail: (err) => {
        this.handleAlbumSaveFail(err, '图片')
      },
    })
  },

  saveVideo(filePath) {
    wx.saveVideoToPhotosAlbum({
      filePath,
      success: () => {
        wx.showToast({ title: '视频已保存到相册', icon: 'success' })
      },
      fail: (err) => {
        this.handleAlbumSaveFail(err, '视频')
      },
    })
  },

  handleAlbumSaveFail(err, mediaName) {
    const message = String((err && err.errMsg) || '')
    if (/auth deny|authorize|permission/i.test(message)) {
      wx.showModal({
        title: '需要相册权限',
        content: `请在设置中允许保存${mediaName}到相册。`,
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) wx.openSetting()
        },
      })
      return
    }
    wx.showToast({ title: `${mediaName}保存失败`, icon: 'none' })
  },
})
