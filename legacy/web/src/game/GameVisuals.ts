import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Scene } from '@babylonjs/core/scene'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { attackDefinitions, type CombatState } from '../domain/combat'
import type { EnemyState } from '../domain/enemy'
import type { MovementState } from '../domain/movement'
import type { ProgressionState } from '../domain/progression'
import type { NarrativeState } from '../narrative/model'
import { floorAt, surfacesByZone, type WorldZone } from '../world/prisonLayout'
import type { PrisonFlags } from '../world/prisonProgression'
import { activeOffhand, offhandGear, weapons, type EquipmentState, type OffhandGearId } from '../world/equipment'
import { encounterIds, type Encounter, type EncounterId } from './encounters'
import { makeMaterial, type PrisonScenery } from './prisonScene'

interface VisualFrame {
  movement: MovementState
  combat: CombatState
  enemy: EnemyState
  enemyFloorY: number
  encounters: Record<EncounterId, Encounter>
  equipment: EquipmentState
  equipmentRecovered: boolean
  facing: -1 | 1
  zone: WorldZone
  flags: PrisonFlags
  loot: ReadonlySet<string>
  narrative: NarrativeState
  progression: ProgressionState
  respawnRemaining: number
  sightRemaining: number
  flurryFlashRemaining: number
  currentWeaponReach: number
}

export class GameVisuals {
  readonly spellMaterial: StandardMaterial
  private readonly soulMaterial: StandardMaterial
  private readonly soulMeshes = new Map<number, Mesh>()
  private readonly encounterMeshes: Record<EncounterId, Mesh>

  constructor(private readonly scene: Scene, private readonly scenery: PrisonScenery) {
    this.soulMaterial = makeMaterial(scene, 'soul light', new Color3(0.3, 0.7, 0.84), new Color3(0.12, 0.6, 0.8))
    this.spellMaterial = makeMaterial(scene, 'soul arrow', new Color3(0.6, 0.8, 1), new Color3(0.25, 0.55, 1))
    this.encounterMeshes = { cellGuard: scenery.cellGuard, corruptedKnight: scenery.corruptedKnight,
      upper1: scenery.upperGuards[0], upper2: scenery.upperGuards[1],
      upper3: scenery.upperGuards[2], upper4: scenery.upperGuards[3],
      inquisitor: scenery.inquisitor, warden: scenery.warden, palaceGuard: scenery.palaceGuard }
  }

