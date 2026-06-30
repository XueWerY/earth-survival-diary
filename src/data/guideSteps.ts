import type { GuideStep } from '../components/common/overlay/GuideOverlay.vue'

export const guideSteps: GuideStep[] = [
  // ==================== 足迹 ====================
  {
    route: '/footprint',
    selector: '.main-nav-bar',
    title: '全局导航栏',
    description: '导航栏包含所有功能模块的入口，点击图标可快速切换到相应页面。当前高亮的图标表示正在使用的模块。',
    padding: 0,
    tooltipPosition: 'right-center'
  },
  {
    route: '/footprint',
    selector: '.header-actions',
    title: '足迹页面 - 日期选择',
    description: '顶部是内联农历日期选择器，默认收起只显示当前周。日期下方的展开提示条可以展开查看整月日历。',
    padding: 0,
    tooltipPosition: 'bottom-center',
    onActivate: () => {
      const dot = document.querySelector('.expand-hint .hint-dot')
      if (dot && dot.classList.contains('collapse-dot')) {
        (dot.closest('.expand-hint') as HTMLElement)?.click()
      }
    }
  },
  {
    route: '/footprint',
    selector: '.header-actions',
    title: '足迹页面 - 完整日历',
    description: '展开后可以看到完整的农历日历，支持左右滑动切换月份。选中的日期高亮显示，点击其他日期可切换查看对应日期的足迹记录。',
    padding: 0,
    tooltipPosition: 'bottom-center',
    onActivate: () => {
      const dot = document.querySelector('.expand-hint .hint-dot')
      if (dot && !dot.classList.contains('collapse-dot')) {
        (dot.closest('.expand-hint') as HTMLElement)?.click()
      }
    }
  },
  {
    route: '/footprint',
    selector: '.inline-picker-container .header-actions-inner',
    title: '足迹页面 - 操作按钮',
    description: '"跳转日期"按钮用于快速切换到任意日期；"添加足迹"记录活动行为和用时；"添加日记"用于书写每日日记。',
    padding: 8,
    tooltipPosition: 'bottom-center'
  },
  {
    route: '/footprint',
    selector: '.footprint-content',
    title: '足迹页面 - 日记内容区',
    description: '记录的足迹会在这个区域展示。按时段（上午/下午/晚上）分组，清晰呈现一天的活动安排，支持双击快捷编辑名称和备注，以及增删改操作。'
  },

  // ==================== 笔记 ====================
  {
    route: '/notes',
    selector: '.notes-breadcrumb-bar',
    title: '笔记页面 - 分类导航',
    description: '笔记模块使用面包屑地址栏导航，点击">"可以弹出下拉列表快速切换分类。首页右侧"+"按钮可以添加自定义分类，进入分类后"+"按钮用于新建笔记。'
  },
  {
    route: '/notes',
    selector: '.card-grid',
    title: '笔记页面 - 分类卡片',
    description: '这里展示所有笔记分类卡片，点击进入查看该分类下的笔记。卡片上显示该分类下的笔记数量，自定义分类卡片右上角有编辑和删除按钮。'
  },

  // ==================== 专注 ====================
  {
    route: '/focus',
    selector: '.focus-control-buttons',
    title: '专注页面 - 模式切换',
    description: '支持番茄钟和正计时两种模式。番茄钟按固定时长倒计时，正计时自由计时。中间是星轨环视觉动画，专注完成自动生成足迹。'
  },
  {
    route: '/focus',
    selector: '.focus-input-section',
    title: '专注页面 - 输入专注事项',
    description: '在这里输入你要专注的事项名称（必填），还可以添加备注信息。下方的常用专注卡片可以快速选择之前保存的事项。'
  },
  {
    route: '/focus',
    selector: '.focus-start-wrapper',
    title: '专注页面 - 开始专注',
    description: '填写专注事项后，点击"开始专注"按钮即可开始计时。左侧"设置"按钮可以调整番茄钟时长。完成专注后会自动弹出保存常用选项。'
  },

  // ==================== 清单 ====================
  {
    route: '/list',
    selector: '.list-breadcrumb-bar',
    title: '清单页面 - 面包屑导航',
    description: '清单模块现在使用面包屑地址栏导航，点击">"可以弹出下拉列表快速切换智能清单或自定义文件夹。右侧的"+"按钮可以添加文件夹、清单、分组或任务。'
  },
  {
    route: '/list',
    selector: '.card-grid',
    title: '清单页面 - 卡片网格',
    description: '这里展示智能清单和自定义文件夹卡片。点击"智能清单"进入今天/已过期/未来七天视图，点击文件夹卡片进入清单列表，层层深入管理任务。'
  },
  {
    route: '/list',
    selector: '.list-container .main-content',
    title: '清单页面 - 内容区',
    description: '进入清单和分组后，任务卡片会在这里显示，包含任务名称、截止日期、优先级等信息。还可以将任务拆解为可勾选的检查事项。'
  },

  // ==================== 倒数日 ====================
  {
    route: '/countdown',
    selector: '.countdown-breadcrumb-bar',
    title: '倒数日页面 - 分类筛选',
    description: '通过面包屑导航切换分类，点击">"下拉选择分类。支持生日、纪念日、节日、旅行等多种分类，系统会自动生成重要节日倒数日。右侧"+"按钮可添加分类或倒数日。'
  },
  {
    route: '/countdown',
    selector: '.card-grid',
    title: '倒数日页面 - 分类卡片',
    description: '这里展示所有分类卡片，点击进入查看该分类下的倒数日事件。卡片上显示该分类下的倒数日数量，自定义分类卡片右上角有编辑和删除按钮。'
  },

  // ==================== 课程表 ====================
  {
    route: '/course',
    selector: '.week-area',
    title: '课程表页面 - 教学周切换',
    description: '通过左右箭头切换教学周，中间显示当前周次和日期范围。你可以在"我的"页面中配置学期开学日期、周数和节次安排。'
  },
  {
    route: '/course',
    selector: '.course-grid-wrapper',
    title: '课程表页面 - 课程网格',
    description: '课程以网格形式按星期和节次排列。左侧显示节次名称和时间，点击空白格子可以添加课程，已添加的课程显示课程名称、地点和教师信息。'
  },

  // ==================== 统计 ====================
  {
    route: '/statistics',
    selector: '.date-range-bar',
    title: '统计页面 - 数据总览',
    description: '在这里查看足迹和专注的统计数据。上方可以设置统计的日期范围，点击"重置"恢复默认。下方按模块展示统计数据和趋势图。'
  },

  // ==================== 工具箱 ====================
  {
    route: '/toolbox',
    selector: '.tool-card-grid',
    title: '工具箱页面 - 实用工具',
    description: '这里汇集了社区开发者提供的小工具，如导出数据、导入数据、清理数据等。点击工具卡片即可打开使用。下方还可以看到已安装的插件列表。'
  },

  // ==================== 我的 ====================
  {
    route: '/profile',
    selector: '#section-profile',
    title: '我的页面 - 个人信息与设置',
    description: '在这里管理个人信息（昵称、生日）、账号安全（修改账号/密码、手机号绑定），以及系统设置（桌面端的开机自启和关闭行为）。'
  },
  {
    route: '/profile',
    selector: '#section-about',
    title: '我的页面 - 关于与更新',
    description: '在这里查看版本号、项目地址，以及检查更新和查看更新日志。下方还有"新手引导"按钮，可以随时重新查看这个教程。'
  }
]