// 拳击比赛游戏逻辑服务

export interface Player {
  id: string
  name: string
  health: number
  score: number
  action: string
  isBlocking: boolean
  comboCount: number
  lastActionTime: number
}

export interface GameState {
  players: [Player, Player]
  currentRound: number
  totalRounds: number
  roundTime: number
  timeRemaining: number
  isMatchRunning: boolean
  isPaused: boolean
  winner: string | null
}

export enum GameEvents {
  MATCH_START = 'match_start',
  MATCH_END = 'match_end',
  ROUND_START = 'round_start',
  ROUND_END = 'round_end',
  HIT_LANDED = 'hit_landed',
  BLOCK_SUCCESS = 'block_success',
  PLAYER_DAMAGED = 'player_damaged',
  SCORE_UPDATE = 'score_update'
}

export class GameLogicService {
  private gameState: GameState
  private eventListeners: Map<GameEvents, Function[]> = new Map()
  private timerInterval: number | null = null
  private aiActionInterval: number | null = null

  constructor() {
    this.gameState = this.createInitialGameState()
  }

  private createInitialGameState(): GameState {
    const player1: Player = {
      id: 'player1',
      name: '玩家',
      health: 100,
      score: 0,
      action: 'idle',
      isBlocking: false,
      comboCount: 0,
      lastActionTime: Date.now()
    }

    const player2: Player = {
      id: 'player2',
      name: 'AI对手',
      health: 100,
      score: 0,
      action: 'idle',
      isBlocking: false,
      comboCount: 0,
      lastActionTime: Date.now()
    }

    return {
      players: [player1, player2],
      currentRound: 1,
      totalRounds: 3,
      roundTime: 180, // 3分钟
      timeRemaining: 180,
      isMatchRunning: false,
      isPaused: false,
      winner: null
    }
  }

