<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import CameraCapture from './components/CameraCapture.vue'
import BoxingCharacter from './components/BoxingCharacter.vue'
import BoxingArena from './components/BoxingArena.vue'
import { gestureService } from './services/gestureRecognition'
import { gameLogic, GameEvents } from './services/gameLogic'

const gestureDetected = ref<string>('')
const gestureConfidence = ref<number>(0)
const isInitialized = ref<boolean>(false)
const error = ref<string>('')
const characterAction = ref<string>('idle')
const opponentAction = ref<string>('idle')
const arenaRef = ref()

// 双人模式相关
const isMultiplayerMode = ref<boolean>(false)
const player2GestureDetected = ref<string>('')
const player2GestureConfidence = ref<number>(0)
const player2Action = ref<string>('idle')

// 全屏相关
const isFullscreen = ref<boolean>(false)
const showControls = ref<boolean>(true)
let controlsTimeout: number | null = null

onMounted(async () => {
  try {
    await gestureService.initialize()
    isInitialized.value = true

    // 设置游戏逻辑事件监听器
    setupGameLogicListeners()

    // 设置全屏事件监听器
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    // 设置鼠标移动事件监听器
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('touchstart', handleTouchStart)
  } catch (err) {
    console.error('Failed to initialize gesture service:', err)
    error.value = '手势识别初始化失败，请刷新页面重试'
  }
})

onUnmounted(() => {
  gestureService.dispose()
  gameLogic.dispose()

  // 清理事件监听器
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
  document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('touchstart', handleTouchStart)

  if (controlsTimeout) {
    clearTimeout(controlsTimeout)
  }
})

const setupGameLogicListeners = () => {
  // 监听角色移动事件
  gameLogic.on(GameEvents.CHARACTER_MOVE, (data: any) => {
    console.log('角色移动:', data)
  })

  // 监听角色跳跃事件
  gameLogic.on(GameEvents.CHARACTER_JUMP, (data: any) => {
    console.log('角色跳跃:', data)
  })

  // 监听AI对手动作变化
  const updateOpponentAction = () => {
    const opponentState = gameLogic.getCharacter(1)
    opponentAction.value = opponentState.action
  }

  // 定期更新对手动作显示
  setInterval(() => {
    const opponentState = gameLogic.getCharacter(1)
    opponentAction.value = opponentState.action
  }, 100)
}

const handleFrame = async (imageData: ImageData) => {
  if (!isInitialized.value) return

  try {
    const results = await gestureService.processFrame(imageData)

    if (results.length > 0) {
      // 取置信度最高的手势结果
      const bestResult = results.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      )

      gestureDetected.value = getGestureDisplayName(bestResult.gesture)
      gestureConfidence.value = Math.round(bestResult.confidence * 100)

      // 根据手势更新人偶动作和游戏逻辑
      characterAction.value = bestResult.gesture

      // 将玩家1动作传递给游戏逻辑
      if (bestResult.confidence > 0.5) { // 只有当置信度足够高时才触发动作
        gameLogic.setCharacterAction(0, bestResult.gesture)
      }
    } else {
      gestureDetected.value = '未检测到手势'
      gestureConfidence.value = 0
      characterAction.value = 'idle'
      gameLogic.setCharacterAction(0, 'idle')
    }
  } catch (err) {
    console.error('Gesture recognition error:', err)
    gestureDetected.value = '识别出错'
    gestureConfidence.value = 0
    characterAction.value = 'idle'
    gameLogic.setCharacterAction(0, 'idle')
  }
}

