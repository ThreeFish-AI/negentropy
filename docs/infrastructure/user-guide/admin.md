# 管理后台

> 本文从用户手册拆分而来，原路径 [docs/user-guide.md](../../user-guide.md)。

管理后台（Admin）提供系统级治理能力，包括用户管理与角色权限管理。

> ⚠️ Admin 模块仅对具有 **admin** 角色的用户可见。用户通过 Google OAuth SSO 登录后，系统根据其角色分配访问权限。详细配置请参阅 [SSO 集成](../design/sso.md)。

> 🔀 **模型管理已迁移**：原「Admin / Models」已迁移至「Interface / Models」，详见 [Interface 能力接入](../../core/user-guide/interface.md)；Admin 模块不再承载模型配置职责。

### 7.1 用户管理

用户管理页面展示当前系统中的所有用户：

- **当前用户信息卡片**：头像、姓名、邮箱、角色徽章
- **用户列表**：展示所有用户及其角色
- **角色切换**：在 `admin` 和 `user` 之间切换用户角色
- **权限说明**：展示 admin 和 user 两种角色的权限范围

### 7.2 角色权限管理

角色权限管理页面以矩阵形式展示各角色的权限配置：

- **权限区域**：Admin Console、User Management、Knowledge、Memory、Chat
- **权限级别**：`read`（只读）/ `write`（读写），通过开关切换
- **草稿管理**：支持刷新加载、Reset 单个角色、Reset All
- **数据导出**：可导出当前权限配置的草稿快照 JSON
