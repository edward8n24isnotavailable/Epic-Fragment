export type PrisonRoomId =
  | 'Cell' | 'PrisonCorridor' | 'Sewer' | 'Vent' | 'MiddleCorridor' | 'Archive'
  | 'KnightCorridor' | 'MainHall' | 'InquisitorRoom' | 'SecondFloor'
  | 'CityStreet' | 'PalaceFoyer' | 'Armory' | 'DetentionArchive'

export type WorldZone = 'prison' | 'city' | 'armory' | 'detention'

export interface WalkSurface {
  id: string
  minX: number
  maxX: number
  y: number
  oneWay?: boolean
}

export interface PrisonRoom {
  id: PrisonRoomId
  label: string
  minX: number
  maxX: number
  floorY: number
  accent: 'blue' | 'amber' | 'red'
}

// Chapter 12.1 main route, with a physical upper floor and small transition
// greyboxes so F10 and the prison return route can be exercised.
export const prisonRooms: readonly PrisonRoom[] = [
  { id: 'Cell', label: '牢房', minX: -85, maxX: -79, floorY: 0, accent: 'blue' },
  { id: 'PrisonCorridor', label: '监狱走廊', minX: -79, maxX: -73, floorY: 0, accent: 'blue' },
  { id: 'Sewer', label: '下水道', minX: -73, maxX: -57, floorY: -1.5, accent: 'blue' },
  { id: 'Vent', label: '通风管／监狱上层通道', minX: -57, maxX: -41, floorY: -0.5, accent: 'blue' },
  { id: 'MiddleCorridor', label: '中层走廊', minX: -41, maxX: -21, floorY: 2.5, accent: 'amber' },
  { id: 'Archive', label: '档案室岔路', minX: -21, maxX: -13, floorY: 2.5, accent: 'amber' },
  { id: 'KnightCorridor', label: '腐化骑士长廊', minX: -13, maxX: 3, floorY: 2.5, accent: 'red' },
  { id: 'MainHall', label: '监狱大厅', minX: 3, maxX: 27, floorY: 2.5, accent: 'amber' },
  { id: 'InquisitorRoom', label: '责难官房', minX: 27, maxX: 44, floorY: 2.5, accent: 'red' },
  { id: 'SecondFloor', label: '监狱二楼', minX: -42, maxX: 18, floorY: 7, accent: 'red' },
  { id: 'CityStreet', label: '王城街道入口', minX: 50, maxX: 63, floorY: 2.5, accent: 'amber' },
  { id: 'PalaceFoyer', label: '皇宫前厅占位', minX: 63, maxX: 80, floorY: 2.5, accent: 'red' },
  { id: 'Armory', label: '军械库外廊', minX: 90, maxX: 105, floorY: 2.5, accent: 'blue' },
  { id: 'DetentionArchive', label: '拘押档案夹层', minX: 110, maxX: 119, floorY: 2.5, accent: 'amber' },
]

export const prisonSurfaces: readonly WalkSurface[] = [
  { id: 'cell', minX: -85, maxX: -73, y: 0 },
  { id: 'sewer', minX: -73, maxX: -57, y: -1.5 },
  { id: 'vent-step-1', minX: -57, maxX: -53, y: -0.5 },
  { id: 'vent-step-2', minX: -53, maxX: -49, y: 0.5 },
  { id: 'vent-step-3', minX: -49, maxX: -45, y: 1.5 },
  { id: 'vent-step-4', minX: -45, maxX: -41, y: 2.5 },
  { id: 'middle-corridor', minX: -41, maxX: -21, y: 2.5 },
  { id: 'archive', minX: -21, maxX: -13, y: 2.5 },
  { id: 'knight-corridor', minX: -13, maxX: 3, y: 2.5 },
  { id: 'knight-high-ledge', minX: -9.5, maxX: -6.5, y: 6.2, oneWay: true },
  { id: 'hall', minX: 3, maxX: 27, y: 2.5 },
  { id: 'inquisitor', minX: 27, maxX: 44, y: 2.5 },
  { id: 'hall-upper-ledge', minX: 18, maxX: 26, y: 6.1, oneWay: true },
  { id: 'second-floor', minX: -42, maxX: 18, y: 7, oneWay: true },
]

export const citySurfaces: readonly WalkSurface[] = [
  { id: 'city-street', minX: 50, maxX: 63, y: 2.5 },
  { id: 'palace-foyer', minX: 63, maxX: 80, y: 2.5 },
]
export const armorySurfaces: readonly WalkSurface[] = [{ id: 'armory', minX: 90, maxX: 105, y: 2.5 }]
export const detentionSurfaces: readonly WalkSurface[] = [{ id: 'detention', minX: 110, maxX: 119, y: 2.5 }]

export const surfacesByZone: Record<WorldZone, readonly WalkSurface[]> = {
  prison: prisonSurfaces, city: citySurfaces, armory: armorySurfaces, detention: detentionSurfaces,
}

export const prisonLocations = {
  spawnX: -81,
  archiveX: -17,
  soldierX: -31,
  altarX: 16,
  inquisitorX: 36,
  equipmentX: -77.5,
  exitX: 9,
  noticeboardX: 5.5,
  armoryStairX: 21.5,
  upperGateX: 23.7,
  shortcutX: -30,
  wardenX: -38,
  lockX: 42.5,
  cityReturnX: 52,
  palaceGuardX: 72,
  palaceEvidenceX: 75,
  armoryReturnX: 92,
  detentionX: 114,
} as const

export const prisonFragmentPickups = [
  { fragmentId: 'F01', x: prisonLocations.archiveX, y: 2.5, radius: 1.1, trigger: 'interact' },
  { fragmentId: 'F03', x: prisonLocations.altarX, y: 2.5, radius: 1.2, trigger: 'proximity' },
] as const

export function roomAt(x: number, y = 0, zone: WorldZone = 'prison'): PrisonRoom {
  if (zone === 'prison') {
    if (y >= 6.7 && x < 18 && x >= -42) return prisonRooms.find(room => room.id === 'SecondFloor')!
    return prisonRooms.slice(0, 9).find(room => x >= room.minX && x < room.maxX)
      ?? (x < prisonRooms[0].minX ? prisonRooms[0] : prisonRooms[8])
  }
  const ids = zone === 'city' ? ['CityStreet', 'PalaceFoyer']
    : zone === 'armory' ? ['Armory'] : ['DetentionArchive']
  return prisonRooms.find(room => ids.includes(room.id) && x >= room.minX && x < room.maxX)
    ?? prisonRooms.find(room => room.id === ids[ids.length - 1])!
}

export function floorAt(x: number): number | null {
  const surface = prisonSurfaces.find(item => x >= item.minX && x <= item.maxX)
  return surface?.y ?? null
}