const handlePlayer2Frame = async (imageData: ImageData) => {
  if (!isInitialized.value || !isMultiplayerMode.value) return

  try {
    const results = await gestureService.processFrame(imageData)

    if (results.length > 0) {
      // 取置信度最高的手势结果
      const bestResult = results.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      )

      player2GestureDetected.value = getGestureDisplayName(bestResult.gesture)
      player2GestureConfidence.value = Math.round(bestResult.confidence * 100)

      // 根据手势更新玩家2人偶动作和游戏逻辑
      player2Action.value = bestResult.gesture

      // 将玩家2动作传递给游戏逻辑
      if (bestResult.confidence > 0.5) {
        gameLogic.setCharacterAction(1, bestResult.gesture)
      }
    } else {
      player2GestureDetected.value = '未检测到手势'
      player2GestureConfidence.value = 0
      player2Action.value = 'idle'
      gameLogic.setCharacterAction(1, 'idle')
    }
  } catch (err) {
    console.error('Player 2 gesture recognition error:', err)
    player2GestureDetected.value = '识别出错'
    player2GestureConfidence.value = 0
    player2Action.value = 'idle'
    gameLogic.setCharacterAction(1, 'idle')
  }
}

const getGestureDisplayName = (gesture: string): string => {
  const gestureNames: Record<string, string> = {
    'thumb_up': '拇指向上',
    'index_up': '食指向上',
    'middle_up': '中指向上',
    'ring_up': '无名指向上',
    'pinky_up': '小指向上',
    'fist': '握拳',
    'open_palm': '张开手掌',
    'idle': '空闲'
  }

  return gestureNames[gesture] || gesture
}

const onMatchStart = () => {
  console.log('游戏开始')
  gameLogic.startGame()
}

const onMatchEnd = (winner: string) => {
  console.log('游戏结束')
  // 可以在这里添加游戏结束动画或结算界面
}

const toggleMode = async () => {
  isMultiplayerMode.value = !isMultiplayerMode.value

  // 重置游戏状态
  gameLogic.resetGame()

  // 清理旧的事件监听器
  gameLogic.dispose()

  // 创建新的游戏逻辑实例
  const { GameLogicService } = await import('./services/gameLogic')
  const newGameLogic = new GameLogicService()

  // 复制状态到全局变量（临时方案）
  Object.assign(gameLogic, newGameLogic)

  setupGameLogicListeners()
}

// 全屏功能
const toggleFullscreen = () => {
  const doc = document as any
  const elem = document.documentElement as any

  if (!document.fullscreenElement &&
      !doc.webkitFullscreenElement &&
      !doc.mozFullScreenElement &&
      !doc.msFullscreenElement) {
    // 进入全屏
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen()
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen()
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen()
    }
  } else {
    // 退出全屏
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen()
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen()
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen()
    }
  }
}

const handleFullscreenChange = () => {
  const doc = document as any
  isFullscreen.value = !!(
    document.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  )
}

const handleMouseMove = () => {
  showControls.value = true

  if (controlsTimeout) {
    clearTimeout(controlsTimeout)
  }

  if (isFullscreen.value) {
    controlsTimeout = window.setTimeout(() => {
      showControls.value = false
    }, 3000)
  }
}

const handleTouchStart = () => {
  showControls.value = true

  if (controlsTimeout) {
    clearTimeout(controlsTimeout)
  }

  if (isFullscreen.value) {
    controlsTimeout = window.setTimeout(() => {
      showControls.value = false
    }, 3000)
  }
}

const getGestureIcon = (gesture: string): string => {
  const icons: Record<string, string> = {
    '拇指向上': '👍',
    '食指向上': '☝️',
    '中指向上': '🖕',
    '无名指向上': '🤞',
    '小指向上': '🤙',
    '握拳': '✊',
    '张开手掌': '🖐️',
    '空闲': '🤚'
  }
  return icons[gesture] || '🤚'
}
</script>

