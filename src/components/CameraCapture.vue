<template>
  <div class="camera-container">
    <video
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="camera-video"
      :class="{ 'camera-active': isActive }"
    ></video>
    <canvas
      ref="canvasRef"
      class="camera-canvas"
      :width="videoWidth"
      :height="videoHeight"
    ></canvas>

    <div class="camera-controls">
      <button
        @click="toggleCamera"
        :disabled="isLoading"
        class="control-button"
      >
        {{ isActive ? '停止摄像头' : '启动摄像头' }}
      </button>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  width?: number
  height?: number
  onFrame?: (imageData: ImageData) => void
}

const props = withDefaults(defineProps<Props>(), {
  width: 640,
  height: 480
})

const videoRef = ref<HTMLVideoElement>()
const canvasRef = ref<HTMLCanvasElement>()
const stream = ref<MediaStream | null>(null)

const isActive = ref(false)
const isLoading = ref(false)
const error = ref<string>('')

const videoWidth = ref(props.width)
const videoHeight = ref(props.height)

let animationFrame: number | null = null
let lastFrameTime = 0
const TARGET_FPS = 30 // 目标30FPS
const FRAME_INTERVAL = 1000 / TARGET_FPS

const startCamera = async () => {
  try {
    isLoading.value = true
    error.value = ''

    const constraints = {
      video: {
        width: props.width,
        height: props.height,
        facingMode: 'user'
      }
    }

    stream.value = await navigator.mediaDevices.getUserMedia(constraints)

    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
      videoRef.value.addEventListener('loadedmetadata', () => {
        videoWidth.value = videoRef.value!.videoWidth
        videoHeight.value = videoRef.value!.videoHeight
        isActive.value = true
        isLoading.value = false
        startFrameCapture()
      })
    }
  } catch (err) {
    console.error('Failed to access camera:', err)
    error.value = '无法访问摄像头，请确保已授予权限'
    isLoading.value = false
  }
}

const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }

  if (videoRef.value) {
    videoRef.value.srcObject = null
  }

  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  isActive.value = false
}

const toggleCamera = () => {
  if (isActive.value) {
    stopCamera()
  } else {
    startCamera()
  }
}

const startFrameCapture = () => {
  const captureFrame = (currentTime: number) => {
    if (!isActive.value || !videoRef.value || !canvasRef.value) return

    // 控制帧率
    if (currentTime - lastFrameTime < FRAME_INTERVAL) {
      animationFrame = requestAnimationFrame(captureFrame)
      return
    }

    lastFrameTime = currentTime

    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      if (props.onFrame) {
        props.onFrame(imageData)
      }
    }

    animationFrame = requestAnimationFrame(captureFrame)
  }

  animationFrame = requestAnimationFrame(captureFrame)
}

onMounted(() => {
  // 自动启动摄像头（可选）
  // startCamera()
})

onUnmounted(() => {
  stopCamera()
})

// 暴露方法给父组件
defineExpose({
  startCamera,
  stopCamera,
  toggleCamera,
  isActive,
  videoWidth,
  videoHeight
})
</script>

<style scoped>
.camera-container {
  position: relative;
  display: inline-block;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.camera-video {
  display: block;
  width: 100%;
  height: auto;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.camera-video.camera-active {
  opacity: 1;
}

.camera-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.camera-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: center;
}

.control-button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.control-button:hover:not(:disabled) {
  background: #0056b3;
}

.control-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
}
</style>
