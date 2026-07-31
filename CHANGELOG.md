# 更新日志

## 2026.7.31-30

- **倒数日分类卡片按钮去背景**：`.card-icon-btn` 背景改为透明
- **删除课程确认弹窗去感叹号**：移除 `<Warning />` 图标，清理 import 和 CSS



- **开学日期区域宽度**：DateScrollPicker 点击区域宽度 110px
- **课表节数设置优化**：PeriodCountPicker 宽度 210px，删除箭头，文本水平居中
- **删除课程确认文本**：`.confirm-message` 颜色改为黄色系 `#fbbf24`



- **倒数日卡片编辑图标修复**：`@element-plus/icons-vue` 的 import 漏了 `Edit`，导致编辑按钮图标不渲染。补齐 import
- **设置弹窗修复**：`.dialog-overlay` 之前在重构时丢失了 `position: fixed; inset: 0; z-index: 9999` 等定位样式，导致弹窗即使 `v-if=true` 也不显示。补齐样式
- **文件夹弹窗 ColorGrid**：`ListPage.vue` 的文件夹颜色区域改用 `<ColorGrid v-model="folderFormColor" />`
- **列表卡片按钮去背景**：`.lcard-action-btn` 去除背景+边框，hover 时危险态变红色

## 2026.7.31-27

- **文件夹/分组 Page 表单 ColorGrid**：ListFormPage、GroupFormPage 颜色选择改用 ColorGrid 组件
- **倒数日卡片按钮图标**：恢复浅色背景+白色图标，提高可见性
- **列表卡片按钮同行**：编辑/删除按钮从卡片底部移至名称行右侧（`margin-left: auto`）

## 2026.7.31-26

- **修复删除按钮颜色**：`.delete-btn` 改为 `.capsule-btn.delete-btn` 提高 CSS 优先级，背景实心红色
- **时间/日记/日期弹窗按钮圆角**：TimePickerPopover、DiaryForm、DateScrollPicker 按钮 `border-radius:8px`
- **专注删除确认**：FocusTimer 删除常用专注改用 ConfirmDialog
- **倒数日卡片按钮**：恢复无背景框（仅 hover 浅背景）
- **清单/文件夹/分组删除**：ListPage 自定义确认弹窗替换为 ConfirmDialog
- **列表卡片编辑/删除按钮**：课程列表视图卡片新增 `.lcard-actions` 区域（编辑+删除）

## 2026.7.31-25

- **课程详情删除按钮红色**：`.delete-btn` 改为实心红色 `#ef4444`
- **ColorGrid 自定义标签在上**：`自定义` 标签移入输入框上方
- **倒数日分类弹窗**：添加 ColorGrid 颜色选择，按钮圆角矩形
- **分类卡片编辑按钮**：增大尺寸+背景+图标，提高可见性；允许编辑/删除系统分类
- **删除分类确认弹窗**：改用 ConfirmDialog（BaseDialog）
- **ConfirmDialog**：标题使用 props.title，移除感叹号图标，提示文本改为黄色系 `#fbbf24`
- **笔记分类弹窗按钮圆角**：`border-radius: 20px` → `8px`

## 2026.7.31-24

- **通用 ColorGrid 组件**：提取 40 色网格+自定义输入为 `src/components/common/ColorGrid.vue`，v-model 双向绑定
- **课程弹窗改造**：详情弹窗底部按钮改圆角矩形+新增删除按钮；编辑弹窗按钮圆角+移除删除按钮+使用 ColorGrid
- **分组/清单弹窗**：颜色选择改用 ColorGrid，按钮圆角矩形
- **笔记分类弹窗**：颜色选择改用 ColorGrid
- **添加任务弹窗**：底部按钮圆角矩形
- **足迹记录弹窗**：开始/结束时间两行显示，标签置于输入框上方
- **ConfirmDialog**：内部改为使用 BaseDialog，按钮圆角矩形
- **倒数日分类卡片**：所有分类卡片新增编辑/删除按钮

## 2026.7.31-23

- **课程格子简化**：有课的格子只显示课程名，水平和垂直居中，字号从 10px 增大到 14px，删除地点/教师/备注/周次等辅助信息

## 2026.7.31-22

- **行高计算考虑 grid gap**：公式加入 `gaps = (totalPeriods - sections) * 2px`，扣减 CSS grid 的行间距

## 2026.7.31-21

- **行高计算精确化**：`overhead` 从硬编码改为 DOM 实测 `.grid-top-row` 和 `.break-section-tag` 的实际高度，自动适应标签行高度变化

## 2026.7.31-20

- **课表行高响应式**：添加 `window.addEventListener('resize', calcRowHeight)`，窗口大小变化时自动重算行高，并在 `onUnmounted` 清理

## 2026.7.31-19

- **课表行高自适应（安全版）**：用 `nextTick` + `calcRowHeight()` 在 onMounted 一次性计算行高，通过 inline `:style="{ gridAutoRows }"` 注入，避免 CSS 变量/v-bind/ResizeObserver 导致的模板编译崩溃

## 2026.7.31-18

