'use client';

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Product, Image as ShopifyImage } from '@/lib/api/types';
import ProductMediaGallery from '@/components/product/ProductMediaGallery';
import ProductInfo from '@/components/product/ProductInfo';

interface Props {
  product: Product;
  defaultImages: ShopifyImage[];
}

function ProductPageClientInner({ product, defaultImages }: Props) {
  const searchParams = useSearchParams();
  const queryColour = searchParams?.get('colour') || searchParams?.get('color') || '';

  // Determine initial colour matching query param or first available colour group
  const matchedColourGroup = useMemo(() => {
    if (!product.colourGroups?.length) return null;
    if (queryColour) {
      return (
        product.colourGroups.find(
          (cg) => cg.colourValue.trim().toLowerCase() === queryColour.trim().toLowerCase()
        ) || null
      );
    }
    return null;
  }, [product.colourGroups, queryColour]);

  const initialImages = useMemo(() => {
    if (matchedColourGroup && matchedColourGroup.images && matchedColourGroup.images.length > 0) {
      return matchedColourGroup.images.map((img) => ({
        url: img.url,
        altText: img.altText || matchedColourGroup.colourValue,
        width: 800,
        height: 800,
      }));
    }
    return defaultImages;
  }, [matchedColourGroup, defaultImages]);

  const [galleryImages, setGalleryImages] = useState<ShopifyImage[]>(initialImages);

  // Sync if URL query param changes
  useEffect(() => {
    if (matchedColourGroup && matchedColourGroup.images && matchedColourGroup.images.length > 0) {
      setGalleryImages(
        matchedColourGroup.images.map((img) => ({
          url: img.url,
          altText: img.altText || matchedColourGroup.colourValue,
          width: 800,
          height: 800,
        }))
      );
    }
  }, [matchedColourGroup]);

  const handleColourChange = useCallback(
    (colourValue: string) => {
      if (!colourValue) {
        setGalleryImages(defaultImages);
        return;
      }

      if (!product.colourGroups?.length) {
        setGalleryImages(defaultImages);
        return;
      }

      const colourGroup = product.colourGroups.find(
        (cg) => cg.colourValue.trim().toLowerCase() === colourValue.trim().toLowerCase()
      );

      if (!colourGroup) {
        setGalleryImages(defaultImages);
        return;
      }

      if (colourGroup.images && colourGroup.images.length > 0) {
        const colourImages: ShopifyImage[] = colourGroup.images.map((img) => ({
          url: img.url,
          altText: img.altText || colourValue,
          width: 800,
          height: 800,
        }));
        setGalleryImages(colourImages);
      } else {
        setGalleryImages([]);
      }
    },
    [product.colourGroups, defaultImages]
  );

  return (
    <>
      <ProductMediaGallery images={galleryImages} productTitle={product.title} />
      <ProductInfo
        product={product}
        initialColour={matchedColourGroup?.colourValue || queryColour || undefined}
        onColourChange={handleColourChange}
      />
    </>
  );
}

export default function ProductPageClient(props: Props) {
  return (
    <Suspense fallback={<ProductMediaGallery images={props.defaultImages} productTitle={props.product.title} />}>
      <ProductPageClientInner {...props} />
    </Suspense>
  );
}
