import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getProduct } from '@/lib/api';
import ProductPageClient from '@/components/product/ProductPageClient';
import ProductReviews from '@/components/product/ProductReviews';
import ProductHighlights from '@/components/product/ProductHighlights';
import ProductLookbook from '@/components/product/ProductLookbook';

interface Props {
  params: Promise<{ handle: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle).catch(() => null);
  if (!product) return { title: 'Product Not Found' };

  const image = product.featuredImage;
  return {
    title: product.seo.title ?? product.title,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 160),
      images: image ? [{ url: image.url, alt: image.altText ?? product.title }] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProduct(handle).catch(() => null);
  if (!product) notFound();

  const images = product.images.edges.map((e) => e.node);

  return (
    <>
      <div className="product-page">
        {/* SCRUM-33: ProductPageClient lifts gallery state so colour selection updates ALL gallery images */}
        <ProductPageClient product={product} defaultImages={images} />
      </div>

      {/* Fit, Kit Type & Activity Highlights Bar */}
      <ProductHighlights product={product} />

      {/* Lookbook / "How He Wears It" Section */}
      <ProductLookbook lookbook={product.lookbook || []} />

      {/* Customer Reviews Section */}
      <ProductReviews initialReviews={product.reviews || []} productHandle={product.handle} />
    </>
  );
}