<template>
  <div class="app" :class="{ 'fullscreen-mode': isFullscreen }">
    <!-- 全屏控制按钮 -->
    <div class="fullscreen-controls" :class="{ 'visible': showControls }">
      <button
        @click="toggleFullscreen"
        class="fullscreen-button"
        :title="isFullscreen ? '退出全屏' : '全屏显示'"
      >
        <span class="fullscreen-icon">{{ isFullscreen ? '⛶' : '⛶' }}</span>
      </button>
  </div>

    <!-- 悬浮控制面板 -->
    <div class="floating-panel" :class="{ 'visible': showControls && isFullscreen }">
      <div class="panel-content">
        <div class="gesture-indicator" v-if="gestureDetected !== '未检测到手势'">
          <div class="gesture-icon">{{ getGestureIcon(gestureDetected) }}</div>
          <div class="gesture-name">{{ gestureDetected }}</div>
        </div>
        <div class="mode-indicator">
          <span class="mode-text">{{ isMultiplayerMode ? '双人对战' : '单人对战AI' }}</span>
        </div>
      </div>
    </div>

    <header class="app-header" :class="{ 'hidden': isFullscreen && !showControls }">
      <div class="header-content">
        <div class="logo-section">
          <div class="logo">
            <span class="logo-icon">🥊</span>
            <span class="logo-text">拳击大师</span>
          </div>
        </div>
        <h1 class="title">手指控制系统</h1>
        <div class="status-section">
          <div class="status-item">
            <span class="status-label">状态:</span>
            <span class="status-value" :class="{ 'ready': isInitialized }">{{ isInitialized ? '就绪' : '初始化中...' }}</span>
          </div>
        </div>
      </div>
    </header>

  <main class="app-main" :class="{ 'fullscreen-main': isFullscreen }">
    <div class="control-section" :class="{ 'hidden': isFullscreen && !showControls }">
      <!-- 模式切换卡片 -->
      <div class="mode-card">
        <h3 class="card-title">🎮 控制模式</h3>
        <div class="mode-selector">
          <button
            @click="toggleMode"
            class="mode-button"
            :class="{ active: !isMultiplayerMode }"
          >
            <div class="mode-icon">🤖</div>
            <div class="mode-text">单人控制</div>
          </button>
          <button
            @click="toggleMode"
            class="mode-button"
            :class="{ active: isMultiplayerMode }"
          >
            <div class="mode-icon">👥</div>
            <div class="mode-text">双人控制</div>
          </button>
        </div>
      </div>

      <!-- 玩家1摄像头和手势识别 -->
      <div class="player-card">
        <div class="card-header">
          <div class="player-avatar">1️⃣</div>
          <h3 class="player-title">玩家1</h3>
        </div>
        <div class="card-content">
          <div class="camera-section">
            <div class="section-icon">📹</div>
            <h4>摄像头捕获</h4>
            <div class="camera-wrapper">
              <CameraCapture :onFrame="handleFrame" />
            </div>
          </div>

          <div class="gesture-section">
            <div class="section-icon">👆</div>
            <h4>手指识别</h4>
            <div class="gesture-display">
              <div class="gesture-result">
                <div class="gesture-icon-large">{{ getGestureIcon(gestureDetected) }}</div>
                <div class="gesture-name">{{ gestureDetected || '未检测到手势' }}</div>
              </div>
              <div v-if="gestureConfidence > 0" class="confidence-bar">
                <div class="confidence-label">置信度</div>
                <div class="confidence-fill" :style="{ width: gestureConfidence + '%' }">
                  <div class="confidence-text">{{ gestureConfidence }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 玩家2摄像头和手势识别（双人模式） -->
      <div v-if="isMultiplayerMode" class="player-card">
        <div class="card-header">
          <div class="player-avatar">2️⃣</div>
          <h3 class="player-title">玩家2</h3>
        </div>
        <div class="card-content">
          <div class="camera-section">
            <div class="section-icon">📹</div>
            <h4>摄像头捕获</h4>
            <div class="camera-wrapper">
              <CameraCapture :onFrame="handlePlayer2Frame" />
            </div>
          </div>

          <div class="gesture-section">
            <div class="section-icon">👆</div>
            <h4>手指识别</h4>
            <div class="gesture-display">
              <div class="gesture-result">
                <div class="gesture-icon-large">{{ getGestureIcon(player2GestureDetected) }}</div>
                <div class="gesture-name">{{ player2GestureDetected || '未检测到手势' }}</div>
              </div>
              <div v-if="player2GestureConfidence > 0" class="confidence-bar">
                <div class="confidence-label">置信度</div>
                <div class="confidence-fill" :style="{ width: player2GestureConfidence + '%' }">
                  <div class="confidence-text">{{ player2GestureConfidence }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 状态显示卡片 -->
      <div class="status-card" v-if="error || !isInitialized">
        <div class="status-icon">{{ error ? '⚠️' : '🔄' }}</div>
        <div class="status-message">
          {{ error || '正在初始化手指识别系统...' }}
        </div>
        <div v-if="!isInitialized" class="loading-spinner"></div>
      </div>
    </div>

    <div class="game-section">
      <div class="arena-container">
        <div class="arena-header-bar">
          <div class="arena-title">
            <span class="arena-icon">🎮</span>
            <span>手指控制舞台</span>
          </div>
          <div class="arena-stats">
            <div class="stat-item">
              <span class="stat-label">模式:</span>
              <span class="stat-value">{{ isMultiplayerMode ? '双人对战' : '单人对战' }}</span>
            </div>
          </div>
        </div>
        <div class="arena-wrapper">
          <BoxingArena
            left-player-name="玩家"
            right-player-name="对手"
            ref="arenaRef"
            @match-start="onMatchStart"
            @match-end="onMatchEnd"
          >
          <template #left-fighter>
            <BoxingCharacter
              character-name="玩家"
              :action="characterAction"
              color="#007bff"
            />
          </template>

          <template #right-fighter>
            <BoxingCharacter
              :character-name="isMultiplayerMode ? '玩家2' : 'AI对手'"
              :action="isMultiplayerMode ? player2Action : opponentAction"
              :color="isMultiplayerMode ? '#28a745' : '#dc3545'"
            />
          </template>
          </BoxingArena>
        </div>
      </div>
    </div>
  </main>
  </div>
</template>

<style scoped>
/* ===== 现代化字体和基础样式 ===== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

* {
  box-sizing: border-box;
}

/* ===== 高级动画系统 ===== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(102, 126, 234, 0.3), 0 0 40px rgba(102, 126, 234, 0.1);
  }
  50% {
    box-shadow: 0 0 30px rgba(102, 126, 234, 0.6), 0 0 60px rgba(102, 126, 234, 0.2);
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* ===== 主应用容器 - 极致美学 ===== */
.app {
  min-height: 100vh;
  background:
    radial-gradient(ellipse at top left, rgba(102, 126, 234, 0.4) 0%, transparent 50%),
    radial-gradient(ellipse at top right, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
    radial-gradient(ellipse at bottom, rgba(120, 219, 226, 0.2) 0%, transparent 50%),
    linear-gradient(135deg,
      #667eea 0%,
      #764ba2 25%,
      #f093fb 50%,
      #f5576c 75%,
      #4facfe 100%);
  background-size: 400% 400%;
  animation: gradient-shift 15s ease infinite;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow-x: hidden;
  line-height: 1.6;
  color: #ffffff;
}

/* 动态背景粒子效果 */
.app::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(120, 219, 226, 0.15) 0%, transparent 50%);
  animation: float 20s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

/* 全屏模式下的深色主题 */
.app.fullscreen-mode {
  background:
    radial-gradient(ellipse at center, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 1) 100%),
    linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(255, 119, 198, 0.1) 100%);
  animation: none;
}

/* ===== 全屏控制 - 优雅的悬浮设计 ===== */
.fullscreen-controls {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1000;
  opacity: 0;
  transform: translateY(-20px) scale(0.8);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fullscreen-controls.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.fullscreen-button {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: white;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
}

.fullscreen-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.fullscreen-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px) scale(1.05);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.fullscreen-button:hover::before {
  left: 100%;
}

.fullscreen-button:active {
  transform: translateY(0) scale(0.98);
}

/* ===== 悬浮面板 - 现代化信息显示 ===== */
.floating-panel {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  z-index: 1000;
  opacity: 0;
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.floating-panel.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.panel-content {
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-radius: 24px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.3),
    0 8px 32px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  position: relative;
  overflow: hidden;
}

.panel-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
    transparent,
    rgba(102, 126, 234, 0.1),
    rgba(255, 119, 198, 0.1),
    transparent);
  animation: shimmer 3s infinite;
}

