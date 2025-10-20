Web 版 AI 旅行规划师（AI Travel Planner）
================================================

本仓库用于构建 AI 驱动的旅行规划 Web 应用。项目采用 Next.js 14 + TypeScript + Tailwind CSS，后续将逐步接入语音交互、地图导航、行程管理与云端同步等功能。

## 开始使用

1. 安装依赖：`pnpm install` / `npm install` / `yarn install`
2. 复制环境变量模板：`cp .env.example .env.local`，并填入真实的 API Key
3. 本地启动开发服务器：`npm run dev`

访问 `http://localhost:3000` 即可查看初始页面。

## 下一步计划

- 集成 Supabase 完成认证与数据模型
- 接入语音识别与语音指令解析
- 调用大语言模型生成行程与预算
- 融合地图服务展示地点、路线与实时辅助

如需部署到生产环境，请确保已配置 CI/CD、封装机密变量，并根据实际情况扩展后端服务。

## Supabase 设置

1. 登录 Supabase 控制台，新建项目。
2. 在 `.env.local` 中填写以下变量：
	- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
	- `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`（仅服务器端使用，不要暴露给前端）
3. 进入 Supabase SQL 编辑器，执行 `supabase/schema.sql` 以创建行程、预算与语音日志等表结构，同时启用 RLS 策略与触发器。
4. 在 `auth` 设置中开启邮件或第三方登录方式，后续可通过 App Router 的 Supabase Provider 使用会话信息。

完成以上步骤后，即可在前端读取 `SessionContextProvider` 提供的会话信息，为行程 CRUD、预算记录与语音日志等 API 打好基础。
