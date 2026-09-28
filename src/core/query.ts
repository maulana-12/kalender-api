import type { Holiday } from './types.ts'

export function availableYears(counts: ReadonlyMap<number, number>): number[] {
  return [...counts.keys()].sort((a, b) => a - b)
}

export function filterByMonth(holidays: Holiday[], month: number): Holiday[] {
  return holidays.filter((holiday) => Number(holiday.date.slice(5, 7)) === month)
}

export function isDayOff(holiday: Holiday): boolean {
  return holiday.is_holiday || holiday.is_joint_holiday
}

export function countByType(holidays: Holiday[]): Record<Holiday['type'], number> {
  const totals: Record<Holiday['type'], number> = { holiday: 0, leave: 0, observance: 0 }
  for (const holiday of holidays) totals[holiday.type] += 1
  return totals
}

export function upcoming(
  holidays: Holiday[],
  from: string,
  limit: number,
): Holiday[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`limit harus bilangan bulat >= 1, dapat "${limit}"`)
  }
  return holidays.filter((holiday) => holiday.date >= from).slice(0, limit)
}
