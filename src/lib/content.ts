import { getCollection, type CollectionEntry } from 'astro:content';

export type Direction = CollectionEntry<'directions'>;
export type Course = CollectionEntry<'courses'>;
export type Teacher = CollectionEntry<'teachers'>;
export type Post = CollectionEntry<'blog'>;

const byOrder = <T extends { data: { order: number } }>(a: T, b: T) => a.data.order - b.data.order;

export async function getDirections(): Promise<Direction[]> {
  return (await getCollection('directions')).sort(byOrder);
}

export async function getCourses(): Promise<Course[]> {
  const directions = await getDirections();
  const dirOrder = new Map(directions.map((d, i) => [d.id, i]));
  return (await getCollection('courses', ({ data }) => !data.draft)).sort(
    (a, b) =>
      (dirOrder.get(a.data.direction.id) ?? 99) - (dirOrder.get(b.data.direction.id) ?? 99) || a.data.order - b.data.order,
  );
}

export async function getTeachers(): Promise<Teacher[]> {
  return (await getCollection('teachers')).sort(byOrder);
}

export async function getPosts(): Promise<Post[]> {
  return (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}
