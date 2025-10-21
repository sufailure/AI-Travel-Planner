# AI 旅行规划师（AI Travel Planner）

一个围绕“旅行计划”场景打造的智能 Web 应用。项目基于 Next.js 14、TypeScript，结合语音识别、个性化偏好和大模型生成能力，帮助旅行者快速整理需求、生成行程、管理预算，并安全地保管个人密钥。

## 产品亮点

- **智能行程生成**：整合目的地、时间、预算、偏好等信息，由服务端调用大模型生成每日行程、交通、餐饮及预算拆分。
- **语音辅助录入**：内置语音识别与自动填充逻辑，一句话即可补齐日期、人数等关键信息。
- **本地密钥管理**：LLM API Key 仅存储在浏览器 localStorage，提供候选解析、快速保存与可用性验证，避免泄露风险。
- **行程全流程管理**：支持草稿保存、云端同步（Supabase）、预算跟踪及行程抽屉查看。



## 快速启动

```bash
npm run dev
```

访问 `http://localhost:3000`，注册/登录后即可体验智能行程规划流程。

## LLM API Key 管理说明

- 进入页面左上角菜单中的 **设置** 页面，粘贴 Key 或将包含多组 Key 的文本批量解析。
- 所有 Key 信息仅保存在当前浏览器的 localStorage，可随时移除或切换激活状态。
- 使用 **验证可用性** 按钮测试 DashScope 连通性，避免生成前才发现异常。
- Planner 模块会在提交前检查是否存在可用 Key，并在同一面板内展示醒目的提醒。

## 常用脚本

| 命令            | 功能                       |
| --------------- | -------------------------- |
| `npm run dev`   | 启动开发服务器（含热更新） |
| `npm run build` | 构建生产包                 |
| `npm run start` | 以生产模式启动 Next.js     |
| `npm run lint`  | 执行 ESLint 规则校验       |

## 部署建议

- 部署到 Vercel/Netlify 时，将 Supabase 环境变量写入托管平台的环境配置。
- `SUPABASE_SERVICE_ROLE_KEY` 仅在服务端使用，请不要暴露给前端与日志。
- 因密钥存储在客户端，需提示最终用户每台浏览器都须单独配置 Key。
- 可结合 Vercel Edge Functions 或 Supabase Edge Functions 扩展更多服务端能力。

## Docker 使用说明（GHCR + 本地构建）

CI/CD 会自动把最新镜像推送到 GitHub Container Registry（GHCR）。如需本地调试或自定义镜像，可参考以下两种方式：

### 1. 直接拉取 GHCR 镜像

1. 在 GitHub 个人设置中生成具备 `read:packages` 权限的 Personal Access Token（经典 PAT 或 fine-grained PAT 均可）。
2. 登录 GHCR：
	 ```bash
	 echo <PAT> | docker login ghcr.io -u <GitHub 用户名> --password-stdin
	 ```
3. 拉取镜像（仓库名会被转换为小写，例如 `ghcr.io/sufailure/ai-travel-planner`）：
	 ```bash
	 docker pull ghcr.io/sufailure/ai-travel-planner:<git-sha>
	 ```
4. 使用 `.env.local`（或等价文件）为容器注入 Supabase、讯飞、地图等运行期密钥：
	 ```bash
	 docker run --rm -p 3000:3000  --env-file .env.local ghcr.io/sufailure/ai-travel-planner:<git-sha>
	 ```



如需导出离线镜像，可执行：

```bash
docker save ghcr.io/sufailure/ai-travel-planner:latest -o ai-travel-planner.tar
```

## 常见问题（FAQ）

1. **为何 Planner 提示需要配置 LLM Key？**
	- 请前往设置页面粘贴可用 Key，并确认选择为“当前使用”，返回 Planner 再次尝试。
2. **语音识别不可用？**
	- 检查浏览器是否允许麦克风权限，若设备不支持，则界面会提供文本输入替代方案。
3. **如何重置存储的 Key？**
	- 在设置页面删除对应记录；如需彻底清理，可清除浏览器的 localStorage。

## 贡献指南

1. Fork 或克隆项目，创建特性分支。
2. 开发过程中保持类型与 Lint 通过（`npm run lint`）。
3. 提交 Pull Request 时附上关键变化说明，UI 改动建议提供截图或录屏。

## 授权协议

本项目采用 [MIT License](./LICENSE)。欢迎在遵循许可协议的前提下自由使用与二次开发。
