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

export enum BoxingGestures {
  JAB = 'jab',           // 直拳
  CROSS = 'cross',        // 交叉拳
  HOOK = 'hook',          // 勾拳
  UPPERcut = 'uppercut',  // 上勾拳
  BLOCK = 'block',        // 格挡
  IDLE = 'idle'           // 空闲
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
        const gesture = this.classifyBoxingGesture(landmarks)
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

  private classifyBoxingGesture(landmarks: any): string {
    // 简化的拳击手势分类逻辑
    // 基于手部关键点的相对位置进行分类

    const wrist = landmarks[0]

    // 计算手指的伸展程度
    const fingersExtended = [
      this.isFingerExtended(wrist, landmarks[5], landmarks[8]),  // 食指
      this.isFingerExtended(wrist, landmarks[9], landmarks[12]), // 中指
      this.isFingerExtended(wrist, landmarks[13], landmarks[16]), // 无名指
      this.isFingerExtended(wrist, landmarks[17], landmarks[20])  // 小指
    ]

    const extendedCount = fingersExtended.filter(Boolean).length

    // 计算手的方向（用于区分不同类型的拳击动作）
    const handDirection = this.getHandDirection(landmarks)

    // 拳击手势分类逻辑
    if (extendedCount === 0) {
      // 所有手指都弯曲 - 可能是握拳
      if (handDirection.vertical > 0.3) {
        return BoxingGestures.UPPERcut // 上勾拳
      } else if (Math.abs(handDirection.horizontal) > 0.3) {
        return BoxingGestures.HOOK // 勾拳
      } else {
        return BoxingGestures.CROSS // 交叉拳或直拳
      }
    } else if (extendedCount === 1 && fingersExtended[0]) {
      // 只有食指伸出 - 可能是直拳准备姿势或点拳
      return BoxingGestures.JAB
    } else if (extendedCount >= 2) {
      // 多个手指伸出 - 可能是格挡姿势
      return BoxingGestures.BLOCK
    }

    return BoxingGestures.IDLE
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

  private calculateGestureConfidence(_landmarks: any, _gesture: string): number {
    // 简化的置信度计算
    // 在实际应用中，应该基于机器学习模型的输出
    return 0.8 // 临时返回固定值
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
