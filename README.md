# FinChat

Веб-приложение для общения с клиентами в реальном времени. Поддерживает авторизацию через email с помощью magic-ссылок, обмен файлами и изображениями, push-уведомления, а также интеграцию с уже имеющейся внешней платформой Chatben для cинхронизаций сообщениями.

Построено на Next.js, Socket.IO, MongoDB, Redis, S3.

## Деплой на Railway

### 1. Загрузка кода на GitHub

Если вы получили проект в виде .zip-архива:

1. Создайте новый приватный репозиторий на Github (https://github.com/new)
2. Распакуйте архив и откройте терминал в папке проекта
3. Выполните:

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/ВАШ_ЮЗЕРНЕЙМ/ВАШ_РЕПОЗИТОРИЙ.git
git branch -M main
git push -u origin main
```

### 2. Создание проекта на Railway

1. Зарегистрируйтесь на [railway.com](https://railway.com)
2. Нажмите "New Project" → "Deploy from GitHub repo"
3. Выберите только что созданный репозиторий

### 3. Добавление сервисов

Добавьте следующие сервисы в проект Railway:

**MongoDB**
- Нажмите "Add Service" → "Database" → "MongoDB"
- Railway автоматически добавит переменную `MONGODB_URI` в ваш сервис

**Storage Bucket** (обязательно для загрузки файлов)
- Нажмите "Add Service" → "Bucket"
- При создании добавьте все переменные бакета в сервис приложения — Railway автоматически заполнит:
  - `AWS_ENDPOINT_URL`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_S3_BUCKET_NAME`
  - `AWS_DEFAULT_REGION`

**Redis** (опционально — нужен только при нескольких репликах)
- Нажмите "Add Service" → "Database" → "Redis"
- Railway автоматически добавит `REDIS_URL`
- Без Redis Socket.IO работает в режиме одного сервера (подходит для большинства случаев, иначе сообщения не будут доходить в real-time между разными доменами)

### 4. Настройка Resend (сервис email-рассылок)

Приложение использует Resend (https://resend.com) для отправки эмейлов и ссылок для входа.

1. Зарегистрируйтесь на https://resend.com
2. Добавьте и подтвердите домен (Settings → Domains)
3. Создайте API-ключ (Settings → API Keys)
4. Добавьте ключ как `RESEND_API_KEY` в переменные Railway

### 5. Настройка переменных окружения

В сервисе приложения на Railway перейдите в "Variables" и добавьте:

| Переменная | Описание | Как получить |
|------------|----------|--------------|
| `AUTH_SECRET` | Ключ шифрования сессий | Выполните `openssl rand -base64 32` |
| `AUTH_URL` | URL вашего приложения | напр. `https://your-app.up.railway.app` |
| `NEXTAUTH_URL` | То же, что AUTH_URL | напр. `https://your-app.up.railway.app` |
| `NEXT_PUBLIC_APP_URL` | То же, что AUTH_URL | напр. `https://your-app.up.railway.app` |
| `MONGODB_DB_NAME` | Имя базы данных | напр. `finchat` |
| `RESEND_API_KEY` | API-ключ Resend | Из панели управления Resend |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Публичный ключ push-уведомлений | См. шаг 6 |
| `VAPID_PRIVATE_KEY` | Приватный ключ push-уведомлений | См. шаг 6 |

Следующие переменные заполняются автоматически при подключении сервисов:
- `MONGODB_URI` (из сервиса MongoDB)
- `AWS_*` переменные (из Storage Bucket)
- `REDIS_URL` (из Redis, если добавлен)

> **Важно:** При использовании нескольких реплик все реплики должны использовать одинаковые значения `AUTH_SECRET`, `VAPID_PRIVATE_KEY` и `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. 

### 6. Генерация VAPID-ключей (push-уведомления)

Выполните локально:

```bash
npm run generate-vapid
```

Команда выведет два значения — добавьте их в Railway:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`


### 7. Деплой

Railway автоматически деплоит при пуше в подключенную ветку. Сборка выполняет:

```bash
npm install
npm run build    # next build
npm start        # NODE_ENV=production node server.js
```


### 8. Импорт базы данных

В проекте есть папка `db-seed/` с начальными данными и настроенным администратором. Импортируйте их в MongoDB на Railway с помощью `mongoimport`:

```bash
mongoimport --uri="YOUR_MONGODB_URI" --db=finchat --collection=users --file=db-seed/users.json --jsonArray
mongoimport --uri="YOUR_MONGODB_URI" --db=finchat --collection=applications --file=db-seed/applications.json --jsonArray
mongoimport --uri="YOUR_MONGODB_URI" --db=finchat --collection=conversations --file=db-seed/conversations.json --jsonArray
mongoimport --uri="YOUR_MONGODB_URI" --db=finchat --collection=messages --file=db-seed/messages.json --jsonArray
```

Замените `YOUR_MONGODB_URI` на строку подключения из вашего сервиса MongoDB на Railway.

Учётные данные администратора по умолчанию:
- **Email:** `admin@admin.com`
- **Пароль:** `admin123`

Альтернативно, данные можно импортировать вручную через приложение MongoDB Compass. 

## Интеграция с Chatben 

Для подключения к внешней платформе с переписками (https://chatben.obnds.com) добавьте переменные (в коде используется префикс `CHATCENTER_`):

| Переменная | Описание |
|------------|----------|
| `CHATCENTER_ENABLED` | Установите `true` для включения |
| `CHATCENTER_V2_API_URL` | Эндпоинт v2 API (напр. `https://chatben.example.com/api/channel-api/v2/{botId}`) |
| `CHATCENTER_V2_API_KEY` | API-ключ v2 |
| `CHATCENTER_V2_SSE_ENABLED` | Установите `true` на ОДНОЙ реплике для получения входящих сообщений через SSE |
| `CHATCENTER_OUTGOING_SECRET` | Секрет вебхука (для v1 fallback) |
| `CHATCENTER_SYSTEM_USER_ID` | ID пользователя MongoDB для системных/операторских сообщений |

## Добавление домена или реплики

### Свой домен

1. В Railway перейдите в сервис приложения → «Settings» → «Networking» → «Custom Domain»
2. Добавьте домен и настройте DNS по инструкции Railway
3. Обновите `AUTH_URL`, `NEXTAUTH_URL` и `NEXT_PUBLIC_APP_URL` на новый домен

### Несколько доменов/реплик

Для запуска сайта на нескольких доменах:

1. Если еще не добавили, то добавьте сервис **Redis** в проект (см. шаг 3 выше). Он нужен для работы сокетов между репликами (чтобы сообщения появлялись в real-time без перезагрузки страницы)
2. Продублируйте сервис приложения в проекте Railway для создания нового инстанса (нажмите правой кнопкой мыши на сервис → «Duplicate»)
3. В новом сервисе обновите `AUTH_URL`, `NEXTAUTH_URL` и `NEXT_PUBLIC_APP_URL` на его новый домен
4. Установите `CHATCENTER_V2_SSE_ENABLED=true` только на **одном** сервисе, чтобы избежать дублирования входящих сообщений

## Локальная разработка

```bash
cp .env.example .env.local
# Заполните значения в .env.local
npm install
npm run dev
```

Приложение запустится на http://localhost:3000.
