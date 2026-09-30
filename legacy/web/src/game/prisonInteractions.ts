import type { NarrativeState } from '../narrative/model'
import type { WorldZone } from '../world/prisonLayout'
import { prisonLocations } from '../world/prisonLayout'
import { originLoadouts, type OriginId } from '../world/originLoadouts'
import type { PrisonFlags } from '../world/prisonProgression'
import type { WeaponId } from '../world/equipment'
import type { Encounter, EncounterId } from './encounters'

export interface InteractionContext {
  zone: WorldZone
  x: number
  y: number
  flags: PrisonFlags
  origin: OriginId
  loot: Set<string>
  acquiredWeapons: Set<WeaponId>
  encounters: Record<EncounterId, Encounter>
  narrative: NarrativeState
}

export interface InteractionActions {
  travel(zone: WorldZone, x: number, y?: number): void
  collect(id: string): boolean
  addFlaskCapacity(): void
  confirmTimeline(): void
  setMessage(message: string): void
  syncWorld(): void
  publish(): void
}

function near(playerX: number, targetX: number, radius = 1.4): boolean {
  return Math.abs(playerX - targetX) <= radius
}

export function handlePrisonInteraction(ctx: InteractionContext, actions: InteractionActions): void {
  const { x, y, zone, flags, loot } = ctx
  const at = (target: number, radius?: number) => near(x, target, radius)
  const message = actions.setMessage
  if (zone === 'prison') {
    if (at(prisonLocations.equipmentX) && y < 2) {
      if (!flags.equipmentRecovered) {
        flags.equipmentRecovered = true
        const gear = originLoadouts[ctx.origin]
        message(`取回${gear.name}装备：${gear.mainHand}、${gear.offHand}、四部位防具与${gear.other}。`)
      }
    } else if (at(-75) && y < 2 && !loot.has('备用短刀')) {
      loot.add('备用短刀')
      ctx.acquiredWeapons.add('dagger')
      message('从牢房 D 取走备用短刀。')
    } else if (at(-65) && y < 0 && !loot.has('花木戒指')) {
      loot.add('花木戒指')
      message('在下水道石桥下找到花木戒指。')
    } else if (at(-55.5) && y < 1 && !loot.has('通风管原素瓶碎片')) {
      loot.add('通风管原素瓶碎片')
      actions.addFlaskCapacity()
      message('循着羽毛调查假墙，找到原素瓶碎片。原素瓶上限 +1。')
    } else if (at(-8) && y > 5.7 && !loot.has('长廊高台戒指')) {
      loot.add('长廊高台戒指')
      message('回访长廊高台，取得藏在高处的戒指。')
    } else if (at(prisonLocations.archiveX) && y < 4) {
      message(actions.collect('F01') ? '获得 F01 政务记录。时间轴已解锁，按 T 调查历史。' : '档案室的政务记录已经收起。')
    } else if (at(prisonLocations.shortcutX) && y > 6.5) {
      if (!flags.shortcutOpen) {
        flags.shortcutOpen = true
        message('踢下铁梯！监狱二楼与中层走廊形成永久环路。')
      } else {
        actions.travel('prison', prisonLocations.shortcutX, 2.5)
        message('沿捷径梯返回中层走廊。')
      }
    } else if (at(prisonLocations.shortcutX) && y < 4) {
      if (flags.shortcutOpen) {
        actions.travel('prison', prisonLocations.shortcutX, 7)
        message('沿捷径梯到达监狱二楼。')
      } else message('铁梯的固定销在上方；你现在打不开。')
    } else if (at(prisonLocations.noticeboardX) && y < 4) {
      message(flags.spiritPerception
        ? actions.collect('F07') ? '隐藏字迹浮现。获得 F07：典狱长拒绝执行释放令。' : '公告板的隐字已经记录。'
        : '普通公告板。似乎还有被覆盖的字迹，但现在无法辨认。')
    } else if (at(prisonLocations.altarX) && y < 4) {
      actions.confirmTimeline()
    } else if (at(prisonLocations.exitX) && y < 4) {
      if (!flags.exitKnowledge) message('正门不是死锁：你尚不明白该走哪套公文程序。调查 F01、F03，回祭坛拼时间轴。')
      else {
        flags.frontGateOpen = true
        actions.travel('city', 55)
        message('根据首相文书线索找到了通行滑槽，进入王城街道。皇宫前厅在右侧。')
      }
    } else if (at(prisonLocations.armoryStairX) && y < 4) {
      actions.travel('armory', 94)
      message('进入军械库外廊。大厅后楼梯仍可返回。')
    } else if (at(prisonLocations.lockX) && y < 4) {
      if (!flags.wardenKey) message('责难官身后的门锁着。锁孔上刻着典狱长徽记。')
      else {
        flags.lockedDoorOpen = true
        actions.travel('detention', 116)
        message('典狱长钥匙串打开铁门：这里是拘押档案夹层。')
      }
    } else if (at(prisonLocations.upperGateX) && y < 4) {
      message('二楼平台就在头顶。需要从完整历史解释中获得二段跳。')
    }
  } else if (zone === 'city') {
    if (at(prisonLocations.cityReturnX)) {
      actions.travel('prison', 10)
      message('返回监狱大厅。')
    } else if (at(prisonLocations.palaceEvidenceX)) {
      message(ctx.encounters.palaceGuard.health > 0
        ? '封锁令在禁卫队长身上。先击败他。'
        : actions.collect('F10') ? '搜索禁卫队长尸体，获得 F10 城门封锁令。可回监狱祭坛拼政变线。'
          : '队长的封锁令已经取走。')
    }
  } else if (zone === 'armory') {
    if (at(prisonLocations.armoryReturnX)) {
      actions.travel('prison', 20)
      message('沿后楼梯返回监狱大厅。')
    } else if (at(103)) {
      if (flags.lockedDoorOpen) {
        actions.travel('detention', 112)
        message('从军械库外廊进入拘押档案夹层。')
      } else message('这条检修通道从刑讯室一侧锁着。')
    }
  } else if (at(prisonLocations.detentionX)) {
    if (!flags.archiveRewardTaken) {
      flags.archiveRewardTaken = true
      loot.add('装备强化材料')
      message('调查拘押名册：放囚令与拒令记录互相矛盾。获得装备强化材料。')
    } else message('拘押名册已调查；这里的记录仍不能证明哪方说了真话。')
  } else if (at(111)) {
    actions.travel('armory', 102)
    message('进入军械库外廊。')
  } else if (at(118)) {
    actions.travel('prison', 41)
    message('回到责难官身后的铁门。')
  }
  actions.syncWorld()
  actions.publish()
}

