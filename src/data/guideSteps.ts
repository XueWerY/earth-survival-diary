import type { GuideStep } from '../components/common/overlay/GuideOverlay.vue'

export const guideSteps: GuideStep[] = [
  // ==================== 足迹 ====================
  {
    route: '/footprint',
    selector: '.header-actions',
    title: '足迹页面 - 记录日常',
    description: '这里是足迹模块，你可以在这里记录每天的活动和行为。点击"记录足迹"按钮添加新的轨迹，上方通过日期筛选器查看不同日期的足迹。'
  },
  {
    route: '/footprint',
    selector: '.footprint-content',
    title: '足迹页面 - 内容区',
    description: '记录的足迹会在这个区域展示。按时段分组，清晰呈现一天的活动安排，支持增删改操作。'
  },

  // ==================== 专注 ====================
  {
    route: '/focus',
    selector: '.mode-switch',
    title: '专注页面 - 模式切换',
    description: '支持番茄钟和正计时两种模式。番茄钟按固定时长倒计时，正计时自由计时，专注完成自动生成足迹。'
  },
  {
    route: '/focus',
    selector: '.focus-input-section',
    title: '专注页面 - 输入专注事项',
    description: '在这里输入你要专注的事项名称（必填），还可以添加备注信息。完成专注后会自动弹出保存常用选项。'
  },
  {
    route: '/focus',
    selector: '.start-button',
    title: '专注页面 - 开始专注',
    description: '填写专注事项后，点击这个按钮即可开始计时。之前的常用专注会以卡片形式保存，方便快速开始。'
  },

  // ==================== 清单 ====================
  {
    route: '/mission',
    selector: '.list-nav-scroll-wrapper',
    title: '清单页面 - 清单导航栏',
    description: '清单模块支持多清单管理。导航栏包含"今天""已过期""未来七天"三个智能清单，以及你创建的自定义清单。点击即可切换。'
  },
  {
    route: '/mission',
    selector: '.group-nav-scroll-wrapper',
    title: '清单页面 - 分组导航栏',
    description: '选中自定义清单后，这里显示分组信息。可以把任务按类别分组管理，方便查找和归档。'
  },
  {
    route: '/mission',
    selector: '.op-nav-scroll-wrapper',
    title: '清单页面 - 操作导航栏',
    description: '通过操作栏管理清单和分组：编辑、添加、移动、删除清单和分组，调整排序。最后一项"添加任务"用于创建新任务。'
  },
  {
    route: '/mission',
    selector: '.mission-container .main-content',
    title: '清单页面 - 任务管理',
    description: '添加任务后，任务卡片会在这里显示，包含任务名称、截止日期、优先级等信息。还可以将任务拆解为可勾选的检查事项。'
  },

  // ==================== 倒数日 ====================
  {
    route: '/countdown',
    selector: '.category-nav-scroll-wrapper',
    title: '倒数日页面 - 分类筛选',
    description: '按分类浏览倒数日事件，支持生日、纪念日、节日、旅行等多种分类。系统会自动生成重要节日倒数日。'
  },
  {
    route: '/countdown',
    selector: '.ops-nav-area',
    title: '倒数日页面 - 操作栏',
    description: '在这里管理分类和倒数日：编辑/添加/删除分类，调整分类顺序，添加/删除倒数日事件。'
  },

  // ==================== 课程表 ====================
  {
    route: '/course',
    selector: '.date-nav-scroll-wrapper',
    title: '课程表页面 - 日期导航',
    description: '按一周七天查看课程安排，点击选择要查看的日期。添加课程后课程卡片会在这里显示。'
  },
  {
    route: '/course',
    selector: '.week-info-bar',
    title: '课程表页面 - 教学周',
    description: '显示当前教学周和学期进度。你可以在"我的→课程表设置"中配置学期开学日期和周数。已结束的课程将自动记录到足迹。'
  },

  // ==================== 统计 ====================
  {
    route: '/statistics',
    selector: '.statistics-container .top-nav-area',
    title: '统计页面 - 数据总览',
    description: '在这里查看足迹和专注的统计数据。上方切换"足迹"和"专注"标签查看不同维度的图表分析。'
  },

  // ==================== 工具箱 ====================
  {
    route: '/toolbox',
    selector: '.tool-card-grid',
    title: '工具箱页面 - 实用工具',
    description: '这里汇集了社区开发者提供的小工具。点击工具卡片即可打开使用。下方还可以看到已安装的插件列表及其功能覆盖情况。'
  },

  // ==================== 我的 ====================
  {
    route: '/profile',
    selector: '.profile-nav-wrapper',
    title: '我的页面 - 设置导航',
    description: '在这里管理个人信息、账号安全、专注设置、课程表设置、系统设置等。右侧导航栏帮你快速跳转到各设置区域。'
  },
  {
    route: '/profile',
    selector: '#section-about',
    title: '我的页面 - 关于与更新',
    description: '在这里查看版本号、检查更新。下方还有"新手引导"按钮，可以随时重新查看这个教程。'
  }
]