  // 事件系统
  on(event: GameEvents, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  off(event: GameEvents, callback: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: GameEvents, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => callback(data))
    }
  }

  // 比赛控制
  startMatch(): void {
    if (this.gameState.isMatchRunning) return

    this.resetGameState()
    this.gameState.isMatchRunning = true
    this.gameState.isPaused = false

    this.emit(GameEvents.MATCH_START)
    this.startRoundTimer()
    this.startAI()
  }

  pauseMatch(): void {
    if (!this.gameState.isMatchRunning) return

    this.gameState.isPaused = !this.gameState.isPaused

    if (this.gameState.isPaused) {
      this.stopRoundTimer()
      this.stopAI()
    } else {
      this.startRoundTimer()
      this.startAI()
    }
  }

  resetMatch(): void {
    this.stopRoundTimer()
    this.stopAI()
    this.gameState = this.createInitialGameState()
    this.emit(GameEvents.MATCH_END, { winner: null, reset: true })
  }

  private resetGameState(): void {
    this.gameState.players[0].health = 100
    this.gameState.players[0].score = 0
    this.gameState.players[0].comboCount = 0

    this.gameState.players[1].health = 100
    this.gameState.players[1].score = 0
    this.gameState.players[1].comboCount = 0

    this.gameState.currentRound = 1
    this.gameState.timeRemaining = this.gameState.roundTime
    this.gameState.winner = null
  }

  // 计时器管理
  private startRoundTimer(): void {
    this.stopRoundTimer()

    this.timerInterval = window.setInterval(() => {
      if (!this.gameState.isPaused && this.gameState.timeRemaining > 0) {
        this.gameState.timeRemaining--

        if (this.gameState.timeRemaining <= 0) {
          this.endRound()
        }
      }
    }, 1000)
  }

  private stopRoundTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  private endRound(): void {
    this.emit(GameEvents.ROUND_END, { round: this.gameState.currentRound })

    if (this.gameState.currentRound < this.gameState.totalRounds) {
      // 开始下一回合
      this.gameState.currentRound++
      this.gameState.timeRemaining = this.gameState.roundTime
      this.startRoundTimer()
      this.emit(GameEvents.ROUND_START, { round: this.gameState.currentRound })
    } else {
      // 比赛结束
      this.endMatch()
    }
  }

  private endMatch(): void {
    this.stopRoundTimer()
    this.stopAI()
    this.gameState.isMatchRunning = false

    // 确定获胜者
    const [player1, player2] = this.gameState.players
    let winner: string

    if (player1.score > player2.score) {
      winner = player1.name
    } else if (player2.score > player1.score) {
      winner = player2.name
    } else {
      winner = '平局'
    }

    this.gameState.winner = winner
    this.emit(GameEvents.MATCH_END, { winner })
  }

  // AI对手逻辑
  private startAI(): void {
    this.stopAI()

    this.aiActionInterval = window.setInterval(() => {
      if (!this.gameState.isPaused && this.gameState.isMatchRunning) {
        this.updateAIAction()
      }
    }, 1000 + Math.random() * 2000) // 1-3秒随机间隔
  }

  private stopAI(): void {
    if (this.aiActionInterval) {
      clearInterval(this.aiActionInterval)
      this.aiActionInterval = null
    }
  }

  private updateAIAction(): void {
    // const aiPlayer = this.gameState.players[1]
    const humanPlayer = this.gameState.players[0]

    // AI决策逻辑
    const actions = ['jab', 'cross', 'hook', 'uppercut', 'block']
    const randomAction = actions[Math.floor(Math.random() * actions.length)]

    // 简单的AI策略：如果玩家在攻击，就有一定概率格挡
    if (humanPlayer.action !== 'idle' && humanPlayer.action !== 'block') {
      if (Math.random() < 0.4) { // 40%概率格挡
        this.setPlayerAction(1, 'block')
        return
      }
    }

    // 随机选择攻击动作
    this.setPlayerAction(1, randomAction)

    // 30%概率在攻击后立即返回idle
    setTimeout(() => {
      if (Math.random() < 0.3) {
        this.setPlayerAction(1, 'idle')
      }
    }, 500)
  }

  // 玩家动作处理
  setPlayerAction(playerIndex: number, action: string): void {
    if (playerIndex < 0 || playerIndex >= this.gameState.players.length) return

    const player = this.gameState.players[playerIndex]
    const now = Date.now()

    // 防止动作切换过于频繁
    if (now - player.lastActionTime < 200) return

    player.action = action
    player.isBlocking = action === 'block'
    player.lastActionTime = now

    // 检查击中判定
    if (this.isAttackAction(action) && this.gameState.isMatchRunning && !this.gameState.isPaused) {
      this.checkHit(playerIndex, action)
    }
  }

  private isAttackAction(action: string): boolean {
    return ['jab', 'cross', 'hook', 'uppercut'].includes(action)
  }

  private checkHit(attackerIndex: number, attackType: string): void {
    const attacker = this.gameState.players[attackerIndex]
    const defenderIndex = 1 - attackerIndex
    const defender = this.gameState.players[defenderIndex]

    if (!attacker || !defender) return

    // 如果防守方在格挡，有一定概率挡住攻击
    if (defender.isBlocking) {
      const blockChance = this.getBlockChance(attackType)
      if (Math.random() < blockChance) {
        this.emit(GameEvents.BLOCK_SUCCESS, {
          blocker: defender.id,
          attackType
        })
        return
      }
    }

    // 计算伤害
    const baseDamage = this.getAttackDamage(attackType)
    const damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4)) // 80%-120%的随机伤害

    // 应用伤害
    defender.health = Math.max(0, defender.health - damage)

    // 增加连击计数和得分
    attacker.comboCount++
    const scoreGain = Math.min(attacker.comboCount * 10, 50) // 连击奖励，最多50分
    attacker.score += scoreGain

    this.emit(GameEvents.HIT_LANDED, {
      attacker: attacker.id,
      defender: defender.id,
      attackType,
      damage,
      scoreGain,
      comboCount: attacker.comboCount
    })

    this.emit(GameEvents.PLAYER_DAMAGED, {
      player: defender.id,
      damage,
      newHealth: defender.health
    })

    this.emit(GameEvents.SCORE_UPDATE, {
      player: attacker.id,
      newScore: attacker.score
    })

    // 检查是否击倒
    if (defender.health <= 0) {
      this.endMatch()
    }
  }

  private getBlockChance(attackType: string): number {
    // 不同攻击类型的格挡成功率
    const blockChances: Record<string, number> = {
      'jab': 0.6,      // 直拳较容易格挡
      'cross': 0.5,    // 交叉拳中等难度
      'hook': 0.4,     // 勾拳较难格挡
      'uppercut': 0.3  // 上勾拳最难格挡
    }
    return blockChances[attackType] || 0.5
  }

  private getAttackDamage(attackType: string): number {
    // 不同攻击类型的基准伤害
    const damages: Record<string, number> = {
      'jab': 8,        // 直拳伤害较低
      'cross': 12,     // 交叉拳中等伤害
      'hook': 15,      // 勾拳较高伤害
      'uppercut': 20   // 上勾拳最高伤害
    }
    return damages[attackType] || 10
  }

  // 获取游戏状态
  getGameState(): GameState {
    return { ...this.gameState }
  }

  // 获取玩家状态
  getPlayer(playerIndex: number): Player {
    if (playerIndex >= 0 && playerIndex < this.gameState.players.length) {
      return { ...this.gameState.players[playerIndex] }
    }
    // 返回默认玩家状态
    return {
      id: 'unknown',
      name: 'Unknown',
      health: 0,
      score: 0,
      action: 'idle',
      isBlocking: false,
      comboCount: 0,
      lastActionTime: 0
    }
  }

  // 清理资源
  dispose(): void {
    this.stopRoundTimer()
    this.stopAI()
    this.eventListeners.clear()
  }
}

// 创建单例实例
export const gameLogic = new GameLogicService()
