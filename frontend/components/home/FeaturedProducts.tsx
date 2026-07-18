import ProductCard from '@/components/collection/ProductCard';
import type { Product } from '@/lib/api/types';

interface Props { products: Product[]; }

export default function FeaturedProducts({ products }: Props) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
