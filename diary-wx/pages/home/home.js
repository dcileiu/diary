const { post } = require('../../utils/request.js')
const routes = require('../../utils/routes.js')

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']
const STARS = [1, 2, 3, 4, 5]

function pad(num) {
  return String(num).padStart(2, '0')
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function addMonths(monthKey, delta) {
  const [yearText, monthText] = String(monthKey).split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1)
  return monthKeyFromDate(date)
}

function formatMonthLabel(monthKey) {
  const [yearText, monthText] = String(monthKey).split('-')
  return `${yearText}年${Number(monthText)}月`
}

function weekdayLabel(dateText) {
  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) return ''
  return `星期${WEEK_DAYS[date.getDay()]}`
}

function formatSelectedEntryDateText(entry) {
  if (!entry || !entry.happenedAt) return ''
  return `${Number(entry.happenedAt.slice(5, 7))}月${Number(
    entry.happenedAt.slice(8, 10),
  )}日 · ${weekdayLabel(entry.happenedAt)}`
}

function buildSummaryItems(summary) {
  return [
    { label: '记仇次数', value: summary.totalEntries || 0, suffix: '次' },
    { label: '翻篇占比', value: summary.resolvedRate || 0, suffix: '%' },
    { label: '记仇对象', value: summary.targetCount || 0, suffix: '人' },
    { label: '日记记录', value: summary.followUpCount || 0, suffix: '笔' },
  ]
}

function cellTone(marker) {
  if (!marker) return ''
  if (marker.grievanceLevel >= 5) return 'cell-critical'
  if (marker.grievanceLevel === 4) return 'cell-high'
  if (marker.grievanceLevel === 3) return 'cell-mid'
  return 'cell-low'
}

function buildCalendarRows(monthKey, markers, selectedDate) {
  const [yearText, monthText] = String(monthKey).split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const offset = firstDay.getDay()
  const markerMap = {}
  ;(markers || []).forEach((item) => {
    markerMap[item.date] = item
  })

  const todayKey = formatDateKey(new Date())
  const cells = []

  for (let i = 0; i < offset; i += 1) {
    cells.push({ key: `ghost-${i}`, label: '', currentMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthKey}-${pad(day)}`
    const marker = markerMap[date] || null
    cells.push({
      key: date,
      date,
      label: String(day),
      currentMonth: true,
      marker,
      isToday: date === todayKey,
      isSelected: date === selectedDate,
      toneClass: cellTone(marker),
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `ghost-tail-${cells.length}`, label: '', currentMonth: false })
  }

  const rows = []
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7))
  }
  return rows
}

Page({
  data: {
    weekDays: WEEK_DAYS,
    stars: STARS,
    currentMonth: '',
    monthLabel: '',
    calendarRows: [],
    selectedDate: '',
    selectedEntry: null,
    selectedEntryDateText: '',
    summaryItems: [],
    loading: true,
  },

  onLoad() {
    const currentMonth = monthKeyFromDate(new Date())
    this.setData({ currentMonth, monthLabel: formatMonthLabel(currentMonth) })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadCalendar()
  },

  onPullDownRefresh() {
    this.loadCalendar().finally(() => wx.stopPullDownRefresh())
  },

  loadCalendar(selectedDate) {
    this.setData({ loading: true })
    return getApp()
      .ensureLoginReady()
      .then(() =>
        post(
          '/api/v1/diary/wechat/calendar',
          {
            month: this.data.currentMonth,
            selectedDate: selectedDate || this.data.selectedDate,
          },
          { silent: true },
        ),
      )
      .then((data) => {
        const entry = data.selectedEntry || null
        this.setData({
          currentMonth: data.month,
          monthLabel: formatMonthLabel(data.month),
          calendarRows: buildCalendarRows(data.month, data.markers || [], data.selectedDate),
          selectedDate: data.selectedDate || '',
          selectedEntry: entry,
          selectedEntryDateText: formatSelectedEntryDateText(entry),
          summaryItems: buildSummaryItems(data.summary || {}),
          loading: false,
        })
      })
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: (error && error.message) || '加载失败', icon: 'none' })
      })
  },

  onPrevMonth() {
    const currentMonth = addMonths(this.data.currentMonth, -1)
    this.setData({ currentMonth, monthLabel: formatMonthLabel(currentMonth), selectedDate: '' })
    this.loadCalendar('')
  },

  onNextMonth() {
    const currentMonth = addMonths(this.data.currentMonth, 1)
    this.setData({ currentMonth, monthLabel: formatMonthLabel(currentMonth), selectedDate: '' })
    this.loadCalendar('')
  },

  onTodayTap() {
    const now = new Date()
    const currentMonth = monthKeyFromDate(now)
    this.setData({ currentMonth, monthLabel: formatMonthLabel(currentMonth) })
    this.loadCalendar(formatDateKey(now))
  },

  onDayTap(e) {
    const cell = e.currentTarget.dataset.cell
    if (!cell || !cell.currentMonth || !cell.date) return
    this.loadCalendar(cell.date)
  },

  onEntryTap() {
    const entry = this.data.selectedEntry
    if (!entry || !entry.id) return
    wx.navigateTo({ url: `${routes.entryEditor}?id=${entry.id}` })
  },

  onWriteTap() {
    wx.navigateTo({ url: routes.entryEditor })
  },

  onSettingsTap() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },
})
