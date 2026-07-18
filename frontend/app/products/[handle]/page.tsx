import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getProduct, getProductRecommendations } from '@/lib/api';
import ProductMediaGallery from '@/components/product/ProductMediaGallery';
import ProductInfo from '@/components/product/ProductInfo';
import ProductCard from '@/components/collection/ProductCard';
import ProductReviews from '@/components/product/ProductReviews';

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle).catch(() => null);
  if (!product) return { title: 'Product Not Found' };

  const image = product.featuredImage;
  return {
    title: product.seo.title ?? product.title,
    description: product.seo.description ?? product.description.slice(0, 160),
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

  const recommendations = await getProductRecommendations(product.id).catch(() => []);

  const images = product.images.edges.map((e) => e.node);

  return (
    <>
      <div className="product-page">
        {/* Left: Media Gallery */}
        <ProductMediaGallery images={images} productTitle={product.title} />

        {/* Right: Product Info */}
        <ProductInfo product={product} />
      </div>

      {/* Lookbook / "How He Wears It" Section */}
      {product.lookbook && product.lookbook.length > 0 && (
        <section className="lookbook-section">
          <div className="container">
            <div className="section-header" style={{ padding: 0, marginBottom: 'var(--space-md)' }}>
              <div>
                <p className="section-title">Inspiration</p>
                <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', marginTop: '4px' }}>
                  How He Wears It
                </h2>
              </div>
            </div>
            <div className="lookbook-grid">
              {product.lookbook.map((item) => (
                <div key={item.id} className="lookbook-card">
                  <div className="lookbook-image-container">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 576px) 50vw, 100vw"
                      className="lookbook-image"
                    />
                  </div>
                  <div className="lookbook-info">
                    <h3 className="lookbook-title">{item.title}</h3>
                    <p className="lookbook-desc">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Customer Reviews Section */}
      <ProductReviews initialReviews={product.reviews || []} productHandle={product.handle} />

      {/* Product Recommendations */}
      {recommendations.length > 0 && (
        <section className="section">
          <div style={{ maxWidth: 'var(--page-width)', margin: '0 auto', padding: '0 var(--space-xl)' }}>
            <div className="section-header" style={{ padding: 0, marginBottom: 'var(--space-xl)' }}>
              <div>
                <p className="section-title">You may also like</p>
                <h2 style={{ fontSize: 'clamp(1.25rem, 2vw, 2rem)', marginTop: '4px' }}>
                  Related Products
                </h2>
              </div>
            </div>
            <div className="related-products-grid">
              {recommendations.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
