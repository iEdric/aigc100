<template>
  <div class="arena-container">
    <div class="arena-header">
      <div class="round-info">
        第 {{ currentRound }} 回合 / 共 {{ totalRounds }} 回合
      </div>
      <div class="timer" :class="{ 'time-warning': timeRemaining < 10 }">
        {{ formatTime(timeRemaining) }}
      </div>
      <div class="game-status">
        {{ gameStatusText }}
      </div>
    </div>

    <div class="arena-scene">
      <div class="ring">
        <div class="ring-mat">
          <div class="ring-ropes">
            <!-- 擂台绳子 -->
            <div class="rope top-rope"></div>
            <div class="rope bottom-rope"></div>
            <div class="rope left-rope"></div>
            <div class="rope right-rope"></div>
          </div>

          <!-- 拳击手位置 -->
          <div class="fighter-position left-fighter">
            <slot name="left-fighter">
              <div class="fighter-placeholder">玩家1</div>
            </slot>
          </div>

          <div class="fighter-position right-fighter">
            <slot name="right-fighter">
              <div class="fighter-placeholder">玩家2</div>
            </slot>
          </div>

          <!-- 擂台中央标记 -->
          <div class="center-mark"></div>
        </div>
      </div>

      <!-- 聚光灯效果 -->
      <div class="spotlight left-spotlight"></div>
      <div class="spotlight right-spotlight"></div>
    </div>

    <div class="arena-footer">
      <div class="scoreboard">
        <div class="player-score left-score">
          <div class="player-name">{{ leftPlayerName }}</div>
          <div class="score-display">{{ leftScore }}</div>
          <div class="health-bar">
            <div class="health-fill" :style="{ width: leftHealth + '%' }"></div>
          </div>
        </div>

        <div class="round-indicator">
          VS
        </div>

        <div class="player-score right-score">
          <div class="player-name">{{ rightPlayerName }}</div>
          <div class="score-display">{{ rightScore }}</div>
          <div class="health-bar">
            <div class="health-fill" :style="{ width: rightHealth + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="arena-controls">
      <button
        @click="startMatch"
        :disabled="isMatchRunning"
        class="control-button start-button"
      >
        {{ isMatchRunning ? '比赛中...' : '开始比赛' }}
      </button>

      <button
        @click="pauseMatch"
        :disabled="!isMatchRunning"
        class="control-button pause-button"
      >
        {{ isPaused ? '继续' : '暂停' }}
      </button>

      <button
        @click="resetMatch"
        class="control-button reset-button"
      >
        重置
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  leftPlayerName?: string
  rightPlayerName?: string
  totalRounds?: number
  roundTime?: number // 每回合时间（秒）
}

const props = withDefaults(defineProps<Props>(), {
  leftPlayerName: '玩家1',
  rightPlayerName: '玩家2',
  totalRounds: 3,
  roundTime: 180 // 3分钟
})

const emit = defineEmits<{
  matchStart: []
  matchPause: []
  matchResume: []
  matchReset: []
  roundEnd: [round: number]
  matchEnd: [winner: string]
}>()

// 比赛状态
const currentRound = ref(1)
const timeRemaining = ref(props.roundTime)
const isMatchRunning = ref(false)
const isPaused = ref(false)

// 得分和生命值
const leftScore = ref(0)
const rightScore = ref(0)
const leftHealth = ref(100)
const rightHealth = ref(100)

// 计时器
let timerInterval: number | null = null

const gameStatusText = computed(() => {
  if (!isMatchRunning.value) return '准备开始'
  if (isPaused.value) return '比赛暂停'
  if (timeRemaining.value <= 0) return '回合结束'
  return '比赛进行中'
})

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const startMatch = () => {
  if (isMatchRunning.value) return

  isMatchRunning.value = true
  isPaused.value = false
  timeRemaining.value = props.roundTime

  emit('matchStart')
  startTimer()
}

const pauseMatch = () => {
  if (!isMatchRunning.value) return

  isPaused.value = !isPaused.value

  if (isPaused.value) {
    stopTimer()
    emit('matchPause')
  } else {
    startTimer()
    emit('matchResume')
  }
}

const resetMatch = () => {
  stopTimer()

  currentRound.value = 1
  timeRemaining.value = props.roundTime
  isMatchRunning.value = false
  isPaused.value = false

  leftScore.value = 0
  rightScore.value = 0
  leftHealth.value = 100
  rightHealth.value = 100

  emit('matchReset')
}

