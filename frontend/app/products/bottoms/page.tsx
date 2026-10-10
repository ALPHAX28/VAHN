import type { Metadata } from 'next';
import CategoryProductsClient from '@/components/shop/CategoryProductsClient';
import { getProducts } from '@/lib/api';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Bottoms — VAHN',
  description:
    'Explore VAHN bottoms, performance shorts, training trackpants & lifestyle silhouettes.',
  openGraph: {
    title: 'Bottoms — VAHN',
    description:
      'Explore VAHN bottoms, performance shorts, training trackpants & lifestyle silhouettes.',
  },
};

export default async function BottomsPage() {
  const { products } = await getProducts({ category: 'BOTTOMS' }).catch(() => ({ products: [] }));

  return (
    <CategoryProductsClient
      initialProducts={products}
      category="BOTTOMS"
      categoryTitle="BOTTOMS"
      categorySubtitle="Performance shorts, tailored trackpants, and active bottom silhouettes engineered for movement."
    />
  );
}
