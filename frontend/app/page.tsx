import type { Metadata } from 'next';
import HeroSection from '@/components/home/HeroSection';
import FreshOutLocker from '@/components/home/FreshOutLocker';
import PickYourSide from '@/components/home/PickYourSide';
import VideoSection from '@/components/home/VideoSection';
import ExploreCategories from '@/components/home/ExploreCategories';
import BrandStatement from '@/components/home/BrandStatement';
import MarqueeStrip from '@/components/home/MarqueeStrip';
import { getProducts } from '@/lib/api';

export const metadata: Metadata = {
  title: 'VAHN — This is VAHN',
  description:
    'Premium performance sportswear crafted for athletes. Discover the VAHN collection — Tops, Jerseys, and more. This is where it starts.',
};

export default async function HomePage() {
  const { products } = await getProducts({ first: 8 }).catch(() => ({ products: [], hasNextPage: false, endCursor: null }));

  return (
    <>
      {/* 1. Hero — full-viewport dark with "THIS IS VAHN" text overlay */}
      <HeroSection />

      {/* 2. Fresh Out of the Locker — horizontal product carousel */}
      <FreshOutLocker products={products} />

      {/* 3. Pick Your Side — dark strip + two blue athlete panels */}
      <PickYourSide />

      {/* 4. Video Section — full-width video/placeholder */}
      <VideoSection />

      {/* 5. Explore Categories — TOPS / BOTTOMS / ACCESSORIES accordion bars */}
      <ExploreCategories />

      {/* 6. Brand Statement — solid blue background with brand manifesto */}
      <BrandStatement />

      {/* 7. Marquee strip — blue scrolling text on dark bg */}
      <MarqueeStrip />
    </>
  );
}
