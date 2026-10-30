import {defineCollection} from 'astro:content';
import {glob} from 'astro/loaders';
import {z} from 'astro/zod';
const guides=defineCollection({loader:glob({pattern:'**/*.md',base:'./src/content/guides'}),schema:z.object({title:z.string().min(10),description:z.string().min(30),pubDate:z.coerce.date(),updatedDate:z.coerce.date().optional(),category:z.string().default('Guide'),draft:z.boolean().default(true),reviewed:z.boolean().default(false),sources:z.array(z.string().url()).default([])})});
export const collections={guides};
