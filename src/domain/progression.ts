export interface SoulDrop {
  id: number
  x: number
  y?: number
  amount: number
  kind: 'enemy' | 'grave'
}

export interface ProgressionState {
  souls: number
  drops: SoulDrop[]
  nextDropId: number
  checkpointX: number
  checkpointActive: boolean
  deaths: number
}

export function initialProgression(): ProgressionState {
  return {
    souls: 0,
    drops: [],
    nextDropId: 1,
    checkpointX: -5,
    checkpointActive: false,
    deaths: 0,
  }
}

export function activateCheckpoint(state: ProgressionState, playerX: number, altarX: number): ProgressionState {
  if (Math.abs(playerX - altarX) > 1.2) return state
  return { ...state, checkpointX: altarX, checkpointActive: true }
}

export function dropEnemySouls(state: ProgressionState, x: number, amount: number, y?: number): ProgressionState {
  return {
    ...state,
    drops: [...state.drops, { id: state.nextDropId, x, y, amount, kind: 'enemy' }],
    nextDropId: state.nextDropId + 1,
  }
}

export function collectSouls(state: ProgressionState, playerX: number, playerY?: number): ProgressionState {
  const nearby = state.drops.filter(drop => Math.abs(drop.x - playerX) <= 0.8
    && (drop.y === undefined || playerY === undefined || Math.abs(drop.y - playerY) <= 1.3))
  if (nearby.length === 0) return state
  const amount = nearby.reduce((sum, drop) => sum + drop.amount, 0)
  const collectedIds = new Set(nearby.map(drop => drop.id))
  return {
    ...state,
    souls: state.souls + amount,
    drops: state.drops.filter(drop => !collectedIds.has(drop.id)),
  }
}

export function loseSoulsOnDeath(state: ProgressionState, playerX: number, playerY?: number): ProgressionState {
  const drops = state.drops.filter(drop => drop.kind !== 'grave')
  if (state.souls > 0) {
    drops.push({ id: state.nextDropId, x: playerX, y: playerY, amount: state.souls, kind: 'grave' })
  }
  return {
    ...state,
    souls: 0,
    drops,
    nextDropId: state.nextDropId + (state.souls > 0 ? 1 : 0),
    deaths: state.deaths + 1,
  }
}
