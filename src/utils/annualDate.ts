import dayjs from 'dayjs'
import { Lunar, LunarMonth, Solar } from 'lunar-javascript'

export type AnnualCalendar = 'solar' | 'lunar'

export interface LunarDateParts {
  month: number
  day: number
}

const formatSolarDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export function solarDateToLunarParts(solarDate: string): LunarDateParts | null {
  const date = dayjs(solarDate)
  if (!date.isValid()) return null
  try {
    const lunar = Solar.fromYmd(date.year(), date.month() + 1, date.date()).getLunar()
    return { month: lunar.getMonth(), day: lunar.getDay() }
  } catch {
    return null
  }
}

/**
 * 返回公历或农历的下一个年度日期。若锚点尚未经过，保留锚点年份；
 * 若已经过，则从当前年份起寻找下一次出现日期。
 */
export function getNextAnnualDate(
  anchorDate: string,
  calendar: AnnualCalendar = 'solar',
  lunarMonth?: number,
  lunarDay?: number,
  fromDate: string = dayjs().format('YYYY-MM-DD')
): string {
  const anchor = dayjs(anchorDate)
  const from = dayjs(fromDate).startOf('day')
  if (!anchor.isValid() || !from.isValid()) return anchorDate
  if (!anchor.isBefore(from, 'day')) return anchor.format('YYYY-MM-DD')

  const solarParts = solarDateToLunarParts(anchorDate)
  const month = calendar === 'lunar' ? lunarMonth || solarParts?.month : anchor.month() + 1
  const day = calendar === 'lunar' ? lunarDay || solarParts?.day : anchor.date()
  if (!month || !day || Math.abs(month) > 12 || day < 1) return anchor.format('YYYY-MM-DD')

  let firstYear = from.year()
  if (calendar === 'lunar') {
    try {
      firstYear = Solar.fromYmd(from.year(), from.month() + 1, from.date()).getLunar().getYear()
    } catch {
      // 日期转换失败时仍用公历年份继续尝试。
    }
  }

  for (let year = firstYear; year <= firstYear + 3; year++) {
    try {
      if (calendar === 'lunar') {
        const lunarMonths = month < 0 ? [month, Math.abs(month)] : [month]
        for (const lunarMonth of lunarMonths) {
          try {
      const maxDay = LunarMonth.fromYm(year, lunarMonth).getDayCount()
            const solar = Lunar.fromYmd(year, lunarMonth, Math.min(day, maxDay)).getSolar()
            const candidate = dayjs(formatSolarDate(solar.getYear(), solar.getMonth(), solar.getDay()))
            if (candidate.isValid() && !candidate.isBefore(from, 'day')) return candidate.format('YYYY-MM-DD')
          } catch {
            // 闰月并非每年都有；没有对应闰月时按同月的普通农历日期重复。
            continue
          }
        }
      } else {
        const maxDay = new Date(year, month, 0).getDate()
        const candidate = dayjs(formatSolarDate(year, month, Math.min(day, maxDay)))
        if (!candidate.isBefore(from, 'day')) return candidate.format('YYYY-MM-DD')
      }
    } catch {
      continue
    }
  }

  return anchor.format('YYYY-MM-DD')
}
