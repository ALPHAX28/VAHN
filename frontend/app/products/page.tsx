import type { Metadata } from 'next';
import { getProducts } from '@/lib/api';
import ShopProductsClient from '@/components/shop/ShopProductsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop All Products — VAHN',
  description: 'Explore the complete VAHN collection. Performance teamwear & lifestyle apparel engineered with precision.',
  openGraph: {
    title: 'Shop All Products — VAHN',
    description: 'Explore the complete VAHN collection. Performance teamwear & lifestyle apparel engineered with precision.',
  },
};

export default async function ProductsPage() {
  const { products } = await getProducts().catch(() => ({ products: [] }));

  return <ShopProductsClient initialProducts={products} />;
}
