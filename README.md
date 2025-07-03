# 安全即时通讯应用 - 深度解析

本项目是一个实现了端到端加密（E2EE）的网页即时通讯（IM）应用。它旨在演示现代Web技术如何构建一个安全、私密的聊天系统，其中服务器仅作为加密消息的中继，无法窥探任何通信内容。

## 技术栈

- **后端**: Python 3, FastAPI, Uvicorn, MongoDB
- **前端**: TypeScript, Remix (React 框架), Vite, Tailwind CSS
- **核心安全库**: Web Crypto API (浏览器原生加密接口)

## 核心特性

- **端到端加密**: 所有消息在发送前于客户端加密，在接收端解密。
- **自动密钥管理**: 用户首次登录后，系统自动在客户端生成密钥对，并将公钥上传至服务器。
- **实时通信**: 使用 WebSocket 实现低延迟的消息传递和在线状态更新。
- **安全的会话管理**: 使用签名的、`httpOnly` 的 Cookie 存储会话凭证。

---

## 详尽通信流程

以下是系统从注册到完成一次加密通信的完整步骤分解。

### 阶段一：用户身份认证与密钥准备

#### 1. 用户注册
- **前端**: 用户在注册页面输入用户名和密码。
- **API 调用**: 前端向后端 `POST /api/user/register` 发送用户名和密码。
- **后端**:
    - 对密码进行哈希处理。
    - 将用户名和哈希后的密码存入 MongoDB 数据库。

#### 2. 用户登录
- **前端**: 用户在登录页面输入用户名和密码。
- **API 调用**: 前端向后端 `POST /api/user/login` 发送凭证。
- **后端**:
    - 从数据库中查找用户，验证密码哈希是否匹配。
    - 验证成功后，生成一个包含用户名的 JWT (JSON Web Token)。
    - 返回一个包含 `accessToken` (即JWT) 和 `user` 对象（其中包含一个重要的布尔标志 `hasPublicKey`）的 JSON 响应。

#### 3. 客户端会话创建
- **前端 (Remix)**:
    - `auth.tsx` 的 `action` 函数接收到后端的成功响应。
    - 调用 `createUserSession` 函数，将 `accessToken` 和 `user` 对象打包存入一个安全的、`httpOnly` 的会话 Cookie 中。
    - 将用户重定向到 `/chat` 聊天页面。

#### 4. 密钥对的自动生成与上传 (首次登录)
- **前端**:
    - 浏览器加载 `/chat` 页面。
    - `chat.tsx` 组件的 `useEffect` hook 被触发。它从会话中读取 `user` 对象，并检查 `user.hasPublicKey` 是否为 `false`。
    - **如果为 `false`**:
        1.  调用 `crypto.client.ts` 中的 `generateAndStoreKeys()` 函数。
        2.  该函数使用浏览器原生的 `Web Crypto API` 生成一个 RSA-OAEP 密钥对。
        3.  **私钥 (Private Key)** 被安全地存储在用户浏览器的 `localStorage` 中。**此密钥永远不会离开用户的设备**。
        4.  **公钥 (Public Key)** 被导出为 PEM 格式的字符串。
        5.  客户端自动向后端 `POST /api/users/me/key` 发送这个公钥，请求头中携带 JWT 进行身份验证。
- **后端**:
    - 接收到公钥上传请求，验证 JWT。
    - 将公钥字符串存储到该用户的数据库记录中，并更新 `hasPublicKey` 标志为 `true`。

### 阶段二：实时加密通信

#### 5. 建立 WebSocket 连接
- **前端**:
    - `chat.tsx` 组件使用会话中的 `accessToken` 向后端 `ws://127.0.0.1:8000/ws` 发起 WebSocket 连接请求。
- **后端**:
    - 验证 Token，将用户标记为在线，并将其加入一个全局的在线用户列表中。
    - 通过 WebSocket 向该用户推送当前所有其他在线用户的列表。
    - 向所有其他用户广播该用户的上线通知。

#### 6. 发送一条加密消息 (用户A -> 用户B)
1.  **获取接收方公钥**:
    - 用户 A 在聊天框中输入消息并点击发送。
    - `handleSendMessage` 函数被触发。它首先检查是否在本地状态中缓存了用户 B 的公钥。
    - 如果没有缓存，它会向后端 `GET /api/users/{用户B的用户名}/key` 发起请求。
    - 后端从数据库返回用户 B 的公钥。
    - 前端将获取到的公钥缓存到状态中，以备后续使用。

2.  **执行加密**:
    - `handleSendMessage` 函数调用 `encryptMessage`，并传入**明文消息**和刚刚获取到的**用户 B 的公钥**。
    - `encryptMessage` 使用此公钥通过 RSA-OAEP 算法加密消息。
    - 函数返回加密后的数据（Base64 字符串）。

3.  **通过 WebSocket 发送**:
    - 客户端将加密后的数据打包成一个 JSON 对象，格式为 `{ type: "message:send", payload: { to: "用户B", encryptedContent: "..." } }`。
    - 这个 JSON 对象通过 WebSocket 发送给服务器。

#### 7. 接收并解密消息 (用户B)
1.  **服务器中继**:
    - 后端 WebSocket 服务器接收到来自用户 A 的消息。它**不会也无法解密** `encryptedContent`。
    - 它根据 `payload.to` 字段查找用户 B 的 WebSocket 连接，并将整个 JSON 对象原封不动地转发给用户 B。

2.  **客户端解密**:
    - 用户 B 的客户端在其 WebSocket 的 `onmessage` 事件监听器中收到这个 JSON 对象。
    - 程序调用 `decryptMessage` 函数，并传入收到的 `encryptedContent`。
    - `decryptMessage` 函数会：
        1.  从 `localStorage` 中读取并导入用户 B 自己的**私钥**。
        2.  使用此私钥解密 `encryptedContent`。
        3.  返回解密后的**明文消息**。

3.  **显示消息**:
    - 客户端的 React 组件状态被更新，将解密后的明文消息渲染到聊天窗口中。

至此，一次完整的、端到端加密的通信流程宣告完成。

---

## 开发与部署

### 启动后端服务
```bash
# 进入后端目录
cd d:/security_inst_comm_system/backend_server

# 安装依赖
pip install -r requirements.txt

# 启动服务器
uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```

### 启动前端服务
```bash
# 进入前端目录
cd d:/security_inst_comm_system/my-secure-chat-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
