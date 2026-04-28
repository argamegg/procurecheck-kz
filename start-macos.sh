#!/bin/bash
# Автоматический запуск ProcureCheck KZ для macOS

set -e

echo "╔════════════════════════════════════════════╗"
echo "║     Запуск ProcureCheck KZ                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Получить директорию скрипта
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Проверка MongoDB
echo "🔍 Проверка MongoDB..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "▶️  Запуск MongoDB..."
    if command -v brew &> /dev/null; then
        brew services start mongodb-community
    else
        mongod --fork --logpath /tmp/mongodb.log --dbpath ./data/db
    fi
    sleep 3
else
    echo "✅ MongoDB уже запущен"
fi
echo ""

# Создание .env файлов если их нет
echo "🔧 Проверка конфигурации..."

if [ ! -f "backend/.env" ]; then
    echo "📝 Создание backend/.env..."
    cat > backend/.env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=procurecheck_db
CORS_ORIGINS=*
SECRET_KEY=local-development-secret-key
# Optional: enables live data from goszakup.gov.kz OWS v3
# GOSZAKUP_API_TOKEN=your-developer-token
# Without the token the app uses the local seeded supplier profiles database
EOF
fi

if [ ! -f "frontend/.env" ]; then
    echo "📝 Создание frontend/.env..."
    cat > frontend/.env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
EOF
fi
echo ""

# Запуск Backend
echo "▶️  Запуск Backend..."
cd backend

# Активация виртуального окружения если есть
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Запуск в фоне
nohup uvicorn server:app --host 0.0.0.0 --port 8001 --reload > /tmp/procurecheck-backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend запущен (PID: $BACKEND_PID)"
echo ""

# Запуск Frontend
echo "▶️  Запуск Frontend..."
cd ../frontend

# Запуск в фоне
nohup yarn start > /tmp/procurecheck-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend запущен (PID: $FRONTEND_PID)"
echo ""

# Ожидание запуска
echo "⏳ Ожидание запуска сервисов..."
sleep 8

echo "╔════════════════════════════════════════════╗"
echo "║   ✅ Приложение успешно запущено!          ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "🌐 Откройте в браузере:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8001"
echo "   API Docs:  http://localhost:8001/docs"
echo ""
echo "👤 Демо учетные записи:"
echo "   • admin@procurecheck.kz / demo123 (Администратор)"
echo "   • user@procurecheck.kz / demo123 (Пользователь)"
echo ""
echo "📝 Логи:"
echo "   Backend:  tail -f /tmp/procurecheck-backend.log"
echo "   Frontend: tail -f /tmp/procurecheck-frontend.log"
echo ""
echo "🛑 Остановка:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   или: killall node python"
echo ""

# Сохранить PID для остановки
echo "$BACKEND_PID" > /tmp/procurecheck-backend.pid
echo "$FRONTEND_PID" > /tmp/procurecheck-frontend.pid

# Открыть браузер
echo "🌍 Открываю браузер..."
sleep 2
open http://localhost:3000

echo "✨ Готово! Приятной работы!"
