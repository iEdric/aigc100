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
const characterHealth = ref<number>(100)
const opponentAction = ref<string>('idle')
const opponentHealth = ref<number>(100)
const arenaRef = ref()

// 双人模式相关
const isMultiplayerMode = ref<boolean>(false)
const player2GestureDetected = ref<string>('')
const player2GestureConfidence = ref<number>(0)
const player2Action = ref<string>('idle')

onMounted(async () => {
  try {
    await gestureService.initialize()
    isInitialized.value = true

    // 设置游戏逻辑事件监听器
    setupGameLogicListeners()
  } catch (err) {
    console.error('Failed to initialize gesture service:', err)
    error.value = '手势识别初始化失败，请刷新页面重试'
  }
})

onUnmounted(() => {
  gestureService.dispose()
  gameLogic.dispose()
})

const setupGameLogicListeners = () => {
  // 监听玩家受伤事件
  gameLogic.on(GameEvents.PLAYER_DAMAGED, (data: any) => {
    if (data.player === 'player1') {
      characterHealth.value = data.newHealth
    } else {
      opponentHealth.value = data.newHealth
    }
  })

  // 监听玩家动作变化
  gameLogic.on(GameEvents.HIT_LANDED, (data: any) => {
    // 可以添加击中音效或视觉效果
    console.log('击中:', data)
  })

  // 监听AI对手动作变化
  const updateOpponentAction = () => {
    const opponentState = gameLogic.getPlayer(1)
    opponentAction.value = opponentState.action
  }

  // 定期更新对手动作显示
  setInterval(() => {
    const opponentState = gameLogic.getPlayer(1)
    if (opponentState) {
      opponentAction.value = opponentState.action
    }
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
        gameLogic.setPlayerAction(0, bestResult.gesture)
      }
    } else {
      gestureDetected.value = '未检测到手势'
      gestureConfidence.value = 0
      characterAction.value = 'idle'
      gameLogic.setPlayerAction(0, 'idle')
    }
  } catch (err) {
    console.error('Gesture recognition error:', err)
    gestureDetected.value = '识别出错'
    gestureConfidence.value = 0
    characterAction.value = 'idle'
    gameLogic.setPlayerAction(0, 'idle')
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
        gameLogic.setPlayerAction(1, bestResult.gesture)
      }
    } else {
      player2GestureDetected.value = '未检测到手势'
      player2GestureConfidence.value = 0
      player2Action.value = 'idle'
      gameLogic.setPlayerAction(1, 'idle')
    }
  } catch (err) {
    console.error('Player 2 gesture recognition error:', err)
    player2GestureDetected.value = '识别出错'
    player2GestureConfidence.value = 0
    player2Action.value = 'idle'
    gameLogic.setPlayerAction(1, 'idle')
  }
}

const getGestureDisplayName = (gesture: string): string => {
  const gestureNames: Record<string, string> = {
    'jab': '直拳',
    'cross': '交叉拳',
    'hook': '勾拳',
    'uppercut': '上勾拳',
    'block': '格挡',
    'idle': '空闲'
  }

  return gestureNames[gesture] || gesture
}

const onMatchStart = () => {
  console.log('比赛开始')
  gameLogic.startMatch()
}

const onMatchEnd = (winner: string) => {
  console.log('比赛结束，获胜者:', winner)
  // 可以在这里添加胜利动画或结算界面
}

