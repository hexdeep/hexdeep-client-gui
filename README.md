## HexDeep GUI
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-v10.x-brightgreen)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-v18.x-brightgreen)](https://nodejs.org/)

HexDeep GUI 是 HexDeep 云手机项目的图形化用户界面，提供了对 HexDeep API 的管理和操作。

## 快速开始

### 前置条件

- Node.js 18
- pnpm 10.x

### 如何编译
```Shell
pnpm install   # 安装依赖 仅需第一次执行
pnpm build     # 生产构建
```
构建产物将生成在 `./dist` 目录中

### 运行项目
```Shell
pnpm dev
```

### 项目结构
``` Text
hexdeep-gui/
├── public/               # 静态资源
├── src/
│   ├── api/              # API接口定义和请求封装
│   ├── common/           # 公共工具和配置
│   ├── i18n/             # 国际化资源
│   ├── lib/              # 公共组件库
│   ├── pages/            # 页面组件
│   │   ├── vm/           # 虚拟机管理
│   │   ├── machine/      # 主机管理
│   │   ├── instance/     # 实例管理
│   │   └── order/        # 订单管理
│   ├── routes/           # 路由配置
│   ├── styles/           # 全局样式
│   ├── types/            # 类型定义
│   ├── main.ts           # 应用入口
│   └── ui_root.tsx       # 根UI组件
├── index.html            # 入口HTML文件
└── package.json          # 项目依赖配置
```

## 贡献指南
我们欢迎任何形式的贡献！请阅读我们的贡献指南了解如何参与项目开发。

## 许可证
本项目采用 [MIT 许可证](LICENSE)。