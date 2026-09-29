export interface MovementState {
  x: number
  y: number
  velocityX: number
  velocityY: number
  grounded: boolean
  coyoteRemaining: number
  jumpBufferRemaining: number
  airJumpsRemaining: number
}

export interface MovementInput {
  direction: -1 | 0 | 1
  jumpPressed: boolean
  sprinting?: boolean
  extraJumps?: number
}

export interface WalkSurface {
  minX: number
  maxX: number
  y: number
  oneWay?: boolean
}

export const movementTuning = {
  speed: 6,
  sprintMultiplier: 1.5,
  groundAcceleration: 42,
  airAcceleration: 23,
  deceleration: 38,
  gravity: 27,
  jumpSpeed: 10.5,
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,
} as const

export function initialMovement(x = -5, y = 0): MovementState {
  return {
    x,
    y,
    velocityX: 0,
    velocityY: 0,
    grounded: true,
    coyoteRemaining: movementTuning.coyoteTime,
    jumpBufferRemaining: 0,
    airJumpsRemaining: 0,
  }
}

function approach(value: number, target: number, change: number): number {
  return value < target
    ? Math.min(value + change, target)
    : Math.max(value - change, target)
}

export function stepMovement(
  state: MovementState,
  input: MovementInput,
  deltaTime: number,
  surfaces: readonly WalkSurface[] = [{ minX: -12, maxX: 12, y: 0 }],
): MovementState {
  const dt = Math.max(0, Math.min(deltaTime, 1 / 30))
  let coyoteRemaining = state.grounded
    ? movementTuning.coyoteTime
    : Math.max(0, state.coyoteRemaining - dt)
  let jumpBufferRemaining = input.jumpPressed
    ? movementTuning.jumpBufferTime
    : Math.max(0, state.jumpBufferRemaining - dt)
  let velocityY = state.velocityY
  let grounded = state.grounded
  let airJumpsRemaining = state.airJumpsRemaining

  if (jumpBufferRemaining > 0 && coyoteRemaining > 0) {
    velocityY = movementTuning.jumpSpeed
    grounded = false
    coyoteRemaining = 0
    jumpBufferRemaining = 0
    airJumpsRemaining = input.extraJumps ?? 0
  } else if (input.jumpPressed && !grounded && coyoteRemaining === 0 && airJumpsRemaining > 0) {
    velocityY = movementTuning.jumpSpeed
    airJumpsRemaining -= 1
    jumpBufferRemaining = 0
  }

  const acceleration = grounded
    ? movementTuning.groundAcceleration
    : movementTuning.airAcceleration
  const velocityX = input.direction === 0
    ? approach(state.velocityX, 0, movementTuning.deceleration * dt)
    : approach(state.velocityX, input.direction * movementTuning.speed * (input.sprinting ? movementTuning.sprintMultiplier : 1), acceleration * dt)

  const worldMin = Math.min(...surfaces.map(surface => surface.minX))
  const worldMax = Math.max(...surfaces.map(surface => surface.maxX))
  const halfWidth = 0.32
  let x = Math.max(worldMin + halfWidth, Math.min(worldMax - halfWidth, state.x + velocityX * dt))
  let resolvedVelocityX = velocityX
  for (const surface of surfaces) {
    if (surface.y <= state.y + 0.04 || 'oneWay' in surface && surface.oneWay) continue
    if (state.x + halfWidth <= surface.minX + 0.001 && x + halfWidth > surface.minX) {
      x = surface.minX - halfWidth
      resolvedVelocityX = 0
    } else if (state.x - halfWidth >= surface.maxX - 0.001 && x - halfWidth < surface.maxX) {
      x = surface.maxX + halfWidth
      resolvedVelocityX = 0
    }
  }

  const support = surfaces.find(surface => x >= surface.minX && x <= surface.maxX && Math.abs(surface.y - state.y) < 0.04)
  if (grounded && support && velocityY <= 0) {
    return { x, y: support.y, velocityX: resolvedVelocityX, velocityY: 0, grounded: true,
      coyoteRemaining: movementTuning.coyoteTime, jumpBufferRemaining,
      airJumpsRemaining: input.extraJumps ?? 0 }
  }

  grounded = false
  velocityY -= movementTuning.gravity * dt
  let y = state.y + velocityY * dt
  if (velocityY <= 0) {
    const landing = surfaces
      .filter(surface => x >= surface.minX && x <= surface.maxX && state.y >= surface.y - 0.001 && y <= surface.y)
      .sort((a, b) => b.y - a.y)[0]
    if (landing) {
      y = landing.y
      velocityY = 0
      grounded = true
      coyoteRemaining = movementTuning.coyoteTime
      airJumpsRemaining = input.extraJumps ?? 0
    }
  }

  return {
    x,
    y,
    velocityX: resolvedVelocityX,
    velocityY,
    grounded,
    coyoteRemaining,
    jumpBufferRemaining,
    airJumpsRemaining,
  }
}
