Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home', text: '首页' },
      { pagePath: '/pages/entries/entries', text: '记仇本' },
      { pagePath: '/pages/stats/stats', text: '统计' },
      { pagePath: '/pages/mine/mine', text: '我的' },
    ],
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) return
      this.setData({ selected: index })
      wx.switchTab({ url: item.pagePath })
    },
  },
})
