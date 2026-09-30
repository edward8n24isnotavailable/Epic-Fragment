import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'
import { Scene } from '@babylonjs/core/scene'
import HavokPhysics from '@babylonjs/havok'
import { createPrisonScenery } from './prisonScene'
import { demoFragments, demoTimeNodes } from '../narrative/demoData'
import { collectFragment, initialNarrative, selectFragment } from '../narrative/state'
import type { NarrativeState } from '../narrative/model'
import { addFlaskCapacity, attackDefinitions, boxesOverlap, castSpell, initialCombat, refillAtCheckpoint, resolveIncomingHit, setMaxFp, stepCombat, stepDefense, useDaggerStep, useFlask, type CombatState, type HitOutcome, type SpellKind } from '../domain/combat'
import { applyEnemyHit, enemyAttackName, enemyDefinition, initialEnemy, stepEnemy, type EnemyState } from '../domain/enemy'
import { attackPoiseDamage, consumeExecution, increaseMaxPoise, poiseRules } from '../domain/poise'
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
import { originAttributes, originLoadouts, originMaxFp, type OriginId } from '../world/originLoadouts'
import { activeOffhand, activeSkill, equipMain, equipOffhand, equipmentName, initialEquipment, offhandGear, ownedOffhands, ownedWeapons, shieldStats, toggleGrip, weaponPower, weapons, type EquipmentState, type OffhandGearId, type OffhandId, type WeaponId } from '../world/equipment'
import { encounterIds, initialEncounters, type EncounterId } from './encounters'
import { profileForEncounter } from './enemyProfiles'
import { GameVisuals } from './GameVisuals'
import { EnemyProjectiles } from './EnemyProjectiles'
import { buildGameSnapshot } from './buildSnapshot'
import { handlePrisonInteraction, prisonInteractionPrompt, type InteractionContext } from './prisonInteractions'
import { clearGameSave, readGameSave, writeGameSave, type GameSaveData, type SaveStorage } from './saveGame'
import type { GameSnapshot } from './GameSnapshot'
export type { GameSnapshot } from './GameSnapshot'

type SnapshotListener = (snapshot: GameSnapshot) => void

const ENEMY_SPAWN_X = prisonLocations.soldierX
const ENEMY_FLOOR_Y = floorAt(ENEMY_SPAWN_X) ?? 0
const ALTAR_X = prisonLocations.altarX
interface SoulArrow { mesh: Mesh; x: number; y: number; direction: -1 | 1; target: EncounterId | 'soldier' | null; remaining: number; zone: WorldZone }

export class GameRuntime {
  private readonly engine: Engine
  private readonly scene: Scene
  private readonly visuals: GameVisuals
  private readonly enemyProjectiles: EnemyProjectiles
  private readonly soulArrows: SoulArrow[] = []
  private readonly keys = new Set<string>()
  private movement: MovementState = initialMovement(prisonLocations.spawnX)
  private combat: CombatState = initialCombat()
  private enemy: EnemyState = initialEnemy(ENEMY_SPAWN_X)
  private encounters = initialEncounters()
  private flags: PrisonFlags = initialPrisonFlags()
  private zone: WorldZone = 'prison'
  private origin: OriginId = 'knight'
  private equipment: EquipmentState = initialEquipment('knight')
  private readonly loot = new Set<string>()
  private readonly acquiredWeapons = new Set<WeaponId>()
  private readonly acquiredOffhands = new Set<OffhandGearId>()
  private progression: ProgressionState = initialProgression()
  private narrative: NarrativeState = initialNarrative(demoTimeNodes)
  private readonly discoveredRooms = new Set<string>(['Cell'])
  private saveAvailable = false
  private timelineOpen = false
  private facing: -1 | 1 = 1
  private jumpQueued = false
  private attackQueued: 'light' | 'heavy' | null = null
  private shieldBashQueued = false
  private flaskQueued = false
  private defenseQueued = false
  private prayerSequence: string[] | null = null
  private radiantRemaining = 0
  private sightRemaining = 0
  private magicGuardRemaining = 0
  private flurryFlashRemaining = 0
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
    this.visuals = new GameVisuals(scene, scenery)
    this.enemyProjectiles = new EnemyProjectiles(scene)
    this.updateCameraBounds()
    this.loadCheckpointSave()
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

  reset(clearSaved = true): void {
    if (clearSaved) {
      const storage = this.saveStorage()
      if (storage) clearGameSave(storage)
      this.saveAvailable = false
    }
    this.movement = initialMovement(prisonLocations.spawnX)
    this.combat = initialCombat(originMaxFp(this.origin))
    this.enemy = initialEnemy(ENEMY_SPAWN_X)
    this.encounters = initialEncounters()
    this.flags = initialPrisonFlags()
    this.loot.clear()
    this.acquiredWeapons.clear()
    this.acquiredOffhands.clear()
    this.equipment = initialEquipment(this.origin)
    this.zone = 'prison'
    this.visuals.reset(prisonLocations.spawnX)
    this.progression = initialProgression()
    this.narrative = initialNarrative(demoTimeNodes)
    this.facing = 1
    this.jumpQueued = false
    this.attackQueued = null
    this.shieldBashQueued = false
    this.flaskQueued = false
    this.defenseQueued = false
    this.prayerSequence = null
    this.radiantRemaining = 0
    this.sightRemaining = 0
    this.magicGuardRemaining = 0
    this.flurryFlashRemaining = 0
    this.interactQueued = false
    this.respawnRemaining = 0
    this.timelineOpen = false
    this.message = '向右穿过牢房，探索监狱。'
    this.discoveredRooms.clear()
    this.discoveredRooms.add('Cell')
    this.clearSoulArrows()
    this.enemyProjectiles.clear()
    this.syncFragmentMeshes()
    this.syncWorldMeshes()
    this.onBlur()
    this.publishSnapshot()
  }

