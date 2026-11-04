# Контент: курси

Кожен курс — окремий Markdown-файл у `content/courses/`. Ім'я файлу збігається з `slug`.

## Frontmatter

| Поле | Тип | Приклад | Призначення |
|---|---|---|---|
| `title` | string | `"Англійська для початківців"` | Назва на картці й сторінці курсу |
| `slug` | string | `"english-beginners-7-10"` | URL сторінки, збігається з ім'ям файлу |
| `direction` | enum | `languages` \| `math` \| `music` \| `programming` | Фільтр «Напрям» у каталозі |
| `ages.min` / `ages.max` | number | `7` / `10` | Фільтр «Вік» (курс підходить, якщо вік дитини в межах `min…max`) |
| `level` | enum | `beginner` | Рівень (зараз усі курси з нуля) |
| `format` | string[] | `["group", "individual"]` | Доступні формати; перший — основний |
| `groupSize` | number | `6` | Максимум дітей у групі |
| `lessonsCount` | number | `12` | Кількість занять |
| `lessonDuration` | number | `40` | Тривалість заняття в хвилинах (базова; варіації описані в тексті) |
| `price` | string | `"[ЗАПОВНИТИ]"` | Ціна (поки заглушка) |
| `teachers` | string[] | `[]` | Викладачі (поки порожньо) |
| `shortDescription` | string | | 1–2 речення для картки в каталозі |
| `outcomes` | string[] | | 4–6 вимірюваних результатів курсу |

Підписи для фільтрів (переклад ключів `direction`): `languages` — «Мови», `math` — «Математика і логіка», `music` — «Музика», `programming` — «Програмування».

## Тіло файлу

Однакова структура в усіх курсах: «Для кого цей курс» → «Формат» → «Програма курсу» (`### Заняття N. …` з метою, планом по хвилинах, ігровим елементом і домашнім завданням) → «Сертифікат» → «Порада для батьків» → «Що потрібно для занять».

## Схема для Astro (коли з'явиться сайт)

Сайту в репозиторії поки немає. Коли його створять, ці поля можна описати в `src/content.config.ts` приблизно так:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const courses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/courses' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    direction: z.enum(['languages', 'math', 'music', 'programming']),
    ages: z.object({ min: z.number().int(), max: z.number().int() }),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    format: z.array(z.enum(['group', 'individual'])).min(1),
    groupSize: z.number().int().optional(),
    lessonsCount: z.number().int(),
    lessonDuration: z.number().int(),
    price: z.string(),
    teachers: z.array(z.string()),
    shortDescription: z.string(),
    outcomes: z.array(z.string()).min(4).max(6),
  }),
});

export const collections = { courses };
```
