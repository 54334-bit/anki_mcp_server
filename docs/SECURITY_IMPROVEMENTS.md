# Anki MCP Server - Security Fork

基于 [@ankimcp/anki-mcp-server](https://github.com/ankimcp/anki-mcp-server) 的安全增强版本。

## 安全改进

### 1. 破坏性操作确认机制

所有破坏性操作（如删除笔记、删除媒体文件）现在需要两步确认：

**使用流程：**
1. 第一次调用破坏性操作工具（如 `deleteNotes`），返回 `confirmationId`
2. 调用 `confirmAction` 工具确认操作
3. 再次调用破坏性操作工具，传入 `confirmationId` 执行操作

**示例：**
```javascript
// 步骤 1: 请求删除
const result1 = await mcp.callTool('deleteNotes', { notes: [123, 456] });
// 返回: { confirmationId: "abc-123", pendingAction: true }

// 步骤 2: 确认操作
const result2 = await mcp.callTool('confirmAction', { confirmationId: "abc-123" });

// 步骤 3: 执行删除
const result3 = await mcp.callTool('deleteNotes', { 
  notes: [123, 456], 
  confirmationId: "abc-123" 
});
```

**安全特性：**
- 确认 ID 5 分钟后过期
- 所有确认操作记录到审计日志
- 防止 AI 误操作或恶意操作

### 2. API Key 认证

HTTP 模式支持 API Key 认证，防止未授权访问。

**配置方式：**
```bash
# 设置环境变量
export API_KEY="your-secret-key-here"

# 启动服务器
npm run start:prod:http
```

**客户端使用：**
```bash
# 方式 1: Bearer Token
curl -H "Authorization: Bearer your-secret-key-here" \
  http://localhost:3141/mcp

# 方式 2: X-API-Key 头
curl -H "X-API-Key: your-secret-key-here" \
  http://localhost:3141/mcp

# 方式 3: 查询参数（不推荐，用于测试）
curl "http://localhost:3141/mcp?api_key=your-secret-key-here"
```

**安全特性：**
- 支持多种认证方式
- 未配置 API Key 时向后兼容（无认证）
- 记录所有认证失败尝试

### 3. 审计日志

所有操作记录到审计日志文件，支持事后审查。

**日志位置：**
- Windows: `%USERPROFILE%\.anki-mcp-server\audit.log`
- macOS/Linux: `~/.anki-mcp-server/audit.log`

**日志格式：**
```json
{
  "timestamp": "2026-06-14T10:30:00.000Z",
  "action": "deleteNotes",
  "parameters": { "notes": [123, 456], "noteCount": 2 },
  "result": "success",
  "confirmationId": "abc-123"
}
```

**查看日志：**
```bash
# Linux/macOS
tail -f ~/.anki-mcp-server/audit.log

# Windows PowerShell
Get-Content "$env:USERPROFILE\.anki-mcp-server\audit.log" -Wait
```

## 安装

### 前置要求

- Node.js >= 22.12.0
- Anki 已安装并运行
- AnkiConnect 插件已安装（插件代码: 2055492159）

### 安装步骤

```bash
# 1. 进入项目目录
cd anki-mcp-server-fork

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 全局安装（可选）
npm install -g .
```

## 配置

### Trae CN 配置

编辑 `.trae/mcp.json`：

```json
{
  "mcpServers": {
    "anki": {
      "command": "node",
      "args": [
        "D:/dd/projects/project1_cad_mcp_server_and_geminiapi/mcp servers/anki-mcp-server-fork/dist/main-stdio.js"
      ],
      "env": {
        "ANKI_CONNECT_URL": "http://localhost:8765",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### HTTP 模式配置（带认证）

```json
{
  "mcpServers": {
    "anki": {
      "url": "http://localhost:3141/mcp",
      "headers": {
        "Authorization": "Bearer your-secret-key-here"
      }
    }
  }
}
```

## 使用方法

### STDIO 模式

```bash
# 直接运行
node dist/main-stdio.js

# 或通过全局命令
ankimcp --stdio
```

### HTTP 模式

```bash
# 不带认证（向后兼容）
node dist/main-http.js --port 3141

# 带认证
API_KEY=your-secret-key node dist/main-http.js --port 3141
```

## 安全最佳实践

1. **始终使用 API Key 认证**（HTTP 模式）
2. **定期审查审计日志**
3. **使用强密码生成 API Key**
4. **不要在代码中硬编码 API Key**
5. **使用环境变量管理敏感信息**
6. **限制 AnkiConnect 端口访问**（仅允许 localhost）

## 与原版的对比

| 特性 | 原版 | 安全 Fork |
|------|------|----------|
| 破坏性操作确认 | 简单布尔标志 | 两步确认 + 超时 |
| HTTP 认证 | 无 | API Key 认证 |
| 审计日志 | 无 | 完整操作日志 |
| 安全评分 | 35/100 | 预期 70+/100 |

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 致谢

感谢 [@ankimcp/anki-mcp-server](https://github.com/ankimcp/anki-mcp-server) 原项目的优秀工作。
