import type { TimelineView } from '../narrative/view'

interface TimelinePanelProps {
  view: TimelineView
  onSelect: (nodeId: string, fragmentId: string | null) => void
  onClose: () => void
  onConfirm: () => void
  nearAltar: boolean
}

export function TimelinePanel({ view, onSelect, onClose, onConfirm, nearAltar }: TimelinePanelProps) {
  return (
    <section className="timeline-overlay" role="dialog" aria-modal="true" aria-label="历史时间轴">
      <div className="timeline-panel">
        <header className="timeline-header">
          <div>
            <p className="eyebrow">THE CHRONICLE · 你目前的解释</p>
            <h2>历史时间轴</h2>
            <p>证据记录了不同人的说法。每个节点可选一份已获得的证据，也可以留白。</p>
          </div>
          <button className="timeline-close" onClick={onClose} aria-label="关闭时间轴">关闭 <kbd>ESC</kbd></button>
        </header>

        <div className="timeline-track">
          {view.nodes.map(node => (
            <article className={`timeline-node ${node.hasConflict ? 'has-conflict' : ''}`} key={node.id}>
              <div className="timeline-node-heading">
                <span className="timeline-node-id">{node.id}</span>
                {node.hasConflict && <span className="timeline-conflict">存在矛盾</span>}
              </div>
              <h3>{node.label}</h3>
              <p className="timeline-result">{node.result}</p>
              <div className="timeline-candidates" role="group" aria-label={`${node.label}的证据候选`}>
                <button
                  className={`timeline-choice ${node.selectedId === null ? 'selected' : ''}`}
                  aria-pressed={node.selectedId === null}
                  onClick={() => onSelect(node.id, null)}
                >
                  <strong>我不知道</strong><span>保留此处历史不明</span>
                </button>
                {node.candidates.map(candidate => (
                  <button
                    className={`timeline-choice ${node.selectedId === candidate.id ? 'selected' : ''}`}
                    aria-pressed={node.selectedId === candidate.id}
                    onClick={() => onSelect(node.id, candidate.id)}
                    key={candidate.id}
                  >
                    <strong>{candidate.id} · {candidate.title}</strong>
                    <span>{candidate.statement}</span>
                    <small>来源：{candidate.source}</small>
                    {candidate.reliabilityHint && <small>{candidate.reliabilityHint}</small>}
                  </button>
                ))}
                {node.candidates.length === 0 && <p className="timeline-empty">尚未获得此时段的证据</p>}
              </div>
            </article>
          ))}
        </div>

        <section className="timeline-narrative" aria-label="当前历史解释">
          <p className="eyebrow">CURRENT INTERPRETATION</p>
          <h3>你目前的历史解释</h3>
          <p>{view.narrativeText}</p>
          <p>F01＋F03 可推断王城公文通道；再加入 F05 可获得监狱内临时灵力感知；政变线五节点完成后解锁二段跳。</p>
          <button disabled={!nearAltar} onClick={onConfirm}>在祭坛提交当前解释</button>
          {!nearAltar && <small>请回到监狱大厅祭坛提交解释。</small>}
        </section>
      </div>
    </section>
  )
}
