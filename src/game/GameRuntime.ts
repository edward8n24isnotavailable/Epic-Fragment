import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Engine } from '@babylonjs/core/Engines/engine'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'
import { Scene } from '@babylonjs/core/scene'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import HavokPhysics from '@babylonjs/havok'
import { createPrisonScenery, makeMaterial } from './prisonScene'
import { demoFragments, demoTimeNodes } from '../narrative/demoData'
import { collectFragment, initialNarrative, selectFragment } from '../narrative/state'
import type { NarrativeState } from '../narrative/model'
import { buildTimelineView, type TimelineView } from '../narrative/view'
import { attackDefinition, boxesOverlap, damagePlayer, initialCombat, stepCombat, type CombatState } from '../domain/combat'
import { applyEnemyHit, enemyDefinition, initialEnemy, stepEnemy, type EnemyState } from '../domain/enemy'
import { initialMovement, stepMovement, type MovementState } from '../domain/movement'
import {
  activateCheckpoint,
  collectSouls,
  dropEnemySouls,
  initialProgression,
  loseSoulsOnDeath,
  type ProgressionState,
} from '../domain/progression'
import { floorAt, prisonFragmentPickups, prisonLocations, roomAt, surfacesByZone, type WorldZone } from '../world/prisonLayout'
import { confirmChronicle, initialPrisonFlags, type PrisonFlags } from '../world/prisonProgression'
import { originLoadouts, type OriginId } from '../world/originLoadouts'

export interface GameSnapshot {
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
  enemyHealth: number
  enemyMaxHealth: number
  attackPhase: string
  grounded: boolean
  souls: number
  checkpointActive: boolean
  dead: boolean
  message: string
  room: string
  discoveredRooms: number
  fragments: number
  timelineOpen: boolean
  timelineUnlocked: boolean
  timeline: TimelineView
  equipmentRecovered: boolean
  exitKnowledge: boolean
  spiritPerception: boolean
  doubleJump: boolean
  shortcutOpen: boolean
  wardenKey: boolean
  lockedDoorOpen: boolean
  nearAltar: boolean
  enemyName: string
  totalRooms: number
  origin: OriginId
  originLevel: number
  equipmentSummary: string
  loot: string[]
  prompt: string | null
}

type SnapshotListener = (snapshot: GameSnapshot) => void

const ENEMY_SPAWN_X = prisonLocations.soldierX
const ENEMY_FLOOR_Y = floorAt(ENEMY_SPAWN_X) ?? 0
const ALTAR_X = prisonLocations.altarX
const encounterIds = ['cellGuard', 'corruptedKnight', 'upper1', 'upper2', 'upper3', 'upper4',
  'inquisitor', 'warden', 'palaceGuard'] as const
type EncounterId = typeof encounterIds[number]
interface Encounter { enemy: EnemyState; health: number; maxHealth: number; floorY: number; minX: number; maxX: number; souls: number; name: string }

function initialEncounters(): Record<EncounterId, Encounter> {
  return {
    cellGuard: { enemy: initialEnemy(-78.7), health: 80, maxHealth: 80,
      floorY: 0, minX: -79.5, maxX: -76.6, souls: 30, name: '牢房疯兵' },
    corruptedKnight: { enemy: initialEnemy(-5), health: 350, maxHealth: 350,
      floorY: 2.5, minX: -11, maxX: 1, souls: 300, name: '腐化骑士' },
    upper1: { enemy: initialEnemy(10), health: 80, maxHealth: 80,
      floorY: 7, minX: 7.5, maxX: 12.5, souls: 50, name: '二楼狱卒' },
    upper2: { enemy: initialEnemy(-2), health: 80, maxHealth: 80,
      floorY: 7, minX: -4.5, maxX: 0.5, souls: 50, name: '二楼狱卒' },
    upper3: { enemy: initialEnemy(-15), health: 80, maxHealth: 80,
      floorY: 7, minX: -17.5, maxX: -12.5, souls: 50, name: '二楼狱卒' },
    upper4: { enemy: initialEnemy(-27), health: 80, maxHealth: 80,
      floorY: 7, minX: -29.5, maxX: -24.5, souls: 50, name: '二楼狱卒' },
    inquisitor: { enemy: initialEnemy(prisonLocations.inquisitorX), health: 400, maxHealth: 400,
      floorY: 2.5, minX: 29, maxX: 41, souls: 500, name: '责难官' },
    warden: { enemy: initialEnemy(prisonLocations.wardenX), health: 1500, maxHealth: 1500,
      floorY: 7, minX: -41, maxX: -34, souls: 5000, name: '典狱长' },
    palaceGuard: { enemy: initialEnemy(prisonLocations.palaceGuardX), health: 200, maxHealth: 200,
      floorY: 2.5, minX: 68, maxX: 77, souls: 200, name: '禁卫队长' },
  }
}