.gesture-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  position: relative;
  z-index: 1;
}

.gesture-icon {
  font-size: 28px;
  animation: bounce-in 0.6s ease-out;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
}

.gesture-name {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.mode-indicator {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.1);
  padding: 6px 12px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 1;
}

/* ===== 应用头部 - 极致优雅设计 ===== */
.app-header {
  padding: 3rem 0 2rem;
  color: white;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.app-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 2px;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 255, 255, 0.6),
    rgba(102, 126, 234, 0.8),
    rgba(255, 119, 198, 0.8),
    rgba(255, 255, 255, 0.6),
    transparent);
  border-radius: 1px;
  opacity: 0.8;
}

.app-header.hidden {
  opacity: 0;
  transform: translateY(-30px) scale(0.95);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  gap: 2rem;
}

.logo-section {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 28px;
  font-weight: 800;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  cursor: default;
}

.logo:hover {
  transform: scale(1.05);
}

.logo-icon {
  font-size: 36px;
  animation: bounce-in 0.8s ease-out, pulse-glow 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-text {
  background: linear-gradient(135deg,
    #ffffff 0%,
    #e0e7ff 25%,
    #f0abfc 50%,
    #fce7f3 75%,
    #ffffff 100%);
  background-size: 200% 200%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-shift 4s ease infinite;
  letter-spacing: 1px;
}

.title {
  margin: 0;
  font-size: 3.5rem;
  font-weight: 900;
  text-align: center;
  flex: 1;
  line-height: 1.1;
  text-shadow:
    0 0 40px rgba(255, 255, 255, 0.3),
    0 4px 20px rgba(0, 0, 0, 0.4),
    0 8px 40px rgba(102, 126, 234, 0.2);
  background: linear-gradient(135deg,
    #ffffff 0%,
    #dbeafe 20%,
    #fce7f3 40%,
    #fef3c7 60%,
    #ecfdf5 80%,
    #ffffff 100%);
  background-size: 300% 300%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-shift 6s ease infinite, pulse-glow 4s ease-in-out infinite;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.status-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(255, 119, 198, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.status-item:hover {
  transform: translateY(-2px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.status-item:hover::before {
  opacity: 1;
}

.status-label {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
  color: rgba(255, 255, 255, 0.9);
}

.status-value {
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;
}

.status-value.ready {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  animation: pulse-glow 2s ease-in-out infinite;
}

/* ===== 主内容区域 - 流畅布局 ===== */
.app-main {
  max-width: 1600px;
  margin: 0 auto;
  padding: 2rem;
  display: grid;
  grid-template-columns: 480px 1fr;
  gap: 2rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.app-main.fullscreen-main {
  padding: 1.5rem;
  grid-template-columns: 420px 1fr;
}

/* ===== 控制区域 - 优雅分组 ===== */
.control-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.control-section.hidden {
  opacity: 0;
  transform: translateX(-30px) scale(0.95);
}

/* ===== 超级卡片系统 - 玻璃态设计 ===== */
.mode-card,
.player-card,
.status-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 16px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: fadeInUp 0.8s ease-out;
  position: relative;
  overflow: hidden;
}

.mode-card::before,
.player-card::before,
.status-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.05) 0%,
    rgba(255, 119, 198, 0.05) 50%,
    rgba(120, 219, 226, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: -1;
}

.mode-card:hover,
.player-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.12),
    0 8px 32px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.25);
}

.mode-card:hover::before,
.player-card:hover::before {
  opacity: 1;
}

.mode-card:active,
.player-card:active {
  transform: translateY(-4px) scale(0.98);
}

/* ===== 卡片头部 - 个性化设计 ===== */
.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 28px 0;
  margin-bottom: 20px;
  position: relative;
}

.card-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 28px;
  right: 28px;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 20%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.3) 80%,
    transparent 100%);
  border-radius: 0.5px;
}

