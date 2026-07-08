import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Astro 5 Content Layer：从 src/content/blog 读取所有 .md / .mdx
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
    pinned: z.boolean().default(false),
  }),
});

export const collections = { blog };
