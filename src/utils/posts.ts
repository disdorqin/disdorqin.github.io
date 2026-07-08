import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** 已发布文章：置顶优先，再按发布时间倒序。*/
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => {
    if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
    return b.data.pubDate.getTime() - a.data.pubDate.getTime();
  });
}

/** 分类及其文章数 */
export function getCategories(posts: Post[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of posts) map.set(p.data.category, (map.get(p.data.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** 标签及其文章数 */
export function getTags(posts: Post[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
