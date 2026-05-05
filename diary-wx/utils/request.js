function apiBase(override) {
  if (override) return String(override).replace(/\/$/, '')
  try {
    const app = getApp()
    return String((app && app.globalData && app.globalData.apiBase) || '').replace(/\/$/, '')
  } catch (error) {
    return ''
  }
}

function clearSessionAndRetryLogin() {
  try {
    const app = getApp()
    if (app && typeof app.clearSession === 'function') app.clearSession()
    if (app && typeof app.doLogin === 'function') app.doLogin()
  } catch (error) {}
}

function parseBody(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (error) {
      return null
    }
  }
  return raw && typeof raw === 'object' ? raw : null
}

function rejectWithMessage(message, opts, reject) {
  if (!opts.silent) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2800,
    })
  }
  reject(new Error(message))
}

function handleResponse(statusCode, rawBody, opts, resolve, reject) {
  const body = parseBody(rawBody)
  if (statusCode >= 400) {
    const message =
      (body && typeof body.msg === 'string' && body.msg.trim()) ||
      `服务异常(${statusCode})`
    if (statusCode === 401 || (body && body.code === 401)) {
      clearSessionAndRetryLogin()
    }
    rejectWithMessage(message, opts, reject)
    return
  }

  if (!body || typeof body.code !== 'number') {
    rejectWithMessage('响应格式异常', opts, reject)
    return
  }

  if (body.code === 401) {
    clearSessionAndRetryLogin()
    rejectWithMessage(body.msg || '登录状态失效', opts, reject)
    return
  }

  if (body.code !== 0) {
    rejectWithMessage(body.msg || '请求失败', opts, reject)
    return
  }

  resolve(body.data)
}

function request(method, path, data, options) {
  const opts = options || {}
  const base = apiBase(opts.apiBase)
  if (!base) {
    return Promise.reject(new Error('apiBase missing'))
  }
  const url = base + (path.startsWith('/') ? path : `/${path}`)
  const header = {
    'content-type': 'application/json',
  }
  if (opts.auth !== false) {
    const token = wx.getStorageSync('accessToken')
    if (token) header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: data || {},
      header,
      timeout: opts.timeoutMs != null ? opts.timeoutMs : 60000,
      success(res) {
        handleResponse(res.statusCode, res.data, opts, resolve, reject)
      },
      fail(err) {
        const message =
          err && /timeout/i.test(err.errMsg || '')
            ? '请求超时，请稍后重试'
            : '网络连接失败'
        rejectWithMessage(message, opts, reject)
      },
    })
  })
}

function post(path, data, options) {
  return request('POST', path, data, options)
}

module.exports = {
  request,
  post,
  apiBase,
}
