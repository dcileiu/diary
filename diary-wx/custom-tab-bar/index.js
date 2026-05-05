Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home', text: '首页' },
      { pagePath: '/pages/gallery/gallery', text: '壁纸图集' },
      { pagePath: '/pages/mine/mine', text: '我的' },
    ],
    lastClickTime: 0,
  },

  methods: {
    switchTab(e) {
      const now = Date.now()
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]
      if (!item) return

      if (index === this.data.selected) return

      if (now - this.data.lastClickTime < 30) return

      const previous = this.data.selected
      const url = item.pagePath

      this.setData({
        selected: index,
        lastClickTime: now,
      })

      wx.switchTab({
        url,
        fail: () => {
          this.setData({ selected: previous })
        },
      })
    },

    setSelected(idx) {
      if (idx >= 0 && idx < this.data.list.length && idx !== this.data.selected) {
        this.setData({
          selected: idx,
          lastClickTime: Date.now(),
        })
      }
    },
  },
})
