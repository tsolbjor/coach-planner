export type SlotEntry = {
  index: number
  slot: {
    matchIndex: number
    periodIndex: number
  }
}

export function getAdjacentEntry(
  slotEntries: SlotEntry[],
  currentEntry: SlotEntry | null,
  direction: -1 | 1,
) {
  if (!currentEntry) return null
  const currentIndex = slotEntries.findIndex((entry) => entry.index === currentEntry.index)
  if (currentIndex < 0) return null
  return slotEntries[currentIndex + direction] ?? null
}
