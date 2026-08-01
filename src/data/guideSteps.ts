import type { GuideStep } from '../components/common/overlay/GuideOverlay.vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useListStore } from '../stores/listStore'
import { usePageNav } from '../composables/usePageNav'

export const guideSteps: GuideStep[] = [
  // ==================== 全局导航栏 ====================
  {
    route: '/footprint',
    selector: '.main-nav-bar',
    title: '全局导航栏 · 收起状态',
    description: '导航栏可以收起为仅显示图标的窄条，腾出更多内容空间。点击底部的折叠按钮即可在收起和展开之间切换。',
    padding: 0,
    tooltipPosition: 'right-center',
    onActivate: () => {
      useSettingsStore().updateSettings({ sidebarCollapsed: true })
    }
  },
  {
    route: '/footprint',
    selector: '.main-nav-bar',
    title: '全局导航栏 · 展开状态',
    description: '展开后显示完整的导航栏，包含所有功能模块的图标和名称。当前高亮的图标表示正在使用的模块，点击即可快速切换。',
    padding: 0,
    tooltipPosition: 'right-center',
    onActivate: () => {
      useSettingsStore().updateSettings({ sidebarCollapsed: false })
    }
  },
  {
    route: '/footprint',
    selector: '.date-nav-area',
    title: '足迹页面 - 日期选择',
    description: '点击左右箭头可切换前一天和后一天，中间显示公历日期与农历信息。点击日期标题可弹出日期选择器，快速跳转到任意日期。',
    padding: 0,
    tooltipPosition: 'bottom-left',
    onActivate: () => {
      const dot = document.querySelector('.expand-hint .hint-dot')
      if (dot && dot.classList.contains('collapse-dot')) {
        (dot.closest('.expand-hint') as HTMLElement)?.click()
      }
    }
  },
  {
    route: '/footprint',
    selector: '.date-dialog-container',
    title: '足迹页面 - 跳转日期',
    description: '点击日期标题后弹出日期选择器，支持公历和农历两种模式。通过滚动选择年月日，点击"保存"切换到对应日期，点击"回到今天"可快速返回当天。',
    padding: 0,
    tooltipPosition: 'bottom-left',
    onActivate: () => {
      const title = document.querySelector('.header-title') as HTMLElement
      title?.click()
    }
  },
  {
    route: '/footprint',
    selector: '.header-actions',
    title: '足迹页面 - 记录生活',
    description: '"记录足迹"用于记录活动行为和用时；"写日记"用于书写每日日记。',
    padding: 8,
    tooltipPosition: 'bottom-right',
    onActivate: () => {
      const overlay = document.querySelector('.date-dialog-overlay') as HTMLElement
      overlay?.click()
    }
  },
  {
    route: '/footprint',
    selector: '.dialog-container',
    title: '足迹页面 - 记录足迹',
    description: '点击"记录足迹"按钮弹出此表单，填写活动名称、选择时段和备注，点击"添加"即可创建一条活动足迹记录。',
    tooltipPosition: 'left-top',
    onActivate: () => {
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
      const btn = document.querySelector('.add-btn') as HTMLElement
      btn?.click()
    }
  },
  {
    route: '/footprint',
    selector: '.drum-picker',
    title: '足迹页面 - 选择时间',
    description: '点击"开始"或"结束"时间按钮可弹出时间选择器，通过滚动选择小时和分钟，点击"确定"完成设置。',
    tooltipPosition: 'left-top',
    onActivate: () => {
      const timeBtn = document.querySelector('.time-btn') as HTMLElement
      timeBtn?.click()
    }
  },
  {
    route: '/footprint',
    selector: '.dialog-container',
    title: '足迹页面 - 写日记',
    description: '点击"写日记"按钮弹出此表单，填写日记标题和正文内容，点击"添加"即可创建一篇日记。',
    tooltipPosition: 'fixed-bottom-right',
    onActivate: () => {
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
      const timeOverlay = document.querySelector('.time-picker-overlay') as HTMLElement
      timeOverlay?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      const btn = document.querySelector('.diary-btn') as HTMLElement
      btn?.click()
    }
  },
  {
    route: '/footprint',
    selector: '.footprint-content',
    title: '足迹页面 - 内容区',
    description: '记录的活动足迹和日记会在这个区域展示。按时段（上午/下午/晚上）分组，星标卡片会在顶部"⭐ 星标"区域聚合显示。',
    tooltipPosition: 'fixed-bottom-right',
    onActivate: () => {
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
    }
  },
  {
    route: '/footprint',
    selector: '.record-card',
    title: '足迹页面 - 记录卡片',
    description: '每张记录卡片展示一条活动足迹，包含活动名称、时段和备注。点击时段可修改起止时间，右上角按钮支持星标置顶、编辑和删除，名称和备注支持双击快捷编辑。',
    tooltipPosition: 'bottom-left'
  },
  {
    route: '/footprint',
    selector: '.diary-card',
    title: '足迹页面 - 日记卡片',
    description: '每张日记卡片展示一篇日记，包含标题、创建时间和正文内容。右上角按钮支持星标置顶、编辑和删除，标题和备注支持双击编辑。',
    tooltipPosition: 'bottom-left'
  },

  // ==================== 笔记 ====================
  {
    route: '/notes',
    selector: '.notes-container',
    title: '笔记页面 - 首页',
    description: '这是笔记模块首页，顶部为面包屑导航栏，下方以卡片网格展示所有分类。点击分类卡片即可进入查看该分类下的笔记。',
    tooltipPosition: 'fixed-bottom-right',
    onActivate: () => {
      usePageNav().setNavPath(['notes'])
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
    }
  },
  {
    route: '/notes',
    selector: '.dialog-container',
    title: '笔记页面 - 新建分类',
    description: '点击首页右上角"+"按钮打开此表单。填写分类名称、选择图标（12×12 emoji 网格）和颜色（40 色调色板），底部也可输入自定义颜色值。点击"添加"即可创建自定义分类。',
    tooltipPosition: 'left-top',
    onActivate: () => {
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
      const btn = document.querySelector('.notes-breadcrumb-bar .breadcrumb-plus-btn') as HTMLElement
      btn?.click()
    }
  },
  {
    route: '/notes',
    selector: '.folder-card:not(:first-child)',
    title: '笔记页面 - 分类卡片',
    description: '每张分类卡片代表一个笔记分类。点击卡片进入查看该分类下的笔记，右上角编辑和删除按钮悬浮出现。卡片下方显示该分类下的笔记数量。',
    onActivate: () => {
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
      usePageNav().setNavPath(['notes'])
    }
  },
  {
    route: '/notes',
    selector: '.notes-container',
    title: '笔记页面 - 分类视图',
    description: '点击分类卡片（如攻略）进入该分类的笔记列表。顶部面包屑显示当前分类路径，点击">"可下拉切换分类。右侧<svg width="14" height="14" viewBox="0 0 1024 1024" style="vertical-align:middle"><path d="M512 747.8l228.2 120a6.4 6.4 0 0 0 9.2-6.7L706 607l184.5-180a6.4 6.4 0 0 0-3.5-10.8L632 379 517.7 147.9a6.4 6.4 0 0 0-11.6 0l-114 231.2L137 416a6.4 6.4 0 0 0-3.5 11L318 607l-43.6 254a6.4 6.4 0 0 0 9.3 6.8zM313.6 924.5a70.4 70.4 0 0 1-102.1-74.3l37.8-220.9L89 473a70.4 70.4 0 0 1 39-120.1l221.8-32.3 99.2-201a70.4 70.4 0 0 1 126.2 0l99.2 201L896.2 353a70.4 70.4 0 0 1 39 120L774.7 629.5l38 220.9a70.4 70.4 0 0 1-102.2 74.2L512 820.1z" fill="currentColor"/></svg>可收藏当前视图，<svg width="14" height="14" viewBox="0 0 1024 1024" style="vertical-align:middle"><path d="M256 128v698.9L452 670a96 96 0 0 1 120 0l196 156.8V128zm-32-64h576a32 32 0 0 1 32 32v797.4a32 32 0 0 1-52 25L532 720a32 32 0 0 0-40 0L244 918.4a32 32 0 0 1-52-25V96a32 32 0 0 1 32-32" fill="currentColor"/></svg>为快速访问下拉列表，<svg width="14" height="14" viewBox="0 0 1024 1024" style="vertical-align:middle"><path d="M384 96a32 32 0 0 1 64 0v786.8a32 32 0 0 1-54.6 22.6L96 608a32 32 0 0 1 0-45.3h.2a32 32 0 0 1 45.1 0l242.8 243zm192 45.2a32 32 0 0 1 54.6-22.5L928 416a32 32 0 0 1 0 45.3h-.2a32 32 0 0 1-45.1 0L640 218.5V928a32 32 0 1 1-64 0z" fill="currentColor"/></svg>可排序笔记（更新时间/创建时间/标题）。',
    tooltipPosition: 'fixed-bottom-right',
    onActivate: () => {
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
      usePageNav().setNavPath(['notes', 'guide'])
    }
  },
  {
    route: '/notes',
    selector: '.note-card',
    title: '笔记页面 - 笔记卡片',
    description: '每张笔记卡片显示笔记标题、大纲标题数和全文字数，以及创建和修改时间。鼠标悬停时右上角显示置顶、编辑和删除按钮，可通过编辑按钮进入编辑模式。',
    onActivate: () => {
      const overlay = document.querySelector('.dialog-overlay') as HTMLElement
      overlay?.click()
      usePageNav().setNavPath(['notes', 'guide'])
    }
  },
  {
    route: '/notes',
    selector: '.notes-container',
    title: '笔记页面 - 编辑笔记',
    tooltipPosition: 'center',
    description: '点击笔记卡片上的编辑按钮进入编辑视图。左侧为大纲导航面板，根据标题层级自动生成，点击可快速跳转。中间为 Markdown 编辑器，支持块级编辑和完整工具栏。顶部面包屑地址栏右侧有重命名笔记按钮，右下角可置顶和保存。底部状态栏显示当前时间和字数统计。',
    onActivate: () => {
      usePageNav().setNavPath(['notes', 'guide', 'guide-note'])
    }
  },

  // ==================== 专注 ====================
  {
    route: '/focus',
    selector: '.focus-style-row',
    title: '专注页面 - 计时器风格',
    description: '可选择圆环或数字两种计时器显示风格。圆环样式带有渐变色进度环和发光粒子（正计时模式下），数字样式简洁纯白。'
  },
  {
    route: '/focus',
    selector: '.focus-mode-row',
    title: '专注页面 - 模式切换',
    description: '支持番茄钟和正计时两种模式。番茄钟按固定时长倒计时，正计时自由计时。专注完成后自动生成对应的足迹记录。'
  },
  {
    route: '/focus',
    selector: '.focus-input-section',
    title: '专注页面 - 输入专注事项',
    description: '在这里输入你要专注的事项名称（必填）。番茄钟模式下可调整专注时长（1-120 分钟，步长 5 分钟），还可以添加备注信息。'
  },
  {
    route: '/focus',
    selector: '.favorites-section',
    title: '专注页面 - 常用专注',
    description: '常用专注卡片保存了你之前标记的事项。点击即可快速填充名称、备注和模式，无需重复输入。右上角删除按钮可移除不再需要的常用事项。'
  },
  {
    route: '/focus',
    selector: '.focus-start-btn',
    title: '专注页面 - 开始专注',
    description: '填写专注事项后，点击"开始专注"按钮即可开始计时。专注完成后会弹出保存常用选项，方便下次快速复用。'
  },

  // ==================== 清单 ====================
  {
    route: '/list',
    selector: '.list-breadcrumb-bar',
    title: '清单页面 - 面包屑导航',
    description: '面包屑地址栏显示当前所处层级，点击">"弹出下拉列表可快速切换智能清单或自定义文件夹。右侧依次为：收藏当前视图、快速访问下拉、添加按钮（根据当前层级自动切换为添加文件夹/清单/分组/任务）。'
  },
  {
    route: '/list',
    selector: '.card-grid-root',
    title: '清单页面 - 首页卡片',
    description: '首页展示"智能清单"卡片和所有自定义文件夹卡片。"智能清单"包含今天、已过期、未来七天三个自动筛选视图；点击文件夹卡片进入清单列表，层层深入管理任务。',
    onActivate: () => {
      usePageNav().setNavPath(['list'])
    }
  },
  {
    route: '/list',
    selector: '.card-grid',
    title: '清单页面 - 智能清单视图',
    description: '进入智能清单后，显示"今天""已过期""未来七天"三张卡片。系统根据截止日期自动筛选任务，无需手动分类，点击卡片即可查看对应的任务列表。',
    onActivate: () => {
      usePageNav().setNavPath(['list', 'smart'])
    }
  },
  {
    route: '/list',
    selector: '.card-grid',
    title: '清单页面 - 我的清单',
    description: '首次使用时系统自动创建"我的清单"文件夹。这里展示该文件夹下的所有清单卡片，每个清单默认包含一个"默认分组"，可以将任务归类到不同分组中方便管理。',
    onActivate: () => {
      const store = useListStore()
      const poll = () => {
        const folder = store.folders.find(f => f.type === 'custom')
        if (folder) {
          usePageNav().setNavPath(['list', 'custom', folder.id])
        } else {
          setTimeout(poll, 100)
        }
      }
      poll()
    }
  },
  {
    route: '/list',
    selector: '.card-grid',
    title: '清单页面 - 默认清单',
    description: '进入一个清单后，展示该清单下的所有分组。每个清单默认包含一个"默认分组"，点击分组卡片可查看该分组下的任务列表。',
    onActivate: () => {
      const store = useListStore()
      const poll = () => {
        const folder = store.folders.find(f => f.type === 'custom')
        if (folder && store.taskLists.length > 0) {
          usePageNav().setNavPath(['list', 'custom', folder.id, store.taskLists[0].id])
        } else {
          setTimeout(poll, 100)
        }
      }
      poll()
    }
  },
  {
    route: '/list',
    selector: '.list-list',
    title: '清单页面 - 任务卡片',
    description: '进入分组后，该分组下的任务卡片在此展示。每张任务卡片包含任务名称、截止日期、优先级以及可勾选的检查事项。任务还支持设置重复策略和提醒时间。',
    onActivate: () => {
      const store = useListStore()
      const poll = () => {
        const folder = store.folders.find(f => f.type === 'custom')
        if (folder && store.taskLists.length > 0 && store.taskLists[0].groups.length > 0) {
          usePageNav().setNavPath(['list', 'custom', folder.id, store.taskLists[0].id, store.taskLists[0].groups[0].id])
        } else {
          setTimeout(poll, 100)
        }
      }
      poll()
    }
  },

  // ==================== 倒数日 ====================
  {
    route: '/countdown',
    selector: '.countdown-breadcrumb-bar',
    title: '倒数日页面 - 分类筛选',
    description: '通过面包屑导航切换分类，点击">"下拉选择分类。支持生日、纪念日、节日、旅行等多种分类，系统会自动生成重要节日倒数日。右侧"+"按钮可添加分类或倒数日。',
    tooltipPosition: 'bottom-center',
    onActivate: () => {
      usePageNav().setNavPath(['countdown'])
    }
  },
  {
    route: '/countdown',
    selector: '.countdown-container .card-grid',
    title: '倒数日页面 - 分类卡片',
    description: '这里展示所有分类卡片，点击进入查看该分类下的倒数日事件。"全部"卡片汇总所有倒数日，自定义分类卡片右上角有编辑和删除按钮。',
    tooltipPosition: 'bottom-center',
    onActivate: () => {
      usePageNav().setNavPath(['countdown'])
    }
  },
  {
    route: '/countdown',
    selector: '.section',
    title: '倒数日页面 - 里程碑分区',
    description: '进入分类后，倒数日按时间划分展示：星标区域聚合重要事项，即将到来（30 天内）红色高亮提示，未来展望（30 天后）紫色展示，时光印记记录已过去的日期。',
    tooltipPosition: 'bottom-center',
    onActivate: () => {
      usePageNav().setNavPath(['countdown', 'all'])
    }
  },
  {
    route: '/countdown',
    selector: '.milestone-card',
    title: '倒数日页面 - 里程碑卡片',
    description: '每张卡片显示倒数日名称、目标日期和剩余天数。底部可切换重复策略（每年/不重复）和提醒设置。右上角按钮支持星标置顶、编辑和删除。双击名称和描述可快捷编辑。',
    tooltipPosition: 'bottom-center',
    onActivate: () => {
      usePageNav().setNavPath(['countdown', 'all'])
    }
  },

  // ==================== 课程表 ====================
  {
    route: '/course',
    selector: '.week-area',
    title: '课程表页面 - 教学周切换',
    description: '通过左右箭头切换教学周，显示当前周次和日期范围。',
    tooltipPosition: 'bottom-center'
  },
  {
    route: '/course',
    selector: '.corner-actions',
    title: '课程表页面 - 设置与视图切换',
    description: '齿轮按钮打开课程表设置，可配置学期日期、节次安排、课间休息等。右侧按钮可在课程网格视图和课程列表视图之间切换。',
    tooltipPosition: 'bottom-left'
  },
  {
    route: '/course',
    selector: '.course-grid-wrapper',
    title: '课程表页面 - 课程网格',
    description: '课程以网格形式按星期和节次排列。左侧显示节次名称和时间，点击空白格子可以添加课程，已添加的课程显示课程名称，点击课程可查看详情。',
    tooltipPosition: 'center'
  },

  // ==================== 统计 ====================
  {
    route: '/statistics',
    selector: '.date-range-bar',
    title: '统计页面 - 日期范围',
    description: '设置统计数据的日期范围。左右两个日期选择器分别选择起始日期和结束日期，点击日期标题可弹出日期选择器快速跳转。下方按模块展示统计数据和趋势图。',
    tooltipPosition: 'bottom-center'
  },
  {
    route: '/statistics',
    selector: '.module-sections > :nth-child(1) .section-stats',
    title: '统计页面 - 数据指标',
    description: '每个模块区域展示关键数据指标。以足迹为例：显示日记数、记录数、总时长、日均日记和日均记录。专注、清单、倒数日、课程表模块也各有对应的统计指标。',
    tooltipPosition: 'bottom-left'
  },
  {
    route: '/statistics',
    selector: '.section-trend',
    title: '统计页面 - 趋势图表',
    description: '当有数据时，每个模块下方显示趋势条形图。点击图表左侧的日期标签可缩小统计范围到对应时间段，方便逐段查看数据变化。',
    tooltipPosition: 'bottom-left'
  },

  // ==================== 工具箱 ====================
  {
    route: '/toolbox',
    selector: '.tool-card-grid',
    title: '工具箱页面 - 实用工具',
    description: '这里展示了插件系统注册的所有小工具。点击工具卡片即可打开使用，每种工具独立运行在工具页面内，点击"返回"按钮回到工具列表。'
  },
  {
    route: '/toolbox',
    selector: '.plugin-list',
    title: '工具箱页面 - 已安装插件',
    description: '这里列出了所有已安装的插件。每个插件卡片显示名称、作者、版本号和简介，右侧标注该插件提供的小工具数量。插件的工具会出现在上方的工具列表中。'
  },

  // ==================== 我的 ====================
  {
    route: '/profile',
    selector: '#section-profile',
    title: '我的页面 - 个人信息',
    description: '在这里设置昵称和生日。昵称限 20 个字符，修改后自动保存；生日通过滚动选择器选择，支持公历与农历两种模式。'
  },
  {
    route: '/profile',
    selector: '#section-security',
    title: '我的页面 - 账号安全',
    description: '在这里管理账号（修改账号、修改密码、绑定手机号），查看注册时间，以及退出登录或注销账号。注销账号将永久删除所有数据，不可恢复。'
  },
  {
    route: '/profile',
    selector: '#section-about',
    title: '我的页面 - 关于与更新',
    description: '在这里查看版本号与项目地址，以及检查更新和查看更新日志。下方"新手引导"按钮可以随时重新打开这个引导教程。'
  }
]