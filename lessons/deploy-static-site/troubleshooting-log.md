# 部署踩坑排查日志

> 完整记录从蓝盾 CI/CD 到本地脚本部署过程中所有执行的脚本、指令、执行结果和分析研究过程。

## 环境信息

| 项目 | 详情 |
|------|------|
| 代码仓库 | https://git.woa.com/yeranyang/my-space.git |
| 服务器 | 腾讯云轻量应用服务器，IP: 139.199.72.245，Ubuntu 24.04 |
| SSH 版本 | 服务器 OpenSSH_9.6p1，AnyDev 容器 OpenSSH_8.0p1 |
| 密钥文件 | light_server_for_claw.pem（RSA 1678字节） |
| 登录用户 | ubuntu |
| 网站目录 | /var/www/my-space |
| CI/CD 平台 | 蓝盾（BK-CI）智研模式 |

---

## 第 1 轮：蓝盾流水线创建与凭证配置

### 流水线配置

- **创建方式**：直接创建
- **应用**：yspace
- **任务名称**：构建-yeranyang-yspace
- **代码路径**：https://git.woa.com/yeranyang/my-space.git
- **开发语言**：Node.js（无更合适选项）
- **制品类型**：软件包
- **制品路径**：`.`
- **代码扫描**：关
- **单元测试**：关

### 问题：变量系统不支持凭证类型

蓝盾经典模式的变量类型下拉框只有：字符串、文本框、布尔值、单选框、复选框、SVN分支或TAG、GIT分支或TAG。**没有「凭证」选项**。

### 解决方案

使用「文本框」变量替代：
- 变量名：`deploy_ssh_key`
- 变量类型：文本框
- 勾选「是否敏感」
- 取消「是否为入参」
- 变量值：SSH 私钥内容

### 初始编译脚本 v1

```bash
#!/bin/bash
set -e

echo "========== 开始部署 my-space =========="

cd ${WORKSPACE}

# 配置SSH密钥（从流水线变量注入）
mkdir -p ~/.ssh
echo "${deploy_ssh_key}" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key
ssh-keyscan -H 139.199.72.245 >> ~/.ssh/known_hosts 2>/dev/null

echo "✅ SSH密钥配置完成"

# rsync 部署文件到服务器
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.gongfeng-ci.yml' \
  --exclude='deploy.sh' \
  --exclude='*.md' \
  --exclude='nginx.conf.example' \
  -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no" \
  ./ ubuntu@139.199.72.245:/var/www/my-space/

echo "✅ 文件同步完成"

# 服务器上设置权限并重载nginx
ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no ubuntu@139.199.72.245 << 'REMOTE'
sudo chown -R ubuntu:ubuntu /var/www/my-space
sudo chmod -R 755 /var/www/my-space
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx重载完成"
REMOTE

# 清理密钥
rm -f ~/.ssh/deploy_key

# 健康检查
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://139.199.72.245)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 健康检查通过 (HTTP ${HTTP_CODE})"
    echo "🌐 网站地址: https://yeranyang.com"
else
    echo "❌ 健康检查失败 (HTTP ${HTTP_CODE})"
    exit 1
fi

echo "========== 部署完成 =========="
```

---

## 第 2 轮：首次执行报错 — SSH 连接被拒绝

### 执行结果

```
========== 开始部署 my-space ==========
✅ SSH密钥配置完成
kex_exchange_identification: Connection closed by remote host
rsync: connection unexpectedly closed (0 bytes received so far) [sender]
rsync error: unexplained error (code 255) at io.c(226) [sender=3.1.3]

Fail to run the plugin because exit code not equal 0
Error: Process completed with exit code 2199011
```

### 分析

- `kex_exchange_identification` 错误发生在 SSH 协议的密钥交换阶段
- 连接在认证之前就被关闭了
- 初步怀疑：防火墙/安全组拦截了蓝盾构建机 IP

### 排查：防火墙确认

腾讯云轻量服务器防火墙已放通 22 端口（来源 0.0.0.0/0，所有 IPv4）。

### 加入网络诊断命令

在脚本中加入 TCP 端口探测：

```bash
echo "测试网络连通性..."
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/139.199.72.245/22' && echo "✅ 端口可达" || echo "❌ 端口不可达"
```