  chooseOrigin(origin: OriginId): void {
    if (this.flags.equipmentRecovered || !Object.hasOwn(originLoadouts, origin)) return
    this.origin = origin
    this.equipment = initialEquipment(origin)
    this.combat = setMaxFp(this.combat, originMaxFp(origin))
    this.message = `选择${originLoadouts[origin].name}出身。装备仍在监狱走廊的没收架上。`
    this.publishSnapshot()
  }

  equipMainWeapon(weapon: WeaponId): void {
    if (!this.canSwitchEquipment()) return
    const next = equipMain(this.equipment, weapon,
      ownedWeapons(this.origin, this.acquiredWeapons))
    if (next === this.equipment) return
    this.equipment = next
    this.magicGuardRemaining = 0
    this.message = `主手换成${equipmentName(weapon)}。当前 L 战技：${this.skillName}。`
    this.publishSnapshot()
  }

  equipOffhandItem(item: OffhandId): void {
    if (!this.canSwitchEquipment()) return
    const next = equipOffhand(this.equipment, item,
      ownedOffhands(this.origin, this.acquiredWeapons, this.acquiredOffhands))
    if (next === this.equipment) return
    this.equipment = next
    this.magicGuardRemaining = 0
    this.message = `副手换成${equipmentName(item)}。当前 L 战技：${this.skillName}。`
    this.publishSnapshot()
  }

  toggleWeaponGrip(): void {
    if (!this.canSwitchEquipment()) return
    this.equipment = toggleGrip(this.equipment)
    this.magicGuardRemaining = 0
    this.message = this.equipment.twoHanded
      ? `双手握持${equipmentName(this.equipment.mainHand)}：攻击提高 20%，副手暂时停用。`
      : `恢复单手握持${equipmentName(this.equipment.mainHand)}，副手重新生效。`
    this.publishSnapshot()
  }

  private canSwitchEquipment(): boolean {
    return this.flags.equipmentRecovered && this.combat.player.health > 0
      && this.combat.attack.phase === 'idle' && this.combat.defense.mode === 'idle'
      && this.prayerSequence === null && this.respawnRemaining <= 0
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('resize', this.onResize)
    this.engine.getRenderingCanvas()?.removeEventListener('pointerdown', this.focusCanvas)
    this.engine.stopRenderLoop()
    this.clearSoulArrows()
    this.enemyProjectiles.clear()
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
    this.progression = activateCheckpoint(this.progression, this.movement.x, ALTAR_X)
    this.combat = refillAtCheckpoint(this.combat)
    this.enemy = initialEnemy(ENEMY_SPAWN_X)
    this.flags = confirmChronicle(this.flags, this.narrative)
    this.message = !previous.doubleJump && this.flags.doubleJump ? '祭坛回应政变线：获得二段跳。回望大厅上方。'
      : !previous.spiritPerception && this.flags.spiritPerception ? '祭坛回应前三段历史：获得监狱内的临时灵力感知。调查入口公告板。'
      : !previous.exitKnowledge && this.flags.exitKnowledge ? '你认出了首相文书通道。回到大厅左侧正门调查。'
      : !previous.dash && this.flags.dash ? '祭坛回应勤王线：获得疾跑突进。'
      : '祭坛已点亮，生命与原素瓶已补满。按 T 选择证据，再按 E 提交解释。'
    this.syncFragmentMeshes()
    this.syncWorldMeshes()
    this.timelineOpen = false
    this.onBlur()
    const saved = this.saveAtAltar()
    this.message += saved ? ' 进度已存档。' : ' 本地存档不可用。'
    this.publishSnapshot()
  }

  private saveStorage(): SaveStorage | null {
    try { return window.localStorage } catch { return null }
  }

  private saveAtAltar(): boolean {
    const storage = this.saveStorage()
    if (!storage) return false
    const save: GameSaveData = {
      version: 1,
      savedAt: Date.now(),
      origin: this.origin,
      equipment: { ...this.equipment },
      flags: { ...this.flags },
      loot: [...this.loot],
      acquiredWeapons: [...this.acquiredWeapons],
      acquiredOffhands: [...this.acquiredOffhands],
      progression: structuredClone(this.progression),
      narrative: structuredClone(this.narrative),
      discoveredRooms: [...this.discoveredRooms],
      defeatedEncounters: encounterIds.filter(id => this.encounters[id].health <= 0),
      maxFlasks: this.combat.maxFlasks,
    }
    const written = writeGameSave(storage, save)
    this.saveAvailable = written || readGameSave(storage) !== null
    return written
  }

