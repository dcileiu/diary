const { post } = require('../../utils/request.js')

function buildLevel(totalEntryCount, resolvedEntryCount) {
  const exp = (Number(totalEntryCount) || 0) * 8 + (Number(resolvedEntryCount) || 0) * 4
  const level = Math.max(1, Math.floor(exp / 36) + 1)
  const current = exp - (level - 1) * 36
  return {
    level,
    current: Math.max(0, current),
    total: 36,
    percent: Math.min(100, Math.round((Math.max(0, current) / 36) * 100)),
  }
}

Page({
  data: {
    user: null,
    summary: null,
    levelInfo: {
      level: 1,
      current: 0,
      total: 36,
      percent: 0,
    },
    menus: [
      { key: 'tags', label: '记仇标签管理' },
      { key: 'recycle', label: '回收站' },
      { key: 'backup', label: '数据备份' },
      { key: 'lock', label: '密码保护' },
      { key: 'privacy', label: '隐私设置' },
      { key: 'about', label: '关于我们' },
    ],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.loadProfile()
  },

  onPullDownRefresh() {
    this.loadProfile().finally(() => wx.stopPullDownRefresh())
  },

  loadProfile() {
    return getApp()
      .ensureLoginReady()
      .then(() => post('/api/v1/diary/wechat/bootstrap', {}, { silent: true }))
      .then((data) => {
        const levelInfo = buildLevel(
          data.summary && data.summary.totalEntryCount,
          data.summary && data.summary.resolvedEntryCount,
        )
        this.setData({
          user: data.user || null,
          summary: data.summary || null,
          levelInfo,
        })
      })
      .catch((error) => {
        wx.showToast({ title: (error && error.message) || '加载失败', icon: 'none' })
      })
  },

  onMenuTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'recycle') {
      getApp().globalData.pendingEntriesFilter = 'RESOLVED'
      wx.switchTab({ url: '/pages/entries/entries' })
      return
    }

    if (key === 'tags') {
      getApp().globalData.pendingEntriesFilter = 'ALL'
      wx.switchTab({ url: '/pages/entries/entries' })
      return
    }

    const messageMap = {
      backup: '后面我会接入导出与备份能力。',
      lock: '后面我会接入本地口令保护。',
      privacy: '后面我会接入隐私与展示设置。',
      about: '记仇是本能，翻篇是选择。',
    }

    wx.showToast({
      title: messageMap[key] || '这个功能我已经给你预留入口了。',
      icon: 'none',
      duration: 2200,
    })
  },
})
