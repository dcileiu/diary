const { post, wallpaperThumbSrc, wallpaperSrc } = require('../../utils/request.js')
const routes = require('../../utils/routes.js')

function isPureDigits(s) {
  return /^\d+$/.test(String(s || '').trim())
}

function enrich(item) {
  return {
    ...item,
    img: (item && item.img) || (item && item.fileName ? wallpaperThumbSrc(item.fileName) : ''),
    imgFull: (item && item.imgFull) || (item && item.fileName ? wallpaperSrc(item.fileName) : ''),
  }
}

function splitColumnsTwo(list) {
  const left = []
  const right = []
  ;(list || []).forEach((item, i) => {
    if (i % 2 === 0) left.push(item)
    else right.push(item)
  })
  return { left, right }
}

Page({
  data: {
    keyword: '',
    loading: false,
    searched: false,
    modeText: '',
    list: [],
    leftCol: [],
    rightCol: [],
    total: 0,
  },

  onInput(e) {
    this.setData({ keyword: String((e.detail && e.detail.value) || '') })
  },

  async fetchBy(body) {
    const data = await post(
      '/api/v1/wallpaper/wechat/page',
      {
        page: 1,
        limit: 60,
        selectFlag: 3,
        ...body,
      },
      { silent: true },
    )
    const app = getApp && getApp()
    if (app && data && data.assetBase) {
      app.globalData.assetBase = String(data.assetBase).replace(/\/$/, '')
    }
    return {
      records: (data && data.records ? data.records : []).map((x) => enrich(x)),
      total: data && data.total ? data.total : 0,
    }
  },

  async onSearch() {
    const keyword = String(this.data.keyword || '').trim()
    if (!keyword) {
      wx.showToast({ title: '请输入关键词', icon: 'none' })
      return
    }
    if (this.data.loading) return

    this.setData({ loading: true })
    try {
      let records = []
      let total = 0
      let modeText = ''

      if (isPureDigits(keyword)) {
        modeText = `按组编号优先：${keyword}`
        const byGroup = await this.fetchBy({ groupCode: keyword })
        records = byGroup.records
        total = byGroup.total
        if (!records.length) {
          modeText = `组编号无结果，已按主题/标签搜索：${keyword}`
          const bySearch = await this.fetchBy({ search: keyword })
          records = bySearch.records
          total = bySearch.total
        }
      } else {
        modeText = `按主题/标签搜索：${keyword}`
        const bySearch = await this.fetchBy({ search: keyword })
        records = bySearch.records
        total = bySearch.total
      }

      this.setData({
        searched: true,
        list: records,
        leftCol: splitColumnsTwo(records).left,
        rightCol: splitColumnsTwo(records).right,
        total,
        modeText,
      })
      if (!records.length) {
        wx.showToast({ title: '未找到结果', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onTapItem(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.list || []
    if (!list.length) return
    let index = 0
    if (id != null && id !== '') {
      const i = list.findIndex((w) => String(w.wallpapersId) === String(id))
      if (i >= 0) index = i
    }
    getApp().globalData.pendingWallpaperPreview = { list, index }
    wx.navigateTo({ url: routes.wallpaperPreview })
  },
})