- **排查渲染崩溃（第三轮）**：完全移除行高自适应全部代码（ResizeObserver、watchers、onUnmounted、ref、CSS 绑定），恢复 grid-auto-rows 固定 64px，判断 bug 是否源于行高改动

## 2026.7.31-17

- **排查渲染崩溃**：临时回退 `grid-auto-rows: v-bind(rowHeightPx)` 为固定 64px，隔离 `v-bind()` CSS 是否是崩溃根源

## 2026.7.31-16

- **修复渲染崩溃（第二次）**：删除 `grid-auto-rows` 的 CSS 变量（`var(--row-h)`）+ `:style` inline 方式，改用 Vue 3 CSS `v-bind(rowHeightPx)`，避免 CSS 变量求值在模板编译阶段的未定义引用

## 2026.7.31-15

- **修复渲染错误**：`watch([periodCountPerSession, () => periods.value.length])` 在组件初始化时 getter 被预求值导致 `Cannot read properties of undefined (reading 'length')` 崩溃，改为直接 watch `periodCountPerSession` computed ref

## 2026.7.31-14

- **课表行高自适应**：课程表网格行高从固定 64px 改为动态计算，使用 ResizeObserver 监听容器高度，按节数等分，使窗口高度得到充分利用

## 2026.7.31-13

- **卡片列表视图重写为 CSS Grid 布局**：删除 JS 布局计算代码（ResizeObserver、cardWidth 等约 50 行），改用 CSS Grid auto-fit + minmax(300px, 1fr)，自动适配每行卡片数并等分宽度，左��边距 = 卡片间距 = 16px
- **设置和切换按钮居中**：按钮容器添加水平居中
- **卡片文本颜色修复**：修复 `--chalk-white-80` 未定义导致文本显示为黑色的 bug，改为 `--chalk-white-85`

## 2026.7.31-12

- **课程详情弹窗恢复分隔线**：BaseDialog 移除 noSeparator 属性，课程详情弹窗标题下方恢复分隔线
- **按钮布局调整**：设置按钮和视图切换按钮包裹在等宽容器中，与周几标签保持同行对齐
- **顶部周数上限**：学期周数显示不会超过设置的最大周数值
- **列表视图返回按钮**：卡片列表视图顶部新增"返回课程表"按钮

## 2026.7.31-11

- **课程弹窗继承 BaseDialog**：课程详情弹窗、添加/编辑课程弹窗和删除确认弹窗均改为使用 BaseDialog 组件，删除了课程详情弹窗中详情行下方的分隔线，添加课程弹窗中的标签和输入框改为上下排列
- **新增课程列表视图**：在设置按钮旁添加了视图切换按钮，可切换到课程卡片列表视图，卡片宽度根据可用空间自适应排列（间距 d=16px），显示所有课程不分周

## 2026.7.31-10

- **统计页统计范围优化**：统计范围区域改为单行显示（统计范围：开始日期 至 结束日期），删除重置按钮，DateScrollPicker 去除右侧箭头、日期文字居中

## 2026.7.31-9

- **课程表宽度 100% + 左右间距**：Electron 端 `.course-grid-wrapper` 80% → 100%，`.course-inner` 水平 padding 0 → 24px（所有平台统一间距）

## 2026.7.31-8

- **撤销课程表左右间距修改**：恢复 `.is-electron .course-grid-wrapper` 80%、`.week-area` 500px（保留原有间距设计）

## 2026.7.31-7

- **课程表��面去左右间距（已撤销）**：Electron 端 `.course-grid-wrapper` 80% → 100%，`.week-area` 500px → 100%

## 2026.7.31-6

- **导航栏垂直居中**：桌面端左侧导航项 `justify-content: flex-start` → `center`

## 2026.7.31-5

- **粒子颜色调浅**：`#7c3aed` → `#c4b5fd`

## 2026.7.31-4

- **粒子尺寸调整**：r=4 → r=2.5，更精致
- **修复弹窗跳转 bug**：点击 FloatingTimerBar 跳回专注页时改为调用 `router.push`，修复页面空白问题

## 2026.7.31-3

- **粒子颜色调整**：亮青 `#22d3ee` → 深紫 `#7c3aed`，比圆环色更深
- **计时弹窗圆角**：上边界也实现圆角效果

## 2026.7.31-2

- **圆环粒子增强**：粒子数量从 8 增至 16，尺寸增大，颜色改为亮青色 `#22d3ee`，更醒目
- **计时弹窗优化**：距窗口顶部留 12px 间距，支持鼠标拖动改变位置

## 2026.7.31-1

- **更新检查优化**：电脑端更新检查不再依赖 `latest.yml`，改为从 GitHub Releases 资产文件名 (`Earth-Survival-Diary-Setup-YYYY.M.DD-X.exe`) 直接提取版本号比对
- **正计时圆环粒子**：正计时模式下圆环布满发光粒子，粒子匀速沿圆环旋转；移除原有的单个末端小球
- **跨页面计时器弹窗**：计时器运行后切换到其他页面时，窗口顶部居中常驻显示计时器弹窗，点击可跳回专注页
- **快速访问拖拽排序**：快速访问下拉列表支持拖拽移动排序，排序结果持久化存储
