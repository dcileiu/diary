const { post } = require('../../utils/request.js')
const routes = require('../../utils/routes.js')
const { formatDate } = require('../../utils/util.js')

const STARS = [1, 2, 3, 4, 5]
const STATUS_TABS = [
  { key: 'ALL', label: '全部' },
  { key: 'UNRESOLVED', label: '未解决' },
  { key: 'RESOLVED', label: '已翻篇' },
]

function formatEntryDateLabel(dateText) {
  const value = formatDate(dateText)
  if (!value) return ''
  const [, month, day] = value.split('-')
  return `${Number(month)}月${Number(day)}日`
}

function normalizeEntries(list) {
  return (list || []).map((item) => ({
    ...item,
    happenedAtLabel: formatEntryDateLabel(item.happenedAt),
  }))
}

Page({
  data: {
    stars: STARS,
    tabs: STATUS_TABS,
    activeTab: 'ALL',
    keyword: '',
    searchVisible: false,
    list: [],
    page: 1,
    pageSize: 12,
    noMore: false,
    loading: true,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    const app = getApp()
    const pending = app.globalData.pendingEntriesFilter || ''
    if (pending) {
      app.globalData.pendingEntriesFilter = ''
      this.setData({ activeTab: pending })
    }
    this.loadEntries(true)
  },

  onPullDownRefresh() {
    this.loadEntries(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadEntries(false)
  },

  loadEntries(reset) {
    if (!reset && (this.data.loading || this.data.noMore)) return Promise.resolve()

    const nextPage = reset ? 1 : this.data.page
    this.setData({ loading: true })

    return getApp()
      .ensureLoginReady()
      .then(() =>
        post(
          '/api/v1/diary/wechat/entries',
          {
            page: nextPage,
            pageSize: this.data.pageSize,
            statusGroup: this.data.activeTab === 'ALL' ? '' : this.data.activeTab,
            keyword: this.data.keyword,
          },
          { silent: true },
        ),
      )
      .then((data) => {
        const incoming = normalizeEntries(data.list || [])
        const list = reset ? incoming : (this.data.list || []).concat(incoming)
        this.setData({
          list,
          page: nextPage + 1,
          noMore: incoming.length < this.data.pageSize,
          loading: false,
        })
      })
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: (error && error.message) || '加载失败', icon: 'none' })
      })
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key
    if (!key || key === this.data.activeTab) return
    this.setData({ activeTab: key, page: 1, noMore: false })
    this.loadEntries(true)
  },

  onSearchToggle() {
    this.setData({ searchVisible: !this.data.searchVisible })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || '' })
  },

  onSearchConfirm() {
    this.setData({ page: 1, noMore: false })
    this.loadEntries(true)
  },

  onEntryTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `${routes.entryEditor}?id=${id}` })
  },

  onWriteTap() {
    wx.navigateTo({ url: routes.entryEditor })
  },
})
