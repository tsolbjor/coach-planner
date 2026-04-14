import type { SportConfig } from '../types'

export const SOCCER_PRESET: SportConfig = {
  presetId: 'soccer',
  name: 'Soccer (11v11)',
  totalOnField: 11,
  benchSize: 4,
  periodCount: 2,
  periodDurationMinutes: 30,
  hasKeeper: true,
  positionTypes: [
    { id: 'gk',  label: 'Goalkeeper',       shortLabel: 'GK',  group: 'keeper',     isKeeper: true,  rotateEveryMinutes: 0 },
    { id: 'lb',  label: 'Left Back',        shortLabel: 'LB',  group: 'defender',   isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'cb',  label: 'Centre Back',      shortLabel: 'CB',  group: 'defender',   isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'rb',  label: 'Right Back',       shortLabel: 'RB',  group: 'defender',   isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'lm',  label: 'Left Mid',         shortLabel: 'LM',  group: 'midfielder', isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'cm',  label: 'Centre Mid',       shortLabel: 'CM',  group: 'midfielder', isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'rm',  label: 'Right Mid',        shortLabel: 'RM',  group: 'midfielder', isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'lw',  label: 'Left Wing',        shortLabel: 'LW',  group: 'forward',    isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'rw',  label: 'Right Wing',       shortLabel: 'RW',  group: 'forward',    isKeeper: false, rotateEveryMinutes: 0 },
    { id: 'st',  label: 'Striker',          shortLabel: 'ST',  group: 'forward',    isKeeper: false, rotateEveryMinutes: 0 },
  ],
  // Default formation: 4-3-3
  lineupSlots: [
    { slotId: 'gk',   positionTypeId: 'gk', label: 'GK'  },
    { slotId: 'lb',   positionTypeId: 'lb', label: 'LB'  },
    { slotId: 'cb_1', positionTypeId: 'cb', label: 'CB'  },
    { slotId: 'cb_2', positionTypeId: 'cb', label: 'CB'  },
    { slotId: 'rb',   positionTypeId: 'rb', label: 'RB'  },
    { slotId: 'lm',   positionTypeId: 'lm', label: 'LM'  },
    { slotId: 'cm',   positionTypeId: 'cm', label: 'CM'  },
    { slotId: 'rm',   positionTypeId: 'rm', label: 'RM'  },
    { slotId: 'lw',   positionTypeId: 'lw', label: 'LW'  },
    { slotId: 'rw',   positionTypeId: 'rw', label: 'RW'  },
    { slotId: 'st',   positionTypeId: 'st', label: 'ST'  },
  ],
}


