export type EnemyMode = 'patrol' | 'chase' | 'windup' | 'active' | 'recovery' | 'hit' | 'dead'

export interface EnemyState {
  x: number
  spawnX: number
  facing: -1 | 1
  mode: EnemyMode
  elapsed: number
  hitPlayer: boolean
}

export interface EnemyStep {
  enemy: EnemyState
  playerDamage: number
}

export const enemyDefinition = {
  patrolSpeed: 1.1,
  chaseSpeed: 2.3,
  patrolRadius: 1.2,
  detectRange: 4.8,
  attackRange: 1.3,
  windup: 0.6,
  active: 0.16,
  recovery: 0.8,
  hitStun: 0.25,
  damage: 25,
  souls: 50,
} as const

export function initialEnemy(spawnX = 4): EnemyState {
  return { x: spawnX, spawnX, facing: -1, mode: 'patrol', elapsed: 0, hitPlayer: false }
}

export function applyEnemyHit(state: EnemyState, remainingHealth: number): EnemyState {
  return {
    ...state,
    mode: remainingHealth <= 0 ? 'dead' : 'hit',
    elapsed: 0,
    hitPlayer: false,
  }
}

export function stepEnemy(state: EnemyState, playerX: number, playerY: number, dt: number, enemyY = 0): EnemyStep {
  if (state.mode === 'dead') return { enemy: state, playerDamage: 0 }
  const enemy = { ...state, elapsed: state.elapsed + Math.max(0, Math.min(dt, 1 / 30)) }
  const distance = Math.abs(playerX - enemy.x)
  const inVerticalRange = Math.abs(playerY - enemyY) < 1.3
  let playerDamage = 0

  switch (enemy.mode) {
    case 'patrol':
      if (distance < enemyDefinition.detectRange && inVerticalRange) {
        enemy.mode = 'chase'
        enemy.elapsed = 0
      } else {
        enemy.x += enemy.facing * enemyDefinition.patrolSpeed * dt
        if (Math.abs(enemy.x - enemy.spawnX) >= enemyDefinition.patrolRadius) {
          enemy.x = enemy.spawnX + Math.sign(enemy.x - enemy.spawnX) * enemyDefinition.patrolRadius
          enemy.facing = enemy.facing === 1 ? -1 : 1
        }
      }
      break
    case 'chase':
      enemy.facing = playerX < enemy.x ? -1 : 1
      if (distance > enemyDefinition.detectRange * 1.6) {
        enemy.mode = 'patrol'
        enemy.elapsed = 0
      } else if (distance <= enemyDefinition.attackRange && inVerticalRange) {
        enemy.mode = 'windup'
        enemy.elapsed = 0
      } else {
        enemy.x += enemy.facing * enemyDefinition.chaseSpeed * dt
      }
      break
    case 'windup':
      if (enemy.elapsed >= enemyDefinition.windup) {
        enemy.mode = 'active'
        enemy.elapsed = 0
        enemy.hitPlayer = false
      }
      break
    case 'active':
      if (!enemy.hitPlayer && distance <= enemyDefinition.attackRange + 0.25 && inVerticalRange) {
        playerDamage = enemyDefinition.damage
        enemy.hitPlayer = true
      }
      if (enemy.elapsed >= enemyDefinition.active) {
        enemy.mode = 'recovery'
        enemy.elapsed = 0
      }
      break
    case 'recovery':
      if (enemy.elapsed >= enemyDefinition.recovery) {
        enemy.mode = 'chase'
        enemy.elapsed = 0
      }
      break
    case 'hit':
      if (enemy.elapsed >= enemyDefinition.hitStun) {
        enemy.mode = 'chase'
        enemy.elapsed = 0
      }
      break
  }

  return { enemy, playerDamage }
}