  updateCameraBounds(engine: Engine): void {
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())
    this.scenery.camera.orthoTop = 5.5
    this.scenery.camera.orthoBottom = -5.5
    this.scenery.camera.orthoLeft = -5.5 * aspect
    this.scenery.camera.orthoRight = 5.5 * aspect
  }

  travel(x: number, y: number): void {
    this.scenery.camera.position.x = x
    this.scenery.camera.position.y = y + 3.1
    this.scenery.camera.setTarget(new Vector3(x, y + 2.2, 0))
  }

  reset(x: number): void {
    this.travel(x, 0)
    for (const mesh of this.soulMeshes.values()) mesh.dispose()
    this.soulMeshes.clear()
    this.scenery.player.isVisible = true
    this.scenery.enemy.isVisible = true
    this.scenery.enemyWeapon.isVisible = true
  }

  setPlayerVisible(visible: boolean): void {
    this.scenery.player.isVisible = visible
  }

  syncFragments(flags: PrisonFlags, narrative: NarrativeState,
    encounters: Record<EncounterId, Encounter>): void {
    for (const [id, mesh] of Object.entries(this.scenery.fragmentMeshes)) {
      mesh.isVisible = id === 'F03' || id === 'F07'
        ? id === 'F03' || flags.spiritPerception && !narrative.collectedFragmentIds.includes(id)
        : id === 'F10'
          ? encounters.palaceGuard.health === 0 && !narrative.collectedFragmentIds.includes(id)
          : !narrative.collectedFragmentIds.includes(id)
    }
  }

  syncWorld(flags: PrisonFlags, loot: ReadonlySet<string>): void {
    const gates = this.scenery.gateMeshes
    gates.gear.isVisible = !flags.equipmentRecovered
    gates.lockedDoor.isVisible = !flags.lockedDoorOpen
    gates.archiveReward.isVisible = !flags.archiveRewardTaken
    gates.cellKnife.isVisible = !loot.has('备用短刀')
    gates.flowerRing.isVisible = !loot.has('花木戒指')
    gates.ventShard.isVisible = false
    gates.ventWall.isVisible = !loot.has('通风管原素瓶碎片')
    gates.ledgeRing.isVisible = !loot.has('长廊高台戒指')
    for (const rung of gates.ladderRungs) rung.isVisible = flags.shortcutOpen
    const cityMaterial = gates.cityGate.material as StandardMaterial
    cityMaterial.emissiveColor = flags.exitKnowledge ? new Color3(0.34, 0.19, 0.06) : Color3.Black()
    const ladderMaterial = gates.shortcut.material as StandardMaterial
    ladderMaterial.emissiveColor = flags.shortcutOpen ? new Color3(0.1, 0.35, 0.32) : Color3.Black()
  }

  syncSouls(progression: ProgressionState): void {
    const activeIds = new Set(progression.drops.map(drop => drop.id))
    for (const [id, mesh] of this.soulMeshes) {
      if (!activeIds.has(id)) {
        mesh.dispose()
        this.soulMeshes.delete(id)
      }
    }
    for (const drop of progression.drops) {
      if (this.soulMeshes.has(drop.id)) continue
      const mesh = MeshBuilder.CreateSphere(`soul drop ${drop.id}`,
        { diameter: drop.kind === 'grave' ? 0.48 : 0.33 }, this.scene)
      mesh.position.set(drop.x, (drop.y ?? floorAt(drop.x) ?? 2.5) + 0.55, -0.3)
      mesh.material = this.soulMaterial
      this.soulMeshes.set(drop.id, mesh)
    }
  }

  private syncEquipment(frame: VisualFrame): void {
    const { equipment, movement, combat, facing } = frame
    const visible = frame.equipmentRecovered && combat.player.health > 0 && frame.respawnRemaining <= 0
    const mainMesh = this.scenery.playerWeapon
    const offhandMesh = this.scenery.playerOffhand
    mainMesh.isVisible = visible
    const offhand = activeOffhand(equipment)
    offhandMesh.isVisible = visible && offhand !== null
    if (!visible) return
    const category = weapons[equipment.mainHand].category
    const height = category === '法杖' ? 1.55 : category === '刺剑' ? 1.35
      : category === '匕首' ? 0.65 : category === '钉锤' ? 0.95
        : category === '特大剑' ? 1.8 : 1.2
    mainMesh.scaling.set(category === '法杖' || category === '刺剑' ? 0.7
      : category === '特大剑' ? 1.3 : 1, height / 1.2, 1)
    mainMesh.position.set(movement.x + facing * (equipment.twoHanded ? 0.42 : 0.62),
      movement.y + 1.05, -0.12)
    mainMesh.rotation.z = facing * (combat.attack.phase === 'active' ? -0.9 : -0.2)
    const weaponMaterial = mainMesh.material as StandardMaterial
    weaponMaterial.diffuseColor = category === '法杖'
      ? new Color3(0.35, 0.55, 0.82) : category === '木棍' ? new Color3(0.49, 0.32, 0.19)
        : category === '钉锤' ? new Color3(0.68, 0.55, 0.31) : new Color3(0.68, 0.68, 0.67)
    if (!offhand) return
    const offhandWeapon = offhand in weapons
    const isBook = !offhandWeapon && offhandGear[offhand as OffhandGearId].kind === 'scripture'
    offhandMesh.scaling.set(offhandWeapon ? 0.32 : isBook ? 0.6 : 1,
      offhandWeapon ? 1.1 : isBook ? 0.56 : 1, 1)
    offhandMesh.position.set(movement.x - facing * 0.5, movement.y + (isBook ? 0.85 : 1.02), -0.13)
    offhandMesh.rotation.z = combat.attack.kind === 'shieldBash' && combat.attack.phase !== 'idle'
      ? facing * -0.9 : offhandWeapon ? facing * 0.25 : 0
    const offhandMaterial = offhandMesh.material as StandardMaterial
    offhandMaterial.diffuseColor = isBook
      ? new Color3(0.75, 0.64, 0.42) : offhandWeapon ? new Color3(0.67, 0.67, 0.65)
        : new Color3(0.42, 0.48, 0.55)
  }

  renderFrame(frame: VisualFrame, engine: Engine, dt: number): void {
    const { movement, combat, enemy, facing } = frame
    const playerMesh = this.scenery.player
    playerMesh.position.set(movement.x, movement.y + 0.9, -0.03)
    playerMesh.scaling.x = facing
    playerMesh.rotation.z = facing === 1 ? -0.05 : 0.05
    this.syncEquipment(frame)
    const playerMaterial = playerMesh.material as StandardMaterial
    playerMaterial.emissiveColor = combat.defense.mode === 'dodge' ? new Color3(0.15, 0.65, 0.8)
      : combat.defense.mode === 'parry' ? new Color3(0.75, 0.52, 0.13)
        : combat.defense.mode === 'guard' ? new Color3(0.15, 0.3, 0.65)
          : combat.defense.mode === 'stagger' ? new Color3(0.7, 0.1, 0.1) : Color3.Black()
    this.scenery.enemy.isVisible = enemy.mode !== 'dead'
    this.scenery.enemyWeapon.isVisible = enemy.mode !== 'dead'
    this.scenery.enemy.position.set(enemy.x, frame.enemyFloorY + 0.9, -0.03)
    this.scenery.enemy.scaling.x = enemy.facing
    this.scenery.enemyWeapon.position.set(enemy.x + enemy.facing * 0.55, frame.enemyFloorY + 0.85, -0.1)
    for (const id of encounterIds) {
      const encounter = frame.encounters[id]
      const mesh = this.encounterMeshes[id]
      mesh.isVisible = encounter.health > 0
      mesh.position.set(encounter.enemy.x,
        encounter.floorY + (id === 'warden' ? 1.4 : id === 'inquisitor' ? 1.15 : 1), -0.03)
      if (id === 'cellGuard' || id.startsWith('upper')) mesh.scaling.x = encounter.enemy.facing
      const material = mesh.material as StandardMaterial
      material.emissiveColor = encounter.enemy.mode === 'windup' || encounter.enemy.mode === 'active'
        ? new Color3(0.5, 0.12, 0.08)
        : frame.sightRemaining > 0 ? new Color3(0.08, 0.48, 0.65) : Color3.Black()
    }
    const enemyMaterial = this.scenery.enemy.material as StandardMaterial
    enemyMaterial.emissiveColor = enemy.mode === 'windup' || enemy.mode === 'active'
      ? new Color3(0.55, 0.11, 0.07)
      : frame.sightRemaining > 0 ? new Color3(0.08, 0.48, 0.65) : Color3.Black()
    const altarMaterial = this.scenery.altar.material as StandardMaterial
    altarMaterial.emissiveColor = frame.progression.checkpointActive
      ? new Color3(0.4, 0.22, 0.08) : Color3.Black()
    this.syncSouls(frame.progression)
    this.syncWorld(frame.flags, frame.loot)
    const slash = this.scenery.slash
    slash.isVisible = combat.attack.phase === 'active' && combat.attack.kind !== 'shieldBash'
      || frame.flurryFlashRemaining > 0
    const attackReach = frame.currentWeaponReach * (combat.attack.kind === 'heavy'
      ? attackDefinitions.heavy.reach / attackDefinitions.light.reach : 1)
    slash.scaling.x = attackReach / attackDefinitions.light.reach
    slash.position.set(movement.x + facing * (0.35 + attackReach / 2), movement.y + 0.95, -0.05)
    const halfViewWidth = 5.5 * engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())
    const surfaces = surfacesByZone[frame.zone]
    const zoneMin = Math.min(...surfaces.map(surface => surface.minX))
    const zoneMax = Math.max(...surfaces.map(surface => surface.maxX))
    const targetX = Math.max(zoneMin + halfViewWidth, Math.min(zoneMax - halfViewWidth, movement.x))
    const targetY = Math.max(2.2, Math.min(9.5, movement.y + 2.2))
    const camera = this.scenery.camera
    camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 4)
    camera.position.y += (targetY + 0.9 - camera.position.y) * Math.min(1, dt * 4)
    camera.setTarget(new Vector3(camera.position.x, camera.position.y - 0.9, 0))
  }
}
