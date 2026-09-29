import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { PointLight } from '@babylonjs/core/Lights/pointLight'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import { Scene } from '@babylonjs/core/scene'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { armorySurfaces, citySurfaces, detentionSurfaces, prisonLocations, prisonRooms, prisonSurfaces } from '../world/prisonLayout'

export interface PrisonScenery {
  player: Mesh
  enemy: Mesh
  enemyWeapon: Mesh
  cellGuard: Mesh
  corruptedKnight: Mesh
  upperGuards: Mesh[]
  inquisitor: Mesh
  warden: Mesh
  palaceGuard: Mesh
  altar: Mesh
  slash: Mesh
  camera: FreeCamera
  fragmentMeshes: { F01: Mesh; F03: Mesh; F07: Mesh; F10: Mesh }
  gateMeshes: { shortcut: Mesh; cityGate: Mesh; lockedDoor: Mesh; gear: Mesh; archiveReward: Mesh;
    cellKnife: Mesh; flowerRing: Mesh; ventShard: Mesh; ventWall: Mesh; ledgeRing: Mesh; ladderRungs: Mesh[] }
}

export function makeMaterial(scene: Scene, name: string, color: Color3, emissive = Color3.Black()): StandardMaterial {
  const result = new StandardMaterial(name, scene)
  result.diffuseColor = color
  result.emissiveColor = emissive
  result.specularColor = new Color3(0.08, 0.08, 0.1)
  return result
}

function box(scene: Scene, name: string, width: number, height: number, depth: number, x: number, y: number, z: number, surface: StandardMaterial): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene)
  mesh.position.set(x, y, z)
  mesh.material = surface
  return mesh
}

function torch(scene: Scene, x: number, y: number, z: number, ember: StandardMaterial): void {
  box(scene, `torch bracket ${x}`, 0.45, 0.13, 0.36, x, y - 0.25, z + 0.05, ember)
  const flame = MeshBuilder.CreateSphere(`torch flame ${x}`, { diameter: 0.29 }, scene)
  flame.position.set(x, y, z)
  flame.material = ember
  const light = new PointLight(`torch light ${x}`, flame.position.clone(), scene)
  light.diffuse = new Color3(1, 0.46, 0.22)
  light.intensity = 10
  light.range = 8
}

