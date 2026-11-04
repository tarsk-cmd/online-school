/**
 * Схеми контенту. Тут описано, які поля мають бути у файлах із папки content/.
 * Якщо в файлі помилка (немає обов'язкового поля, неправильне значення) —
 * збірка зупиниться й підкаже, у якому файлі й якому полі проблема.
 */
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const localized = z.object({ uk: z.string(), en: z.string().optional(), pl: z.string().optional() });

import { AGE_GROUPS, FORMATS, LEVELS } from './lib/taxonomy';

const directions = defineCollection({
  loader: glob({ pattern: '*.json', base: './content/directions' }),
  schema: z.object({
    order: z.number().default(100),
    icon: z.enum(['chess', 'languages', 'math', 'music', 'it', 'exams']),
    color: z.enum(['indigo', 'teal', 'violet', 'rose', 'emerald', 'amber']),
    flagship: z.boolean().default(false),
    title: localized,
    short: localized,
    description: z.string(),
    subjects: z.array(z.string()).default([]),
    highlights: z.array(z.string()).default([]),
    /** Показувати в каталогі як підліткову програму (15–17) */
    teens: z.boolean().default(false),
  }),
});

const courses = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/courses' }),
  schema: z.object({
    title: z.string(),
    direction: reference('directions'),
    summary: z.string(),
    order: z.number().default(100),
    draft: z.boolean().default(false),
    ages: z.array(z.enum(AGE_GROUPS)).min(1),
    ageLabel: z.string(),
    formats: z.array(z.enum(FORMATS)).min(1),
    levels: z.array(z.enum(LEVELS)).min(1),
    groupSize: z.string().optional(),
    lessonDuration: z.string(),
    courseDuration: z.string(),
    scheduleExample: z.array(z.string()).default([]),
    price: z.object({ group: z.string().optional(), individual: z.string().optional() }),
    tools: z.array(z.string()).default([]),
    teachers: z.array(reference('teachers')).default([]),
    outcomes: z.array(z.string()).min(1),
    modules: z
      .array(z.object({ title: z.string(), lessons: z.string().optional(), topics: z.array(z.string()) }))
      .min(1),
    homework: z.string().optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    translations: z
      .object({
        en: z.object({ title: z.string(), summary: z.string() }).optional(),
        pl: z.object({ title: z.string(), summary: z.string() }).optional(),
      })
      .default({}),
  }),
});

const teachers = defineCollection({
  loader: glob({ pattern: '*.json', base: './content/teachers' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    order: z.number().default(100),
    founder: z.boolean().default(false),
    directions: z.array(reference('directions')).min(1),
    subjects: z.array(z.string()),
    experience: z.string(),
    bio: z.string(),
    education: z.string().optional(),
    teachingLanguages: z.array(z.string()).default(['українська']),
    /** Шлях до фото в public/, напр. "/images/teachers/olena.jpg". Без фото — показується заглушка з ініціалами. */
    photo: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    direction: reference('directions').optional(),
    tags: z.array(z.string()).default([]),
    readingTime: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.string().optional(),
    needsLegalReview: z.boolean().default(false),
  }),
});

export const collections = { directions, courses, teachers, blog, pages };
