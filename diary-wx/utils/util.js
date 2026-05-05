function pad(num) {
  return String(num).padStart(2, '0')
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function safeText(value) {
  return String(value || '').trim()
}

module.exports = {
  formatDate,
  formatDateTime,
  safeText,
}
