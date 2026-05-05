const GUIDE_ITEMS = [
  {
    id: 'support',
    title: '支持哪些链接和分享内容？',
    body: [
      '目前支持公众号文章链接、抖音分享链接和小红书分享链接。',
      '你可以直接粘贴分享口令、短链，或者完整文章链接，不需要先手动清洗内容。',
    ],
  },
  {
    id: 'steps',
    title: '第一次使用怎么操作？',
    body: [
      '1. 先在对应 App 里复制分享内容。',
      '2. 回到首页点击“粘贴”，把内容填进输入框。',
      '3. 点击“开始解析”，等待结果返回。',
      '4. 解析完成后即可预览、复制链接，或直接保存图片和视频。',
    ],
  },
  {
    id: 'failed',
    title: '为什么有时会解析失败？',
    body: [
      '常见原因是分享内容不完整、原链接已失效，或者平台临时做了风控限制。',
      '可以优先尝试重新复制一次完整分享内容，再回到首页重新解析。',
    ],
  },
  {
    id: 'save',
    title: '图片和视频怎么保存？',
    body: [
      '图片解析成功后可以直接点击“保存图片”。',
      '视频解析成功后可以直接点击“保存视频”；如果是流媒体地址，页面会提示你先复制地址。',
      '第一次保存到相册时，需要允许小程序访问相册权限。',
    ],
  },
  {
    id: 'clipboard',
    title: '粘贴按钮和清空按钮怎么切换？',
    body: [
      '输入框为空时，左侧按钮会显示“粘贴”，点击后会自动读取剪贴板内容。',
      '输入框有内容时，左侧按钮会自动切换成“清空”，点击后会同时清掉输入内容和当前解析结果。',
    ],
  },
]

Page({
  data: {
    statusBarHeight: 20,
    navBlockHeight: 88,
    openGuideId: 'steps',
    guideItems: GUIDE_ITEMS,
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const sh = win.statusBarHeight || 20
    const w = win.windowWidth || win.screenWidth || 375
    const barPx = (88 / 750) * w
    this.setData({
      statusBarHeight: sh,
      navBlockHeight: sh + barPx,
    })
  },

  onToggleGuide(e) {
    const id = String((e.currentTarget.dataset && e.currentTarget.dataset.id) || '')
    if (!id) return
    this.setData({
      openGuideId: this.data.openGuideId === id ? '' : id,
    })
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/home/home' })
      },
    })
  },
})
