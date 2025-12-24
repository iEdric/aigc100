// 手势识别服务
// 使用MediaPipe Hands进行手势识别和拳击动作分类

export interface HandLandmarks {
  [key: number]: {
    x: number
    y: number
    z: number
  }
}

export interface GestureResult {
  gesture: string
  confidence: number
  landmarks: HandLandmarks
}

export enum FingerGestures {
  THUMB_UP = 'thumb_up',     // 拇指向上 - 向上移动
  INDEX_UP = 'index_up',     // 食指向上 - 向前移动
  MIDDLE_UP = 'middle_up',   // 中指向上 - 向后移动
  RING_UP = 'ring_up',       // 无名指向上 - 向左移动
  PINKY_UP = 'pinky_up',     // 小指向上 - 向右移动
  FIST = 'fist',             // 握拳 - 停止
  OPEN_PALM = 'open_palm',   // 张开手掌 - 跳跃
  IDLE = 'idle'              // 空闲
}

export class GestureRecognitionService {
  private hands: any = null
  private isInitialized = false
  private lastProcessTime = 0
  private readonly PROCESS_INTERVAL = 100 // 每100ms最多处理一次

  async initialize(): Promise<void> {
    try {
      // 动态导入MediaPipe Hands
      // @ts-ignore
      const handsModule = await import('@mediapipe/hands').catch(() => null)
      if (!handsModule) {
        console.warn('MediaPipe Hands not available, using fallback gesture recognition')
        return
      }
      const { Hands } = handsModule
      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        }
      })

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      this.hands = hands
      this.isInitialized = true
      console.log('Gesture recognition initialized')
    } catch (error) {
      console.error('Failed to initialize gesture recognition:', error)
      throw error
    }
  }

  async processFrame(imageData: ImageData): Promise<GestureResult[]> {
    if (!this.isInitialized || !this.hands) {
      return []
    }

    const now = Date.now()
    if (now - this.lastProcessTime < this.PROCESS_INTERVAL) {
      return [] // 节流：跳过过于频繁的处理
    }
    this.lastProcessTime = now

    try {
      // 将ImageData转换为适合MediaPipe的格式
      const results = await this.hands.send({ image: imageData })

      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        return []
      }

      const gestureResults: GestureResult[] = []

      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i]
        const gesture = this.classifyFingerGesture(landmarks)
        const confidence = this.calculateGestureConfidence(landmarks, gesture)

        gestureResults.push({
          gesture,
          confidence,
          landmarks: this.convertLandmarks(landmarks)
        })
      }

      return gestureResults
    } catch (error) {
      console.error('Failed to process frame:', error)
      return []
    }
  }

  private classifyFingerGesture(landmarks: any): string {
    // 基于5个手指单独检测的手势识别逻辑（优化版本）

    // 获取每个手指的伸展状态
    const fingerStates = this.getFingerStates(landmarks)
    const extendedCount = Object.values(fingerStates).filter(Boolean).length

    // 检测张开手掌（优先级最高 - 大部分手指伸出）
    if (extendedCount >= 3) {
      return FingerGestures.OPEN_PALM // 张开手掌 - 跳跃
    }

    // 检测握拳（所有手指都弯曲）
    if (extendedCount === 0) {
      return FingerGestures.FIST // 握拳 - 停止
    }

    // 检测单个主要手指伸展（降低严格程度）
    const extendedFingers = Object.entries(fingerStates)
      .filter(([_, extended]) => extended)
      .map(([finger, _]) => finger)

    // 如果只有一个手指伸出，使用它
    if (extendedCount === 1) {
      const finger = extendedFingers[0]
      switch (finger) {
        case 'thumbExtended': return FingerGestures.THUMB_UP
        case 'indexExtended': return FingerGestures.INDEX_UP
        case 'middleExtended': return FingerGestures.MIDDLE_UP
        case 'ringExtended': return FingerGestures.RING_UP
        case 'pinkyExtended': return FingerGestures.PINKY_UP
      }
    }

    // 如果有两个手指伸出，优先选择食指
    if (extendedCount === 2 && fingerStates.indexExtended) {
      return FingerGestures.INDEX_UP
    }

    return FingerGestures.IDLE // 其他情况 - 空闲
  }

  private getFingerStates(landmarks: any): {
    thumbExtended: boolean
    indexExtended: boolean
    middleExtended: boolean
    ringExtended: boolean
    pinkyExtended: boolean
  } {
    const wrist = landmarks[0]

    return {
      thumbExtended: this.isFingerExtended(wrist, landmarks[1], landmarks[4]),  // 拇指
      indexExtended: this.isFingerExtended(wrist, landmarks[5], landmarks[8]),  // 食指
      middleExtended: this.isFingerExtended(wrist, landmarks[9], landmarks[12]), // 中指
      ringExtended: this.isFingerExtended(wrist, landmarks[13], landmarks[16]), // 无名指
      pinkyExtended: this.isFingerExtended(wrist, landmarks[17], landmarks[20])  // 小指
    }
  }

  private isFingerExtended(wrist: any, fingerBase: any, fingerTip: any): boolean {
    // 计算手指是否伸展的简单方法
    const fingerLength = Math.sqrt(
      Math.pow(fingerTip.x - fingerBase.x, 2) +
      Math.pow(fingerTip.y - fingerBase.y, 2)
    )

    const extension = Math.abs(fingerTip.y - wrist.y) / fingerLength

    return extension > 0.7 // 阈值可调整
  }

  private getHandDirection(landmarks: any): { horizontal: number; vertical: number } {
    const wrist = landmarks[0]
    const middleFingerBase = landmarks[9]

    return {
      horizontal: middleFingerBase.x - wrist.x,
      vertical: middleFingerBase.y - wrist.y
    }
  }

  private calculateGestureConfidence(landmarks: any, gesture: string): number {
    // 基于手指状态计算置信度
    const fingerStates = this.getFingerStates(landmarks)
    const extendedCount = Object.values(fingerStates).filter(Boolean).length

    let confidence = 0.5 // 基础置信度

    switch (gesture) {
      case FingerGestures.THUMB_UP:
        confidence = fingerStates.thumbExtended && extendedCount === 1 ? 0.9 : 0.3
        break
      case FingerGestures.INDEX_UP:
        confidence = fingerStates.indexExtended && extendedCount === 1 ? 0.9 : 0.3
        break
      case FingerGestures.MIDDLE_UP:
        confidence = fingerStates.middleExtended && extendedCount === 1 ? 0.9 : 0.3
        break
      case FingerGestures.RING_UP:
        confidence = fingerStates.ringExtended && extendedCount === 1 ? 0.9 : 0.3
        break
      case FingerGestures.PINKY_UP:
        confidence = fingerStates.pinkyExtended && extendedCount === 1 ? 0.9 : 0.3
        break
      case FingerGestures.FIST:
        confidence = extendedCount === 0 ? 0.95 : 0.2
        break
      case FingerGestures.OPEN_PALM:
        confidence = extendedCount >= 4 ? 0.85 : 0.3
        break
      default:
        confidence = 0.1
    }

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  private convertLandmarks(landmarks: any): HandLandmarks {
    const converted: HandLandmarks = {}

    landmarks.forEach((landmark: any, index: number) => {
      converted[index] = {
        x: landmark.x,
        y: landmark.y,
        z: landmark.z
      }
    })

    return converted
  }

  dispose(): void {
    if (this.hands) {
      this.hands.close()
      this.hands = null
    }
    this.isInitialized = false
  }
}

// 创建单例实例
export const gestureService = new GestureRecognitionService()