  loadCheckpointSave(): void {
    const storage = this.saveStorage()
    const save = storage ? readGameSave(storage) : null
    if (!save) {
      this.saveAvailable = false
      return
    }
    this.origin = save.origin
    this.reset(false)
    this.flags = { ...initialPrisonFlags(), ...save.flags }
    this.progression = structuredClone(save.progression)
    this.narrative = structuredClone(save.narrative)
    this.combat = initialCombat(originMaxFp(save.origin))
    this.combat = { ...this.combat, flasks: save.maxFlasks, maxFlasks: save.maxFlasks }
    for (const item of save.loot) this.loot.add(item)
    for (const item of save.acquiredWeapons) this.acquiredWeapons.add(item)
    for (const item of save.acquiredOffhands) this.acquiredOffhands.add(item)
    this.equipment = ownedWeapons(save.origin, this.acquiredWeapons).includes(save.equipment.mainHand)
      && ownedOffhands(save.origin, this.acquiredWeapons, this.acquiredOffhands).includes(save.equipment.offHand)
      ? { ...save.equipment } : initialEquipment(save.origin)
    for (const id of save.defeatedEncounters) {
      const encounter = this.encounters[id]
      encounter.health = 0
      encounter.enemy = applyEnemyHit(encounter.enemy, 0)
    }
    this.discoveredRooms.clear()
    for (const room of save.discoveredRooms) this.discoveredRooms.add(room)
    this.travel('prison', save.progression.checkpointX, floorAt(save.progression.checkpointX) ?? 2.5)
    this.saveAvailable = true
    this.message = '已载入祭坛存档。'
    this.syncFragmentMeshes()
    this.syncWorldMeshes()
    this.syncSoulMeshes()
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
    if (this.prayerSequence !== null && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
      event.preventDefault()
      if (!event.repeat && this.prayerSequence.length < 4) {
        this.prayerSequence.push(event.code.slice(3))
        this.message = `祷言指令：${this.prayerSequence.join(' → ')}。松开 L 释放。`
        this.publishSnapshot()
      }
      return
    }
    if (['KeyA', 'KeyD', 'KeyW', 'Space', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyR', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault()
    this.keys.add(event.code)
    if (!event.repeat && (event.code === 'Space' || event.code === 'KeyW')) this.jumpQueued = true
    if (!event.repeat && event.code === 'KeyJ') this.attackQueued = 'light'
    if (!event.repeat && event.code === 'KeyK') this.attackQueued = 'heavy'
    if (!event.repeat && event.code === 'KeyQ') this.shieldBashQueued = true
    if (!event.repeat && event.code === 'KeyR') this.flaskQueued = true
    if (!event.repeat && event.code === 'KeyF') this.toggleWeaponGrip()
    if (!event.repeat && event.code === 'KeyL') {
      this.defenseQueued = true
      if (this.currentSkill === 'prayer'
        && !(this.movement.grounded && (this.keys.has('KeyA') !== this.keys.has('KeyD'))
          && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')))
        && this.combat.attack.phase === 'idle' && this.combat.defense.mode === 'idle') {
        this.prayerSequence = []
        this.message = '圣典已展开：按 W/A/S/D 输入祷言，松开 L 释放。'
        this.publishSnapshot()
      }
    }
    if (!event.repeat && event.code === 'KeyE') this.interactQueued = true
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
    if (event.code === 'KeyL' && this.prayerSequence !== null) this.finishPrayer()
  }

  private readonly onBlur = (): void => {
    this.keys.clear()
    this.jumpQueued = false
    this.attackQueued = null
    this.shieldBashQueued = false
    this.flaskQueued = false
    this.defenseQueued = false
    this.prayerSequence = null
    this.interactQueued = false
  }

  private readonly onResize = (): void => {
    this.engine.resize()
    this.updateCameraBounds()
  }

  private updateCameraBounds(): void {
    this.visuals.updateCameraBounds(this.engine)
  }

  private get shieldReduction(): number {
    return this.magicGuardRemaining > 0 ? 1
      : this.flags.equipmentRecovered ? shieldStats(this.equipment).reduction : 0
  }

  private get parryBonusFrames(): number {
    return this.flags.equipmentRecovered ? shieldStats(this.equipment).parryBonusFrames : 0
  }

  private get currentSkill(): ReturnType<typeof activeSkill> {
    return this.flags.equipmentRecovered ? activeSkill(this.equipment) : 'none'
  }

  private get skillName(): string {
    if (this.currentSkill === 'catalog') return weapons[this.equipment.mainHand].skillName
    return ({ shield: '盾牌弹反/格挡', prayer: '圣典祷言', holyGuard: '圣盾格挡',
      flurry: '连续突刺', soulArrow: '追踪灵魂箭', blessing: '祝福',
      daggerStep: '短刀闪避步', none: '无', catalog: '待接入' } as Record<ReturnType<typeof activeSkill>, string>)[this.currentSkill]
  }

  private get currentWeaponPower(): number {
    return this.flags.equipmentRecovered ? weaponPower(this.equipment, originAttributes[this.origin]) : 0.4
  }

  private get currentWeaponReach(): number {
    return this.flags.equipmentRecovered ? weapons[this.equipment.mainHand].reach : 1.0
  }

  private receiveHit(damage: number, attackerX: number, attackerName: string): HitOutcome {
    const result = resolveIncomingHit(this.combat, damage, this.shieldReduction,
      this.facing * (attackerX - this.movement.x) > 0, this.parryBonusFrames)
    this.combat = result.state
    const interruptedPrayer = this.prayerSequence !== null
    if (result.outcome === 'hit' || result.outcome === 'guardBroken') this.prayerSequence = null
    this.message = result.outcome === 'parried' ? `弹反${attackerName}！对方露出破绽。`
      : result.outcome === 'dodged' ? `闪避了${attackerName}的攻击。`
        : result.outcome === 'blocked' ? `格挡了${attackerName}的攻击。`
          : result.outcome === 'guardBroken' ? `精力耗尽，${attackerName}击破了盾牌。`
            : interruptedPrayer ? `${attackerName}击中了你，祷言被打断。` : `${attackerName}击中了你。`
    return result.outcome
  }

  private finishPrayer(): void {
    const sequence = this.prayerSequence?.join('') ?? ''
    this.prayerSequence = null
    const prayers: Record<string, SpellKind> = { WSW: 'smallHeal', WAD: 'radiantWeapon', ADS: 'divineSight' }
    const spell = prayers[sequence]
    if (!spell) {
      this.message = sequence ? `祷言指令 ${sequence} 未对应已知祷言。` : '圣典合上；未输入祷言。'
      this.publishSnapshot()
      return
    }
    const next = castSpell(this.combat, spell)
    if (next === this.combat) {
      this.message = spell === 'smallHeal' && this.combat.player.health >= this.combat.player.maxHealth
        ? '生命已满，无需施放小回复。' : 'FP 不足，祷言无法施放。'
      this.publishSnapshot()
      return
    }
    this.combat = next
    if (spell === 'radiantWeapon') {
      this.radiantRemaining = 60
      this.message = '光辉武器生效 60 秒：近战伤害提高。'
    } else if (spell === 'divineSight') {
      this.sightRemaining = 30
      this.message = '神识生效 30 秒：敌人轮廓发出蓝光。'
    } else this.message = '小回复恢复了 30% 最大生命。'
    this.publishSnapshot()
  }

  private activateWeaponSkill(direction: -1 | 0 | 1): boolean {
    const skill = this.currentSkill
    if (skill === 'shield' || skill === 'prayer') return false
    if (this.combat.attack.phase !== 'idle' || this.combat.defense.mode !== 'idle') return true
    if (skill === 'soulArrow') {
      this.castSoulArrow()
      return true
    }
    if (skill === 'daggerStep') {
      const next = useDaggerStep(this.combat, direction || this.facing)
      this.message = next === this.combat ? '短刀闪避步暂不可用：检查 FP 或冷却。' : '短刀闪避步！'
      this.combat = next
      return true
    }
    if (skill === 'none') {
      this.message = '当前武器没有 L 键战技。'
      return true
    }
    if (skill === 'catalog') {
      this.message = '该武器战技将随所属关卡接入。'
      return true
    }
    const next = castSpell(this.combat, skill)
    if (next === this.combat) {
      this.message = skill === 'blessing' && this.combat.player.health >= this.combat.player.maxHealth
        ? '生命已满，无需施放祝福。' : 'FP 不足，无法施放武器战技。'
      return true
    }
    this.combat = next
    if (skill === 'blessing') this.message = '钉锤祝福恢复了 20% 最大生命。'
    else if (skill === 'holyGuard') {
      this.magicGuardRemaining = 2
      this.combat = { ...this.combat, defense: { ...this.combat.defense, mode: 'guard', elapsed: 0 } }
      this.message = '圣盾格挡生效：按住 L，在两秒内抵御正面攻击。'
    } else if (skill === 'flurry') this.useFlurry()
    return true
  }

  private useFlurry(): void {
    const maxDistance = this.currentWeaponReach + 0.7
    const candidates: { id: EncounterId | 'soldier'; distance: number }[] = []
    const distanceTo = (x: number, y: number): number => {
      const distance = this.facing * (x - this.movement.x)
      return distance > 0 && distance <= maxDistance && Math.abs(y - this.movement.y) < 1.5
        ? distance : Infinity
    }
    if (this.zone === 'prison' && this.combat.enemy.health > 0) {
      candidates.push({ id: 'soldier', distance: distanceTo(this.enemy.x, ENEMY_FLOOR_Y) })
    }
    for (const id of encounterIds) {
      const encounter = this.encounters[id]
      if (encounter.health <= 0 || (id === 'palaceGuard' ? 'city' : 'prison') !== this.zone) continue
      candidates.push({ id, distance: distanceTo(encounter.enemy.x, encounter.floorY) })
    }
    const nearest = candidates.sort((a, b) => a.distance - b.distance)[0]
    if (!nearest || !Number.isFinite(nearest.distance)) {
      this.message = '连续突刺挥空了。'
      this.flurryFlashRemaining = 0.3
      return
    }
    const strikeDamage = Math.round(attackDefinitions.light.damage * this.currentWeaponPower * 0.7)
    for (let strike = 0; strike < 3; strike += 1) {
      if (nearest.id === 'soldier') this.damageSoldier(strikeDamage, poiseRules.light)
      else this.damageEncounter(nearest.id, strikeDamage * 2, poiseRules.light)
    }
    this.flurryFlashRemaining = 0.3
    if (nearest.id === 'soldier' ? this.combat.enemy.health > 0 : this.encounters[nearest.id].health > 0) {
      this.message = '连续突刺三连击命中。'
    }
  }

  private castSoulArrow(): void {
    if (this.combat.attack.phase !== 'idle' || this.combat.defense.mode !== 'idle') return
    const next = castSpell(this.combat, 'soulArrow')
    if (next === this.combat) {
      this.message = 'FP 不足，无法释放追踪灵魂箭。'
      return
    }
    this.combat = next
    const targets: { id: EncounterId | 'soldier'; distance: number }[] = []
    const distanceTo = (x: number, y: number): number => this.facing * (x - this.movement.x) > 0
      && Math.abs(y - this.movement.y) < 1.8 ? Math.abs(x - this.movement.x) : Infinity
    if (this.zone === 'prison' && this.combat.enemy.health > 0) {
      targets.push({ id: 'soldier', distance: distanceTo(this.enemy.x, ENEMY_FLOOR_Y) })
    }
    for (const id of encounterIds) {
      const encounter = this.encounters[id]
      if (encounter.health <= 0 || (id === 'palaceGuard' ? 'city' : 'prison') !== this.zone) continue
      targets.push({ id, distance: distanceTo(encounter.enemy.x, encounter.floorY) })
    }
    const nearest = targets.sort((a, b) => a.distance - b.distance)[0]
    const target = nearest && nearest.distance <= 8 ? nearest.id : null
    const mesh = MeshBuilder.CreateSphere('tracking soul arrow', { diameter: 0.28 }, this.scene)
    mesh.material = this.visuals.spellMaterial
    const x = this.movement.x + this.facing * 0.55
    const y = this.movement.y + 1
    mesh.position.set(x, y, -0.15)
    this.soulArrows.push({ mesh, x, y, direction: this.facing, target, remaining: 0.8, zone: this.zone })
    this.message = target ? '释放追踪灵魂箭，锁定前方敌人。' : '释放灵魂箭，前方没有可锁定目标。'
  }

  private clearSoulArrows(): void {
    for (const arrow of this.soulArrows) arrow.mesh.dispose()
    this.soulArrows.length = 0
  }

  private stepSoulArrows(dt: number): void {
    for (let index = this.soulArrows.length - 1; index >= 0; index -= 1) {
      const arrow = this.soulArrows[index]
      arrow.remaining -= dt
      const encounter = arrow.target && arrow.target !== 'soldier' ? this.encounters[arrow.target] : null
      const targetAlive = arrow.zone === this.zone && (arrow.target === 'soldier'
        ? this.combat.enemy.health > 0 : encounter ? encounter.health > 0 : false)
      const targetX = targetAlive ? arrow.target === 'soldier' ? this.enemy.x : encounter!.enemy.x : null
      const targetY = targetAlive ? arrow.target === 'soldier' ? ENEMY_FLOOR_Y + 1 : encounter!.floorY + 1 : null
      if (targetX !== null && targetY !== null) {
        const dx = targetX - arrow.x
        const dy = targetY - arrow.y
        const distance = Math.hypot(dx, dy)
        if (distance <= 14 * dt + 0.35) {
          if (arrow.target === 'soldier') this.damageSoldier(60)
          else if (arrow.target) this.damageEncounter(arrow.target, 60)
          arrow.mesh.dispose()
          this.soulArrows.splice(index, 1)
          continue
        }
        arrow.x += dx / distance * 14 * dt
        arrow.y += dy / distance * 14 * dt
      } else arrow.x += arrow.direction * 14 * dt
      arrow.mesh.position.set(arrow.x, arrow.y, -0.15)
      if (arrow.remaining <= 0) {
        arrow.mesh.dispose()
        this.soulArrows.splice(index, 1)
      }
    }
  }

  private tick(dt: number): void {
    if (this.timelineOpen) return
    if (this.respawnRemaining > 0) {
      this.respawnRemaining -= dt
      if (this.respawnRemaining <= 0) this.respawn()
      this.publishAtInterval(dt)
      return
    }

    const prayerActive = this.prayerSequence !== null
    const direction = prayerActive ? 0
      : Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) as -1 | 0 | 1
    if (direction !== 0) this.facing = direction
    const sprinting = direction !== 0 && this.movement.grounded && this.combat.player.stamina > 0
      && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))
    if (prayerActive) this.movement.velocityX = 0
    if (this.defenseQueued && !sprinting && this.flags.equipmentRecovered
      && this.activateWeaponSkill(direction)) this.defenseQueued = false
    this.combat = stepDefense(this.combat, { pressed: this.defenseQueued, held: this.keys.has('KeyL'),
      sprinting, direction, shieldReduction: this.shieldReduction }, dt)
    this.defenseQueued = false
    const dodging = this.combat.defense.mode === 'dodge'
    const staggered = this.combat.defense.mode === 'stagger'
    if (staggered) this.movement.velocityX = 0
    this.movement = stepMovement(this.movement,
      { direction: staggered ? 0 : direction, jumpPressed: this.jumpQueued && !dodging && !staggered && !prayerActive,
        sprinting: sprinting && !dodging && !staggered,
        dodgeDirection: dodging ? this.combat.defense.direction : undefined,
        extraJumps: this.flags.doubleJump ? 1 : 0 },
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

    if (this.flaskQueued) {
      const healed = useFlask(this.combat)
      if (healed !== this.combat) {
        this.combat = healed
        this.message = `使用原素瓶，恢复生命。剩余 ${healed.flasks} / ${healed.maxFlasks} 瓶。`
      } else if (this.combat.flasks === 0) this.message = '原素瓶已用尽；在祭坛补充。'
      this.flaskQueued = false
    }

    const enemyStep = stepEnemy(this.enemy, this.movement.x, this.movement.y, dt, ENEMY_FLOOR_Y)
    this.enemy = {
      ...enemyStep.enemy,
      x: Math.max(-39, Math.min(-23, enemyStep.enemy.x)),
    }
    if (enemyStep.playerDamage > 0) {
      const outcome = this.receiveHit(enemyStep.playerDamage, this.enemy.x, '灰烬士兵')
      if (outcome === 'parried') {
        this.enemy = applyEnemyHit(this.enemy, this.combat.enemy.health, poiseRules.parry)
        if (this.enemy.poise.exhaustedRemaining > 0) this.message = '弹反击溃灰烬士兵韧性！3 秒内可处决。'
      }
    }
    const previousEnemyHealth = this.combat.enemy.health
    const offhand = activeOffhand(this.equipment)
    const shieldEquipped = this.flags.equipmentRecovered && offhand !== null
      && offhand in offhandGear && offhandGear[offhand as OffhandGearId].kind === 'shield'
    if (this.shieldBashQueued && !shieldEquipped) this.message = '盾击需要单手装备盾牌。'
    this.combat = stepCombat(
      this.combat,
      this.attackQueued === 'light' && !prayerActive,
      this.movement.x,
      this.movement.y,
      this.facing,
      this.enemy.x,
      dt,
      sprinting && !dodging,
      ENEMY_FLOOR_Y,
      this.attackQueued === 'heavy' && !prayerActive,
      this.currentWeaponPower * (this.radiantRemaining > 0 ? 1.2 : 1),
      this.currentWeaponReach,
      !this.movement.grounded,
      this.enemy.poise.executionAvailable && this.combat.attack.kind !== 'shieldBash'
        ? poiseRules.executionMultiplier : 1,
      this.shieldBashQueued && shieldEquipped && !prayerActive,
    )
    this.attackQueued = null
    this.shieldBashQueued = false
    this.afterSoldierHit(previousEnemyHealth,
      attackPoiseDamage(this.combat.attack.kind, this.combat.attack.jumping),
      this.combat.attack.kind !== 'shieldBash')

    this.stepEncounters(dt)
    this.enemyProjectiles.step(dt, this.movement.x, this.movement.y, this.zone, projectile => {
      const encounter = this.encounters[projectile.ownerId]
      const outcome = this.receiveHit(projectile.damage, projectile.x,
        `${encounter.name}的${projectile.name}`)
      if (outcome === 'parried' && encounter.health > 0) {
        encounter.enemy = applyEnemyHit(encounter.enemy, encounter.health, poiseRules.parry)
        if (encounter.enemy.poise.exhaustedRemaining > 0) {
          this.message = `弹反击溃${encounter.name}韧性！3 秒内可处决。`
        }
      }
    })
    this.stepSoulArrows(dt)
    this.radiantRemaining = Math.max(0, this.radiantRemaining - dt)
    this.sightRemaining = Math.max(0, this.sightRemaining - dt)
    this.magicGuardRemaining = Math.max(0, this.magicGuardRemaining - dt)
    this.flurryFlashRemaining = Math.max(0, this.flurryFlashRemaining - dt)
    if (this.magicGuardRemaining === 0 && this.combat.defense.mode === 'guard'
      && shieldStats(this.equipment).reduction === 0) {
      this.combat.defense = { ...this.combat.defense, mode: 'idle', elapsed: 0 }
    }

    const soulsBefore = this.progression.souls
    this.progression = collectSouls(this.progression, this.movement.x, this.movement.y)
    if (this.progression.souls > soulsBefore) this.message = `获得 ${this.progression.souls - soulsBefore} 魂。`
    if (this.combat.player.health <= 0) {
      this.progression = loseSoulsOnDeath(this.progression, this.movement.x, this.movement.y)
      this.respawnRemaining = 1.4
      this.message = '你死了。即将返回上一个检查点。'
      this.visuals.setPlayerVisible(false)
      this.publishSnapshot()
    }

    this.visuals.renderFrame({ movement: this.movement, combat: this.combat,
      enemy: this.enemy, enemyFloorY: ENEMY_FLOOR_Y, encounters: this.encounters,
      equipment: this.equipment, equipmentRecovered: this.flags.equipmentRecovered,
      facing: this.facing, zone: this.zone, flags: this.flags, loot: this.loot,
      narrative: this.narrative, progression: this.progression,
      respawnRemaining: this.respawnRemaining, sightRemaining: this.sightRemaining,
      flurryFlashRemaining: this.flurryFlashRemaining,
      currentWeaponReach: this.currentWeaponReach }, this.engine, dt)

    this.publishAtInterval(dt)
  }

  private near(x: number, radius = 1.4): boolean {
    return Math.abs(this.movement.x - x) <= radius
  }

  private travel(zone: WorldZone, x: number, y = 2.5): void {
    this.clearSoulArrows()
    this.enemyProjectiles.clear()
    this.zone = zone
    this.movement = initialMovement(x, y)
    this.visuals.travel(x, y)
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
    handlePrisonInteraction(this.interactionContext(), {
      travel: (zone, x, y) => this.travel(zone, x, y),
      collect: id => this.collect(id),
      addFlaskCapacity: () => { this.combat = addFlaskCapacity(this.combat) },
      confirmTimeline: () => this.confirmTimeline(),
      setMessage: message => { this.message = message },
      syncWorld: () => this.syncWorldMeshes(),
      publish: () => this.publishSnapshot(),
    })
  }


  private stepEncounters(dt: number): void {
    for (const id of encounterIds) {
      const encounter = this.encounters[id]
      if (encounter.health <= 0) continue
      const activeZone = id === 'palaceGuard' ? 'city' : 'prison'
      if (this.zone !== activeZone) continue
      const profile = profileForEncounter(id, encounter.health)
      const step = stepEnemy(encounter.enemy, this.movement.x, this.movement.y, dt, encounter.floorY, profile)
      encounter.enemy = { ...step.enemy, x: Math.max(encounter.minX, Math.min(encounter.maxX, step.enemy.x)) }
      if (step.projectile) this.enemyProjectiles.spawn(id, step.projectile.name,
        step.projectile.damage, step.projectile.speed,
        encounter.enemy.x + encounter.enemy.facing * 0.65, encounter.floorY + 1,
        encounter.enemy.facing, this.zone)
      if (step.playerDamage > 0) {
        const attackName = enemyAttackName(encounter.enemy, profile)
        const outcome = this.receiveHit(step.playerDamage, encounter.enemy.x,
          attackName ? `${encounter.name}的${attackName}` : encounter.name)
        if ((outcome === 'hit' || outcome === 'guardBroken') && step.playerDisplacement) {
          const surfaces = surfacesByZone[this.zone]
          const minimum = Math.min(...surfaces.map(surface => surface.minX)) + 0.32
          const maximum = Math.max(...surfaces.map(surface => surface.maxX)) - 0.32
          this.movement = { ...this.movement,
            x: Math.max(minimum, Math.min(maximum, this.movement.x + step.playerDisplacement)),
            velocityX: 0 }
        }
        if (outcome === 'parried') {
          encounter.enemy = applyEnemyHit(encounter.enemy, encounter.health, poiseRules.parry)
          if (encounter.enemy.poise.exhaustedRemaining > 0) this.message = `弹反击溃${encounter.name}韧性！3 秒内可处决。`
        }
      }
      if (this.combat.attack.phase !== 'active' || this.combat.attack.hitTarget) continue
      const definition = attackDefinitions[this.combat.attack.kind]
      const reach = this.currentWeaponReach * definition.reach / attackDefinitions.light.reach
      const hit = { x: this.movement.x + this.facing * (0.35 + reach / 2), y: this.movement.y + 0.35,
        halfWidth: reach / 2, height: definition.height }
      const target = { x: encounter.enemy.x, y: encounter.floorY, halfWidth: id === 'warden' ? 0.88 : 0.65,
        height: id === 'warden' ? 2.8 : 2.1 }
      if (!boxesOverlap(hit, target)) continue
      const damage = this.combat.attack.kind === 'shieldBash' ? definition.damage
        : (this.flags.equipmentRecovered ? id === 'warden' ? 100 : 50 : 25)
          * definition.damage / attackDefinitions.light.damage * this.combat.attack.damageMultiplier
      this.combat.attack.hitTarget = true
      this.damageEncounter(id, damage,
        attackPoiseDamage(this.combat.attack.kind, this.combat.attack.jumping),
        this.combat.attack.kind !== 'shieldBash')
    }
  }

  private damageSoldier(damage: number, poiseDamage = 0): void {
    const previousHealth = this.combat.enemy.health
    this.combat = { ...this.combat, enemy: { ...this.combat.enemy,
      health: Math.max(0, previousHealth - damage) } }
    this.afterSoldierHit(previousHealth, poiseDamage)
  }

  private afterSoldierHit(previousHealth: number, poiseDamage = 0, executionEligible = false): void {
    if (this.combat.enemy.health >= previousHealth) return
    const executed = executionEligible && this.enemy.poise.executionAvailable
    const wasExhausted = this.enemy.poise.exhaustedRemaining > 0
    if (executed) this.enemy = { ...this.enemy, poise: consumeExecution(this.enemy.poise) }
    this.enemy = applyEnemyHit(this.enemy, this.combat.enemy.health, poiseDamage)
    this.message = this.combat.enemy.health === 0 ? '敌人倒下，魂已落在地面。'
      : executed ? '处决命中灰烬士兵，造成双倍伤害！'
        : !wasExhausted && this.enemy.poise.exhaustedRemaining > 0
          ? '灰烬士兵韧性耗尽！3 秒内用 J/K 处决。' : '命中灰烬士兵。'
    if (this.combat.enemy.health === 0) {
      this.progression = dropEnemySouls(this.progression, this.enemy.x, enemyDefinition.souls, ENEMY_FLOOR_Y)
    }
  }

  private damageEncounter(id: EncounterId, damage: number, poiseDamage = 0,
    executionEligible = false): void {
    const encounter = this.encounters[id]
    if (encounter.health <= 0) return
    const executed = executionEligible && encounter.enemy.poise.executionAvailable
    const wasExhausted = encounter.enemy.poise.exhaustedRemaining > 0
    const previousHealth = encounter.health
    encounter.health = Math.max(0, encounter.health - damage
      * (executed ? poiseRules.executionMultiplier : 1))
    if (executed) encounter.enemy = { ...encounter.enemy,
      poise: consumeExecution(encounter.enemy.poise) }
    encounter.enemy = applyEnemyHit(encounter.enemy, encounter.health, poiseDamage)
    if (id === 'warden' && previousHealth > 600 && encounter.health <= 600
      && encounter.health > 0) {
      encounter.enemy = { ...encounter.enemy,
        poise: increaseMaxPoise(encounter.enemy.poise, 450) }
    }
    this.message = executed ? `处决命中${encounter.name}，造成双倍伤害！`
      : !wasExhausted && encounter.enemy.poise.exhaustedRemaining > 0
        ? `${encounter.name}韧性耗尽！3 秒内用 J/K 处决。` : `命中${encounter.name}。`
    if (id === 'warden' && previousHealth > 600 && encounter.health <= 600
      && encounter.health > 0) this.message = '典狱长起身，进入第二阶段！韧性上限提高到 450。'
    if (encounter.health > 0) return
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
      this.combat = addFlaskCapacity(this.combat)
      this.message = '腐化骑士倒下。获得原素瓶碎片（上限 +1）与 300 魂。'
    } else this.message = `${encounter.name}倒下。`
  }

