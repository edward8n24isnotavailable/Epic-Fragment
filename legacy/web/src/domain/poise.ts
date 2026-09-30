export interface PoiseState {
  current: number
  max: number
  recoveryDelay: number
  exhaustedRemaining: number
  executionAvailable: boolean
}

export const poiseRules = {
  light: 8,
  heavy: 20,
  parry: 25,
  jumpStrike: 15,
  shieldBash: 12,
  recoveryDelay: 5,
  recoveryRate: 10,
  exhaustionDuration: 3,
  executionMultiplier: 2,
} as const

export function attackPoiseDamage(kind: 'light' | 'heavy' | 'shieldBash', jumping: boolean): number {
  return kind === 'shieldBash' ? poiseRules.shieldBash
    : kind === 'light' ? poiseRules.light : jumping ? poiseRules.jumpStrike : poiseRules.heavy
}

export function initialPoise(max: number): PoiseState {
  return { current: max, max, recoveryDelay: 0, exhaustedRemaining: 0, executionAvailable: false }
}

export function consumeExecution(state: PoiseState): PoiseState {
  return state.executionAvailable ? { ...state, executionAvailable: false } : state
}

export function increaseMaxPoise(state: PoiseState, max: number): PoiseState {
  return { ...state, max, current: state.exhaustedRemaining > 0 ? 0
    : Math.min(max, state.current + Math.max(0, max - state.max)) }
}

export function applyPoiseDamage(state: PoiseState, amount: number): { state: PoiseState; broke: boolean } {
  if (amount <= 0 || state.exhaustedRemaining > 0) return { state, broke: false }
  const current = Math.max(0, state.current - amount)
  const broke = current === 0 && state.current > 0
  return { state: { ...state, current,
    recoveryDelay: broke ? 0 : poiseRules.recoveryDelay,
    exhaustedRemaining: broke ? poiseRules.exhaustionDuration : 0,
    executionAvailable: broke }, broke }
}

export function stepPoise(state: PoiseState, deltaTime: number): PoiseState {
  const dt = Math.max(0, Math.min(deltaTime, 1 / 30))
  if (state.exhaustedRemaining > 0) {
    const exhaustedRemaining = Math.max(0, state.exhaustedRemaining - dt)
    return exhaustedRemaining > 0 ? { ...state, exhaustedRemaining }
      : initialPoise(state.max)
  }
  const recoveryDelay = Math.max(0, state.recoveryDelay - dt)
  const recoveryTime = Math.max(0, dt - state.recoveryDelay)
  return { ...state, recoveryDelay,
    current: Math.min(state.max, state.current + recoveryTime * poiseRules.recoveryRate) }
}
