#!/bin/bash

# 启动后端服务器
node /workspace/projects/server/index.js &
SERVER_PID=$!

# 等待后端服务器启动
sleep 2

# 启动前端开发服务器
pnpm run dev &
VITE_PID=$!

# 等待任意进程退出
wait $SERVER_PID $VITE_PID
