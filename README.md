# 拳击手势识别系统 🥊

一个基于Vue 3 + TypeScript + Vite开发的实时拳击手势识别和人偶交互系统。通过电脑摄像头捕捉用户手势动作，实时驱动3D人偶进行拳击比赛。

## ✨ 核心功能

### 🎥 实时摄像头捕获
- 支持调用用户电脑摄像头
- 实时捕捉手势动作画面
- 清晰流畅的视频采集

### 🤖 智能手势识别
- 基于MediaPipe的手势识别引擎
- 支持多种拳击动作识别：
  - ✊ **直拳** (Jab) - 快速前伸
  - 👊 **交叉拳** (Cross) - 强力打击
  - 🥊 **勾拳** (Hook) - 旋转打击
  - ⬆️ **上勾拳** (Uppercut) - 向上攻击
  - 🛡️ **格挡** (Block) - 防御姿势

### 🎮 3D人偶交互
- Three.js驱动的3D人偶渲染
- 实时同步手势到人偶动作
- 流畅的动画过渡效果

### 🏟️ 拳击比赛场景
- 逼真的擂台环境
- 实时计分板和计时器
- 生命值和连击系统
- 专业的拳击比赛UI

### 🎯 游戏模式
- **单人对战AI** - 与智能AI对手对战
- **双人对战** - 两个玩家同时参与

## 🚀 快速开始

### 环境要求
- Node.js 16+
- 支持WebGL的现代浏览器
- 电脑摄像头权限

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问 `http://localhost:5174` 开始使用！

## 🎮 使用指南

### 基本操作
1. **允许摄像头权限** - 首次使用需要授权摄像头访问
2. **选择游戏模式** - 单人对战AI或双人对战
3. **开始比赛** - 点击"开始比赛"按钮
4. **做出手势** - 在摄像头前做出拳击动作

### 手势识别提示
- 确保光线充足，背景简单
- 手势动作要清晰明显
- 保持合适距离（手臂伸直距离）
- 避免快速切换动作

### 比赛规则
- **回合时间**: 3分钟
- **总回合**: 3回合
- **得分系统**: 击中得分，连击奖励
- **生命值**: 初始100点，受到攻击减少

## 🛠️ 技术架构

### 前端框架
- **Vue 3** - 响应式UI框架
- **TypeScript** - 类型安全的JavaScript
- **Vite** - 快速的构建工具

### AI与计算机视觉
- **MediaPipe Hands** - 手势识别引擎
- **TensorFlow.js** - 机器学习框架

### 3D渲染
- **Three.js** - 3D图形渲染引擎
- **WebGL** - 硬件加速渲染

### 核心服务
- `gestureRecognition.ts` - 手势识别服务
- `gameLogic.ts` - 比赛逻辑处理
- `CameraCapture.vue` - 摄像头组件
- `BoxingCharacter.vue` - 3D人偶组件
- `BoxingArena.vue` - 比赛场景组件

## 📦 项目结构

```
src/
├── components/          # Vue组件
│   ├── CameraCapture.vue    # 摄像头捕获
│   ├── BoxingCharacter.vue  # 3D拳击人偶
│   └── BoxingArena.vue      # 拳击擂台场景
├── services/            # 业务服务
│   ├── gestureRecognition.ts # 手势识别
│   └── gameLogic.ts         # 游戏逻辑
├── App.vue             # 主应用组件
└── main.ts            # 应用入口
```

## 🎯 性能优化

- **帧率控制**: 限制到30FPS避免过度渲染
- **节流处理**: 手势识别100ms间隔处理
- **条件渲染**: 不可见组件暂停动画
- **内存管理**: 主动清理资源和事件监听器

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

### 开发环境设置
1. Fork本项目
2. 克隆到本地: `git clone https://github.com/your-username/boxing-gesture-recognition.git`
3. 安装依赖: `npm install`
4. 启动开发: `npm run dev`

## 📄 许可证

MIT License - 详见LICENSE文件

## 🙏 致谢

- [MediaPipe](https://mediapipe.dev/) - 提供优秀的手势识别技术
- [Three.js](https://threejs.org/) - 强大的3D渲染引擎
- [Vue.js](https://vuejs.org/) - 优秀的响应式框架

---

**享受拳击的乐趣！让你的手势成为最强的武器！** 💪🥊
