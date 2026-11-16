#!/bin/bash
set -e

# ===== 配置（可用环境变量覆盖，供 GitHub Actions 复用）=====
SERVER_IP="${SERVER_IP:-139.199.72.245}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-/Users/yangguang/Downloads/Files Download/YSpace/light_server_for_claw.pem}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/my-space}"
SITE_URL="${SITE_URL:-https://yeranyang.com}"

echo "========== 开始部署 my-space =========="

# 0. Lint 检查（CI 风格：lint 失败立即中止部署）
# 设置 SKIP_LINT=1 可临时跳过（紧急修复时使用）
if [ "${SKIP_LINT:-0}" != "1" ]; then
  echo "🔍 运行 lint 检查..."
  if [ -d "node_modules" ]; then
    npm run lint
  else
    echo "⚠️  node_modules 缺失，跳过 lint。请先运行 'npm install'。"
    echo "    （首次安装后，下次部署会自动 lint。）"
  fi
  echo "✅ Lint 通过"
else
  echo "⏭  已通过 SKIP_LINT=1 跳过 lint 检查"
fi

# 1. 同步文件到服务器
echo "📦 同步文件..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='deploy.sh' \
  --exclude='*.md' \
  --exclude='node_modules' \
  --exclude='.playwright-cli' \
  --exclude='.codebuddy' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='eslint.config.mjs' \
  --exclude='.stylelintrc.json' \
  --exclude='.htmlhintrc' \
  --exclude='.editorconfig' \
  --exclude='scripts' \
  -e "ssh -i \"${SSH_KEY}\" -o StrictHostKeyChecking=no" \
  ./ ${SERVER_USER}@${SERVER_IP}:${DEPLOY_PATH}/

echo "✅ 文件同步完成"

# 2. 服务器上设置权限并重载 Nginx
echo "🔄 重载 Nginx..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << REMOTE
sudo chown -R ${SERVER_USER}:${SERVER_USER} ${DEPLOY_PATH}
sudo chmod -R 755 ${DEPLOY_PATH}
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx 重载完成"
REMOTE

# 3. 健康检查（经 EdgeOne；内容是否为最新版由后续缓存刷新保证）
echo "🏥 健康检查..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${SITE_URL}")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 部署成功！(HTTP ${HTTP_CODE})"
    echo "🌐 网站地址: ${SITE_URL}"
else
    echo "⚠️  HTTP 状态码: ${HTTP_CODE}（可能是 CDN 缓存延迟，稍等再试）"
fi

echo "========== 部署完成 =========="
