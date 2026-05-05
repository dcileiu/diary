export const DIARY_ENTRY_STATUS_OPTIONS = [
  { value: "OPEN", label: "正在记仇", tone: "critical" },
  { value: "COOLING", label: "冷静观察", tone: "warning" },
  { value: "RECONCILED", label: "已经和解", tone: "success" },
  { value: "RELEASED", label: "决定放下", tone: "calm" },
  { value: "ARCHIVED", label: "归档保存", tone: "muted" },
] as const;

export const DIARY_FOLLOW_UP_TYPE_OPTIONS = [
  { value: "NOTE", label: "补充事实" },
  { value: "REFLECTION", label: "复盘想法" },
  { value: "ACTION", label: "采取动作" },
  { value: "RESULT", label: "结果更新" },
] as const;

export const DEFAULT_DIARY_CATEGORIES = [
  { name: "感情", description: "伴侣、暧昧和亲密关系中的委屈", color: "#E85D75", sortOrder: 0 },
  { name: "职场", description: "同事、上级、甩锅、沟通失衡", color: "#F08A24", sortOrder: 1 },
  { name: "家庭", description: "亲属、育儿、代际相处摩擦", color: "#5E8C61", sortOrder: 2 },
  { name: "朋友", description: "友情中的失约、边界和消耗", color: "#2C6E91", sortOrder: 3 },
  { name: "服务体验", description: "商家、平台、售后、消费纠纷", color: "#875692", sortOrder: 4 },
  { name: "金钱往来", description: "借钱、AA、报销、账目不清", color: "#7A5C3E", sortOrder: 5 },
] as const;

export const DEFAULT_DIARY_TAGS = [
  { name: "阴阳怪气", color: "#C44569", sortOrder: 0 },
  { name: "甩锅", color: "#D98E04", sortOrder: 1 },
  { name: "爽约", color: "#E56B6F", sortOrder: 2 },
  { name: "冷暴力", color: "#6C5B7B", sortOrder: 3 },
  { name: "翻旧账", color: "#355070", sortOrder: 4 },
  { name: "不回消息", color: "#4D908E", sortOrder: 5 },
  { name: "边界模糊", color: "#577590", sortOrder: 6 },
  { name: "账目纠纷", color: "#9C6644", sortOrder: 7 },
  { name: "公开失礼", color: "#BC4749", sortOrder: 8 },
  { name: "承诺落空", color: "#8D99AE", sortOrder: 9 },
] as const;

export const DIARY_STATUS_LABEL_MAP = Object.fromEntries(
  DIARY_ENTRY_STATUS_OPTIONS.map((item) => [item.value, item.label]),
) as Record<string, string>;

export const DIARY_FOLLOW_UP_LABEL_MAP = Object.fromEntries(
  DIARY_FOLLOW_UP_TYPE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<string, string>;
