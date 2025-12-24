// 手指控制游戏逻辑服务

export interface Character {
  id: string
  name: string
  x: number // 水平位置 (-100 到 100)
  y: number // 垂直位置 (-100 到 100)
  action: string
  lastActionTime: number
  isJumping: boolean
  jumpStartTime: number
}

export interface GameState {
  characters: [Character, Character]
  isGameRunning: boolean
  isPaused: boolean
  currentRound?: number
  totalRounds?: number
  roundTime?: number
  timeRemaining?: number
}

export enum GameEvents {
  CHARACTER_MOVE = 'character_move',
  CHARACTER_JUMP = 'character_jump',
  CHARACTER_STOP = 'character_stop',
  GAME_START = 'game_start',
  GAME_END = 'game_end'
}

export class GameLogicService {
  private gameState: GameState
  private eventListeners: Map<GameEvents, Function[]> = new Map()
  private animationFrame: number | null = null

  constructor() {
    this.gameState = this.createInitialGameState()
  }

  private createInitialGameState(): GameState {
    const character1: Character = {
      id: 'character1',
      name: '玩家1',
      x: -50,
      y: 0,
      action: 'idle',
      lastActionTime: Date.now(),
      isJumping: false,
      jumpStartTime: 0
    }

    const character2: Character = {
      id: 'character2',
      name: '玩家2',
      x: 50,
      y: 0,
      action: 'idle',
      lastActionTime: Date.now(),
      isJumping: false,
      jumpStartTime: 0
    }

    return {
      characters: [character1, character2],
      isGameRunning: false,
      isPaused: false
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

  // 游戏控制
  startGame(): void {
    if (this.gameState.isGameRunning) return

    this.resetGame()
    this.gameState.isGameRunning = true
    this.gameState.isPaused = false

    this.emit(GameEvents.GAME_START)
    this.startGameLoop()
  }

  pauseGame(): void {
    this.gameState.isPaused = !this.gameState.isPaused

    if (this.gameState.isPaused) {
      this.stopGameLoop()
    } else {
      this.startGameLoop()
    }
  }

  resetGame(): void {
    this.stopGameLoop()
    this.gameState = this.createInitialGameState()
    this.emit(GameEvents.GAME_END, { reset: true })
  }

  private startGameLoop(): void {
    if (this.animationFrame) return

    const gameLoop = () => {
      if (!this.gameState.isPaused) {
        this.updateCharacters()
      }
      this.animationFrame = requestAnimationFrame(gameLoop)
    }

    this.animationFrame = requestAnimationFrame(gameLoop)
  }

  private stopGameLoop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  private updateCharacters(): void {
    const now = Date.now()

    this.gameState.characters.forEach((character, index) => {
      // 处理跳跃动画
      if (character.isJumping) {
        const jumpDuration = now - character.jumpStartTime
        const jumpHeight = Math.sin((jumpDuration / 1000) * Math.PI) * 30 // 跳跃高度

        if (jumpDuration > 1000) { // 跳跃持续1秒
          character.isJumping = false
          character.y = 0
          character.action = 'idle'
        } else {
          character.y = jumpHeight
        }
      }
    })
  }



  // 角色动作处理
  setCharacterAction(characterIndex: number, action: string): void {
    if (characterIndex < 0 || characterIndex >= this.gameState.characters.length) return

    const character = this.gameState.characters[characterIndex]
    const now = Date.now()

    // 防止动作切换过于频繁
    if (now - character.lastActionTime < 100) return

    character.action = action
    character.lastActionTime = now

    // 处理不同的手指动作
    switch (action) {
      case 'thumb_up':
        this.moveCharacter(characterIndex, 0, -5) // 向上移动
        this.emit(GameEvents.CHARACTER_MOVE, { character: character.id, direction: 'up' })
        break
      case 'index_up':
        this.moveCharacter(characterIndex, 0, 5) // 向前移动 (屏幕坐标)
        this.emit(GameEvents.CHARACTER_MOVE, { character: character.id, direction: 'forward' })
        break
      case 'middle_up':
        this.moveCharacter(characterIndex, 0, -5) // 向后移动 (屏幕坐标)
        this.emit(GameEvents.CHARACTER_MOVE, { character: character.id, direction: 'backward' })
        break
      case 'ring_up':
        this.moveCharacter(characterIndex, -5, 0) // 向左移动
        this.emit(GameEvents.CHARACTER_MOVE, { character: character.id, direction: 'left' })
        break
      case 'pinky_up':
        this.moveCharacter(characterIndex, 5, 0) // 向右移动
        this.emit(GameEvents.CHARACTER_MOVE, { character: character.id, direction: 'right' })
        break
      case 'fist':
        character.action = 'idle'
        this.emit(GameEvents.CHARACTER_STOP, { character: character.id })
        break
      case 'open_palm':
        if (!character.isJumping) {
          character.isJumping = true
          character.jumpStartTime = now
          character.action = 'jump'
          this.emit(GameEvents.CHARACTER_JUMP, { character: character.id })
        }
        break
    }
  }

  private moveCharacter(characterIndex: number, deltaX: number, deltaY: number): void {
    const character = this.gameState.characters[characterIndex]

    // 限制移动范围
    character.x = Math.max(-100, Math.min(100, character.x + deltaX))
    character.y = Math.max(-100, Math.min(100, character.y + deltaY))
  }

  // 获取游戏状态
  getGameState(): GameState {
    return { ...this.gameState }
  }

  // 获取角色状态
  getCharacter(characterIndex: number): Character {
    if (characterIndex >= 0 && characterIndex < this.gameState.characters.length) {
      return { ...this.gameState.characters[characterIndex] }
    }
    // 返回默认角色状态
    return {
      id: 'unknown',
      name: 'Unknown',
      x: 0,
      y: 0,
      action: 'idle',
      lastActionTime: 0,
      isJumping: false,
      jumpStartTime: 0
    }
  }

  // 清理资源
  dispose(): void {
    this.stopGameLoop()
    this.eventListeners.clear()
  }
}

// 创建单例实例
export const gameLogic = new GameLogicService()