.player-avatar {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg,
    #667eea 0%,
    #764ba2 25%,
    #f093fb 50%,
    #f5576c 75%,
    #4facfe 100%);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.15),
    0 4px 12px rgba(102, 126, 234, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.player-avatar::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(102, 126, 234, 0.2) 100%);
  border-radius: 18px;
  z-index: -1;
}

.player-title {
  margin: 0;
  color: white;
  font-size: 20px;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
}

.card-title {
  margin: 0 0 20px 0;
  color: white;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
}

.card-title::before {
  content: '🎮';
  margin-right: 12px;
  font-size: 24px;
  vertical-align: middle;
}

/* ===== 卡片内容 - 精致布局 ===== */
.card-content {
  padding: 0 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: relative;
  z-index: 1;
}

/* ===== 模式选择器 - 交互式设计 ===== */
.mode-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.mode-button {
  padding: 20px 16px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  color: white;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.mode-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(255, 119, 198, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: -1;
}

.mode-button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s ease, height 0.6s ease;
  z-index: -1;
}

.mode-button:hover {
  transform: translateY(-4px) scale(1.02);
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(102, 126, 234, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.mode-button:hover::before {
  opacity: 1;
}

.mode-button:active::after {
  width: 200px;
  height: 200px;
}

.mode-button.active {
  background: linear-gradient(135deg,
    #667eea 0%,
    #764ba2 25%,
    #f093fb 50%,
    #f5576c 75%,
    #4facfe 100%);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 8px 32px rgba(102, 126, 234, 0.3),
    0 4px 16px rgba(255, 119, 198, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.mode-button.active::before {
  opacity: 0.5;
}

.mode-icon {
  font-size: 32px;
  transition: all 0.3s ease;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
}

.mode-button:hover .mode-icon,
.mode-button.active .mode-icon {
  transform: scale(1.1);
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
}

.mode-text {
  font-size: 16px;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
}

/* ===== 功能区域 - 精致模块设计 ===== */
.camera-section,
.gesture-section {
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.camera-section::before,
.gesture-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.03) 0%,
    rgba(255, 119, 198, 0.03) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.camera-section:hover,
.gesture-section:hover {
  transform: translateY(-2px);
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.camera-section:hover::before,
.gesture-section:hover::before {
  opacity: 1;
}

.section-icon {
  font-size: 28px;
  text-align: center;
  margin-bottom: 12px;
  display: block;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  transition: all 0.3s ease;
}

.camera-section:hover .section-icon,
.gesture-section:hover .section-icon {
  transform: scale(1.1);
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
}

.camera-section h4,
.gesture-section h4 {
  margin: 0 0 16px 0;
  color: white;
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  opacity: 0.95;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.camera-wrapper {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.4);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.camera-wrapper:hover {
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* ===== 手势显示 - 动态视觉反馈 ===== */
.gesture-display {
  text-align: center;
  position: relative;
}

.gesture-result {
  margin-bottom: 20px;
  position: relative;
}

.gesture-icon-large {
  font-size: 56px;
  margin-bottom: 12px;
  animation: bounce-in 0.6s ease-out, float 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.3));
  background: linear-gradient(135deg,
    #ffffff 0%,
    #dbeafe 25%,
    #fce7f3 50%,
    #fef3c7 75%,
    #ecfdf5 100%);
  background-size: 200% 200%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation:
    bounce-in 0.6s ease-out,
    float 3s ease-in-out infinite,
    gradient-shift 4s ease infinite;
  display: inline-block;
}

.gesture-name {
  color: white;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  position: relative;
  z-index: 1;
}

.gesture-name::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg,
    rgba(102, 126, 234, 0.6) 0%,
    rgba(255, 119, 198, 0.6) 100%);
  border-radius: 1px;
}

/* ===== 置信度条 - 炫酷进度指示器 ===== */
.confidence-bar {
  width: 100%;
  position: relative;
}

.confidence-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
}

.confidence-fill {
  height: 16px;
  background: linear-gradient(90deg,
    #ff4757 0%,
    #ffa726 25%,
    #ffeb3b 50%,
    #4caf50 75%,
    #2196f3 100%);
  background-size: 200% 200%;
  animation: gradient-shift 2s ease infinite;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.confidence-fill::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 30%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.4) 70%,
    transparent 100%);
  animation: shimmer 2s infinite;
}

.confidence-fill::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 8px;
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  transform: translateY(-50%);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  animation: pulse 1.5s ease-in-out infinite;
}

.confidence-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 11px;
  font-weight: 800;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.8),
    0 0 8px rgba(255, 255, 255, 0.5);
  letter-spacing: 0.5px;
  z-index: 1;
}

