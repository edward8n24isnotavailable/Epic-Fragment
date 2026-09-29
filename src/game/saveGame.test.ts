import { describe, expect, it } from 'vitest'
import { initialProgression } from '../domain/progression'
import { demoTimeNodes } from '../narrative/demoData'
import { initialNarrative } from '../narrative/state'
import { initialEquipment } from '../world/equipment'
import { initialPrisonFlags } from '../world/prisonProgression'
import { clearGameSave, readGameSave, SAVE_KEY, writeGameSave, type GameSaveData, type SaveStorage } from './saveGame'

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>()
  return { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) } }
}

function validSave(): GameSaveData {
  return { version: 1, savedAt: 1, origin: 'knight', equipment: initialEquipment('knight'),
    flags: initialPrisonFlags(), loot: ['备用短刀'], acquiredWeapons: ['dagger'], acquiredOffhands: [],
    progression: { ...initialProgression(), checkpointActive: true, checkpointX: 20, souls: 250 },
    narrative: initialNarrative(demoTimeNodes), discoveredRooms: ['Cell', 'Hall'],
    defeatedEncounters: ['corruptedKnight'], maxFlasks: 4 }
}

describe('altar save', () => {
  it('round trips progression, gear, collected items and defeated enemies', () => {
    const storage = memoryStorage()
    const save = validSave()
    expect(writeGameSave(storage, save)).toBe(true)
    expect(readGameSave(storage)).toEqual(save)
    expect(clearGameSave(storage)).toBe(true)
    expect(readGameSave(storage)).toBeNull()
  })

  it('ignores damaged or incompatible save data', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, '{bad json')
    expect(readGameSave(storage)).toBeNull()
    storage.setItem(SAVE_KEY, JSON.stringify({ ...validSave(), version: 2 }))
    expect(readGameSave(storage)).toBeNull()
    storage.setItem(SAVE_KEY, JSON.stringify({ ...validSave(), maxFlasks: -1 }))
    expect(readGameSave(storage)).toBeNull()
  })

  it('handles unavailable browser storage without crashing', () => {
    const storage: SaveStorage = { getItem: () => { throw Error('blocked') },
      setItem: () => { throw Error('blocked') }, removeItem: () => { throw Error('blocked') } }
    expect(readGameSave(storage)).toBeNull()
    expect(writeGameSave(storage, validSave())).toBe(false)
    expect(clearGameSave(storage)).toBe(false)
  })
})
