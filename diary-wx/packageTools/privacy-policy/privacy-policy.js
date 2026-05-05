const POLICY_SECTIONS = [
  {
    id: 'service',
    title: '1. 服务说明',
    paragraphs: [
      '本程序仅提供链接解析，不存储任何解析的视频、图片等',
      '本程序不会存储任何用户解析下载的视频、图片等内容',
      '所有解析内容的版权归原作者及其发布平台所有',
      '用户需自行承担使用本工具的一切法律责任',
      '如有侵权内容，请联系我们立即处理',
    ],
  },
  {
    id: 'collect',
    title: '2. 信息收集',
    paragraphs: [
      '我们可能收集的信息包括：',
      '用户提供的链接（仅用于解析，不保存）',
      '设备信息（操作系统、浏览器类型等）',
      '访问日志（IP地址、访问时间、使用频率等）',
      '用户账号相关信息（如有）',
    ],
  },
  {
    id: 'rules',
    title: '3. 使用规范',
    paragraphs: [
      '用户在使用本程序服务时应遵守：',
      '不得用于任何违法违规用途',
      '不得侵犯他人知识产权或其他合法权益',
      '不得批量下载或使用自动化工具进行访问',
      '不得干扰网站正常运营或损害其他用户权益',
    ],
  },
  {
    id: 'disclaimer',
    title: '4. 免责声明',
    paragraphs: [
      '本程序声明：',
      '不对用户使用本工具的行为及其后果承担责任',
      '不保证服务的及时性、安全性、准确性',
      '保留随时修改或中止服务的权利',
      '如遇到任何法律问题，由用户自行承担',
    ],
  },
  {
    id: 'copyright',
    title: '5. 版权保护',
    paragraphs: [
      '关于内容版权：',
      '所有视频内容的版权归原作者所有',
      '本程序仅提供技术工具，不对内容版权负责',
      '用户应确保拥有相关内容的使用权',
      '收到版权投诉后将立即处理',
    ],
  },
  {
    id: 'changes',
    title: '6. 服务变更',
    paragraphs: [
      '我们保留以下权利：',
      '随时修改本隐私政策的权利',
      '调整或终止部分或全部服务的权利',
      '在必要时限制某些用户使用本服务的权利',
      '对违规行为采取相应措施的权利',
    ],
  },
  {
    id: 'consent',
    title: '7. 同意条款',
    paragraphs: [
      '欢迎使用本程序提供的链接分析工具。请您在使用我们的服务之前仔细阅读本隐私政策。使用本网站服务，即表示您已充分阅读、理解并同意接受本隐私政策的全部内容。如果您不同意本隐私政策的任何内容，请立即停止使用本网站服务。',
    ],
  },
  {
    id: 'contact',
    title: '8. 联系我们',
    paragraphs: ['如有任何问题或建议，请联系：', 'QQ：1587954520'],
  },
]

Page({
  data: {
    statusBarHeight: 20,
    navBlockHeight: 88,
    updatedAt: '最后更新日期：2026年4月1日',
    sections: POLICY_SECTIONS,
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

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/mine/mine' })
      },
    })
  },
})
