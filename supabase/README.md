# Supabase Schema

使用 `schema.sql` 为项目初始化行程、预算与语音日志相关的表结构，并配置 RLS 策略。

## 使用步骤

1. 打开 Supabase 控制台，进入 SQL Editor。
2. 复制 `schema.sql` 内容执行一次；重复执行会自动跳过已存在的对象。
3. 检查 `Database > Policies` 页面，确认每张表的 RLS 策略已经启用。
4. 如需自定义枚举值、扩展字段或添加索引，可在此文件的基础上追加新的 migration。

执行完毕后，请在 `.env.local` 中配置 Supabase 项目的 URL 与密钥，以便应用使用。