const toggleMode = async () => {
  isMultiplayerMode.value = !isMultiplayerMode.value

  // 重置游戏状态
  gameLogic.resetMatch()

  // 清理旧的事件监听器
  gameLogic.dispose()

  // 创建新的游戏逻辑实例
  const { GameLogicService } = await import('./services/gameLogic')
  const newGameLogic = new GameLogicService()

  // 复制状态到全局变量（临时方案）
  Object.assign(gameLogic, newGameLogic)

  setupGameLogicListeners()
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>拳击手势识别系统</h1>
    </header>

  <main class="app-main">
    <div class="control-section">
      <!-- 模式切换 -->
      <div class="mode-selector">
        <button
          @click="toggleMode"
          class="mode-button"
          :class="{ active: !isMultiplayerMode }"
        >
          单人对战AI
        </button>
        <button
          @click="toggleMode"
          class="mode-button"
          :class="{ active: isMultiplayerMode }"
        >
          双人对战
        </button>
      </div>

      <!-- 玩家1摄像头和手势识别 -->
      <div class="player-controls">
        <div class="camera-section">
          <h2>玩家1 - 摄像头捕获</h2>
          <CameraCapture :onFrame="handleFrame" />
        </div>

        <div class="gesture-section">
          <h2>玩家1 - 手势识别</h2>
          <div class="gesture-display">
            <div class="gesture-result">
              检测到的手势: <span class="gesture-text">{{ gestureDetected || '无' }}</span>
            </div>
            <div v-if="gestureConfidence > 0" class="confidence-bar">
              <div class="confidence-label">置信度: {{ gestureConfidence }}%</div>
              <div class="confidence-fill" :style="{ width: gestureConfidence + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 玩家2摄像头和手势识别（双人模式） -->
      <div v-if="isMultiplayerMode" class="player-controls">
        <div class="camera-section">
          <h2>玩家2 - 摄像头捕获</h2>
          <CameraCapture :onFrame="handlePlayer2Frame" />
        </div>

        <div class="gesture-section">
          <h2>玩家2 - 手势识别</h2>
          <div class="gesture-display">
            <div class="gesture-result">
              检测到的手势: <span class="gesture-text">{{ player2GestureDetected || '无' }}</span>
            </div>
            <div v-if="player2GestureConfidence > 0" class="confidence-bar">
              <div class="confidence-label">置信度: {{ player2GestureConfidence }}%</div>
              <div class="confidence-fill" :style="{ width: player2GestureConfidence + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 通用错误和状态显示 -->
      <div v-if="error" class="error-display">
        {{ error }}
      </div>

      <div v-if="!isInitialized" class="loading-display">
        正在初始化手势识别...
      </div>
    </div>

    <div class="game-section">
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
              :health="characterHealth"
              :action="characterAction"
              color="#007bff"
            />
          </template>

          <template #right-fighter>
            <BoxingCharacter
              :character-name="isMultiplayerMode ? '玩家2' : 'AI对手'"
              :health="opponentHealth"
              :action="isMultiplayerMode ? player2Action : opponentAction"
              :color="isMultiplayerMode ? '#28a745' : '#dc3545'"
            />
          </template>
        </BoxingArena>
      </div>
    </div>
  </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Arial', sans-serif;
}

.app-header {
  text-align: center;
  padding: 2rem 0;
  color: white;
}

.app-header h1 {
  margin: 0;
  font-size: 2.5rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.app-main {
  max-width: 1600px;
  margin: 0 auto;
  padding: 2rem;
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 2rem;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.game-section {
  display: flex;
  flex-direction: column;
}

.arena-wrapper {
  flex: 1;
  min-height: 600px;
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
}

@media (max-width: 768px) {
  .app-main {
    padding: 1rem;
  }

  .control-section {
    flex-direction: column;
  }
}

.camera-section, .gesture-section {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  backdrop-filter: blur(10px);
}

.camera-section h2, .gesture-section h2 {
  margin-top: 0;
  color: #333;
  font-size: 1.5rem;
  text-align: center;
  margin-bottom: 1.5rem;
}

.gesture-display {
  text-align: center;
}

.gesture-result {
  font-size: 1.2rem;
  color: #555;
  margin-bottom: 1rem;
}

.gesture-text {
  font-weight: bold;
  color: #007bff;
  font-size: 1.5rem;
}

.confidence-bar {
  margin-top: 1rem;
  width: 100%;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.confidence-label {
  text-align: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.confidence-fill {
  height: 8px;
  background: linear-gradient(90deg, #28a745 0%, #ffc107 50%, #dc3545 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
}

.confidence-fill::after {
  content: '';
  position: absolute;
  right: -4px;
  top: -2px;
  width: 12px;
  height: 12px;
  background: #fff;
  border: 2px solid #333;
  border-radius: 50%;
}

.error-display {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f8d7da;
  color: #721c24;
  border-radius: 6px;
  text-align: center;
  font-size: 0.9rem;
}

.loading-display {
  margin-top: 1rem;
  text-align: center;
  color: #666;
  font-style: italic;
}

.mode-selector {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: center;
}

.mode-button {
  padding: 0.75rem 1.5rem;
  border: 2px solid #007bff;
  background: transparent;
  color: #007bff;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mode-button:hover {
  background: #007bff;
  color: white;
}

.mode-button.active {
  background: #007bff;
  color: white;
}

.player-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}
</style>
