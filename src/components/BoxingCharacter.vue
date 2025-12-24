<template>
  <div class="character-container">
    <div ref="canvasRef" class="character-canvas"></div>

    <div class="character-info">
      <div class="character-name">{{ characterName }}</div>
      <div class="character-position">
        <div class="position-label">位置</div>
        <div class="position-display">
          X: {{ Math.round(position.x) }}, Y: {{ Math.round(position.y) }}
        </div>
      </div>
    </div>

    <div class="character-status">
      当前动作: <span class="current-action">{{ currentAction }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  characterName?: string
  position?: { x: number; y: number; z: number }
  action?: string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  characterName: '角色',
  position: () => ({ x: 0, y: 0, z: 0 }),
  action: 'idle',
  color: '#ff6b6b'
})

const canvasRef = ref<HTMLDivElement>()
const currentAction = ref<string>('待机')
const position = ref({ x: 0, y: 0, z: 0 })
let scene: any = null
let renderer: any = null
let camera: any = null
let character: any = null
let animationId: number | null = null

// 手指控制动作枚举
const FingerActions = {
  IDLE: 'idle',
  THUMB_UP: 'thumb_up',
  INDEX_UP: 'index_up',
  MIDDLE_UP: 'middle_up',
  RING_UP: 'ring_up',
  PINKY_UP: 'pinky_up',
  FIST: 'fist',
  OPEN_PALM: 'open_palm'
}

// 动作映射到显示名称
const actionDisplayNames: Record<string, string> = {
  [FingerActions.IDLE]: '待机',
  [FingerActions.THUMB_UP]: '向上移动',
  [FingerActions.INDEX_UP]: '向前移动',
  [FingerActions.MIDDLE_UP]: '向后移动',
  [FingerActions.RING_UP]: '向左移动',
  [FingerActions.PINKY_UP]: '向右移动',
  [FingerActions.FIST]: '停止',
  [FingerActions.OPEN_PALM]: '跳跃'
}

const initializeThreeJS = async () => {
  try {
    // @ts-ignore
    const threeModule = await import('three').catch(() => null)

    if (!threeModule) {
      createFallbackDisplay()
      return
    }

    const THREE = threeModule

    // 创建场景
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)

    // 创建相机
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    camera.position.set(0, 1, 3)
    camera.lookAt(0, 0, 0)

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(300, 300)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    if (canvasRef.value) {
      canvasRef.value.appendChild(renderer.domElement)
    }

    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // 创建人偶
    createCharacter(THREE)

    // 开始渲染循环
    animate()
  } catch (error) {
    console.error('Failed to initialize Three.js:', error)
    createFallbackDisplay()
  }
}

const createCharacter = (THREE: any) => {
  // 创建人偶的简单几何体
  character = new THREE.Group()

  // 身体
  const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8)
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: props.color })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.6
  body.castShadow = true
  character.add(body)

  // 头部
  const headGeometry = new THREE.SphereGeometry(0.25, 16, 16)
  const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac })
  const head = new THREE.Mesh(headGeometry, headMaterial)
  head.position.y = 1.5
  head.castShadow = true
  character.add(head)

  // 手臂
  const armGeometry = new THREE.CapsuleGeometry(0.08, 0.8, 4, 8)
  const armMaterial = new THREE.MeshLambertMaterial({ color: props.color })

  const leftArm = new THREE.Mesh(armGeometry, armMaterial)
  leftArm.position.set(-0.4, 0.8, 0)
  leftArm.rotation.z = Math.PI / 6
  leftArm.castShadow = true
  character.add(leftArm)

  const rightArm = new THREE.Mesh(armGeometry, armMaterial)
  rightArm.position.set(0.4, 0.8, 0)
  rightArm.rotation.z = -Math.PI / 6
  rightArm.castShadow = true
  character.add(rightArm)

  // 腿部
  const legGeometry = new THREE.CapsuleGeometry(0.12, 1.0, 4, 8)
  const legMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 })

  const leftLeg = new THREE.Mesh(legGeometry, legMaterial)
  leftLeg.position.set(-0.15, -0.5, 0)
  leftLeg.castShadow = true
  character.add(leftLeg)

  const rightLeg = new THREE.Mesh(legGeometry, legMaterial)
  rightLeg.position.set(0.15, -0.5, 0)
  rightLeg.castShadow = true
  character.add(rightLeg)

  // 设置人偶位置
  character.position.set(props.position.x, props.position.y, props.position.z)

  scene.add(character)
}

