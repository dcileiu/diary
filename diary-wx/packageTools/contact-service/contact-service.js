Page({
  data: {
    serviceQq: '1587954520',
  },

  onCopyQq() {
    const qq = this.data.serviceQq
    wx.setClipboardData({
      data: qq,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      },
    })
  },
})