/* ===== 状态卡片 - 优雅的状态反馈 ===== */
.status-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-radius: 20px;
  padding: 24px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: fadeInUp 0.8s ease-out;
  position: relative;
  overflow: hidden;
}

.status-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.05) 0%,
    rgba(255, 119, 198, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: -1;
}

.status-card:hover::before {
  opacity: 1;
}

.status-icon {
  font-size: 40px;
  margin-bottom: 16px;
  display: block;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
  animation: float 3s ease-in-out infinite;
}

.status-message {
  color: white;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
  line-height: 1.4;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  margin: 0 auto;
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.3);
  position: relative;
}

.loading-spinner::before {
  content: '';
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border: 3px solid transparent;
  border-top: 3px solid rgba(102, 126, 234, 0.5);
  border-radius: 50%;
  animation: spin 2s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
    filter: hue-rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
    filter: hue-rotate(360deg);
  }
}

/* ===== 游戏区域 - 沉浸式竞技场 ===== */
.game-section {
  display: flex;
  flex-direction: column;
  position: relative;
}

.arena-container {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 12px 48px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  overflow: hidden;
  animation: fadeInUp 1s ease-out;
  position: relative;
}

.arena-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.03) 0%,
    rgba(255, 119, 198, 0.03) 50%,
    rgba(120, 219, 226, 0.03) 100%);
  z-index: -1;
}

