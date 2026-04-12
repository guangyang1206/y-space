#!/bin/bash
# =====================================================
#  deploy.sh — 手动一键部署到腾讯云轻量服务器
# =====================================================
#
#  用法:
#    ./deploy.sh [服务器IP] [用户名] [目标路径]
#
#  示例:
#    ./deploy.sh 1.2.3.4 root /var/www/my-space
#
#  前提: 已配置 SSH 免密登录（ssh-copy-id）
#
# =====================================================

set -euo pipefail

# 默认值（请修改为你的实际配置）
DEPLOY_HOST="${1:-YOUR_SERVER_IP}"
DEPLOY_USER="${2:-root}"
DEPLOY_PATH="${3:-/var/www/my-space}"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━ Deploying to ${DEPLOY_HOST}:${DEPLOY_PATH} ━━━${NC}"

# 获取脚本所在目录（即项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 1: 确保远程目录存在
echo "📁 Ensuring remote directory exists..."
ssh ${DEPLOY_USER}@${DEPLOY_HOST} "mkdir -p ${DEPLOY_PATH}"

# Step 2: rsync 同步
echo "📦 Syncing files..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.gongfeng-ci.yml' \
  --exclude='deploy.sh' \
  --exclude='DESIGN.md' \
  --exclude='.gitignore' \
  "${SCRIPT_DIR}/" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

# Step 3: 设置权限
echo "🔒 Setting permissions..."
ssh ${DEPLOY_USER}@${DEPLOY_HOST} "chown -R www-data:www-data ${DEPLOY_PATH} 2>/dev/null || true && chmod -R 755 ${DEPLOY_PATH}"

echo ""
echo -e "${GREEN}✅ Deploy complete!${NC}"
echo -e "   Site: https://yeranyang.com"
echo -e "   Path: ${DEPLOY_HOST}:${DEPLOY_PATH}"
