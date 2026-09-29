import { describe, expect, it } from 'vitest'
import { floorAt, prisonRooms, prisonSurfaces, roomAt, surfacesByZone } from './prisonLayout'

describe('prison greybox layout', () => {
  it('follows the GDD main route from cells through the archive and knight hall', () => {
    expect(prisonRooms.slice(0, 9).map(room => room.id)).toEqual([
      'Cell', 'PrisonCorridor', 'Sewer', 'Vent', 'MiddleCorridor', 'Archive', 'KnightCorridor', 'MainHall', 'InquisitorRoom',
    ])
    for (let index = 1; index < 9; index += 1) {
      expect(prisonRooms[index - 1].maxX).toBe(prisonRooms[index].minX)
    }
    expect(prisonSurfaces[0].y).toBe(0)
    expect(floorAt(-65)).toBe(-1.5)
    expect(floorAt(-47)).toBe(1.5)
    expect(floorAt(16)).toBe(2.5)
    expect(roomAt(-17).id).toBe('Archive')
    expect(roomAt(36).id).toBe('InquisitorRoom')
    expect(roomAt(-30, 7).id).toBe('SecondFloor')
    expect(roomAt(72, 2.5, 'city').id).toBe('PalaceFoyer')
    expect(surfacesByZone.prison.some(surface => surface.id === 'second-floor' && surface.oneWay)).toBe(true)
  })
})
