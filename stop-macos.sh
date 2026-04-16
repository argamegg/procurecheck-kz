#!/bin/bash
# Остановка ProcureCheck KZ

echo "🛑 Остановка ProcureCheck KZ..."

# Остановка по PID файлам
if [ -f "/tmp/procurecheck-backend.pid" ]; then
    BACKEND_PID=$(cat /tmp/procurecheck-backend.pid)
    echo "Остановка Backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
    rm /tmp/procurecheck-backend.pid
fi

if [ -f "/tmp/procurecheck-frontend.pid" ]; then
    FRONTEND_PID=$(cat /tmp/procurecheck-frontend.pid)
    echo "Остановка Frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
    rm /tmp/procurecheck-frontend.pid
fi

# Дополнительная очистка портов
echo "Очистка портов..."
lsof -ti:8001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "✅ Приложение остановлено"