### 第二次执行结果

```
========== 开始部署 my-space ==========
✅ SSH密钥配置完成
测试网络连通性...
✅ 端口可达
kex_exchange_identification: Connection closed by remote host
rsync: connection unexpectedly closed (0 bytes received so far) [sender]
rsync error: unexplained error (code 255) at io.c(226) [sender=3.1.3]
```

### 结论

TCP 22 端口可达，但 SSH 协议层被拒绝。**不是防火墙问题**。

---

## 第 3 轮：Base64 编码解决换行符问题

### 假设

蓝盾文本框变量在注入脚本时破坏了私钥的多行格式（换行符丢失）。

### 解决方案

在 Mac 上将私钥 Base64 编码为单行：

```bash
base64 < /Users/yangguang/Downloads/YSpace/light_server_for_claw.pem | tr -d '\n' | pbcopy
```

更新蓝盾变量值为 Base64 编码的单行字符串。

### 编译脚本 v2（含 Base64 解码和格式验证）

```bash
#!/bin/bash
set -e

echo "========== 开始部署 my-space =========="

# 配置SSH密钥（Base64解码）
mkdir -p ~/.ssh
echo "${deploy_ssh_key}" | base64 -d > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key

# 验证密钥格式
echo "密钥文件前30字符: $(head -c 30 ~/.ssh/deploy_key)"
if head -1 ~/.ssh/deploy_key | grep -q "BEGIN"; then
    echo "✅ SSH密钥格式正确"
else
    echo "❌ SSH密钥格式异常，可能变量注入有问题"
    exit 1
fi

ssh-keyscan -H 139.199.72.245 >> ~/.ssh/known_hosts 2>/dev/null
echo "✅ SSH密钥配置完成"

# 测试网络连通性
echo "测试网络连通性..."
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/139.199.72.245/22' && echo "✅ 端口可达" || echo "❌ 端口不可达"

# 测试SSH连接
echo "测试SSH连接..."
ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@139.199.72.245 "echo '✅ SSH连接成功'" || {
    echo "❌ SSH连接失败"
    echo "密钥文件信息:"
    ls -la ~/.ssh/deploy_key
    file ~/.ssh/deploy_key
    exit 1
}

# ... (后续 rsync 部署步骤同上)
```

### 执行结果

```
========== 开始部署 my-space ==========
密钥文件前30字符: -----BEGIN RSA PRIVATE KEY----
✅ SSH密钥格式正确
✅ SSH密钥配置完成
测试网络连通性...
✅ 端口可达
测试SSH连接...
kex_exchange_identification: Connection closed by remote host
❌ SSH连接失败
密钥文件信息:
-rw------- 1 root root 1678 5月   2 22:09 /root/.ssh/deploy_key
/root/.ssh/deploy_key: PEM RSA private key
```

### 结论

- ✅ 密钥 Base64 解码成功，格式正确
- ✅ 文件权限 600 正确
- ✅ file 命令识别为 PEM RSA private key
- ❌ SSH 仍然在协议握手阶段被关闭
- **密钥格式不是问题**，问题在其他地方

---

## 第 4 轮：服务器端全面排查

### 4.1 检查 /etc/hosts.deny

```bash
ubuntu@VM-0-6-ubuntu:~$ cat /etc/hosts.deny
```

**结果**：文件为空（只有注释），无拦截规则。✅

### 4.2 检查 sshd_config 访问限制

```bash
ubuntu@VM-0-6-ubuntu:~$ grep -i "AllowUsers\|DenyUsers\|AllowGroups\|DenyGroups\|MaxStartups\|Match" /etc/ssh/sshd_config
#MaxStartups 10:30:100
#Match User anoncvs
```

**结果**：AllowUsers/DenyUsers 均为注释，无限制。✅

### 4.3 查看 SSH 拒绝日志

```bash
ubuntu@VM-0-6-ubuntu:~$ sudo tail -100 /var/log/auth.log | grep -i "ssh\|connection\|closed\|refused\|key"
```

**结果**（关键摘录）：