  private respawn(): void {
    const checkpointX = this.progression.checkpointActive ? this.progression.checkpointX : prisonLocations.spawnX
    this.travel('prison', checkpointX, floorAt(checkpointX) ?? 0)
    this.combat = refillAtCheckpoint(this.combat)
    this.magicGuardRemaining = 0
    this.flurryFlashRemaining = 0
    this.radiantRemaining = 0
    this.sightRemaining = 0
    this.enemy = initialEnemy(ENEMY_SPAWN_X)
    const initialRoster = initialEncounters()
    for (const id of encounterIds) {
      const encounter = this.encounters[id]
      if (encounter.health > 0) {
        encounter.health = encounter.maxHealth
        encounter.enemy = initialRoster[id].enemy
      }
    }
    this.visuals.setPlayerVisible(true)
    this.respawnRemaining = 0
    this.message = '你在检查点苏醒。失去的魂可回原地拾取。'
    this.publishSnapshot()
  }

  private syncSoulMeshes(): void {
    this.visuals.syncSouls(this.progression)
  }

  private syncFragmentMeshes(): void {
    this.visuals.syncFragments(this.flags, this.narrative, this.encounters)
  }

  private syncWorldMeshes(): void {
    this.visuals.syncWorld(this.flags, this.loot)
  }

