const { post } = require('../../utils/request.js')
const { formatDate } = require('../../utils/util.js')

const GRIEVANCE_OPTIONS = [
  { value: 1, label: '一点点' },
  { value: 2, label: '有点气' },
  { value: 3, label: '挺生气' },
  { value: 4, label: '很生气' },
  { value: 5, label: '气炸了' },
]

const EMOTION_OPTIONS = [
  { value: 1, emoji: '-_-', label: '先忍住' },
  { value: 2, emoji: '>_<', label: '委屈' },
  { value: 3, emoji: 'T_T', label: '想哭' },
  { value: 4, emoji: 'QAQ', label: '上头' },
  { value: 5, emoji: '!!!', label: '炸毛' },
]

const STATUS_OPTIONS = [
  { value: 'OPEN', label: '正在记仇' },
  { value: 'COOLING', label: '先冷静下' },
  { value: 'RELEASED', label: '准备翻篇' },
]

function normalizeStatus(value) {
  const raw = String(value || '').toUpperCase()
  if (raw === 'COOLING') return 'COOLING'
  if (raw === 'RELEASED' || raw === 'RECONCILED' || raw === 'ARCHIVED') return 'RELEASED'
  return 'OPEN'
}

Page({
  data: {
    id: 0,
    isEdit: false,
    saving: false,
    dateValue: '',
    causeText: '',
    targetName: '',
    grievanceLevel: 3,
    emotionLevel: 3,
    status: 'OPEN',
    followUpText: '',
    tagOptions: [],
    tagSelectedIds: [],
    grievanceOptions: GRIEVANCE_OPTIONS,
    emotionOptions: EMOTION_OPTIONS,
    statusOptions: STATUS_OPTIONS,
  },

  onLoad(options) {
    const id = Number(options && options.id) || 0
    this.setData({
      id,
      isEdit: id > 0,
      dateValue: formatDate(new Date()),
    })

    this.loadMeta().then(() => {
      if (id > 0) this.loadDetail(id)
    })
  },

  loadMeta() {
    return getApp()
      .ensureLoginReady()
      .then(() => post('/api/v1/diary/wechat/meta', {}, { silent: true }))
      .then((data) => {
        this.setData({
          tagOptions: data.tags || [],
        })
      })
  },

  loadDetail(id) {
    return post(
      '/api/v1/diary/wechat/entry/detail',
      { entryId: id },
      { silent: true },
    )
      .then((data) => {
        const entry = data.entry || {}
        this.setData({
          causeText: entry.content || '',
          targetName: entry.targetName || '',
          grievanceLevel: entry.grievanceLevel || 3,
          emotionLevel: entry.emotionLevel || 3,
          status: normalizeStatus(entry.status),
          dateValue: entry.happenedAt ? String(entry.happenedAt).slice(0, 10) : this.data.dateValue,
          tagSelectedIds: (entry.tags || []).map((item) => item.id),
        })
      })
      .catch((error) => {
        wx.showToast({
          title: (error && error.message) || '加载失败',
          icon: 'none',
        })
      })
  },

  onDateChange(e) {
    this.setData({ dateValue: e.detail.value })
  },

  onCauseInput(e) {
    this.setData({ causeText: e.detail.value || '' })
  },

  onTargetInput(e) {
    this.setData({ targetName: e.detail.value || '' })
  },

  onFollowUpInput(e) {
    this.setData({ followUpText: e.detail.value || '' })
  },

  onGrievanceTap(e) {
    this.setData({ grievanceLevel: Number(e.currentTarget.dataset.value) || 3 })
  },

  onEmotionTap(e) {
    this.setData({ emotionLevel: Number(e.currentTarget.dataset.value) || 3 })
  },

  onStatusTap(e) {
    this.setData({ status: e.currentTarget.dataset.value || 'OPEN' })
  },

  onTagTap(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id) return

    const set = new Set(this.data.tagSelectedIds || [])
    if (set.has(id)) set.delete(id)
    else set.add(id)

    this.setData({ tagSelectedIds: Array.from(set) })
  },

  onSaveTap() {
    if (this.data.saving) return
    if (!String(this.data.causeText || '').trim()) {
      wx.showToast({ title: '先写下起因吧', icon: 'none' })
      return
    }

    const content = String(this.data.causeText || '').trim()
    this.setData({ saving: true })

    post(
      '/api/v1/diary/wechat/entry/save',
      {
        id: this.data.id || undefined,
        title: content.slice(0, 20),
        content,
        targetName: String(this.data.targetName || '').trim(),
        grievanceLevel: this.data.grievanceLevel,
        emotionLevel: this.data.emotionLevel,
        status: this.data.status,
        tagIds: this.data.tagSelectedIds,
        happenedAt: `${this.data.dateValue}T12:00:00+08:00`,
        initialFollowUp: String(this.data.followUpText || '').trim(),
      },
      { silent: true },
    )
      .then(() => {
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => {
          const pages = getCurrentPages()
          if (pages.length > 1) wx.navigateBack()
          else wx.switchTab({ url: '/pages/entries/entries' })
        }, 400)
      })
      .catch((error) => {
        wx.showToast({
          title: (error && error.message) || '保存失败',
          icon: 'none',
        })
      })
      .finally(() => {
        this.setData({ saving: false })
      })
  },
})