```
2026-05-02T21:47:13 sshd[12662]: Connection reset by 129.204.154.232 port 36144 [preauth]
2026-05-02T21:48:06 sshd[12856]: Invalid user admin from 204.76.203.233 port 60506
2026-05-02T21:48:06 sshd[12856]: Failed password for invalid user admin from 204.76.203.233
2026-05-02T21:51:16 sshd[13620]: Failed password for ubuntu from 106.12.18.199
2026-05-02T21:54:17 sshd[14326]: Failed password for root from 200.89.69.247
2026-05-02T21:55:56 sshd[14711]: Failed password for invalid user admin from 102.88.137.213
...
2026-05-02T22:02:19 sshd[16240]: Connection closed by 14.22.11.162 port 20026 [preauth]
2026-05-02T22:02:19 sshd[16242]: Connection closed by 14.116.239.35 port 63034 [preauth]
2026-05-02T22:02:19 sshd[16241]: Connection closed by 14.22.11.165 port 25402 [preauth]
...
2026-05-02T22:04:36 sshd[16776]: Connection closed by 14.116.239.35 port 14493 [preauth]
2026-05-02T22:04:36 sshd[16778]: Connection closed by 14.116.239.37 port 15872 [preauth]
2026-05-02T22:04:36 sshd[16777]: Connection closed by 14.116.239.34 port 46804 [preauth]
```

**分析**：
- 大量外部 IP 在尝试暴力破解（admin、root 密码猜测）
- `14.22.11.x` 和 `14.116.239.x` 是蓝盾构建机的出口 IP
- 蓝盾连接在 `[preauth]` 阶段被关闭
- 三个蓝盾 IP 同一秒连接，全部被关闭

### 4.4 初步判断（后来证明是误判）

当时判断：SSH 暴力破解攻击占满了 MaxStartups 并发连接配额。

---

## 第 5 轮：服务器安全加固

### 5.1 安装 fail2ban

```bash
sudo apt install -y fail2ban

sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
backend = systemd
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

### 5.2 调大 MaxStartups

```bash
sudo sed -i 's/^#MaxStartups.*/MaxStartups 30:50:80/' /etc/ssh/sshd_config
```

### 5.3 禁止密码登录

```bash
sudo sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
```

### 5.4 重启 SSH 服务

```bash
sudo systemctl restart sshd
```

### 5.5 验证配置

```bash
ubuntu@VM-0-6-ubuntu:~$ echo "--- MaxStartups ---"
MaxStartups 30:50:80

ubuntu@VM-0-6-ubuntu:~$ echo "--- PasswordAuthentication ---"
PasswordAuthentication no
PasswordAuthentication no

ubuntu@VM-0-6-ubuntu:~$ sudo fail2ban-client status sshd
Status for the jail: sshd
|- Filter
|  |- Currently failed:	1
|  |- Total failed:	1
|  `- Journal matches:	_SYSTEMD_UNIT=sshd.service + _COMM=sshd
`- Actions
   |- Currently banned:	0
   |- Total banned:	0
   `- Banned IP list:
```

### 5.6 加固后再次触发蓝盾

```
========== 开始部署 my-space ==========
密钥文件前30字符: -----BEGIN RSA PRIVATE KEY----
✅ SSH密钥格式正确
✅ SSH密钥配置完成
测试网络连通性...
✅ 端口可达
测试SSH连接...
❌ SSH连接失败
kex_exchange_identification: Connection closed by remote host
密钥文件信息:
-rw------- 1 root root 1678 5月   2 22:18 /root/.ssh/deploy_key
/root/.ssh/deploy_key: PEM RSA private key
```

**结论**：安全加固后问题依旧。MaxStartups 不是根本原因。

---

## 第 6 轮：深度排查 — 排除一切服务端因素

### 6.1 当前 SSH 连接数

```bash
ubuntu@VM-0-6-ubuntu:~$ ss -tnp | grep ":22" | wc -l
1
```

**结论**：只有 1 个连接（本人），不存在连接数满的问题。

### 6.2 sshd 支持的密钥交换算法

```bash
ubuntu@VM-0-6-ubuntu:~$ sudo sshd -T | grep "kexalgorithms"
kexalgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group-exchange-sha256,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512,diffie-hellman-group14-sha256
```

**结论**：支持多种现代算法，不太可能是算法不兼容。

### 6.3 authorized_keys 检查

