<template>
  <div class="character-container">
    <div ref="canvasRef" class="character-canvas"></div>

    <div class="character-info">
      <div class="character-name">{{ characterName }}</div>
      <div class="character-health">
        <div class="health-label">生命值</div>
        <div class="health-bar">
          <div
            class="health-fill"
            :style="{ width: health + '%' }"
            :class="{ 'low-health': health < 30 }"
          ></div>
        </div>
        <div class="health-text">{{ Math.round(health) }}%</div>
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
  health?: number
  position?: { x: number; y: number; z: number }
  action?: string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  characterName: '拳击手',
  health: 100,
  position: () => ({ x: 0, y: 0, z: 0 }),
  action: 'idle',
  color: '#ff6b6b'
})

const canvasRef = ref<HTMLDivElement>()
const currentAction = ref<string>('待机')
let scene: any = null
let renderer: any = null
let camera: any = null
let character: any = null
let animationId: number | null = null

  // 拳击动作枚举
  const BoxingActions = {
    IDLE: 'idle',
    JAB: 'jab',
    CROSS: 'cross',
    HOOK: 'hook',
    UPPERCUT: 'uppercut',
    BLOCK: 'block',
    HIT: 'hit',
    KO: 'ko'
  }

// 动作映射到显示名称
const actionDisplayNames: Record<string, string> = {
  [BoxingActions.IDLE]: '待机',
  [BoxingActions.JAB]: '直拳',
  [BoxingActions.CROSS]: '交叉拳',
  [BoxingActions.HOOK]: '勾拳',
  [BoxingActions.UPPERCUT]: '上勾拳',
  [BoxingActions.BLOCK]: '格挡',
  [BoxingActions.HIT]: '被击中',
  [BoxingActions.KO]: '击倒'
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
    case BoxingActions.JAB:
      // 直拳动画 - 右手向前伸
      character.children[3].rotation.z = -Math.PI / 3 + Math.sin(time * 10) * 0.2
      break
    case BoxingActions.CROSS:
      // 交叉拳动画 - 左手向前伸
      character.children[2].rotation.z = Math.PI / 3 + Math.sin(time * 10) * 0.2
      break
    case BoxingActions.HOOK:
      // 勾拳动画 - 手臂旋转
      character.children[3].rotation.x = Math.sin(time * 8) * 0.5
      break
    case BoxingActions.BLOCK:
      // 格挡动画 - 手臂抬起
      character.children[2].rotation.z = Math.PI / 2
      character.children[3].rotation.z = -Math.PI / 2
      break
    case BoxingActions.HIT:
      // 被击中动画 - 身体后仰
      character.rotation.z = Math.sin(time * 15) * 0.1
      break
    default:
      // 待机动画 - 轻微摆动
      character.rotation.y = Math.sin(time * 2) * 0.05
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

.character-health {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.health-label {
  font-size: 0.9rem;
  color: #666;
  min-width: 50px;
}

.health-bar {
  flex: 1;
  height: 12px;
  background: #e9ecef;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745 0%, #ffc107 50%, #dc3545 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.health-fill.low-health {
  background: linear-gradient(90deg, #dc3545 0%, #6c757d 100%);
}

.health-text {
  font-size: 0.9rem;
  font-weight: bold;
  color: #333;
  min-width: 40px;
  text-align: right;
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
