# Шежіре — Манам

Сайт-шежіре рода Аргын → Куандық → Темеш → Манам. React 18 + TypeScript + Vite + Tailwind CSS + Supabase.

## Первый запуск

### 1. База данных (один раз, ~2 минуты)

Схема ещё не применена к проекту Supabase. В [Dashboard → SQL Editor](https://supabase.com/dashboard/project/zutafziyuwuaccgznidr/sql/new):

1. Вставить и выполнить целиком `supabase/migrations/001_init.sql` (таблицы, RLS, RPC, storage-bucket `photos`).
2. Вставить и выполнить `supabase/seed.sql` (базовая цепочка Аргын → … → Манам + текст истории).

### 2. Назначить себе админа

Зарегистрируйтесь на сайте, затем в SQL Editor:

```sql
update public.profiles set role = 'admin' where full_name = 'ВАШЕ ИМЯ';
```

(или по email: `where id = (select id from auth.users where email = 'you@mail.com')`)

### 3. Google OAuth (опционально)

Dashboard → Authentication → Providers → Google → включить и указать Client ID/Secret. Кнопка «Войти через Google» уже есть на страницах входа.

### 4. Локальная разработка

```bash
npm install
npm run dev
```

`.env` уже содержит `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Деплой на Vercel

1. Импортировать репозиторий в Vercel (Framework: Vite).
2. Добавить env-переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. `vercel.json` уже настроен (SPA-rewrites).
4. В Supabase: Authentication → URL Configuration → добавить продакшн-домен в Site URL / Redirect URLs.

## Структура

- `src/pages/` — Главная, Древо, Персона, Вход/Регистрация, Кабинет, Заявка, Админка
- `src/components/TreeView.tsx` — кастомный рендер древа (d3-hierarchy + d3-zoom: зум/пан/pinch, свернуть/развернуть ветку, лимит поколений)
- `src/lib/i18n.ts` — русский и казахский интерфейс
- `supabase/` — миграция схемы и seed

## Как это работает

- Гости смотрят древо и персон; авторизованные подают **заявки** (добавить персону / исправить / «я в древе»), модератор одобряет через RPC `approve_submission` (одна транзакция).
- Родословная строго по мужской линии: у персоны одно поле `father_id`, `generation` считается триггером.
- Антиспам: максимум 10 pending-заявок на пользователя (RLS-политика).
- Роли назначает только админ (вкладка «Роли» в админке, RPC `set_user_role`).
- Неверифицированные узлы — пунктирная рамка и бейдж.