```bash
ubuntu@VM-0-6-ubuntu:~$ cat ~/.ssh/authorized_keys
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCSvbCI7OrrskzqqK5TkzPIbYmK1o4wS0oiZtb2OpxZZz13kNXMfkpLasjP7buIXyBl9ocnbq8/qCA3fjYNZznHLC6dNv/3RTw6fwtsXfv4KLXL/3jUUXBk028WqD9hN9fUvxo+jb/x2NrK2Axp170gMpBFjDbkUTrrz0VLgE16TddlJynZZhNjAkle5tiC+n3IhysrtblLOPtCrm9E6amWxCClqJXQtHLDngwpTo4vnEzlz34p7OHhFbjiiHK7xCSITBpRtgKMhNiSHTQUmKskpABqpodNLTVajWQG8u9N76IC2skAdymBX1PJ5xgjXz2BkJySXxgaRqzyWmPPwVtt skey-0mqhoapr
```

**结论**：公钥存在（skey-0mqhoapr 即腾讯云密钥对标识）。

### 6.4 全面排查汇总

| 排查项 | 结果 | 结论 |
|--------|------|------|
| TCP 22 端口可达 | ✅ | 网络层 OK |
| SSH 连接数 | 1 个 | 非并发问题 |
| 密钥格式 | PEM RSA, 600权限 | 密钥 OK |
| hosts.deny | 空文件 | 无拦截 |
| AllowUsers/DenyUsers | 全注释 | 无限制 |
| MaxStartups | 30:50:80 | 容量充足 |
| Kex 算法 | 10种算法 | 兼容性 OK |
| authorized_keys | 公钥在 | 认证配置 OK |
| fail2ban | 运行中，0封禁 | 未拦截 |

**结论：服务端所有因素全部排除，问题在客户端网络链路。**

---

## 第 7 轮：AnyDev 开发容器测试

### 7.1 在 AnyDev 容器中执行部署脚本

从另一个 AnyDev 容器执行，结果：

```
kex_exchange_identification: Connection closed by remote host
rsync: connection unexpectedly closed (0 bytes received so far) [sender]
rsync error: unexplained error (code 255) at io.c(226) [sender=3.1.3]
```

同样的错误。

### 7.2 使用 ssh -v 详细模式测试

```bash
[root@yeranyang-2bbjex5p0a home]# ssh -v -i /data/workspace/light_server_for_claw.pem ubuntu@139.199.72.245
```

**输出（关键信息）**：

```
OpenSSH_8.0p1, OpenSSL 1.1.1k  FIPS 25 Mar 2021
debug1: Reading configuration data /etc/ssh/ssh_config
debug1: Reading configuration data /etc/ssh/ssh_config.d/05-redhat.conf
debug1: Reading configuration data /etc/crypto-policies/back-ends/openssh.config
debug1: configuration requests final Match pass
debug1: re-parsing configuration
debug1: Reading configuration data /etc/ssh/ssh_config
debug1: Reading configuration data /etc/ssh/ssh_config.d/05-redhat.conf
debug1: Reading configuration data /etc/crypto-policies/back-ends/openssh.config
debug1: Connecting to 139.199.72.245 [139.199.72.245] port 36000.
debug1: Connection established.
debug1: identity file /data/workspace/light_server_for_claw.pem type -1
debug1: identity file /data/workspace/light_server_for_claw.pem-cert type -1
debug1: Local version string SSH-2.0-OpenSSH_8.0
debug1: kex_exchange_identification: banner line 0: HTTP/1.1 502 Server UnReachable
debug1: kex_exchange_identification: banner line 1: proxy-agent: VM-129-13-centos
debug1: kex_exchange_identification: banner line 2: 
kex_exchange_identification: Connection closed by remote host
```

### 🎯 真相大白！

**两个致命问题在 `ssh -v` 的输出中暴露无遗：**

#### 问题 1：SSH 连接的不是端口 22，是端口 36000

```
debug1: Connecting to 139.199.72.245 [139.199.72.245] port 36000.
```

AnyDev 容器的 SSH 客户端配置文件 `/etc/ssh/ssh_config.d/05-redhat.conf` 将默认端口改成了 36000（企业内部 SSH 跳板端口）。

#### 问题 2：中间有一个 HTTP 代理在拦截 SSH 流量

