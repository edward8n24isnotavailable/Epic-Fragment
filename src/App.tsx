import { useEffect, useRef, useState } from 'react'
import { GameRuntime, type GameSnapshot } from './game/GameRuntime'
import { demoFragments, demoTimeNodes } from './narrative/demoData'
import { initialNarrative } from './narrative/state'
import { buildTimelineView } from './narrative/view'
import { TimelinePanel } from './ui/TimelinePanel'
import { originLoadouts, type OriginId } from './world/originLoadouts'
import './style.css'

const initialSnapshot: GameSnapshot = {
  health: 350,
  maxHealth: 350,
  stamina: 90,
  maxStamina: 90,
  enemyHealth: 80,
  enemyMaxHealth: 80,
  attackPhase: 'idle',
  grounded: true,
  souls: 0,
  checkpointActive: false,
  dead: false,
  message: '向右穿过牢房，探索监狱。',
  room: '牢房',
  discoveredRooms: 1,
  fragments: 0,
  timelineOpen: false,
  timelineUnlocked: false,
  timeline: buildTimelineView(initialNarrative(demoTimeNodes), demoTimeNodes, demoFragments),
  equipmentRecovered: false,
  exitKnowledge: false,
  spiritPerception: false,
  doubleJump: false,
  shortcutOpen: false,
  wardenKey: false,
  lockedDoorOpen: false,
  nearAltar: false,
  enemyName: '灰烬士兵',
  totalRooms: 14,
  origin: 'knight',
  originLevel: 9,
  equipmentSummary: '囚服、牢门钥匙；职业装备被没收',
  loot: [],
  prompt: null,
}

function Meter({ label, value, maximum, kind }: { label: string; value: number; maximum: number; kind: string }) {
  return (
    <div className="meter">
      <div className="meter-label"><span>{label}</span><span>{value} / {maximum}</span></div>
      <div className={`meter-track ${kind}`}><div style={{ width: `${value / maximum * 100}%` }} /></div>
    </div>
  )
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<GameRuntime | null>(null)
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [status, setStatus] = useState('正在唤醒遗迹…')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    GameRuntime.create(canvas, setSnapshot).then(runtime => {
      if (cancelled) runtime.dispose()
      else {
        runtimeRef.current = runtime
        setStatus('监狱 Greybox 已载入')
      }
    }).catch(error => {
      setStatus(`场景初始化失败：${error instanceof Error ? error.message : String(error)}`)
    })
    return () => {
      cancelled = true
      runtimeRef.current?.dispose()
      runtimeRef.current = null
    }
  }, [])

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="史诗碎片监狱 Greybox" />
      <div className="screen-shade" />
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">✦</div>
        <div className="brand-copy"><strong>史诗碎片</strong><span>EPIC FRAGMENT</span></div>
        <div className="stage-badge"><span className="status-dot" />VERTICAL SLICE · PRISON</div>
      </header>

      <section className="hud" aria-label="角色状态">
        <p className="eyebrow">无名囚徒 <span>LV. {snapshot.originLevel}</span></p>
        <label className="origin-picker">出身
          <select value={snapshot.origin} disabled={snapshot.equipmentRecovered}
            onChange={event => runtimeRef.current?.chooseOrigin(event.target.value as OriginId)}>
            {Object.entries(originLoadouts).map(([id, loadout]) => <option key={id} value={id}>{loadout.name}</option>)}
          </select>
        </label>
        <Meter label="生命" value={snapshot.health} maximum={snapshot.maxHealth} kind="health" />
        <Meter label="精力" value={snapshot.stamina} maximum={snapshot.maxStamina} kind="stamina" />
        <div className="hud-caption">魂 · {snapshot.souls}　/　祭坛 · {snapshot.checkpointActive ? '已点亮' : '未点亮'}</div>
        <div className="room-caption">当前位置 · {snapshot.room}<br />已探索区域 · {snapshot.discoveredRooms} / {snapshot.totalRooms}</div>
        <div className="room-caption">历史证据 · 已收集 {snapshot.fragments}</div>
        <details className="loadout-details"><summary>携带装备</summary><p>{snapshot.equipmentSummary}</p></details>
        {snapshot.loot.length > 0 && <details className="loadout-details"><summary>探索收获 · {snapshot.loot.length}</summary><p>{snapshot.loot.join('、')}</p></details>}
        <div className="room-caption">装备 · {snapshot.equipmentRecovered ? '已取回' : '被没收'}　王城 · {snapshot.exitKnowledge ? '已识别' : '待调查'}<br />感知 · {snapshot.spiritPerception ? '生效' : '无'}　二段跳 · {snapshot.doubleJump ? '已解锁' : '未解锁'}<br />捷径 · {snapshot.shortcutOpen ? '已开启' : '未开启'}　钥匙 · {snapshot.wardenKey ? '已获得' : '无'}</div>
      </section>

      {['牢房', '监狱走廊', '中层走廊', '腐化骑士长廊', '责难官房', '监狱二楼', '皇宫前厅占位'].includes(snapshot.room) && <section className="enemy-card" aria-label={`${snapshot.enemyName}状态`}>
        <span className="eyebrow">当前区域敌人 · {snapshot.enemyName}</span>
        <strong>{snapshot.enemyHealth > 0 ? '观察他的起手动作' : '敌人已倒下'}</strong>
        <Meter label="生命" value={snapshot.enemyHealth} maximum={snapshot.enemyMaxHealth} kind="enemy" />
      </section>}

      {snapshot.prompt && <div className="interaction-hint">{snapshot.prompt}</div>}
      <div className={`center-hint ${snapshot.dead ? 'death-hint' : ''}`}>{snapshot.message}</div>

      {snapshot.timelineOpen && <TimelinePanel
        view={snapshot.timeline}
        onSelect={(nodeId, fragmentId) => runtimeRef.current?.selectTimelineFragment(nodeId, fragmentId)}
        onClose={() => runtimeRef.current?.toggleTimeline()}
        onConfirm={() => runtimeRef.current?.confirmTimeline()}
        nearAltar={snapshot.nearAltar}
      />}

      <footer className="bottom-bar">
        <div className="controls"><span><kbd>A</kbd><kbd>D</kbd> 移动</span><span><kbd>W</kbd>/<kbd>SPACE</kbd> 跳跃</span><span><kbd>SHIFT</kbd> 疾跑</span><span><kbd>J</kbd> 攻击</span><span><kbd>E</kbd> 调查</span><span><kbd>T</kbd> 时间轴</span></div>
        <div className="bottom-actions"><span className="runtime-status">{status}</span><button disabled={!snapshot.timelineUnlocked} title={snapshot.timelineUnlocked ? '打开时间轴' : '找到第一块历史证据后解锁'} onClick={() => runtimeRef.current?.toggleTimeline()}>时间轴</button><button onClick={() => runtimeRef.current?.reset()}>重置原型</button></div>
      </footer>
    </main>
  )
}
