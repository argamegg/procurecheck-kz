# 📦 Как использовать архив ProcureCheck KZ

## Расположение архива

Архив находится по адресу: **`/app/procurecheck-kz.tar.gz`** (243 KB)

---

## 🍎 Установка на macOS

### Шаг 1: Скачайте архив

Скачайте файл `procurecheck-kz.tar.gz` из Emergent или скопируйте с сервера.

### Шаг 2: Распакуйте

```bash
# Перейдите в папку Downloads (или где у вас архив)
cd ~/Downloads

# Распакуйте архив
tar -xzf procurecheck-kz.tar.gz

# Перейдите в папку проекта
cd procurecheck-kz
```

### Шаг 3: Установите зависимости системы

```bash
# Установите Homebrew (если еще нет)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установите все необходимое одной командой
brew install python node yarn mongodb-community

# Запустите MongoDB
brew services start mongodb-community
```

### Шаг 4: Установите зависимости Backend

```bash
cd backend

# Создайте виртуальное окружение
python3 -m venv venv

# Активируйте его
source venv/bin/activate

# Установите зависимости
pip install -r requirements.txt

# Создайте .env файл
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=procurecheck_db
CORS_ORIGINS=*
SECRET_KEY=your-secret-key-for-local
# Optional: enables live data from goszakup.gov.kz OWS v3
GOSZAKUP_API_TOKEN=your-developer-token
EOF

cd ..
```

### Шаг 5: Установите зависимости Frontend

```bash
cd frontend

# Установите зависимости
yarn install

# Создайте .env файл
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
EOF

cd ..
```

### Шаг 6: Запустите приложение

```bash
# Используйте скрипт автозапуска
chmod +x start-macos.sh
./start-macos.sh
```

Скрипт:
- открывает `http://localhost:3000` и `http://localhost:8001/docs`
- показывает live-логи backend и frontend в этом же терминале
- останавливает оба сервиса по `Ctrl+C`

Или запустите вручную в 2 терминалах:

**Терминал 1:**
```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Терминал 2:**
```bash
cd frontend
yarn start
```

### Шаг 7: Откройте приложение

Frontend: **http://localhost:3000**  
API Docs: **http://localhost:8001/docs**

**Демо вход:**
- Email: `admin@procurecheck.kz`
- Пароль: `demo123`

---

## 🛑 Остановка

```bash
# Используйте скрипт
./stop-macos.sh

# Или, если приложение запущено через ./start-macos.sh,
# просто нажмите Ctrl+C в том же терминале

# Или остановите процессы на портах
kill -9 $(lsof -ti:8001)
kill -9 $(lsof -ti:3000)
```

---

## 📂 Что входит в архив

```
procurecheck-kz/
├── backend/              # Backend FastAPI + MongoDB
│   ├── server.py        # Главный файл приложения
│   ├── data/            # Локальная demo-база и настройки аналитики
│   └── requirements.txt # Python зависимости
│
├── frontend/            # Frontend React
│   ├── src/            # Исходный код
│   │   ├── pages/     # Страницы приложения
│   │   ├── components/ # Компоненты
│   │   └── utils/     # Утилиты
│   └── package.json   # Node.js зависимости
│
├── README.md           # Основная документация
├── README_MACOS.md     # Подробная инструкция для macOS
├── start-macos.sh      # Скрипт автозапуска
├── stop-macos.sh       # Скрипт остановки
└── README.md           # Краткое описание проекта
```

---

## 🚨 Решение проблем

### Проблема: MongoDB не запускается

```bash
# Перезапустите MongoDB
brew services restart mongodb-community

# Проверьте статус
brew services list | grep mongodb
```

### Проблема: Порт уже занят

```bash
# Освободите порт 3000
lsof -ti:3000 | xargs kill -9

# Освободите порт 8001
lsof -ti:8001 | xargs kill -9
```

### Проблема: "command not found: brew"

```bash
# Установите Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Перезапустите Terminal
```

### Проблема: Ошибка при установке зависимостей

```bash
# Backend - используйте pip3
pip3 install -r requirements.txt

# Frontend - очистите кэш
rm -rf node_modules
yarn cache clean
yarn install
```

---

## ✅ Проверка работоспособности

После запуска проверьте:

1. **Backend API**: http://localhost:8001/api/
   - Должен вернуть: `{"status":"ok","message":"ProcureCheck KZ API"}`

2. **API Docs**: http://localhost:8001/docs
   - Должна открыться документация Swagger

3. **Frontend**: http://localhost:3000
   - Должна открыться страница входа

4. **MongoDB**: 
   ```bash
   mongosh
   show dbs
   ```
   - Должен подключиться к MongoDB

5. **Локальная demo-база**:
   - При первом старте backend автоматически создаст коллекцию `supplier_profiles`
   - Будут доступны участники, объявления, заявки, договоры, акты, жалобы и РНУ
   - Аналитика участников будет работать даже без токена goszakup

---

## 📞 Нужна помощь?

Если что-то не работает:

1. Убедитесь что все зависимости установлены
2. Проверьте что MongoDB запущен
3. Посмотрите логи в терминалах
4. Проверьте файлы .env в backend и frontend
5. Попробуйте перезапустить приложение

---

## 🎉 Готово!

Теперь у вас полностью рабочее приложение ProcureCheck KZ!

Приятной работы! 🚀
