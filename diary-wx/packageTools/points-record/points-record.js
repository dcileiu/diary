const { post } = require('../../utils/request.js')

const LIMIT = 20

function pad2(n) {
  return String(n).padStart(2, '0')
}

function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (String(d) === 'Invalid Date') return String(ts)
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${m}-${day} ${hh}:${mm}`
}

Page({
  data: {
    records: [],
    nextPage: 1,
    loading: false,
    noMore: false,
  },

  onLoad() {
    this.loadMore(true)
  },

  onPullDownRefresh() {
    this.loadMore(true)
  },

  onReachBottom() {
    this.loadMore(false)
  },

  loadMore(isFirst) {
    if (this.data.loading || (!isFirst && this.data.noMore)) return
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) {
      wx.showToast({ title: '正在登录，请稍后再试', icon: 'none' })
      return
    }

    const page = isFirst ? 1 : this.data.nextPage
    this.setData({ loading: true })
    post(
      '/api/v1/sys/user/point-record/page',
      { uid: u.id, page, limit: LIMIT },
      { silent: true },
    )
      .then((data) => {
        const batch = (data && data.records) || []
        const total = (data && data.total) || 0
        const mapped = batch.map((r) => ({
          content: r.content || '',
          points: Number(r.points) || 0,
          type: r.type || '',
          createTime: fmt(r.createTime),
        }))
        const all = isFirst ? mapped : this.data.records.concat(mapped)
        const noMore = batch.length < LIMIT || all.length >= total
        this.setData({
          records: all,
          nextPage: page + 1,
          loading: false,
          noMore,
        })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
      .finally(() => {
        wx.stopPullDownRefresh()
      })
  },
})

