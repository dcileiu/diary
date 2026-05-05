# 记仇日记系统设计

## 目标

把当前项目从壁纸模板改造成一套可直接继续开发的「记仇日记」系统：

- 小程序端：记录、筛选、回看自己的记仇事件
- 管理后台：查看用户、条目、分类标签和整体数据
- 后端：基于 Next.js Route Handlers + Prisma + MySQL

## MVP 功能范围

### 小程序

- 微信静默登录
- 首页概览
- 记仇条目列表
- 新增 / 编辑条目
- 条目详情
- 跟进记录
- 我的页面

### 后台

- 概览统计
- 条目管理
- 分类管理
- 标签管理
- 用户列表

## 核心领域模型

### `WxUser`

小程序用户主体，保存：

- `openId`
- `accessToken`
- `nickname`
- `avatar`
- 条目统计数据

### `DiaryCategory`

条目分类，解决“这次仇属于哪一类”的问题，例如：

- 感情
- 职场
- 家庭
- 朋友
- 服务体验

### `DiaryTag`

更细粒度的标签，例如：

- 阴阳怪气
- 临时甩锅
- 爽约
- 冷暴力
- 账目纠纷

### `DiaryEntry`

主表，表示一条记仇日记。它承载：

- 标题
- 正文
- 目标对象
- 对象关系
- 发生地点
- 记仇等级
- 情绪等级
- 当前状态
- 发生时间
- 解决时间
- 最近跟进时间

### `DiaryEntryTag`

条目和标签的多对多关系表。

### `DiaryEntryAttachment`

条目附件，预留图片证据、聊天截图、票据等扩展能力。

### `DiaryEntryFollowUp`

一条记仇事件的后续演变记录，例如：

- 补充细节
- 再次冲突
- 开始冷静
- 已和解
- 决定放下

## 状态设计

### 条目状态 `DiaryEntryStatus`

- `OPEN`：正在记仇，事件仍在影响情绪
- `COOLING`：开始冷静，但仍未完全放下
- `RECONCILED`：已和解
- `RELEASED`：决定放下，不再持续记录
- `ARCHIVED`：归档，仅保留查阅

### 跟进类型 `DiaryFollowUpType`

- `NOTE`：补充事实
- `REFLECTION`：自我复盘
- `ACTION`：采取动作
- `RESULT`：结果更新

## 数据关系

- 一个 `WxUser` 可以拥有多条 `DiaryEntry`
- 一条 `DiaryEntry` 属于一个 `DiaryCategory`
- 一条 `DiaryEntry` 可以拥有多个 `DiaryTag`
- 一条 `DiaryEntry` 可以拥有多个 `DiaryEntryAttachment`
- 一条 `DiaryEntry` 可以拥有多个 `DiaryEntryFollowUp`

## 接口设计

### 小程序端

- `POST /api/v1/diary/wechat/login`
- `POST /api/v1/diary/wechat/bootstrap`
- `POST /api/v1/diary/wechat/meta`
- `POST /api/v1/diary/wechat/entries`
- `POST /api/v1/diary/wechat/entry/detail`
- `POST /api/v1/diary/wechat/entry/save`
- `POST /api/v1/diary/wechat/entry/status`
- `POST /api/v1/diary/wechat/entry/follow-up`

### 后台

- `POST /api/admin/login`
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/entries`
- `PATCH /api/admin/entries/[id]`
- `GET|POST /api/admin/categories`
- `PATCH|DELETE /api/admin/categories/[id]`
- `GET|POST /api/admin/tags`
- `PATCH|DELETE /api/admin/tags/[id]`

## 为什么这样设计

- 主表 `DiaryEntry` 只保留“事件当前快照”，保证列表查询简单
- 变化过程放到 `DiaryEntryFollowUp`，保证后续复盘完整
- 分类与标签拆开，既能管理结构化筛选，也能保留表达自由度
- 附件独立成表，为后续接入上传能力留好空间
- 用户统计冗余到 `WxUser`，方便首页和“我的”页快速展示