export class GameRuntime {
  private readonly engine: Engine
  private readonly scene: Scene
  private readonly playerMesh: Mesh
  private readonly enemyMesh: Mesh
  private readonly enemyWeaponMesh: Mesh
  private readonly altarMesh: Mesh
  private readonly slashMesh: Mesh
  private readonly fragmentMeshes: { F01: Mesh; F03: Mesh; F07: Mesh; F10: Mesh }
  private readonly gateMeshes: { shortcut: Mesh; cityGate: Mesh; lockedDoor: Mesh; gear: Mesh; archiveReward: Mesh;
    cellKnife: Mesh; flowerRing: Mesh; ventShard: Mesh; ventWall: Mesh; ledgeRing: Mesh; ladderRungs: Mesh[] }
  private readonly encounterMeshes: Record<EncounterId, Mesh>
  private readonly camera: FreeCamera
  private readonly soulMeshes = new Map<number, Mesh>()
  private readonly soulMaterial: StandardMaterial
  private readonly keys = new Set<string>()
  private movement: MovementState = initialMovement(prisonLocations.spawnX)
  private combat: CombatState = initialCombat()
  private enemy: EnemyState = initialEnemy(ENEMY_SPAWN_X)
  private encounters = initialEncounters()
  private flags: PrisonFlags = initialPrisonFlags()
  private zone: WorldZone = 'prison'
  private origin: OriginId = 'knight'
  private readonly loot = new Set<string>()
  private progression: ProgressionState = initialProgression()
  private narrative: NarrativeState = initialNarrative(demoTimeNodes)
  private readonly discoveredRooms = new Set<string>(['Cell'])
  private timelineOpen = false
  private facing: -1 | 1 = 1
  private jumpQueued = false
  private attackQueued = false
  private interactQueued = false
  private respawnRemaining = 0
  private message = '向右穿过牢房，探索监狱。'
  private snapshotClock = 0
  private readonly listener: SnapshotListener

  private constructor(canvas: HTMLCanvasElement, listener: SnapshotListener, scene: Scene, engine: Engine) {
    this.engine = engine
    this.scene = scene
    this.listener = listener
    const scenery = createPrisonScenery(scene)
    this.playerMesh = scenery.player
    this.enemyMesh = scenery.enemy
    this.enemyWeaponMesh = scenery.enemyWeapon
    this.altarMesh = scenery.altar
    this.slashMesh = scenery.slash
    this.fragmentMeshes = scenery.fragmentMeshes
    this.gateMeshes = scenery.gateMeshes
    this.encounterMeshes = { cellGuard: scenery.cellGuard, corruptedKnight: scenery.corruptedKnight,
      upper1: scenery.upperGuards[0], upper2: scenery.upperGuards[1],
      upper3: scenery.upperGuards[2], upper4: scenery.upperGuards[3],
      inquisitor: scenery.inquisitor, warden: scenery.warden, palaceGuard: scenery.palaceGuard }
    this.camera = scenery.camera
    this.soulMaterial = makeMaterial(scene, 'soul light', new Color3(0.3, 0.7, 0.84), new Color3(0.12, 0.6, 0.8))
    this.updateCameraBounds()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('resize', this.onResize)
    canvas.addEventListener('pointerdown', this.focusCanvas)
    this.publishSnapshot()
    this.engine.runRenderLoop(() => {
      try {
        this.tick(Math.min(this.engine.getDeltaTime() / 1000, 1 / 30))
        this.scene.render()
      } catch (error) {
        this.engine.stopRenderLoop()
        this.message = `场景渲染失败：${error instanceof Error ? error.message : String(error)}`
        this.publishSnapshot()
        console.error(error)
      }
    })
  }

