function apiBase(override) {
  if (override) return override.replace(/\/$/, '')
  try {
    const app = getApp()
    return (app && app.globalData && app.globalData.apiBase
      ? app.globalData.apiBase
      : ''
    ).replace(/\/$/, '')
  } catch (e) {
    return ''
  }
}

function assetBase(override) {
  if (override) return override.replace(/\/$/, '')
  try {
    const app = getApp()
    return (app && app.globalData && app.globalData.assetBase
      ? app.globalData.assetBase
      : apiBase()
    ).replace(/\/$/, '')
  } catch (e) {
    return apiBase()
  }
}

function clearLoginAndRetry() {
  try {
    wx.removeStorageSync('accessToken')
    wx.removeStorageSync('wxUser')
  } catch (e) {}
  try {
    const app = getApp && getApp()
    if (app && typeof app.doLogin === 'function') app.doLogin()
  } catch (e) {}
}

function parseResponseBody(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      return null
    }
  }
  return raw && typeof raw === 'object' ? raw : null
}

function responseErrorTitle(status, body, fallback) {
  if (body && typeof body.msg === 'string' && body.msg.trim()) return body.msg
  return fallback || '服务异常(' + status + ')'
}

function handleResponse(status, rawBody, opts, resolve, reject) {
  const body = parseResponseBody(rawBody)
  if (status >= 400) {
    const title = responseErrorTitle(status, body, '服务异常(' + status + ')')
    if (status === 401 || (body && body.code === 401)) {
      clearLoginAndRetry()
    }
    if (!opts.silent) {
      wx.showToast({ title, icon: 'none', duration: 3000 })
    }
    reject(new Error(title))
    return
  }
  if (!body) {
    if (!opts.silent) {
      wx.showToast({ title: '响应异常', icon: 'none' })
    }
    reject(new Error('bad body'))
    return
  }
  if (body.code === 500) {
    if (!opts.silent) {
      wx.showToast({
        title: body.msg || '服务暂不可用',
        icon: 'none',
        duration: 3500,
      })
    }
    reject(new Error(body.msg || '500'))
    return
  }
  if (body.code === 401) {
    if (!opts.silent) {
      wx.showToast({ title: body.msg || '请重新登录', icon: 'none' })
    }
    clearLoginAndRetry()
    reject(new Error(body.msg || '401'))
    return
  }
  if (body.code !== 0) {
    if (!opts.silent) {
      wx.showToast({ title: body.msg || '请求失败', icon: 'none' })
    }
    reject(new Error(body.msg || 'fail'))
    return
  }
  resolve(body.data)
}

function request(method, path, data, options) {
  const opts = options || {}
  const base = apiBase(opts.apiBase)
  if (!base) {
    if (!opts.silent) {
      wx.showToast({ title: '未配置 API 地址', icon: 'none' })
    }
    return Promise.reject(new Error('apiBase missing'))
  }
  const url = base + (path.startsWith('/') ? path : '/' + path)
  const headers = { 'content-type': 'application/json' }
  if (opts.auth !== false) {
    const token = wx.getStorageSync('accessToken')
    if (token) headers.Authorization = 'Bearer ' + token
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: method || 'POST',
      data: data || {},
      header: headers,
      /** 默认过短易在弱网/模拟器下报 timeout；与基础库行为对齐 */
      timeout: opts.timeoutMs != null ? opts.timeoutMs : 60000,
      success(res) {
        handleResponse(res.statusCode, res.data, opts, resolve, reject)
      },
      fail(err) {
        if (!opts.silent) {
          const msg = (err && err.errMsg) || ''
          const title = /timeout/i.test(msg) ? '请求超时，请检查网络' : '网络错误'
          wx.showToast({ title, icon: 'none', duration: 3000 })
        }
        reject(err)
      },
    })
  })
}

function post(path, data, options) {
  return request('POST', path, data, options)
}

function wallpaperSrc(fileName) {
  const base = assetBase()
  if (!fileName) return ''
  return base + '/uploads/wallpapers/' + fileName
}

/** 列表/瀑布流小图：服务端按需生成 WebP；预览/保存相册仍用 {@link wallpaperSrc} */
function wallpaperThumbSrc(fileName) {
  const asset = assetBase()
  const api = apiBase()
  if (!fileName) return ''
  if (asset && api && asset !== api) {
    return (
      asset +
      '/uploads/wallpapers/' +
      fileName +
      '?imageView2/2/w/360/q/72/format/webp'
    )
  }
  return api + '/api/public/wallpaper-thumb?f=' + encodeURIComponent(fileName)
}

/**
 * 带登录态的 wx.uploadFile，与 post 一样走 apiBase + Bearer。
 * 成功且 body.code===0 时 resolve body.data；否则 reject(Error(msg))。
 */
function uploadFile(path, filePath, formData, options) {
  const opts = options || {}
  const base = apiBase(opts.apiBase)
  if (!base) {
    if (!opts.silent) {
      wx.showToast({ title: '未配置 API 地址', icon: 'none' })
    }
    return Promise.reject(new Error('apiBase missing'))
  }
  const url = base + (path.startsWith('/') ? path : '/' + path)
  const headers = {}
  if (opts.auth !== false) {
    const token = wx.getStorageSync('accessToken')
    if (token) headers.Authorization = 'Bearer ' + token
  }
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name: opts.fileFieldName || 'file',
      formData: formData || {},
      header: headers,
      timeout: opts.timeoutMs != null ? opts.timeoutMs : 60000,
      success(res) {
        handleResponse(res.statusCode, res.data, opts, resolve, reject)
      },
      fail(err) {
        if (!opts.silent) {
          const msg = (err && err.errMsg) || ''
          const title = /timeout/i.test(msg) ? '请求超时，请检查网络' : '网络错误'
          wx.showToast({ title, icon: 'none', duration: 3000 })
        }
        reject(err)
      },
    })
  })
}

module.exports = {
  request,
  post,
  uploadFile,
  wallpaperSrc,
  wallpaperThumbSrc,
  apiBase,
  assetBase,
}
