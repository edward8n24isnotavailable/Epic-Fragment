// One-time migration: preserve the prototype's authored data without retyping it.
import { registerHooks } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !path.extname(specifier)) specifier += '.ts'
  return next(specifier, context)
} })
const source = Object.assign({}, ...await Promise.all([
  'world/prisonLayout', 'world/weaponCatalog', 'world/originLoadouts',
  'narrative/demoData', 'game/encounters', 'game/enemyProfiles', 'domain/enemy',
].map(file => import(pathToFileURL(path.resolve('src', file + '.ts'))))))
const encounters = source.initialEncounters()
encounters.soldier = { enemy: source.initialEnemy(-31, 50), health: 80, maxHealth: 80,
  floorY: 2.5, minX: -34, maxX: -28, souls: 50, name: '灰烬士兵' }
const profiles = {}
for (const id of Object.keys(encounters)) {
  profiles[id] = { normal: source.profileForEncounter(id, encounters[id].maxHealth),
    phase2: source.profileForEncounter(id, 1) }
}
await mkdir('data', { recursive: true })
await writeFile('data/game_data.json', JSON.stringify({
  rooms: source.prisonRooms, surfaces: source.surfacesByZone, locations: source.prisonLocations,
  fragments: source.demoFragments, timeNodes: source.demoTimeNodes,
  weapons: source.weapons, offhands: source.offhandGear, scaling: source.scalingCoefficients,
  origins: source.originLoadouts, attributes: source.originAttributes, encounters, profiles,
}, null, 2) + '\n')
console.log('Migrated rooms, surfaces, 13 fragments, 27 weapons, 10 offhands, 5 origins and 10 encounters.')