const startTimer = () => {
  stopTimer() // 确保没有重复的计时器

  timerInterval = window.setInterval(() => {
    if (!isPaused.value && timeRemaining.value > 0) {
      timeRemaining.value--

      if (timeRemaining.value <= 0) {
        endRound()
      }
    }
  }, 1000)
}

const stopTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

const endRound = () => {
  stopTimer()
  emit('roundEnd', currentRound.value)

  if (currentRound.value < props.totalRounds) {
    // 开始下一回合
    currentRound.value++
    timeRemaining.value = props.roundTime
    startTimer()
  } else {
    // 比赛结束
    endMatch()
  }
}

const endMatch = () => {
  isMatchRunning.value = false

  const winner = leftScore.value > rightScore.value ? props.leftPlayerName :
                 rightScore.value > leftScore.value ? props.rightPlayerName : '平局'

  emit('matchEnd', winner)
}

// 暴露方法给父组件
defineExpose({
  startMatch,
  pauseMatch,
  resetMatch,
  addScore: (player: 'left' | 'right', points: number) => {
    if (player === 'left') {
      leftScore.value += points
    } else {
      rightScore.value += points
    }
  },
  takeDamage: (player: 'left' | 'right', damage: number) => {
    if (player === 'left') {
      leftHealth.value = Math.max(0, leftHealth.value - damage)
    } else {
      rightHealth.value = Math.max(0, rightHealth.value - damage)
    }
  }
})

onMounted(() => {
  // 初始化逻辑
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.arena-container {
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  border-radius: 16px;
  padding: 2rem;
  color: white;
  box-shadow: 0 12px 40px rgba(0,0,0,0.3);
  position: relative;
  overflow: hidden;
}

.arena-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="1" fill="rgba(255,255,255,0.1)"/></svg>');
  pointer-events: none;
}

.arena-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
}

.round-info {
  font-size: 1.2rem;
  font-weight: bold;
}

.timer {
  font-size: 2rem;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  background: rgba(0,0,0,0.3);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: color 0.3s ease;
}

.timer.time-warning {
  color: #ff6b6b;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.game-status {
  font-size: 1.1rem;
  color: #bdc3c7;
}

.arena-scene {
  position: relative;
  height: 400px;
  margin-bottom: 2rem;
}

.ring {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #8b4513 0%, #a0522d 100%);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 0 50px rgba(0,0,0,0.5);
}

.ring-mat {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, #deb887 0%, #f4a460 25%, #deb887 50%, #f4a460 75%, #deb887 100%);
  background-size: 40px 40px;
}

.ring-ropes {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  bottom: 20px;
}

.rope {
  position: absolute;
  background: #8b4513;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.top-rope {
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 2px;
}

.bottom-rope {
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 2px;
}

.left-rope {
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 2px;
}

.right-rope {
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 2px;
}

.fighter-position {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 120px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.left-fighter {
  left: 60px;
}

.right-fighter {
  right: 60px;
  transform: translateY(-50%) scaleX(-1); /* 翻转右侧拳击手 */
}

.fighter-placeholder {
  color: rgba(255,255,255,0.7);
  font-size: 1.1rem;
  font-weight: bold;
  text-align: center;
}

.center-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: #ff0000;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255,0,0,0.6);
}

.spotlight {
  position: absolute;
  top: -100px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  pointer-events: none;
}

.left-spotlight {
  left: 50px;
}

.right-spotlight {
  right: 50px;
}

.arena-footer {
  margin-top: 2rem;
}

.scoreboard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0,0,0,0.2);
  padding: 1.5rem;
  border-radius: 8px;
}

.player-score {
  flex: 1;
  text-align: center;
}

.left-score {
  text-align: left;
}

.right-score {
  text-align: right;
}

.player-name {
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.score-display {
  font-size: 2rem;
  font-weight: bold;
  color: #f39c12;
  margin-bottom: 0.5rem;
}

.health-bar {
  height: 8px;
  background: rgba(255,255,255,0.2);
  border-radius: 4px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60 0%, #f39c12 50%, #e74c3c 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.round-indicator {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ecf0f1;
  margin: 0 2rem;
}

.arena-controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}

.control-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.start-button {
  background: #27ae60;
  color: white;
}

.start-button:hover:not(:disabled) {
  background: #229954;
}

.pause-button {
  background: #f39c12;
  color: white;
}

.pause-button:hover:not(:disabled) {
  background: #e67e22;
}

.reset-button {
  background: #e74c3c;
  color: white;
}

.reset-button:hover {
  background: #c0392b;
}

.control-button:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
}
</style>
