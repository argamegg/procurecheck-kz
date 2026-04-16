# 🍎 ProcureCheck KZ - Установка для macOS

## Быстрый старт (5 минут)

### 1️⃣ Установите необходимые программы

Откройте **Terminal** и выполните:

```bash
# Установите Homebrew (если еще нет)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установите Python, Node.js, Yarn и MongoDB
brew install python node yarn mongodb-community

# Запустите MongoDB
brew services start mongodb-community
```

### 2️⃣ Распакуйте и установите зависимости

```bash
# Распакуйте архив
cd ~/Downloads  # или где у вас находится архив
tar -xzf procurecheck-kz.tar.gz
cd procurecheck-kz

# Установите зависимости Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Создайте .env файл
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=procurecheck_db
CORS_ORIGINS=*
SECRET_KEY=your-local-secret-key
EOF

# Установите зависимости Frontend
cd ../frontend
yarn install

# Создайте .env файл
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
EOF
```

### 3️⃣ Запустите приложение

Откройте **2 терминала**:

**Терминал 1 (Backend):**
```bash
cd ~/Downloads/procurecheck-kz/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Терминал 2 (Frontend):**
```bash
cd ~/Downloads/procurecheck-kz/frontend
yarn start
```

### 4️⃣ Откройте приложение

Браузер откроется автоматически: **http://localhost:3000**

**Демо вход:**
- Email: `admin@procurecheck.kz`
- Пароль: `demo123`

---

## 🎯 Автоматический запуск

Используйте скрипт `start-macos.sh`:

```bash
cd ~/Downloads/procurecheck-kz
chmod +x start-macos.sh
./start-macos.sh
```

---

## 🛑 Остановка приложения

В терминалах нажмите `Ctrl+C`

Или:
```bash
# Остановить процессы на портах
kill -9 $(lsof -ti:8001)  # Backend
kill -9 $(lsof -ti:3000)  # Frontend
```

---

## 🚨 Решение проблем

### MongoDB не запускается
```bash
brew services restart mongodb-community
brew services list | grep mongodb
```

### Порт уже занят
```bash
lsof -ti:3000  # Найти процесс
kill -9 $(lsof -ti:3000)  # Остановить
```

### Ошибка "command not found"
```bash
# Перезапустите Terminal после установки
# Или добавьте в PATH:
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте что MongoDB запущен: `brew services list`
2. Проверьте что порты свободны: `lsof -ti:8001 -ti:3000`
3. Посмотрите логи в терминалах Backend и Frontend
