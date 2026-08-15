'use client';

import { useState, useCallback } from 'react';
import type { Product, Image as ShopifyImage } from '@/lib/api/types';
import ProductMediaGallery from '@/components/product/ProductMediaGallery';
import ProductInfo from '@/components/product/ProductInfo';

interface Props {
  product: Product;
  defaultImages: ShopifyImage[];
}

/**
 * SCRUM-33: Client wrapper that lifts gallery image state so that when a user
 * selects a colour in ProductInfo, the gallery updates with ALL images for
 * that colour group, not just the first one.
 */
export default function ProductPageClient({ product, defaultImages }: Props) {
  const [galleryImages, setGalleryImages] = useState<ShopifyImage[]>(defaultImages);

  const handleColourChange = useCallback(
    (colourValue: string) => {
      if (!colourValue) {
        // No colour selected at all → show product gallery
        setGalleryImages(defaultImages);
        return;
      }

      if (!product.colourGroups?.length) {
        // Product has no colour groups → show product gallery
        setGalleryImages(defaultImages);
        return;
      }

      const colourGroup = product.colourGroups.find(
        (cg) => cg.colourValue.trim().toLowerCase() === colourValue.trim().toLowerCase()
      );

      if (!colourGroup) {
        // Colour not found in any group → fall back to product gallery
        setGalleryImages(defaultImages);
        return;
      }

      if (colourGroup.images && colourGroup.images.length > 0) {
        // Colour group has images → show them
        const colourImages: ShopifyImage[] = colourGroup.images.map((img) => ({
          url: img.url,
          altText: img.altText || colourValue,
          width: 800,
          height: 800,
        }));
        setGalleryImages(colourImages);
      } else {
        // Colour group exists but has NO images → show empty gallery (not the Blue/other images)
        setGalleryImages([]);
      }
    },
    [product.colourGroups, defaultImages]
  );

  return (
    <>
      <ProductMediaGallery images={galleryImages} productTitle={product.title} />
      <ProductInfo product={product} onColourChange={handleColourChange} />
    </>
  );
}