.arena-header-bar {
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(20px);
  padding: 20px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.arena-header-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg,
    rgba(102, 126, 234, 0.1) 0%,
    transparent 20%,
    transparent 80%,
    rgba(255, 119, 198, 0.1) 100%);
  z-index: -1;
}

.arena-title {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  font-size: 20px;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  letter-spacing: 0.5px;
}

.arena-icon {
  font-size: 28px;
  animation: pulse-glow 3s ease-in-out infinite;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
}

.arena-stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.stat-label {
  opacity: 0.8;
  font-weight: 500;
}

.stat-value {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  padding: 6px 12px;
  border-radius: 12px;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.stat-value:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.arena-wrapper {
  flex: 1;
  min-height: 600px;
  background:
    radial-gradient(ellipse at center, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.05) 100%),
    linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(255, 119, 198, 0.02) 100%);
  position: relative;
}

.arena-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 25% 25%, rgba(102, 126, 234, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(255, 119, 198, 0.05) 0%, transparent 50%);
  animation: float 20s ease-in-out infinite;
  z-index: -1;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .app-main {
    grid-template-columns: 400px 1fr;
    gap: 1.5rem;
  }
}

@media (max-width: 1200px) {
  .app-main {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .control-section {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .player-card {
    min-width: 300px;
  }

  .mode-selector {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .app-main {
    padding: 1rem;
  }

  .control-section {
    flex-direction: column;
  }

  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .title {
    font-size: 2rem;
  }

  .floating-panel {
    bottom: 10px;
    left: 10px;
    right: 10px;
    transform: none;
  }

  .panel-content {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .fullscreen-controls {
    top: 10px;
    right: 10px;
  }
}

@media (max-width: 480px) {
  .app-main {
    padding: 0.5rem;
  }

  .title {
    font-size: 1.5rem;
  }

  .arena-header-bar {
    padding: 12px 16px;
  }

  .card-header,
  .card-content {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
