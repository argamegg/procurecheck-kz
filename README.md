# 🏛️ ProcureCheck KZ - Платформа аналитики госзакупок Казахстана

> Современная веб-платформа для проверки поставщиков, анализа жалоб, истории тендеров, проверки реестра недобросовестных и оценки доверия/риска.

## 📋 О проекте

**ProcureCheck KZ** - это профессиональная аналитическая система для работы с данными государственных закупок Казахстана. Платформа предоставляет удобный интерфейс для проверки компаний, анализа их истории участия в тендерах и оценки рисков.

### ✨ Основные возможности

- 🔍 **Поиск компаний** по БИН/ИИН или названию
- 📊 **Профиль Поставщика 360°** с полной информацией
- 📈 **История тендеров и контрактов**
- ⚠️ **Анализ жалоб** и их статусов
- 🚫 **Проверка реестра недобросовестных**
- 📉 **Оценка рисков** и уровня доверия
- 👥 **Ролевой доступ** (Администратор/Пользователь)
- 🇷🇺 **Интерфейс на русском языке**

## 🎯 Демо учетные записи

| Email | Пароль | Роль |
|-------|--------|------|
| admin@procurecheck.kz | demo123 | Администратор |
| user@procurecheck.kz | demo123 | Пользователь |

## 🚀 Быстрый старт

### Для macOS 🍎

```bash
# 1. Установите зависимости
brew install python node yarn mongodb-community
brew services start mongodb-community

# 2. Распакуйте и установите
tar -xzf procurecheck-kz.tar.gz
cd procurecheck-kz

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
yarn install

# 3. Запустите
cd ..
./start-macos.sh
```

📖 **Подробная инструкция**: [README_MACOS.md](README_MACOS.md)

## 🏗️ Технологический стек

### Backend
- **FastAPI** - современный веб-фреймворк
- **MongoDB** - NoSQL база данных
- **Motor** - асинхронный драйвер MongoDB
- **JWT** - аутентификация
- **Local Supplier Profiles DB** - локальная аналитическая база профилей, смоделированная по публичной структуре реестров goszakup

### Frontend
- **React 18** - библиотека для UI
- **Tailwind CSS** - CSS фреймворк
- **Shadcn UI** - библиотека компонентов
- **Recharts** - графики и диаграммы

## 📁 Структура проекта

```
procurecheck-kz/
├── backend/              # Backend FastAPI
├── frontend/             # Frontend React
├── README.md            # Основная документация
├── README_MACOS.md      # Инструкция для macOS
└── start-macos.sh       # Скрипт запуска
```

## 🔌 API Endpoints

- `POST /api/auth/login` - Вход в систему
- `GET /api/companies/search` - Поиск компаний
- `GET /api/companies/{bin}/profile` - Профиль компании

## 🗄️ Локальная база профилей

Backend автоматически засеивает MongoDB локальным набором профилей поставщиков при первом запуске. Данные синтетические, но структура и поля построены по мотивам публичных реестров goszakup: участники, договоры, жалобы, РНУ, риск-индикаторы.

Основной режим работы не требует внешнего API или developer token.

При желании backend все еще умеет ходить в официальный `https://ows.goszakup.gov.kz/v3`, если в `backend/.env` задан:

```env
GOSZAKUP_API_TOKEN=your-developer-token
```

Без токена приложение работает на собственной локальной базе профилей.

📚 **Документация API**: http://localhost:8001/docs

---

**Made with ❤️ for Kazakhstan Public Procurement Analytics**
