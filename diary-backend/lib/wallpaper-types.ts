/** 用户保存单张壁纸到相册消耗的发财鸭（非 VIP）；小程序与 points type「2」需与此一致 */
export const WALLPAPER_DOWNLOAD_POINTS_COST = 2;
/** 首页去水印解析消耗的发财鸭（非 VIP）；小程序首页与统一提取接口需与此一致 */
export const WALLPAPER_MEDIA_EXTRACT_POINTS_COST = 2;

export type WallItem = {
  /** 数据库主键，收藏/下载等仍用此 id */
  wallpapersId: number;
  /**
   * 组编号：同一批多张图共用（4～6 位数字），由前端或后台随机生成；
   * 与 wallpapersId 无关。
   */
  groupCode: string;
  fileName: string;
  type: string;
  /** 主题：整批上传可共用；可与标题、标签独立 */
  theme?: string;
  title: string;
  tags: string;
  hotScore?: number;
  /** 被收藏总数（壁纸维度） */
  collectCount?: number;
  downloading?: number;
  avatarList?: string[];
  /** 是否进入小程序首页「每日精选」轮播 */
  dailyFeatured?: boolean;
  /** 轮播顺序（升序靠前）；未入选时为 0 */
  dailyFeaturedSort?: number;
  /** true：仅管理后台可见，小程序接口不返回 */
  hidden?: boolean;
};

export type WxUser = {
  id: string;
  openId: string;
  accessToken: string;
  nickname: string;
  avatar: string;
  color: string;
  points: number;
  isVip: string;
};

/** 管理端用户列表：仅保留运营展示需要的概要信息，禁止暴露会话凭证 */
export type AdminUserSummary = {
  id: string;
  nickname: string;
  avatar: string;
  color: string;
  points: number;
  isVip: string;
  collectSum?: number;
  downloadSum?: number;
};

export type PointRecord = {
  id: string;
  uid: string;
  content: string;
  points: number;
  type: string;
  createTime: string;
};

/** 后台管理的壁纸分类（与 WallItem.type 字符串对应，用于下拉选项） */
export type WallpaperCategory = {
  id: number;
  name: string;
  sortOrder: number;
};

/** 后台管理的壁纸标签（与壁纸 tags 字段中的逗号分隔片段对应） */
export type WallpaperTag = {
  id: number;
  name: string;
  sortOrder: number;
};
