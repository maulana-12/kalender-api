export const HOLIDAY_TYPES = ['holiday', 'leave', 'observance'] as const

export type HolidayType = (typeof HOLIDAY_TYPES)[number]

export type Holiday = {
  date: string
  name: string
  type: HolidayType
  is_holiday: boolean
  is_joint_holiday: boolean
}

export type YearMeta = {
  year: number
  count: number
  source: string
  published: string
  last_updated: string
}

export type YearResponse = {
  success: true
  data: Holiday[]
  meta: YearMeta
}