export function prisonInteractionPrompt(ctx: InteractionContext): string | null {
  const { x, y, zone, flags, loot, narrative } = ctx
  const at = (target: number, radius?: number) => near(x, target, radius)
  if (zone === 'prison') {
    if (at(prisonLocations.equipmentX) && y < 2 && !flags.equipmentRecovered) return 'E · 取回被没收的职业装备'
    if (at(-75) && y < 2 && !loot.has('备用短刀')) return 'E · 调查牢房 D'
    if (at(-65) && y < 0 && !loot.has('花木戒指')) return 'E · 调查石桥下方'
    if (at(-55.5) && y < 1 && !loot.has('通风管原素瓶碎片')) return 'E · 调查羽毛与假墙'
    if (at(prisonLocations.shortcutX)) return y > 6.5
      ? flags.shortcutOpen ? 'E · 沿捷径梯下降' : 'E · 从二楼放下铁梯'
      : flags.shortcutOpen ? 'E · 沿捷径梯登上二楼' : '梯口在头顶，需从另一侧打开'
    if (at(prisonLocations.archiveX) && y < 4 && !narrative.collectedFragmentIds.includes('F01')) return 'E · 调查档案室政务记录 F01'
    if (at(-8) && y > 5.7 && !loot.has('长廊高台戒指')) return 'E · 取得高台戒指'
    if (at(-8) && y < 4 && !flags.doubleJump) return '高台尚不可达：需要二段跳'
    if (at(prisonLocations.noticeboardX) && y < 4) return flags.spiritPerception
      ? 'E · 读取公告板隐藏字迹 F07' : '公告板似乎盖着旧字迹'
    if (at(prisonLocations.exitX) && y < 4) return flags.exitKnowledge
      ? 'E · 走首相公文通道，进入王城' : 'E · 调查王城出口的通行程序'
    if (at(prisonLocations.altarX) && y < 4) return 'T · 拼时间轴；E · 祭坛确认解释并存档'
    if (at(prisonLocations.armoryStairX) && y < 4) return 'E · 前往军械库外廊'
    if (at(prisonLocations.upperGateX) && y < 4) return flags.doubleJump
      ? 'W／Space · 连按两次跳上监狱二楼' : '上方二楼需要二段跳'
    if (at(prisonLocations.lockX) && y < 4) return flags.wardenKey
      ? 'E · 用典狱长钥匙串打开铁门' : 'E · 调查责难官身后的锁门'
  } else if (zone === 'city') {
    if (at(prisonLocations.cityReturnX)) return 'E · 返回监狱大厅'
    if (at(prisonLocations.palaceEvidenceX)) return ctx.encounters.palaceGuard.health > 0
      ? '击败禁卫队长，取得封锁令' : 'E · 搜索尸体取得 F10'
  } else if (zone === 'armory') {
    if (at(prisonLocations.armoryReturnX)) return 'E · 返回监狱大厅后楼梯'
    if (at(103)) return flags.lockedDoorOpen ? 'E · 进入拘押档案夹层' : '通道从刑讯室侧锁着'
  } else {
    if (at(111)) return 'E · 通往军械库外廊'
    if (at(prisonLocations.detentionX) && !flags.archiveRewardTaken) return 'E · 调查拘押名册'
    if (at(118)) return 'E · 回责难官房'
  }
  return null
}
