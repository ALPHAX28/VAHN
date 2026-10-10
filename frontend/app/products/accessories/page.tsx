import type { Metadata } from 'next';
import CategoryProductsClient from '@/components/shop/CategoryProductsClient';
import { getProducts } from '@/lib/api';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Accessories — VAHN',
  description: 'Explore VAHN accessories, performance wristbands, socks, and active essentials.',
  openGraph: {
    title: 'Accessories — VAHN',
    description: 'Explore VAHN accessories, performance wristbands, socks, and active essentials.',
  },
};

export default async function AccessoriesPage() {
  const { products } = await getProducts({ category: 'ACCESSORIES' }).catch(() => ({
    products: [],
  }));

  return (
    <CategoryProductsClient
      initialProducts={products}
      category="ACCESSORIES"
      categoryTitle="ACCESSORIES"
      categorySubtitle="Performance wristbands, socks, headbands, and essentials engineered with precision."
    />
  );
}