export function createPrisonScenery(scene: Scene): PrisonScenery {
  scene.clearColor = new Color4(0.027, 0.039, 0.064, 1)
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = 0.012
  scene.fogColor = new Color3(0.027, 0.039, 0.064)

  const stone = makeMaterial(scene, 'floor stone', new Color3(0.23, 0.27, 0.31))
  const back = makeMaterial(scene, 'back wall', new Color3(0.075, 0.11, 0.16))
  const trim = makeMaterial(scene, 'wall trim', new Color3(0.28, 0.33, 0.36))
  const iron = makeMaterial(scene, 'prison iron', new Color3(0.13, 0.17, 0.2))
  const gold = makeMaterial(scene, 'altar brass', new Color3(0.56, 0.38, 0.2))
  const ember = makeMaterial(scene, 'torch ember', new Color3(0.94, 0.39, 0.17), new Color3(0.8, 0.2, 0.04))
  const red = makeMaterial(scene, 'inquisitor stone', new Color3(0.27, 0.17, 0.18))
  const evidence = makeMaterial(scene, 'evidence glow', new Color3(0.43, 0.7, 0.79), new Color3(0.17, 0.43, 0.54))
  const water = makeMaterial(scene, 'sewer water', new Color3(0.08, 0.24, 0.25), new Color3(0.02, 0.08, 0.09))

  // StandardMaterial considers only its first four lights by default.
  // Register the global light before the room torches so distant rooms stay visible.
  const ambient = new HemisphericLight('cold ambient', new Vector3(0, 1, -0.5), scene)
  ambient.diffuse = new Color3(0.5, 0.62, 0.77)
  ambient.groundColor = new Color3(0.11, 0.12, 0.18)
  ambient.intensity = 0.95

  for (const surface of [...prisonSurfaces, ...citySurfaces, ...armorySurfaces, ...detentionSurfaces]) {
    const height = surface.oneWay ? 0.3 : surface.y + 3.5
    const floor = box(scene, `floor ${surface.id}`, surface.maxX - surface.minX, height, 5.4,
      (surface.minX + surface.maxX) / 2, surface.oneWay ? surface.y - 0.15 : (surface.y - 3.5) / 2, 0,
      surface.id === 'inquisitor' || surface.id === 'knight-corridor' ? red : stone)
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene)
    box(scene, `floor edge ${surface.id}`, surface.maxX - surface.minX, 0.13, 5.6,
      (surface.minX + surface.maxX) / 2, surface.y - 0.08, 0, trim)
  }

  for (const room of prisonRooms) {
    const width = room.maxX - room.minX
    const center = (room.minX + room.maxX) / 2
    const wallY = room.id === 'Vent' ? 3.3 : room.floorY + 3.4
    box(scene, `back wall ${room.id}`, width, 8.5, 0.5, center, wallY, 2.9, back)
    box(scene, `cornice ${room.id}`, width, 0.22, 0.76, center, wallY + 3.25, 2.58, trim)
    box(scene, `wall band ${room.id}`, width, 0.13, 0.67, center, wallY - 1.95, 2.58, trim)
    for (let x = room.minX + 2.1; x < room.maxX - 1; x += 4.4) {
      box(scene, `arch pier ${room.id} ${x}`, 0.57, 6.4, 0.7, x, wallY - 0.05, 2.43, trim)
      box(scene, `arch head ${room.id} ${x}`, 1.12, 0.24, 0.83, x, wallY + 3.05, 2.43, trim)
    }
  }

  // Cell corridor: barred cells and an open exit into the lower sewer.
  box(scene, 'cell cot', 3.1, 0.28, 1.1, -82, 0.46, 1.5, iron)
  box(scene, 'cell bedding', 2.65, 0.12, 1.0, -82, 0.66, 1.5, stone)
  for (const x of [-84.3, -83.1, -81.9, -80.7, -79.5, -78.3]) {
    box(scene, `cell bars ${x}`, 0.12, 3.4, 0.14, x, 2.0, 1.4, iron)
  }
  box(scene, 'cell lintel', 10.5, 0.22, 0.18, -79, 3.7, 1.4, iron)
  const cellKnife = box(scene, 'cell D backup dagger', 0.65, 0.12, 0.2, -75, 0.72, 1.3, evidence)
  const gear = box(scene, 'confiscated class equipment', 1.3, 1.9, 0.55, prisonLocations.equipmentX, 1.05, 1.35, gold)
  box(scene, 'sewer entrance frame', 0.4, 4, 0.6, -73.2, 0.8, 0.4, trim)

  // Sewer: shallow water, bridge, collapse marker and the route up to the vent.
  box(scene, 'sewer water channel', 14, 0.07, 1.5, -65, -1.42, 1.65, water)
  box(scene, 'sewer stone bridge', 3.3, 0.17, 2.5, -65, -1.33, 0.05, trim)
  const flowerRing = box(scene, 'bridge flower ring', 0.34, 0.12, 0.34, -65, -1.08, -0.8, evidence)
  for (const x of [-70, -60]) torch(scene, x, 1.3, 2.0, ember)
  box(scene, 'sewer collapsed masonry', 1.4, 0.25, 0.8, -61, -1.34, 1.2, trim)

  // Vent: four ascending narrow platforms, ribs and a false-wall silhouette.
  for (const [index, x] of [-55, -51, -47, -43].entries()) {
    const y = -0.5 + index
    box(scene, `vent rib ${index}`, 0.2, 2.5, 0.45, x - 1.7, y + 1.3, 2.35, iron)
    box(scene, `vent overhead ${index}`, 3.8, 0.19, 0.45, x, y + 2.45, 2.35, iron)
    box(scene, `vent platform marker ${index}`, 0.8, 0.12, 0.4, x, y + 0.09, -0.2, trim)
  }
  const ventWall = box(scene, 'vent false wall', 0.22, 2.4, 0.7, -55.8, 0.8, 2.0, iron)
  for (const x of [-56.1, -55.8, -55.5]) box(scene, `vent feather clue ${x}`, 0.1, 0.2, 0.05, x, -0.15, 1.56, trim)
  const ventShard = box(scene, 'vent nest flask shard', 0.4, 0.55, 0.3, -55.4, 0.45, 1.5, evidence)
  ventShard.isVisible = false

  // Middle corridor and the half-open archive room before the knight hall.
  for (const x of [-37, -29, -23]) {
    box(scene, `middle corridor recess ${x}`, 2.2, 3.1, 0.1, x, 4.9, 2.57, iron)
    torch(scene, x + 1.5, 5.7, 2.0, ember)
  }
  box(scene, 'archive half-open door', 0.28, 3.9, 0.8, -20.4, 4.5, 1.6, trim)
  box(scene, 'archive cabinet', 2.3, 2.3, 0.65, prisonLocations.archiveX, 3.75, 2.06, iron)
  for (const x of [-17.7, -17, -16.3]) box(scene, `archive shelf ${x}`, 0.5, 0.12, 0.45, x, 3.7, 1.64, trim)
  box(scene, 'archive reading stand', 1.6, 0.2, 1.1, prisonLocations.archiveX, 3.15, -0.5, trim)
  const fragmentF01 = box(scene, 'fragment F01 record', 0.67, 0.05, 0.45,
    prisonLocations.archiveX, 3.34, -0.55, evidence)
  box(scene, 'archive back shelves', 5.2, 2.6, 0.32, -17, 4.0, 2.4, iron)

  // Elite corridor: arena silhouette and a high ledge for a later return.
  for (const x of [-10, -4, 1]) torch(scene, x, 5.8, 2, ember)
  box(scene, 'knight silhouette pedestal', 1.8, 0.2, 1.3, -5, 2.62, 1.5, iron)
  box(scene, 'double jump ledge', 3.1, 0.3, 1.8, -8, 6.05, 1.0, trim)
  const ledgeRing = box(scene, 'high ledge ring', 0.38, 0.14, 0.38, -8, 6.35, 0.5, evidence)

  // Hall: altar, entrance noticeboard, front door, armory stair and upper gate.
  for (const x of [5, 20, 25]) torch(scene, x, 5.35, 2.0, ember)
  box(scene, 'hall entrance noticeboard', 2.4, 2.1, 0.2, 5.5, 4.3, 2.28, iron)
  const fragmentF07 = box(scene, 'fragment F07 hidden notice', 0.9, 0.55, 0.09, 5.5, 4.5, 2.12, evidence)
  fragmentF07.isVisible = false
  box(scene, 'hall front door', 3, 4.6, 0.15, 9, 5.2, 2.5, iron)
  const cityGate = box(scene, 'knowledge gate seal', 1.4, 0.85, 0.1, prisonLocations.exitX, 4.45, 2.31, gold)
  box(scene, 'armory stair entrance', 3.1, 2.3, 0.15, 21.5, 3.7, 2.5, iron)
  box(scene, 'upper locked gate', 2.8, 2.7, 0.18, 23.7, 8.1, 2.45, iron)
  box(scene, 'upper jump target', 1.9, 0.15, 1.0, 23.7, 6.2, 0.5, gold)
  const shortcut = box(scene, 'one sided shortcut ladder', 0.45, 4.3, 0.5,
    prisonLocations.shortcutX, 4.8, 1.75, iron)
  const ladderRungs: Mesh[] = []
  for (let y = 3.1; y < 6.8; y += 0.55) ladderRungs.push(box(scene, `shortcut rung ${y}`, 1.35, 0.12, 0.26,
    prisonLocations.shortcutX, y, 1.49, trim))
  box(scene, 'second floor warden door', 0.5, 4.1, 0.7, -41.8, 9, 1.8, red)
  for (const x of [-33, -20, -7, 7]) torch(scene, x, 9.6, 2, ember)
  box(scene, 'inquisitor doorway left', 0.55, 5.4, 0.65, 27, 5.0, 1.95, trim)
  box(scene, 'inquisitor doorway head', 2.7, 0.4, 0.8, 28.35, 7.7, 1.95, trim)

  // Inquisitor room: reserved arena footprint and interrogation props.
  box(scene, 'inquisitor platform', 5.5, 0.4, 3.2, 37, 2.76, 0.4, iron)
  box(scene, 'interrogation chair seat', 1.1, 0.18, 0.9, 38, 3.65, 0.25, trim)
  box(scene, 'interrogation chair back', 1.1, 2.1, 0.18, 38, 4.56, 0.62, trim)
  for (const x of [34, 35.2, 36.4, 39.6, 40.8]) box(scene, `inquisitor tool ${x}`, 0.12, 1.55, 0.16, x, 5.9, 2.34, iron)
  torch(scene, 32, 5.35, 2, ember)
  torch(scene, 42, 5.35, 2, ember)
  const lockedDoor = box(scene, 'warden key door', 0.45, 4, 1.1, prisonLocations.lockX, 4.5, 0.3, iron)

  // Small transition spaces keep F10 at the palace foyer without moving it
  // into the prison. The rest of the city and palace remain outside this slice.
  box(scene, 'city return gate', 2.3, 4.2, 0.24, 52, 4.6, 2.35, iron)
  box(scene, 'city smoke silhouette', 5, 2.5, 0.4, 58, 5.5, 2.4, red)
  box(scene, 'palace foyer arch', 2.5, 4, 0.3, 65, 4.5, 2.4, trim)
  const fragmentF10 = box(scene, 'fragment F10 blockade order', 0.9, 0.09, 0.5,
    prisonLocations.palaceEvidenceX, 2.75, -0.5, evidence)
  fragmentF10.isVisible = false
  box(scene, 'armory hall return', 2.1, 3.9, 0.25, 92, 4.45, 2.35, iron)
  box(scene, 'armory archive passage', 2.1, 3.9, 0.25, 103, 4.45, 2.35, trim)
  box(scene, 'detention armory passage', 2.1, 3.9, 0.25, 111, 4.45, 2.35, trim)
  const archiveReward = box(scene, 'detention archive reward', 1.4, 0.18, 0.8,
    prisonLocations.detentionX, 2.75, -0.5, evidence)
  box(scene, 'detention register shelves', 4.3, 2.4, 0.4, 115, 4.1, 2.4, iron)

  const player = MeshBuilder.CreateCapsule('player placeholder', { height: 1.8, radius: 0.42 }, scene)
  player.material = makeMaterial(scene, 'ashen traveller', new Color3(0.72, 0.78, 0.8))
  player.position.set(prisonLocations.spawnX, 0.9, 0)
  const enemy = MeshBuilder.CreateCapsule('ash soldier', { height: 1.8, radius: 0.43 }, scene)
  enemy.position.set(prisonLocations.soldierX, 3.4, 0)
  enemy.material = makeMaterial(scene, 'ash soldier armor', new Color3(0.5, 0.26, 0.23))
  const enemyWeapon = box(scene, 'soldier blade', 0.13, 1.3, 0.13, prisonLocations.soldierX - 0.55, 3.35, -0.1, iron)
  const cellGuard = MeshBuilder.CreateCapsule('first mad soldier', { height: 1.75, radius: 0.4 }, scene)
  cellGuard.position.set(-78.7, 0.9, 0)
  cellGuard.material = makeMaterial(scene, 'mad soldier', new Color3(0.42, 0.37, 0.32))
  const corruptedKnight = MeshBuilder.CreateCapsule('corrupted knight', { height: 2.15, radius: 0.56 }, scene)
  corruptedKnight.position.set(-5, 3.58, 0)
  corruptedKnight.material = makeMaterial(scene, 'corrupted armor', new Color3(0.24, 0.33, 0.29))
  const upperGuards = [10, -2, -15, -27].map((x, index) => {
    const guard = MeshBuilder.CreateCapsule(`upper guard ${index + 1}`, { height: 1.8, radius: 0.41 }, scene)
    guard.position.set(x, 7.9, 0)
    guard.material = makeMaterial(scene, `upper guard armor ${index}`, new Color3(0.38, 0.32, 0.27))
    return guard
  })
  const inquisitor = MeshBuilder.CreateCapsule('inquisitor elite', { height: 2.3, radius: 0.65 }, scene)
  inquisitor.position.set(prisonLocations.inquisitorX, 3.65, 0)
  inquisitor.material = makeMaterial(scene, 'inquisitor robe', new Color3(0.48, 0.12, 0.13))
  const warden = MeshBuilder.CreateCapsule('hidden warden boss', { height: 2.8, radius: 0.88 }, scene)
  warden.position.set(prisonLocations.wardenX, 8.4, 0)
  warden.material = makeMaterial(scene, 'warden black coat', new Color3(0.22, 0.24, 0.31))
  const palaceGuard = MeshBuilder.CreateCapsule('palace guard captain', { height: 2, radius: 0.48 }, scene)
  palaceGuard.position.set(prisonLocations.palaceGuardX, 3.5, 0)
  palaceGuard.material = makeMaterial(scene, 'palace guard armor', new Color3(0.37, 0.36, 0.28))

  const altar = box(scene, 'checkpoint altar', 1.5, 0.7, 1, prisonLocations.altarX, 2.85, -0.6, gold)
  const altarFlame = MeshBuilder.CreateSphere('checkpoint ember', { diameter: 0.42 }, scene)
  altarFlame.position.set(prisonLocations.altarX, 3.4, -0.6)
  altarFlame.material = ember
  const fragmentF03 = box(scene, 'fragment F03 inscription', 0.62, 0.35, 0.06,
    prisonLocations.altarX, 2.95, -1.13, evidence)
  const altarLight = new PointLight('checkpoint light', altarFlame.position.clone(), scene)
  altarLight.diffuse = new Color3(1, 0.53, 0.25)
  altarLight.intensity = 13
  altarLight.range = 6

  const slashMaterial = makeMaterial(scene, 'attack arc', new Color3(0.9, 0.72, 0.4), new Color3(0.55, 0.3, 0.08))
  slashMaterial.alpha = 0.6
  const slash = MeshBuilder.CreateBox('attack visual', { width: 1.35, height: 1.2, depth: 0.08 }, scene)
  slash.material = slashMaterial
  slash.isVisible = false

  const camera = new FreeCamera('side camera', new Vector3(prisonLocations.spawnX, 3.1, -18), scene)
  camera.setTarget(new Vector3(prisonLocations.spawnX, 2.2, 0))
  camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA
  return { player, enemy, enemyWeapon, cellGuard, corruptedKnight, upperGuards,
    inquisitor, warden, palaceGuard, altar, slash, camera,
    fragmentMeshes: { F01: fragmentF01, F03: fragmentF03, F07: fragmentF07, F10: fragmentF10 },
    gateMeshes: { shortcut, cityGate, lockedDoor, gear, archiveReward, cellKnife, flowerRing,
      ventShard, ventWall, ledgeRing, ladderRungs } }
}