const createFallbackDisplay = () => {
  if (!canvasRef.value) return

  const fallback = document.createElement('div')
  fallback.className = 'character-fallback'
  fallback.innerHTML = `
    <div class="fallback-icon">👤</div>
    <div class="fallback-text">3D渲染未加载</div>
  `
  canvasRef.value.appendChild(fallback)
}

const animate = () => {
  if (!renderer || !scene || !camera) return

  animationId = requestAnimationFrame(animate)

  // 只有当组件可见时才更新动画
  if (character && isVisible()) {
    updateAnimation()
    // 更新位置显示
    position.value.x = character.position.x
    position.value.y = character.position.y
    position.value.z = character.position.z
    renderer.render(scene, camera)
  }
}

const isVisible = (): boolean => {
  // 检查元素是否在视口中（简单的实现）
  if (!canvasRef.value) return false

  const rect = canvasRef.value.getBoundingClientRect()
  return rect.top < window.innerHeight && rect.bottom > 0
}

const updateAnimation = () => {
  if (!character) return

  const time = Date.now() * 0.001

  switch (props.action) {
    case FingerActions.THUMB_UP:
      // 向上移动动画 - 身体向上倾斜
      character.rotation.x = -Math.PI / 6
      character.position.y = Math.sin(time * 8) * 2
      break
    case FingerActions.INDEX_UP:
      // 向前移动动画 - 身体向前倾
      character.rotation.x = Math.PI / 12
      character.position.z = Math.sin(time * 8) * 1
      break
    case FingerActions.MIDDLE_UP:
      // 向后移动动画 - 身体向后倾
      character.rotation.x = -Math.PI / 12
      character.position.z = -Math.sin(time * 8) * 1
      break
    case FingerActions.RING_UP:
      // 向左移动动画 - 身体向左倾
      character.rotation.z = Math.PI / 8
      character.position.x = -Math.sin(time * 8) * 1
      break
    case FingerActions.PINKY_UP:
      // 向右移动动画 - 身体向右倾
      character.rotation.z = -Math.PI / 8
      character.position.x = Math.sin(time * 8) * 1
      break
    case FingerActions.OPEN_PALM:
      // 跳跃动画 - 身体向上跳起
      const jumpProgress = Math.sin(time * 6)
      character.position.y = Math.abs(jumpProgress) * 8
      character.rotation.x = jumpProgress * Math.PI / 8
      break
    case FingerActions.FIST:
      // 停止动画 - 身体稳定
      character.rotation.set(0, 0, 0)
      character.position.y = 0
      break
    default:
      // 待机动画 - 轻微呼吸效果
      character.rotation.y = Math.sin(time * 2) * 0.02
      character.position.y = Math.sin(time * 3) * 0.5
  }
}

const performAction = (action: string) => {
  currentAction.value = actionDisplayNames[action] || action

  // 重置动画状态
  if (character) {
    character.rotation.set(0, 0, 0)
    character.children.forEach((child: any) => {
      if (child.rotation) {
        child.rotation.set(0, 0, 0)
      }
    })
  }
}

// 监听动作变化
watch(() => props.action, (newAction) => {
  performAction(newAction)
})

onMounted(() => {
  initializeThreeJS()
  performAction(props.action)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  if (renderer) {
    renderer.dispose()
  }
})
</script>

<style scoped>
.character-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.character-canvas {
  width: 300px;
  height: 300px;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.character-fallback {
  text-align: center;
  color: #666;
}

.fallback-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.fallback-text {
  font-size: 0.9rem;
}

.character-info {
  margin-top: 1rem;
  text-align: center;
  width: 100%;
}

.character-name {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.75rem;
}

.character-position {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.position-label {
  font-size: 0.9rem;
  color: #666;
  min-width: 50px;
}

.position-display {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: #007bff;
  background: rgba(0, 123, 255, 0.1);
  padding: 4px 12px;
  border-radius: 8px;
  text-align: center;
}

.character-status {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #666;
  text-align: center;
}

.current-action {
  font-weight: bold;
  color: #007bff;
}
</style>
