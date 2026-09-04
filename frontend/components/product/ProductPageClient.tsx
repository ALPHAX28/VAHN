'use client';

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Product, Image as ShopifyImage } from '@/lib/api/types';
import ProductMediaGallery from '@/components/product/ProductMediaGallery';
import ProductInfo from '@/components/product/ProductInfo';
import ProductHighlights from '@/components/product/ProductHighlights';
import ProductLookbook from '@/components/product/ProductLookbook';

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

  const [selectedColour, setSelectedColour] = useState<string>(
    matchedColourGroup?.colourValue || queryColour || ''
  );

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
    if (matchedColourGroup) {
      setSelectedColour(matchedColourGroup.colourValue);
      if (matchedColourGroup.images && matchedColourGroup.images.length > 0) {
        setGalleryImages(
          matchedColourGroup.images.map((img) => ({
            url: img.url,
            altText: img.altText || matchedColourGroup.colourValue,
            width: 800,
            height: 800,
          }))
        );
      }
    }
  }, [matchedColourGroup]);

  const handleColourChange = useCallback(
    (colourValue: string) => {
      setSelectedColour(colourValue);

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

  // Dynamically resolve Lookbook cards matching the selected colour, falling back to product lookbook
  const currentLookbook = useMemo(() => {
    if (selectedColour && product.colourGroups?.length) {
      const group = product.colourGroups.find(
        (cg) => cg.colourValue.trim().toLowerCase() === selectedColour.trim().toLowerCase()
      );
      if (group?.lookbook && group.lookbook.length > 0) {
        return group.lookbook;
      }
    }
    return product.lookbook || [];
  }, [selectedColour, product.colourGroups, product.lookbook]);

  return (
    <>
      <div className="product-page">
        <ProductMediaGallery images={galleryImages} productTitle={product.title} />
        <ProductInfo
          product={product}
          initialColour={matchedColourGroup?.colourValue || queryColour || undefined}
          onColourChange={handleColourChange}
        />
      </div>

      {/* Fit, Kit Type & Activity Highlights Bar */}
      <ProductHighlights product={product} />

      {/* Lookbook / "How He Wears It" Section */}
      <ProductLookbook lookbook={currentLookbook} />
    </>
  );
}

export default function ProductPageClient(props: Props) {
  return (
    <Suspense
      fallback={
        <>
          <div className="product-page">
            <ProductMediaGallery images={props.defaultImages} productTitle={props.product.title} />
            <ProductInfo product={props.product} />
          </div>
          <ProductHighlights product={props.product} />
          <ProductLookbook lookbook={props.product.lookbook || []} />
        </>
      }
    >
      <ProductPageClientInner {...props} />
    </Suspense>
  );
}
