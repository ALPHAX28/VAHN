import type { Metadata } from 'next';
import CategoryProductsClient from '@/components/shop/CategoryProductsClient';
import { getProducts } from '@/lib/api';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Tops — VAHN',
  description:
    'Explore VAHN tops, performance football jerseys, training tees & lifestyle silhouettes.',
  openGraph: {
    title: 'Tops — VAHN',
    description:
      'Explore VAHN tops, performance football jerseys, training tees & lifestyle silhouettes.',
  },
};

export default async function TopsPage() {
  const { products } = await getProducts({ category: 'TOPS' }).catch(() => ({ products: [] }));

  return (
    <CategoryProductsClient
      initialProducts={products}
      category="TOPS"
      categoryTitle="TOPS"
      categorySubtitle="Performance football jerseys, relaxed fit tees, and active silhouettes engineered with precision."
    />
  );
}
