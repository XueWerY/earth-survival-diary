import type { GuideStep } from '../components/common/overlay/GuideOverlay.vue'
import { useListStore } from '../stores/listStore'
import { useNoteStore } from '../stores/noteStore'
import { usePageNav } from '../composables/usePageNav'

const showAllNotes = () => usePageNav().setNavPath(['notes', 'all'])

const showGuideNote = () => {
  const noteStore = useNoteStore()
  const note = noteStore.notes.find(item => item.id === 'guide-note' && !item.trashedAt)
    || noteStore.notes.find(item => !item.trashedAt)
  usePageNav().setNavPath(note ? ['notes', 'all', note.id] : ['notes', 'all'])
}

export const guideSteps: GuideStep[] = [
  // ==================== 全局导航栏 ====================
  {
    route: '/footprint',
    selector: '.main-nav-bar',
    title: '全局导航栏 · 模块入口',
    description: '左侧导航栏集中显示足迹、笔记、清单、倒数日、课程表、统计、工具箱和个人页面入口。足迹页中的“专注”按钮可打开专注计时面板。',
    padding: 0,
    tooltipPosition: 'right-center'
  },
  {
    route: '/footprint',
    selector: '.nav-item.active',
    title: '全局导航栏 · 当前模块',
    description: '当前所在模块会在导航栏中高亮显示。选择其他模块即可切换页面，当前页面状态会随模块保留。',
    padding: 0,
    tooltipPosition: 'right-center'
  },
  {
    route: '/footprint',
    selector: '.date-nav-area',
    title: '足迹页面 - 日期选择',
    description: '点击左右箭头可切换前一天和后一天，中间显示公历日期与农历信息。点击日期标题可弹出日期选择器，快速跳转到任意日期。',
    padding: 0,
    tooltipPosition: 'bottom-left'
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
    description: '活动卡片展示名称、起止时间、时长和备注；右上角可星标、编辑或删除记录。',
    fallbackSelector: '.footprint-content',
    fallbackTitle: '足迹页面 - 记录区域',
    fallbackDescription: '当前日期没有活动记录。新增记录后会显示在这里，并可从卡片编辑或星标。',
    tooltipPosition: 'bottom-left'
  },
  {
    route: '/footprint',
    selector: '.diary-card',
    title: '足迹页面 - 日记卡片',
    description: '日记卡片展示标题、创建时间、正文和备注；右上角可星标、编辑或删除日记。',
    fallbackSelector: '.footprint-content',
    fallbackTitle: '足迹页面 - 日记区域',
    fallbackDescription: '当前日期没有日记。新增日记后会显示在这里，并可从卡片查看、编辑或星标。',
    tooltipPosition: 'bottom-left'
  },

  // ==================== 笔记 ====================
  {
    route: '/notes',
    selector: '.notes-page',
    title: '笔记页面 - 总览',
    description: '笔记页面分为三栏：左侧切换视图与标签，中间搜索和浏览笔记，右侧查看或编辑当前笔记。',
    tooltipPosition: 'fixed-bottom-right',
    onActivate: showAllNotes
  },
  {
    route: '/notes',
    selector: '.np-nav',
    title: '笔记页面 - 侧边导航',
    description: '侧边导航可切换全部笔记、收藏和回收站；标签树支持按标签筛选笔记。',
    onActivate: showAllNotes
  },
  {
    route: '/notes',
    selector: '.np-list',
    title: '笔记页面 - 搜索与列表',
    description: '列表顶部可按标题、正文或标签搜索；每条笔记显示摘要、标签和更新时间。',
    onActivate: showAllNotes
  },
  {
    route: '/notes',
    selector: '.np-list-head',
    title: '笔记页面 - 新建笔记',
    description: '点击“+”可创建笔记，顶部搜索框支持检索标题、正文和标签。',
    fallbackSelector: '.np-list',
    fallbackTitle: '笔记页面 - 新建笔记',
    fallbackDescription: '当前列表区域暂未显示新建控件；切换到“全部笔记”等常规视图即可创建笔记。',
    onActivate: showAllNotes
  },
  {
    route: '/notes',
    selector: '.np-item',
    title: '笔记页面 - 笔记条目',
    description: '选择条目会在右侧打开笔记。普通视图下可从条目操作收藏或删除，回收站中则可恢复或彻底删除。',
    fallbackSelector: '.np-list-scroll',
    fallbackTitle: '笔记页面 - 笔记列表',
    fallbackDescription: '当前视图没有笔记条目。创建笔记后会显示在这里。',
    onActivate: showAllNotes
  },
  {
    route: '/notes',
    selector: '.np-editor',
    title: '笔记页面 - 编辑区域',
    description: '选中笔记后，右侧编辑区提供 Markdown 编辑、标题和标签管理，并自动保存内容。',
    tooltipPosition: 'center',
    onActivate: showGuideNote
  },
  {
    route: '/notes',
    selector: '.editor-status-bar',
    title: '笔记页面 - 状态栏与操作',
    description: '底部状态栏显示字数、创建时间和更新时间，并提供大纲、反向链接、导出、源码与收藏操作。',
    tooltipPosition: 'top-center',
    fallbackSelector: '.np-editor',
    fallbackTitle: '笔记页面 - 编辑操作',
    fallbackDescription: '先选择或新建一篇笔记，状态栏会显示字数、时间信息和编辑操作。',
    onActivate: showGuideNote
  },

  // ==================== 足迹中的专注 ====================
  {
    route: '/footprint',
    selector: '.focus-btn',
    title: '足迹页面 - 专注入口',
    description: '点击“专注”会打开原专注页面的计时面板。专注完成后会在足迹中留下记录。'
  },

  // ==================== 清单 ====================
  {
    route: '/list',
    selector: '.list-breadcrumb-bar',
    title: '清单页面 - 面包屑导航',
    description: '面包屑地址栏显示当前层级，点击“>”可快速切换智能清单或自定义文件夹。右侧提供快速访问和添加操作；进入子页面后还可收藏当前视图。'
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
    title: '清单页面 - 自定义清单',
    description: '打开自定义文件夹后，这里会显示其中的清单卡片。选择清单后可继续管理分组和任务。',
    fallbackSelector: '.main-content',
    fallbackTitle: '清单页面 - 自定义文件夹',
    fallbackDescription: '当前没有自定义文件夹。可通过右上角添加按钮创建文件夹，再在其中新建清单。',
    onActivate: () => {
      const store = useListStore()
      const folder = store.folders.find(f => f.type === 'custom')
      usePageNav().setNavPath(folder ? ['list', 'custom', folder.id] : ['list', 'custom'])
    }
  },
  {
    route: '/list',
    selector: '.card-grid',
    title: '清单页面 - 分组管理',
    description: '进入清单后，这里展示该清单下的分组。选择分组即可查看和管理其中的任务。',
    fallbackSelector: '.main-content',
    fallbackTitle: '清单页面 - 清单与分组',
    fallbackDescription: '当前文件夹中没有清单卡片。可使用添加按钮创建清单；打开清单后可管理分组。',
    onActivate: () => {
      const store = useListStore()
      const folder = store.folders.find(f => f.type === 'custom')
      const listId = folder?.listIds.find(id => store.taskLists.some(list => list.id === id))
      usePageNav().setNavPath(folder && listId
        ? ['list', 'custom', folder.id, listId]
        : folder ? ['list', 'custom', folder.id] : ['list', 'custom'])
    }
  },
  {
    route: '/list',
    selector: '.list-list',
    title: '清单页面 - 任务卡片',
    description: '进入分组后，该分组下的任务卡片会在此展示。任务可设置截止日期、优先级、检查事项、重复策略和提醒时间。',
    fallbackSelector: '.main-content',
    fallbackTitle: '清单页面 - 任务',
    fallbackDescription: '当前路径下暂无可展示的任务卡片。创建并进入一个分组后，可在这里查看任务并设置日期、优先级、重复和提醒。',
    onActivate: () => {
      const store = useListStore()
      const folder = store.folders.find(f => f.type === 'custom')
      const listId = folder?.listIds.find(id => store.taskLists.some(list => list.id === id))
      const list = store.taskLists.find(item => item.id === listId)
      const group = list?.groups[0]
      usePageNav().setNavPath(folder && list && group
        ? ['list', 'custom', folder.id, list.id, group.id]
        : folder && list
          ? ['list', 'custom', folder.id, list.id]
          : folder ? ['list', 'custom', folder.id] : ['list', 'custom'])
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
    fallbackSelector: '.content-wrapper',
    fallbackTitle: '倒数日页面 - 事件区域',
    fallbackDescription: '当前没有倒数日事件，因此分区尚未显示。添加事件后会按时间和星标状态归类。',
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
    fallbackSelector: '.content-wrapper',
    fallbackTitle: '倒数日页面 - 事件卡片',
    fallbackDescription: '当前分类没有倒数日卡片。添加事件后，卡片会显示目标日期、剩余天数、重复方式和提醒状态。',
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
    fallbackSelector: '.course-container',
    fallbackTitle: '课程表页面 - 教学周',
    fallbackDescription: '当前显示课程列表视图。返回课程表视图后，可以在顶部切换教学周。',
    tooltipPosition: 'bottom-center'
  },
  {
    route: '/course',
    selector: '.corner-actions',
    title: '课程表页面 - 设置与视图切换',
    description: '齿轮按钮打开课程表设置，可配置学期日期、节次安排、课间休息等。右侧按钮可在课程网格视图和课程列表视图之间切换。',
    fallbackSelector: '.course-container',
    fallbackTitle: '课程表页面 - 设置与视图',
    fallbackDescription: '当前显示课程列表视图。返回课程表视图后，可使用设置和视图切换按钮。',
    tooltipPosition: 'bottom-left'
  },
  {
    route: '/course',
    selector: '.course-grid-wrapper',
    title: '课程表页面 - 课程网格',
    description: '课程以网格形式按星期和节次排列。左侧显示节次名称和时间，点击空白格子可以添加课程，已添加的课程显示课程名称，点击课程可查看详情。',
    fallbackSelector: '.course-container',
    fallbackTitle: '课程表页面 - 课程网格',
    fallbackDescription: '当前显示课程列表视图。切回课程表视图后，可在课程网格中查看或添加课程。',
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
    description: '每个模块区域展示关键数据指标。足迹显示日记数、记录数、总时长、日均日记和日均记录；清单、倒数日、课程表也各有对应指标。',
    tooltipPosition: 'bottom-left'
  },
  {
    route: '/statistics',
    selector: '.section-trend',
    title: '统计页面 - 趋势图表',
    description: '当有数据时，每个模块下方显示趋势条形图。点击图表左侧的日期标签可缩小统计范围到对应时间段，方便逐段查看数据变化。',
    fallbackSelector: '.module-sections',
    fallbackTitle: '统计页面 - 趋势图表',
    fallbackDescription: '当前日期范围还没有趋势数据。产生足迹或任务数据后，趋势图会显示在对应模块下方。',
    tooltipPosition: 'bottom-left'
  },

  // ==================== 工具箱 ====================
  {
    route: '/toolbox',
    selector: '.tool-card-grid',
    title: '工具箱页面 - 实用工具',
    description: '这里展示插件提供的小工具。打开工具后可使用页面顶部的返回按钮回到工具列表。',
    fallbackSelector: '.toolbox-page',
    fallbackTitle: '工具箱页面 - 实用工具',
    fallbackDescription: '当前没有可显示的工具卡片。安装插件后，其工具会出现在此区域。'
  },
  {
    route: '/toolbox',
    selector: '.plugin-list',
    title: '工具箱页面 - 已安装插件',
    description: '这里列出已安装插件的名称、作者、版本、简介和工具数量；插件工具会显示在上方。',
    fallbackSelector: '.toolbox-page',
    fallbackTitle: '工具箱页面 - 已安装插件',
    fallbackDescription: '当前还没有已安装插件。安装插件后，这里会显示名称、作者、版本和工具数量。'
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
