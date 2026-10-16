const COUNTDOWN_CATEGORY_LABELS: Record<string, string> = {
  birthday: '生日',
  anniversary: '纪念日',
  holiday: '节日',
  travel: '旅行',
  entertainment: '娱乐',
  work: '工作',
  study: '学习',
  life: '生活'
}

const customCountdownCategoryLabels = new Map<string, string>()

export const registerCountdownCategoryLabels = (categories: unknown) => {
  customCountdownCategoryLabels.clear()
  if (!Array.isArray(categories)) return

  for (const category of categories) {
    if (!category || typeof category !== 'object') continue
    const { value, label } = category as { value?: unknown; label?: unknown }
    if (typeof value === 'string' && typeof label === 'string' && value && label.trim()) {
      customCountdownCategoryLabels.set(value, label.trim())
    }
  }
}

export const getCountdownCategoryLabel = (value: string) =>
  COUNTDOWN_CATEGORY_LABELS[value] || customCountdownCategoryLabels.get(value)
