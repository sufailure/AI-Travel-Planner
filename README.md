Web 版 AI 旅行规划师（AI Travel Planner）
================================================

本仓库用于构建 AI 驱动的旅行规划 Web 应用。项目采用 Next.js 14 + TypeScript + Tailwind CSS，后续将逐步接入语音交互、地图导航、行程管理与云端同步等功能。

## 开始使用

1. 安装依赖：`pnpm install` / `npm install` / `yarn install`
2. 复制环境变量模板：`cp .env.example .env.local`，并填入真实的 API Key
3. 本地启动开发服务器：`npm run dev`

访问 `http://localhost:3000` 即可查看初始页面。

## 下一步计划

- 集成 Supabase/Firebase 完成认证与数据模型
- 接入语音识别与语音指令解析
- 调用大语言模型生成行程与预算
- 融合地图服务展示地点、路线与实时辅助

如需部署到生产环境，请确保已配置 CI/CD、封装机密变量，并根据实际情况扩展后端服务。
