# 🏛️ ProcureCheck KZ - Платформа аналитики госзакупок Казахстана

> Современная веб-платформа для анализа участников государственных закупок Казахстана: поставщиков, заказчиков и организаторов.

## 📋 О проекте

**ProcureCheck KZ** - это аналитическая система для работы с данными государственных закупок Казахстана. Платформа предоставляет интерфейс для проверки участников, просмотра реестров, анализа закупочной истории и расчета ролевой аналитики.

### ✨ Основные возможности

- 🔍 **Поиск участников** по БИН/ИИН или названию
- 📊 **Профиль участника** с полной карточкой, реестрами и аналитикой
- 📈 **Реестры объявлений, договоров, заявок, лотов, актов и жалоб**
- ⚠️ **Анализ жалоб** и их статусов
- 🚫 **Проверка РНУ**
- 📉 **Supplier Trust Score** для поставщиков
- 📘 **Customer Transparency Score** для заказчиков
- 🛠️ **Admin Panel** для управления demo-данными и настройками формулы
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

После запуска `start-macos.sh`:
- автоматически открываются `http://localhost:3000` и `http://localhost:8001/docs`
- в этом же терминале показываются live-логи frontend и backend
- остановка выполняется через `Ctrl+C`

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
├── README.md             # Основная документация
├── README_MACOS.md       # Инструкция для macOS
├── start-macos.sh        # Запуск с live-логами
└── stop-macos.sh         # Резервный скрипт остановки
```

## 🔌 API Endpoints

- `POST /api/auth/login` - Вход в систему
- `GET /api/companies/search` - Поиск участников
- `GET /api/companies` - Реестр участников
- `GET /api/companies/{bin}/profile` - Профиль участника
- `GET /api/contracts` - Реестр договоров
- `GET /api/complaints` - Реестр жалоб
- `GET /api/participants/{bin}/trust-score` - Единый расчет score участника
- `GET /api/admin/*` - Admin CRUD и настройки аналитики

## 🗄️ Локальная база профилей

Backend автоматически засеивает MongoDB локальным набором участников при первом запуске. Данные синтетические, но структура и поля построены по мотивам публичных реестров goszakup: участники, адреса, объявления, заявки, лоты, договоры, акты, жалобы, РНУ и аналитические показатели.

Основной режим работы не требует внешнего API или developer token.

При желании backend все еще умеет ходить в официальный `https://ows.goszakup.gov.kz/v3`, если в `backend/.env` задан:

```env
GOSZAKUP_API_TOKEN=your-developer-token
```

Без токена приложение работает на собственной локальной базе профилей.

📚 **Документация API**: http://localhost:8001/docs

---

**Made with ❤️ for Kazakhstan Public Procurement Analytics**
