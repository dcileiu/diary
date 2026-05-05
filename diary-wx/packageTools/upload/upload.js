const { uploadFile } = require('../../utils/request.js')

Page({
  data: {
    uploading: false,
    lastUrl: '',
    doneCount: 0,
    failCount: 0,
  },

  onPick() {
    if (this.data.uploading) return
    const u = wx.getStorageSync('wxUser')
    if (!u || !u.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const files = (res.tempFiles || []).filter((f) => f && f.tempFilePath)
        if (!files.length) {
          wx.showToast({ title: '未选择文件', icon: 'none' })
          return
        }
        this.doUpload(files.map((f) => f.tempFilePath), String(u.id))
      },
      fail: () => {
        wx.chooseImage({
          count: 9,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (r) => {
            const files = (r.tempFilePaths || []).filter(Boolean)
            if (!files.length) {
              wx.showToast({ title: '未选择文件', icon: 'none' })
              return
            }
            this.doUpload(files, String(u.id))
          },
        })
      },
    })
  },

  async doUpload(filePaths, uid) {
    if (this.data.uploading) return
    const list = Array.isArray(filePaths) ? filePaths : [filePaths]
    let done = 0
    let fail = 0
    this.setData({ uploading: true, doneCount: 0, failCount: 0 })
    for (const filePath of list) {
      try {
        const data = await uploadFile('/api/v1/wallpaper/wechat/user-upload', filePath, { uid })
        const url = data && data.url ? data.url : ''
        done += 1
        this.setData({
          doneCount: done,
          failCount: fail,
          lastUrl: url || this.data.lastUrl,
        })
      } catch (e) {
        fail += 1
        this.setData({ doneCount: done, failCount: fail })
      }
    }
    this.setData({ uploading: false })
    if (fail === 0) {
      wx.showToast({ title: `上传成功 ${done} 张`, icon: 'success' })
    } else {
      wx.showToast({ title: `成功${done} 失败${fail}`, icon: 'none' })
    }
  },
})
