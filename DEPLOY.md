# 线上部署

这个项目现在已经适配 `Vercel`。

## 方案一：Vercel

1. 把项目上传到 GitHub。
2. 在 Vercel 中点击 `Add New Project`。
3. 选择当前仓库并导入。
4. `Framework Preset` 选择 `Other` 即可。
5. 在 `Environment Variables` 中填写：
   - `ARK_API_KEY`
   - `QDRANT_API_KEY`（可选，当前版本未实际使用）
6. 点击部署。
7. 部署完成后可访问：
   - `/`
   - `/api/health`

### 当前 Vercel 结构

- `public/`：静态页面
- `api/[...route].js`：Vercel Serverless API 入口
- `server.js`：本地和 Vercel 共用的 Express 应用
- `vercel.json`：Vercel 函数配置

## 方案二：本地 Vercel CLI 预览

```bash
npm i -g vercel
vercel
```

首次运行会提示你登录并绑定项目。

## 方案三：Docker

```bash
docker build -t doubao-chat-demo .
docker run -p 3456:3456 -e ARK_API_KEY=你的key doubao-chat-demo
```

如果以后要接入 Qdrant，可以额外传：

```bash
-e QDRANT_API_KEY=你的key
```

## 注意事项

- 不要把任何真实密钥写进前端。
- 不要把 `.env` 提交到仓库。
- 当前公开访问的服务，所有调用都会使用服务端的 `ARK_API_KEY`，所以如果要长期对外开放，建议后续再加：
  - 登录或访问频控
  - 请求限流
  - 简单鉴权