  private interactionContext(): InteractionContext {
    return { zone: this.zone, x: this.movement.x, y: this.movement.y,
      flags: this.flags, origin: this.origin, loot: this.loot,
      acquiredWeapons: this.acquiredWeapons, encounters: this.encounters,
      narrative: this.narrative }
  }

  private interactionPrompt(): string | null {
    return prisonInteractionPrompt(this.interactionContext())
  }


  private publishAtInterval(dt: number): void {
    this.snapshotClock += dt
    if (this.snapshotClock >= 0.1) {
      this.snapshotClock = 0
      this.publishSnapshot()
    }
  }

  private publishSnapshot(): void {
    this.listener(buildGameSnapshot({
      combat: this.combat, movement: this.movement, enemy: this.enemy,
      encounters: this.encounters, zone: this.zone, flags: this.flags,
      narrative: this.narrative, progression: this.progression,
      equipment: this.equipment, origin: this.origin,
      acquiredWeapons: this.acquiredWeapons, acquiredOffhands: this.acquiredOffhands,
      loot: this.loot, discoveredRooms: this.discoveredRooms,
      message: this.message, timelineOpen: this.timelineOpen,
      saveAvailable: this.saveAvailable, canSwitchEquipment: this.canSwitchEquipment(),
      skillName: this.skillName, shieldReduction: this.shieldReduction,
      prayerInput: this.prayerSequence?.join(' → ') ?? null,
      radiantRemaining: this.radiantRemaining, sightRemaining: this.sightRemaining,
      respawnRemaining: this.respawnRemaining,
      nearAltar: this.zone === 'prison' && this.near(ALTAR_X) && this.movement.y < 4,
      prompt: this.interactionPrompt(),
    }))
  }
}
