const { post } = require('../../utils/request.js')

function pad(num) {
  return String(num).padStart(2, '0')
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function buildRingStyle(distribution) {
  let start = 0
  const parts = (distribution || []).map((item) => {
    const end = start + (Number(item.percent) || 0)
    const segment = `${item.color} ${start}% ${end}%`
    start = end
    return segment
  })

  if (!parts.length) {
    return 'background: conic-gradient(#f1e7e2 0% 100%);'
  }

  return `background: conic-gradient(${parts.join(', ')});`
}

function buildDelta(delta) {
  const value = Number(delta) || 0
  return {
    text: `${value >= 0 ? '+' : ''}${value}`,
    className: value >= 0 ? 'delta-up' : 'delta-down',
  }
}

Page({
  data: {
    currentMonth: '',
    totalCount: 0,
    deltaFromPrevMonth: 0,
    deltaText: '+0',
    deltaClass: 'delta-up',
    distribution: [],
    topTargets: [],
    ringStyle: '',
    loading: true,
  },

  onLoad() {
    this.setData({ currentMonth: monthKeyFromDate(new Date()) })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadStats()
  },

  onMonthChange(e) {
    const value = e.detail.value || this.data.currentMonth
    this.setData({ currentMonth: value })
    this.loadStats()
  },

  onPullDownRefresh() {
    this.loadStats().finally(() => wx.stopPullDownRefresh())
  },

  loadStats() {
    this.setData({ loading: true })
    return getApp()
      .ensureLoginReady()
      .then(() =>
        post(
          '/api/v1/diary/wechat/stats',
          { month: this.data.currentMonth },
          { silent: true },
        ),
      )
      .then((data) => {
        const delta = buildDelta(data.deltaFromPrevMonth)
        this.setData({
          currentMonth: data.month || this.data.currentMonth,
          totalCount: data.totalCount || 0,
          deltaFromPrevMonth: data.deltaFromPrevMonth || 0,
          deltaText: delta.text,
          deltaClass: delta.className,
          distribution: data.distribution || [],
          topTargets: data.topTargets || [],
          ringStyle: buildRingStyle(data.distribution || []),
          loading: false,
        })
      })
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: (error && error.message) || '加载失败', icon: 'none' })
      })
  },
})