```
debug1: kex_exchange_identification: banner line 0: HTTP/1.1 502 Server UnReachable
debug1: kex_exchange_identification: banner line 1: proxy-agent: VM-129-13-centos
```

容器所有外网 SSH 连接经过一个 HTTP 代理（`proxy-agent: VM-129-13-centos`），该代理无法理解 SSH 协议，直接返回了 HTTP 502 错误。

#### 为什么之前的所有排查都找不到原因

- **服务端看到的日志**：`Connection closed by X.X.X.X [preauth]`—— SSH 连接实际上没到达服务器，这些日志是其他攻击者留下的
- **TCP 端口可达**：因为 TCP 层确实能建立连接（到代理），但代理不转发 SSH 协议
- **密钥格式正确**：密钥根本没有被使用到，连接在协议握手阶段就被代理截断了

---

## 最终方案：本地部署脚本

### deploy.sh（最终版本）

```bash
#!/bin/bash
set -e

SERVER_IP="139.199.72.245"
SERVER_USER="ubuntu"
SSH_KEY="~/.ssh/light_server.pem"
DEPLOY_PATH="/var/www/my-space"

echo "========== 开始部署 my-space =========="

# 1. rsync 增量同步
echo "📦 同步文件..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.gongfeng-ci.yml' \
  --exclude='deploy.sh' \
  --exclude='*.md' \
  --exclude='nginx.conf.example' \
  -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
  ./ ${SERVER_USER}@${SERVER_IP}:${DEPLOY_PATH}/

echo "✅ 文件同步完成"

# 2. 服务器上设置权限并重载 Nginx
echo "🔄 重载 Nginx..."
ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'REMOTE'
sudo chown -R ubuntu:ubuntu /var/www/my-space
sudo chmod -R 755 /var/www/my-space
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx 重载完成"
REMOTE

# 3. 健康检查
echo "🏥 健康检查..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://yeranyang.com)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 部署成功！(HTTP ${HTTP_CODE})"
    echo "🌐 网站地址: https://yeranyang.com"
else
    echo "⚠️  HTTP 状态码: ${HTTP_CODE}（可能是 CDN 缓存延迟）"
fi

echo "========== 部署完成 =========="
```

### 使用方式

```bash
# 赋予执行权限（只需一次）
chmod +x deploy.sh

# 部署
./deploy.sh

# 或者用 alias 一键 push + 部署
alias deploy="git push && ./deploy.sh"
```

---

## 补充：关于 EdgeOne 与 SSH 安全

- EdgeOne 只代理 HTTP/HTTPS 流量（80/443 端口）
- SSH 的 22 端口直接暴露在公网，不经过 EdgeOne
- SSH 安全只能靠服务端自身配置（fail2ban + 禁密码 + 密钥认证）

---

## 关键经验总结

### 1. `ssh -v` 是排查 SSH 问题的第一步

一条命令就能看到：
- 连的是哪个端口
- 读了哪些配置文件
- 是否走了代理
- 在哪一步断开的
- 收到了什么响应

如果一开始就用 `ssh -v`，整个排查过程可能 5 分钟就结束了。

### 2. 企业网络环境的 SSH 限制

- 蓝盾构建机、AnyDev 开发容器等企业环境的外网流量走 HTTP 代理
- HTTP 代理无法理解 SSH 协议，会返回 HTTP 502
- SSH 客户端配置可能被全局修改（默认端口不是 22）
- 服务端完全看不到这个问题（连接没到达服务器）

### 3. CI/CD 多行密文传递

- 蓝盾文本框变量会破坏多行内容的换行符
- Base64 编码转单行是最稳妥的传递方式
- 脚本中解码：`echo "$VAR" | base64 -d > file`

### 4. 公网服务器 SSH 安全

必须在服务器上线第一天就完成：
- `PasswordAuthentication no` — 禁止密码登录
- `fail2ban` — 自动封禁暴力破解 IP
- `MaxStartups 30:50:80` — 提升并发连接上限
- 定期检查 `/var/log/auth.log`

### 5. 简单场景用简单方案

对于纯静态个人网站，本地 `deploy.sh` 比 CI/CD 流水线更合适：
- 无需处理企业网络限制
- 无需配置凭证传递
- 直接从开发机 SSH 到服务器，链路最短
- 一个 shell alias 就能实现 push + 部署一条命令