  static async create(canvas: HTMLCanvasElement, listener: SnapshotListener): Promise<GameRuntime> {
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })
    const scene = new Scene(engine)
    try {
      const havok = await HavokPhysics()
      scene.enablePhysics(new Vector3(0, -27, 0), new HavokPlugin(true, havok))
      return new GameRuntime(canvas, listener, scene, engine)
    } catch (error) {
      scene.dispose()
      engine.dispose()
      throw error
    }
  }

  reset(): void {
    this.movement = initialMovement(prisonLocations.spawnX)
    this.combat = initialCombat()
    this.enemy = initialEnemy(ENEMY_SPAWN_X)
    this.encounters = initialEncounters()
    this.flags = initialPrisonFlags()
    this.loot.clear()
    this.zone = 'prison'
    this.camera.position.set(prisonLocations.spawnX, 3.1, -18)
    this.camera.setTarget(new Vector3(prisonLocations.spawnX, 2.2, 0))
    this.progression = initialProgression()
    this.narrative = initialNarrative(demoTimeNodes)
    this.facing = 1
    this.jumpQueued = false
    this.attackQueued = false
    this.interactQueued = false
    this.respawnRemaining = 0
    this.timelineOpen = false
    this.message = '向右穿过牢房，探索监狱。'
    this.discoveredRooms.clear()
    this.discoveredRooms.add('Cell')
    for (const mesh of this.soulMeshes.values()) mesh.dispose()
    this.soulMeshes.clear()
    this.playerMesh.isVisible = true
    this.enemyMesh.isVisible = true
    this.enemyWeaponMesh.isVisible = true
    this.syncFragmentMeshes()
    this.syncWorldMeshes()
    this.onBlur()
    this.publishSnapshot()
  }

  chooseOrigin(origin: OriginId): void {
    if (this.flags.equipmentRecovered || !Object.hasOwn(originLoadouts, origin)) return
    this.origin = origin
    this.message = `选择${originLoadouts[origin].name}出身。装备仍在监狱走廊的没收架上。`
    this.publishSnapshot()
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('resize', this.onResize)
    this.engine.getRenderingCanvas()?.removeEventListener('pointerdown', this.focusCanvas)
    this.engine.stopRenderLoop()
    this.scene.dispose()
    this.engine.dispose()
  }

  toggleTimeline(): void {
    if (!this.narrative.collectedFragmentIds.includes('F01')) {
      this.message = '先寻找监狱中的政务记录，时间轴才会展开。'
      this.publishSnapshot()
      return
    }
    this.timelineOpen = !this.timelineOpen
    this.onBlur()
    this.publishSnapshot()
  }

  selectTimelineFragment(nodeId: string, fragmentId: string | null): void {
    const result = selectFragment(this.narrative, nodeId, fragmentId, demoFragments)
    if (result.ok) {
      this.narrative = result.state
      this.publishSnapshot()
    }
  }

  confirmTimeline(): void {
    if (this.zone !== 'prison' || Math.abs(this.movement.x - ALTAR_X) > 1.4 || this.movement.y > 4) {
      this.message = '请回到监狱大厅祭坛，向祭坛提交当前解释。'
      this.publishSnapshot()
      return
    }
    const previous = this.flags
    this.flags = confirmChronicle(this.flags, this.narrative)
    this.message = !previous.doubleJump && this.flags.doubleJump ? '祭坛回应政变线：获得二段跳。回望大厅上方。'
      : !previous.spiritPerception && this.flags.spiritPerception ? '祭坛回应前三段历史：获得监狱内的临时灵力感知。调查入口公告板。'
      : !previous.exitKnowledge && this.flags.exitKnowledge ? '你认出了首相文书通道。回到大厅左侧正门调查。'
      : !previous.dash && this.flags.dash ? '祭坛回应勤王线：获得疾跑突进。'
      : '祭坛记下了你的解释；没有新的地图变化。'
    this.syncFragmentMeshes()
    this.syncWorldMeshes()
    this.timelineOpen = false
    this.onBlur()
    this.publishSnapshot()
  }

  private readonly focusCanvas = (): void => {
    this.engine.getRenderingCanvas()?.focus()
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'KeyT' || event.code === 'Escape' && this.timelineOpen) {
      event.preventDefault()
      if (!event.repeat) this.toggleTimeline()
      return
    }
    if (this.timelineOpen) return
    if (['KeyA', 'KeyD', 'KeyW', 'Space', 'KeyJ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault()
    this.keys.add(event.code)
    if (!event.repeat && (event.code === 'Space' || event.code === 'KeyW')) this.jumpQueued = true
    if (!event.repeat && event.code === 'KeyJ') this.attackQueued = true
    if (!event.repeat && event.code === 'KeyE') this.interactQueued = true
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private readonly onBlur = (): void => {
    this.keys.clear()
    this.jumpQueued = false
    this.attackQueued = false
    this.interactQueued = false
  }

  private readonly onResize = (): void => {
    this.engine.resize()
    this.updateCameraBounds()
  }

  private updateCameraBounds(): void {
    const aspect = this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight())
    this.camera.orthoTop = 5.5
    this.camera.orthoBottom = -5.5
    this.camera.orthoLeft = -5.5 * aspect
    this.camera.orthoRight = 5.5 * aspect
  }

  private tick(dt: number): void {
    if (this.timelineOpen) return
    if (this.respawnRemaining > 0) {
      this.respawnRemaining -= dt
      if (this.respawnRemaining <= 0) this.respawn()
      this.publishAtInterval(dt)
      return
    }

    const direction = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) as -1 | 0 | 1
    if (direction !== 0) this.facing = direction
    const sprinting = direction !== 0 && this.movement.grounded && this.combat.player.stamina > 0
      && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))
    this.movement = stepMovement(this.movement,
      { direction, jumpPressed: this.jumpQueued, sprinting, extraJumps: this.flags.doubleJump ? 1 : 0 },
      dt, surfacesByZone[this.zone])
    this.jumpQueued = false

    const currentRoom = roomAt(this.movement.x, this.movement.y, this.zone)
    if (!this.discoveredRooms.has(currentRoom.id)) {
      this.discoveredRooms.add(currentRoom.id)
      this.message = `已进入${currentRoom.label}。`
    }

    for (const pickup of prisonFragmentPickups) {
      if (pickup.trigger !== 'proximity') continue
      if (Math.abs(this.movement.x - pickup.x) > pickup.radius || Math.abs(this.movement.y - pickup.y) > 1.1) continue
      const next = collectFragment(this.narrative, pickup.fragmentId, demoFragments)
      if (next !== this.narrative) {
        this.narrative = next
        this.message = '祭坛石板发出微光。获得历史证据：国王死讯公告。'
        this.syncFragmentMeshes()
      }
    }

    if (this.interactQueued) this.interact()

    const enemyStep = stepEnemy(this.enemy, this.movement.x, this.movement.y, dt, ENEMY_FLOOR_Y)
    this.enemy = {
      ...enemyStep.enemy,
      x: Math.max(-39, Math.min(-23, enemyStep.enemy.x)),
    }
    if (enemyStep.playerDamage > 0) {
      this.combat = damagePlayer(this.combat, enemyStep.playerDamage)
      this.message = '灰烬士兵击中了你。'
    }
    const previousEnemyHealth = this.combat.enemy.health
    this.combat = stepCombat(
      this.combat,
      this.attackQueued,
      this.movement.x,
      this.movement.y,
      this.facing,
      this.enemy.x,
      dt,
      sprinting,
      ENEMY_FLOOR_Y,
    )
    this.attackQueued = false
    if (this.combat.enemy.health < previousEnemyHealth) {
      this.enemy = applyEnemyHit(this.enemy, this.combat.enemy.health)
      this.message = this.combat.enemy.health === 0 ? '敌人倒下，魂已落在地面。' : '命中灰烬士兵。'
      if (this.combat.enemy.health === 0) {
        this.progression = dropEnemySouls(this.progression, this.enemy.x, enemyDefinition.souls, ENEMY_FLOOR_Y)
      }
    }

    this.stepEncounters(dt)

    const soulsBefore = this.progression.souls
    this.progression = collectSouls(this.progression, this.movement.x, this.movement.y)
    if (this.progression.souls > soulsBefore) this.message = `获得 ${this.progression.souls - soulsBefore} 魂。`
    if (this.combat.player.health <= 0) {
      this.progression = loseSoulsOnDeath(this.progression, this.movement.x, this.movement.y)
      this.respawnRemaining = 1.4
      this.message = '你死了。即将返回上一个检查点。'
      this.playerMesh.isVisible = false
      this.publishSnapshot()
    }

    this.playerMesh.position.set(this.movement.x, this.movement.y + 0.9, 0)
    this.playerMesh.rotation.z = this.facing === 1 ? -0.05 : 0.05
    this.enemyMesh.isVisible = this.enemy.mode !== 'dead'
    this.enemyWeaponMesh.isVisible = this.enemy.mode !== 'dead'
    this.enemyMesh.position.set(this.enemy.x, ENEMY_FLOOR_Y + 0.9, 0)
    this.enemyWeaponMesh.position.set(this.enemy.x + this.enemy.facing * 0.55, ENEMY_FLOOR_Y + 0.85, -0.1)
    for (const id of encounterIds) {
      const encounter = this.encounters[id]
      const mesh = this.encounterMeshes[id]
      mesh.isVisible = encounter.health > 0
      mesh.position.set(encounter.enemy.x, encounter.floorY + (id === 'warden' ? 1.4 : id === 'inquisitor' ? 1.15 : 1), 0)
      const material = mesh.material as StandardMaterial
      material.emissiveColor = encounter.enemy.mode === 'windup' || encounter.enemy.mode === 'active'
        ? new Color3(0.5, 0.12, 0.08) : Color3.Black()
    }
    const enemyMaterial = this.enemyMesh.material as StandardMaterial
    enemyMaterial.emissiveColor = this.enemy.mode === 'windup' || this.enemy.mode === 'active'
      ? new Color3(0.55, 0.11, 0.07)
      : Color3.Black()
    const altarMaterial = this.altarMesh.material as StandardMaterial
    altarMaterial.emissiveColor = this.progression.checkpointActive
      ? new Color3(0.4, 0.22, 0.08)
      : Color3.Black()
    this.syncSoulMeshes()
    this.syncWorldMeshes()
    this.slashMesh.isVisible = this.combat.attack.phase === 'active'
    this.slashMesh.position.set(this.movement.x + this.facing * 0.95, this.movement.y + 0.95, -0.05)
    const halfViewWidth = 5.5 * this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight())
    const surfaces = surfacesByZone[this.zone]
    const zoneMin = Math.min(...surfaces.map(surface => surface.minX))
    const zoneMax = Math.max(...surfaces.map(surface => surface.maxX))
    const targetX = Math.max(zoneMin + halfViewWidth, Math.min(zoneMax - halfViewWidth, this.movement.x))
    const targetY = Math.max(2.2, Math.min(9.5, this.movement.y + 2.2))
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 4)
    this.camera.position.y += (targetY + 0.9 - this.camera.position.y) * Math.min(1, dt * 4)
    this.camera.setTarget(new Vector3(this.camera.position.x, this.camera.position.y - 0.9, 0))

    this.publishAtInterval(dt)
  }

  private near(x: number, radius = 1.4): boolean {
    return Math.abs(this.movement.x - x) <= radius
  }

  private travel(zone: WorldZone, x: number, y = 2.5): void {
    this.zone = zone
    this.movement = initialMovement(x, y)
    this.camera.position.x = x
    this.camera.position.y = y + 3.1
    this.camera.setTarget(new Vector3(x, y + 2.2, 0))
  }

  private collect(id: string): boolean {
    const next = collectFragment(this.narrative, id, demoFragments)
    if (next === this.narrative) return false
    this.narrative = next
    this.syncFragmentMeshes()
    return true
  }

  private interact(): void {
    this.interactQueued = false
    const x = this.movement.x
    const y = this.movement.y
    if (this.zone === 'prison') {
      if (this.near(prisonLocations.equipmentX) && y < 2) {
        if (!this.flags.equipmentRecovered) {
          this.flags.equipmentRecovered = true
          const gear = originLoadouts[this.origin]
          this.message = `取回${gear.name}装备：${gear.mainHand}、${gear.offHand}、四部位防具与${gear.other}。`
        }
      } else if (this.near(-75) && y < 2 && !this.loot.has('备用短刀')) {
        this.loot.add('备用短刀')
        this.message = '从牢房 D 取走备用短刀。'
      } else if (this.near(-65) && y < 0 && !this.loot.has('花木戒指')) {
        this.loot.add('花木戒指')
        this.message = '在下水道石桥下找到花木戒指。'
      } else if (this.near(-55.5) && y < 1 && !this.loot.has('通风管原素瓶碎片')) {
        this.loot.add('通风管原素瓶碎片')
        this.message = '循着羽毛调查假墙，在乌鸦巢找到原素瓶碎片。'
      } else if (this.near(-8) && y > 5.7 && !this.loot.has('长廊高台戒指')) {
        this.loot.add('长廊高台戒指')
        this.message = '回访长廊高台，取得藏在高处的戒指。'
      } else if (this.near(prisonLocations.archiveX) && y < 4) {
        this.message = this.collect('F01') ? '获得 F01 政务记录。时间轴已解锁，按 T 调查历史。' : '档案室的政务记录已经收起。'
      } else if (this.near(prisonLocations.shortcutX) && y > 6.5) {
        if (!this.flags.shortcutOpen) {
          this.flags.shortcutOpen = true
          this.message = '踢下铁梯！监狱二楼与中层走廊形成永久环路。'
        } else {
          this.travel('prison', prisonLocations.shortcutX, 2.5)
          this.message = '沿捷径梯返回中层走廊。'
        }
      } else if (this.near(prisonLocations.shortcutX) && y < 4) {
        if (this.flags.shortcutOpen) {
          this.travel('prison', prisonLocations.shortcutX, 7)
          this.message = '沿捷径梯到达监狱二楼。'
        } else this.message = '铁梯的固定销在上方；你现在打不开。'
      } else if (this.near(prisonLocations.noticeboardX) && y < 4) {
        this.message = this.flags.spiritPerception
          ? this.collect('F07') ? '隐藏字迹浮现。获得 F07：典狱长拒绝执行释放令。' : '公告板的隐字已经记录。'
          : '普通公告板。似乎还有被覆盖的字迹，但现在无法辨认。'
      } else if (this.near(ALTAR_X) && y < 4) {
        const activated = activateCheckpoint(this.progression, x, ALTAR_X)
        if (activated !== this.progression) {
          this.progression = activated
          this.combat = initialCombat()
          this.enemy = initialEnemy(ENEMY_SPAWN_X)
        }
        this.confirmTimeline()
        if (this.message === '祭坛记下了你的解释；没有新的地图变化。') {
          this.message = '祭坛已点亮，生命恢复。按 T 选择证据，再按 E 提交解释。'
        }
      } else if (this.near(prisonLocations.exitX) && y < 4) {
        if (!this.flags.exitKnowledge) {
          this.message = '正门不是死锁：你尚不明白该走哪套公文程序。调查 F01、F03，回祭坛拼时间轴。'
        } else {
          this.flags.frontGateOpen = true
          this.travel('city', 55)
          this.message = '根据首相文书线索找到了通行滑槽，进入王城街道。皇宫前厅在右侧。'
        }
      } else if (this.near(prisonLocations.armoryStairX) && y < 4) {
        this.travel('armory', 94)
        this.message = '进入军械库外廊。大厅后楼梯仍可返回。'
      } else if (this.near(prisonLocations.lockX) && y < 4) {
        if (!this.flags.wardenKey) this.message = '责难官身后的门锁着。锁孔上刻着典狱长徽记。'
        else {
          this.flags.lockedDoorOpen = true
          this.travel('detention', 116)
          this.message = '典狱长钥匙串打开铁门：这里是拘押档案夹层。'
        }
      } else if (this.near(prisonLocations.upperGateX) && y < 4) {
        this.message = '二楼平台就在头顶。需要从完整历史解释中获得二段跳。'
      }
    } else if (this.zone === 'city') {
      if (this.near(prisonLocations.cityReturnX)) {
        this.travel('prison', 10)
        this.message = '返回监狱大厅。'
      } else if (this.near(prisonLocations.palaceEvidenceX)) {
        this.message = this.encounters.palaceGuard.health > 0
          ? '封锁令在禁卫队长身上。先击败他。'
          : this.collect('F10') ? '搜索禁卫队长尸体，获得 F10 城门封锁令。可回监狱祭坛拼政变线。'
            : '队长的封锁令已经取走。'
      }
    } else if (this.zone === 'armory') {
      if (this.near(prisonLocations.armoryReturnX)) {
        this.travel('prison', 20)
        this.message = '沿后楼梯返回监狱大厅。'
      } else if (this.near(103)) {
        if (this.flags.lockedDoorOpen) {
          this.travel('detention', 112)
          this.message = '从军械库外廊进入拘押档案夹层。'
        } else this.message = '这条检修通道从刑讯室一侧锁着。'
      }
    } else {
      if (this.near(prisonLocations.detentionX)) {
        if (!this.flags.archiveRewardTaken) {
          this.flags.archiveRewardTaken = true
          this.loot.add('装备强化材料')
          this.message = '调查拘押名册：放囚令与拒令记录互相矛盾。获得装备强化材料。'
        } else this.message = '拘押名册已调查；这里的记录仍不能证明哪方说了真话。'
      } else if (this.near(111)) {
        this.travel('armory', 102)
        this.message = '进入军械库外廊。'
      } else if (this.near(118)) {
        this.travel('prison', 41)
        this.message = '回到责难官身后的铁门。'
      }
    }
    this.syncWorldMeshes()
    this.publishSnapshot()
  }

  private stepEncounters(dt: number): void {
    for (const id of encounterIds) {
      const encounter = this.encounters[id]
      if (encounter.health <= 0) continue
      const activeZone = id === 'palaceGuard' ? 'city' : 'prison'
      if (this.zone !== activeZone) continue
      const step = stepEnemy(encounter.enemy, this.movement.x, this.movement.y, dt, encounter.floorY)
      encounter.enemy = { ...step.enemy, x: Math.max(encounter.minX, Math.min(encounter.maxX, step.enemy.x)) }
      if (step.playerDamage > 0) {
        this.combat = damagePlayer(this.combat,
          id === 'warden' ? 50 : id === 'inquisitor' || id === 'corruptedKnight' ? 35
            : id === 'cellGuard' ? 15 : 25)
        this.message = `${encounter.name}击中了你。`
      }
      if (this.combat.attack.phase !== 'active' || this.combat.attack.hitTarget) continue
      const hit = { x: this.movement.x + this.facing * 0.95, y: this.movement.y + 0.35,
        halfWidth: attackDefinition.reach / 2, height: attackDefinition.height }
      const target = { x: encounter.enemy.x, y: encounter.floorY, halfWidth: id === 'warden' ? 0.88 : 0.65,
        height: id === 'warden' ? 2.8 : 2.1 }
      if (!boxesOverlap(hit, target)) continue
      const damage = this.flags.equipmentRecovered ? id === 'warden' ? 100 : 50 : 10
      encounter.health = Math.max(0, encounter.health - damage)
      this.combat.attack.hitTarget = true
      encounter.enemy = applyEnemyHit(encounter.enemy, encounter.health)
      this.message = `命中${encounter.name}。`
      if (encounter.health === 0) {
        this.progression = dropEnemySouls(this.progression, encounter.enemy.x, encounter.souls, encounter.floorY)
        if (id === 'inquisitor') {
          this.collect('F05')
          this.loot.add('诘问之戒')
          this.message = '责难官倒下。获得诘问之戒与 F05 首相手令；祭坛可拼 T0–T2。'
        } else if (id === 'warden') {
          this.collect('F12')
          this.flags.wardenKey = true
          this.loot.add('典狱长钥匙串')
          this.loot.add('钥匙环戒指')
          this.message = '典狱长倒下。获得钥匙串、钥匙环戒指与 F12；返回责难官身后的锁门。'
        } else if (id === 'palaceGuard') {
          this.syncFragmentMeshes()
          this.message = '禁卫队长倒下。调查尸体上的封锁令以取得 F10。'
        } else if (id === 'corruptedKnight') {
          this.loot.add('长廊原素瓶碎片')
          this.message = '腐化骑士倒下。获得原素瓶碎片与 300 魂。'
        } else {
          this.message = `${encounter.name}倒下。`
        }
      }
    }
  }

  private respawn(): void {
    const checkpointX = this.progression.checkpointActive ? this.progression.checkpointX : prisonLocations.spawnX
    this.travel('prison', checkpointX, floorAt(checkpointX) ?? 0)
    this.combat = initialCombat()
    this.enemy = initialEnemy(ENEMY_SPAWN_X)
    for (const id of encounterIds) {
      const encounter = this.encounters[id]
      if (encounter.health > 0) {
        encounter.health = encounter.maxHealth
        encounter.enemy = initialEnemy(encounter.enemy.spawnX)
      }
    }
    this.playerMesh.isVisible = true
    this.respawnRemaining = 0
    this.message = '你在检查点苏醒。失去的魂可回原地拾取。'
    this.publishSnapshot()
  }

  private syncSoulMeshes(): void {
    const activeIds = new Set(this.progression.drops.map(drop => drop.id))
    for (const [id, mesh] of this.soulMeshes) {
      if (!activeIds.has(id)) {
        mesh.dispose()
        this.soulMeshes.delete(id)
      }
    }
    for (const drop of this.progression.drops) {
      if (this.soulMeshes.has(drop.id)) continue
      const mesh = MeshBuilder.CreateSphere(`soul drop ${drop.id}`, { diameter: drop.kind === 'grave' ? 0.48 : 0.33 }, this.scene)
      mesh.position.set(drop.x, (drop.y ?? floorAt(drop.x) ?? 2.5) + 0.55, -0.3)
      mesh.material = this.soulMaterial
      this.soulMeshes.set(drop.id, mesh)
    }
  }

  private syncFragmentMeshes(): void {
    for (const [id, mesh] of Object.entries(this.fragmentMeshes)) {
      mesh.isVisible = id === 'F03' || id === 'F07'
        ? id === 'F03' || this.flags.spiritPerception && !this.narrative.collectedFragmentIds.includes(id)
        : id === 'F10'
          ? this.encounters.palaceGuard.health === 0 && !this.narrative.collectedFragmentIds.includes(id)
          : !this.narrative.collectedFragmentIds.includes(id)
    }
  }

  private syncWorldMeshes(): void {
    this.gateMeshes.gear.isVisible = !this.flags.equipmentRecovered
    this.gateMeshes.lockedDoor.isVisible = !this.flags.lockedDoorOpen
    this.gateMeshes.archiveReward.isVisible = !this.flags.archiveRewardTaken
    this.gateMeshes.cellKnife.isVisible = !this.loot.has('备用短刀')
    this.gateMeshes.flowerRing.isVisible = !this.loot.has('花木戒指')
    this.gateMeshes.ventShard.isVisible = false
    this.gateMeshes.ventWall.isVisible = !this.loot.has('通风管原素瓶碎片')
    this.gateMeshes.ledgeRing.isVisible = !this.loot.has('长廊高台戒指')
    for (const rung of this.gateMeshes.ladderRungs) rung.isVisible = this.flags.shortcutOpen
    const cityMaterial = this.gateMeshes.cityGate.material as StandardMaterial
    cityMaterial.emissiveColor = this.flags.exitKnowledge ? new Color3(0.34, 0.19, 0.06) : Color3.Black()
    const ladderMaterial = this.gateMeshes.shortcut.material as StandardMaterial
    ladderMaterial.emissiveColor = this.flags.shortcutOpen ? new Color3(0.1, 0.35, 0.32) : Color3.Black()
  }

  private interactionPrompt(): string | null {
    const y = this.movement.y
    if (this.zone === 'prison') {
      if (this.near(prisonLocations.equipmentX) && y < 2 && !this.flags.equipmentRecovered) return 'E · 取回被没收的职业装备'
      if (this.near(-75) && y < 2 && !this.loot.has('备用短刀')) return 'E · 调查牢房 D'
      if (this.near(-65) && y < 0 && !this.loot.has('花木戒指')) return 'E · 调查石桥下方'
      if (this.near(-55.5) && y < 1 && !this.loot.has('通风管原素瓶碎片')) return 'E · 调查羽毛与假墙'
      if (this.near(prisonLocations.shortcutX)) return y > 6.5
        ? this.flags.shortcutOpen ? 'E · 沿捷径梯下降' : 'E · 从二楼放下铁梯'
        : this.flags.shortcutOpen ? 'E · 沿捷径梯登上二楼' : '梯口在头顶，需从另一侧打开'
      if (this.near(prisonLocations.archiveX) && y < 4 && !this.narrative.collectedFragmentIds.includes('F01')) return 'E · 调查档案室政务记录 F01'
      if (this.near(-8) && y > 5.7 && !this.loot.has('长廊高台戒指')) return 'E · 取得高台戒指'
      if (this.near(-8) && y < 4 && !this.flags.doubleJump) return '高台尚不可达：需要二段跳'
      if (this.near(prisonLocations.noticeboardX) && y < 4) return this.flags.spiritPerception
        ? 'E · 读取公告板隐藏字迹 F07' : '公告板似乎盖着旧字迹'
      if (this.near(prisonLocations.exitX) && y < 4) return this.flags.exitKnowledge
        ? 'E · 走首相公文通道，进入王城' : 'E · 调查王城出口的通行程序'
      if (this.near(ALTAR_X) && y < 4) return 'T · 拼时间轴；E · 祭坛确认解释并存档'
      if (this.near(prisonLocations.armoryStairX) && y < 4) return 'E · 前往军械库外廊'
      if (this.near(prisonLocations.upperGateX) && y < 4) return this.flags.doubleJump
        ? 'W／Space · 连按两次跳上监狱二楼' : '上方二楼需要二段跳'
      if (this.near(prisonLocations.lockX) && y < 4) return this.flags.wardenKey
        ? 'E · 用典狱长钥匙串打开铁门' : 'E · 调查责难官身后的锁门'
    } else if (this.zone === 'city') {
      if (this.near(prisonLocations.cityReturnX)) return 'E · 返回监狱大厅'
      if (this.near(prisonLocations.palaceEvidenceX)) return this.encounters.palaceGuard.health > 0
        ? '击败禁卫队长，取得封锁令' : 'E · 搜索尸体取得 F10'
    } else if (this.zone === 'armory') {
      if (this.near(prisonLocations.armoryReturnX)) return 'E · 返回监狱大厅后楼梯'
      if (this.near(103)) return this.flags.lockedDoorOpen ? 'E · 进入拘押档案夹层' : '通道从刑讯室侧锁着'
    } else {
      if (this.near(111)) return 'E · 通往军械库外廊'
      if (this.near(prisonLocations.detentionX) && !this.flags.archiveRewardTaken) return 'E · 调查拘押名册'
      if (this.near(118)) return 'E · 回责难官房'
    }
    return null
  }

  private publishAtInterval(dt: number): void {
    this.snapshotClock += dt
    if (this.snapshotClock >= 0.1) {
      this.snapshotClock = 0
      this.publishSnapshot()
    }
  }

  private publishSnapshot(): void {
    const currentRoom = roomAt(this.movement.x, this.movement.y, this.zone)
    const encounter = currentRoom.id === 'InquisitorRoom' ? this.encounters.inquisitor
      : currentRoom.id === 'SecondFloor'
        ? [this.encounters.warden, this.encounters.upper1, this.encounters.upper2,
          this.encounters.upper3, this.encounters.upper4]
          .filter(item => item.health > 0).sort((a, b) => Math.abs(a.enemy.x - this.movement.x) - Math.abs(b.enemy.x - this.movement.x))[0]
        : currentRoom.id === 'PalaceFoyer' ? this.encounters.palaceGuard
          : currentRoom.id === 'KnightCorridor' ? this.encounters.corruptedKnight
            : currentRoom.id === 'Cell' || currentRoom.id === 'PrisonCorridor' ? this.encounters.cellGuard : null
    this.listener({
      health: this.combat.player.health,
      maxHealth: this.combat.player.maxHealth,
      stamina: Math.round(this.combat.player.stamina),
      maxStamina: this.combat.player.maxStamina,
      enemyHealth: encounter?.health ?? this.combat.enemy.health,
      enemyMaxHealth: encounter?.maxHealth ?? this.combat.enemy.maxHealth,
      attackPhase: this.combat.attack.phase,
      grounded: this.movement.grounded,
      souls: this.progression.souls,
      checkpointActive: this.progression.checkpointActive,
      dead: this.respawnRemaining > 0,
      message: this.message,
      room: currentRoom.label,
      discoveredRooms: this.discoveredRooms.size,
      fragments: this.narrative.collectedFragmentIds.length,
      timelineOpen: this.timelineOpen,
      timelineUnlocked: this.narrative.collectedFragmentIds.includes('F01'),
      timeline: buildTimelineView(this.narrative, demoTimeNodes, demoFragments),
      equipmentRecovered: this.flags.equipmentRecovered,
      exitKnowledge: this.flags.exitKnowledge,
      spiritPerception: this.flags.spiritPerception && this.zone === 'prison',
      doubleJump: this.flags.doubleJump,
      shortcutOpen: this.flags.shortcutOpen,
      wardenKey: this.flags.wardenKey,
      lockedDoorOpen: this.flags.lockedDoorOpen,
      nearAltar: this.zone === 'prison' && this.near(ALTAR_X) && this.movement.y < 4,
      enemyName: encounter?.name ?? '灰烬士兵',
      totalRooms: 14,
      origin: this.origin,
      originLevel: originLoadouts[this.origin].level,
      equipmentSummary: this.flags.equipmentRecovered
        ? `${originLoadouts[this.origin].mainHand} / ${originLoadouts[this.origin].offHand} / 四部位防具 / ${originLoadouts[this.origin].other}`
        : '囚服、牢门钥匙；职业装备被没收',
      loot: [...this.loot],
      prompt: this.interactionPrompt(),
    })
  }
}
