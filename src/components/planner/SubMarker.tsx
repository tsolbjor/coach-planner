import type { TimeSlot } from '../../types'

export function computeSubDiff(prev: TimeSlot, next: TimeSlot) {
  const prevField = new Set(Object.values(prev.assignments).filter(Boolean) as string[])
  const nextField = new Set(Object.values(next.assignments).filter(Boolean) as string[])
  return {
    comingOn: [...nextField].filter((id) => !prevField.has(id)),
    goingOff: [...prevField].filter((id) => !nextField.has(id)),
  }
}


