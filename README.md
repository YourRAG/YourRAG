<div align="center">
  <img src="https://edgeoneimg.cdn.sn/i/692b8a42237f5_1764461122.webp" alt="YourRAG Logo" width="150">
  <h1>YourRAG</h1>
  <p>
    <b>Your Personal RAG Knowledge Base / 您的个人 RAG 知识库系统</b>
  </p>

  <p>
    <a href="https://github.com/YourRAG/YourRAG/stargazers"><img src="https://img.shields.io/github/stars/YourRAG/YourRAG?style=flat-square&logo=github" alt="GitHub stars"></a>
    <a href="https://github.com/YourRAG/YourRAG/network/members"><img src="https://img.shields.io/github/forks/YourRAG/YourRAG?style=flat-square&logo=github" alt="GitHub forks"></a>
    <a href="https://github.com/YourRAG/YourRAG/issues"><img src="https://img.shields.io/github/issues/YourRAG/YourRAG?style=flat-square&logo=github" alt="GitHub issues"></a>
    <a href="https://github.com/YourRAG/YourRAG/blob/main/LICENSE"><img src="https://img.shields.io/github/license/YourRAG/YourRAG?style=flat-square&logo=github" alt="License"></a>
  </p>
</div>

---

<div align="center">
  <img src="https://edgeoneimg.cdn.sn/i/692d4f3a78487_1764577082.webp" width="48%" />
  <img src="https://edgeoneimg.cdn.sn/i/692d4f38e53f0_1764577080.webp" width="45%" />
</div>

---

# YourRAG 更新日志 (Update Log)

**版本日期**: 2025-12-01
**当前状态**: 🚀 功能快速迭代中

---

## 📅 2025-12-01 更新概览

本日更新重点在于增强**文档组织能力**（分组过滤、导入导出）、提升**RAG 问答体验**（推理过程显示、OpenAI 兼容性）以及完善**开发者体验**（cURL 示例、Demo 演示）。

### ✨ 新增功能 (New Features)

* **文档分组与过滤增强**
    * **模型名称后缀过滤**: 实现了一项高级功能，支持通过模型名称后缀（如 `gpt-4o-mini-MyGroup`）来指定 RAG 搜索的文档组。如果组存在，搜索将限定在该组内；否则自动回退到全局搜索。
    * **搜索页分组筛选**: 在 UI 的搜索标签页增加了分组选择控件，允许用户在搜索时指定特定的文档文件夹。
    * **分组导入/导出**: 实现了文档组的完整管理功能，现在支持创建文件夹，并能将整个分组（包含文档内容和元数据）导出为 JSON，或从 JSON 导入。
* **推理模型支持 (Reasoning Models)**
    * **思维链显示**: API 和 UI 现已支持流式传输和显示推理内容（Reasoning Content）。对于具备“思考”能力的模型（如 DeepSeek-R1, QwQ 等），用户可以在对话界面看到 AI 的思维过程。
* **交互式演示 (Demo Tab)**
    * 新增 `Demo` 标签页和用户菜单入口，提供从“添加文档”到“搜索”再到“对话”的完整 RAG 工作流演示，帮助新用户快速上手。
* **元数据标签支持**
    * 在上传文档时增加了可选的 `Category` (类别) 和 `Source` (来源) 标签字段，并提供了可折叠的 UI 区域，方便对文档进行更细维度的标记。
* **活动追踪控制**
    * 在系统配置中集成了活动追踪（Activity Tracking）的全局开关，管理员可按需开启或关闭用户行为记录。

### ⚡️ 优化与改进 (Improvements)

* **OpenAI 兼容性升级**: 重构了对话历史处理逻辑，增加了对 `top_p`, `frequency_penalty` 等标准 OpenAI 参数的支持，确保与第三方客户端更好的兼容性。
* **开发者体验**: 在“添加文档”和“搜索”页面增加了交互式的 `cURL` 代码片段生成与复制功能，方便开发者直接复制命令在终端测试 API。
* **Prompt 优化**: 调整了 LLM 的系统提示词（Prompt），优化了在未检索到相关文档时的回答逻辑，减少幻觉并引导 AI 给出更得体的回复。
* **网络优化**: 禁用了本地连接的 HTTP 代理，避免在特定网络环境下出现路由问题。

### 🛡️ 安全与配置 (Security & Config)

* **安全加固**: 从 `.env.example` 中移除了敏感的 `DATABASE_URL` 默认值。
* **文档更新**: 更新 README，增加了 Waving Capsule 页脚，优化了 Docker 镜像的展示顺序。

---

## 📅 2025-11-30 更新概览

本日更新奠定了**文档分组架构**的基础，并引入了**Gitee 登录**与**自动化密钥管理**，大幅降低了部署门槛。

### ✨ 新增功能 (New Features)

* **Gitee OAuth 支持**: 新增 Gitee（码云）登录支持，完善了用户模型以支持多种认证提供商，并优化了管理员的用户管理界面。
* **文档分组架构 (Document Grouping)**:
    * 数据库层面引入 `DocumentGroup` 表。
    * API 和 UI 实现了完整的分组 CRUD（增删改查）操作。
    * 支持批量将文档分配到指定分组。
* **独立活动记录页**: 新增 `Activity` (活动) 标签页，将活动记录从个人资料页剥离，提供独立的浏览体验，并支持清空历史记录。
* **自动化密钥生成**: 实现了 RSA 密钥的自动生成逻辑。如果环境变量未配置 `PRIVATE_KEY`，系统将在首次启动时自动生成并存入数据库，极大简化了 JWT 认证的部署流程。

### 💄 界面优化 (UI Polish)

* **加载体验**: 在用户认证检查期间添加了加载旋转动画（Loading Spinner），提升首屏体验。
* **弹窗标准化**: 将全局的 `alert` 调用替换为自定义的 `AlertModal` 和 `ConfirmModal` 组件，统一了交互风格。
* **样式微调**: 修复了 API Key 选择区域的边距问题。

### 🔧 构建与开发 (Build & Dev)

* **Turbo 模式**: 开发环境 (`npm run dev`) 启用 Next.js Turbo 模式，显著提升热更新速度。
* **环境变量**: 调整 `.env.example`，补充 `EMBEDDING_VECTOR_DIMENSION` 配置项。

<br/>

## What is YourRAG / YourRAG 是什么

<div align="center">
  <img src="https://edgeoneimg.cdn.sn/i/692b899378285_1764460947.webp" width="46%" />
  <img src="https://edgeoneimg.cdn.sn/i/692ad1d14125b_1764413905.webp" width="48%" />
</div>
<br/>

## How to Deploy YourRAG / 如何部署 YourRAG

<div align="center">
  <img src="https://edgeoneimg.cdn.sn/i/692ac7d1126c5_1764411345.webp" width="46%" />
  <img src="https://edgeoneimg.cdn.sn/i/692a607a5f68b_1764384890.webp" width="48%" />
</div>
<br/>