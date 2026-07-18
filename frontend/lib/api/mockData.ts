import type { Product, Collection, ProductVariant } from './types';

// Let's generate S, M, L, XL variants for Maroon, Navy, Black colours
const sizes = ['S', 'M', 'L', 'XL'];
const colours = ['Maroon', 'Navy', 'Black'];
const basePrice = { amount: '55.00', currencyCode: 'GBP' };

const mockVariants: ProductVariant[] = [];
let variantIdCounter = 1;

colours.forEach((colour) => {
  sizes.forEach((size) => {
    mockVariants.push({
      id: `gid://shopify/ProductVariant/mock-${variantIdCounter++}`,
      title: `${colour} / ${size}`,
      availableForSale: true,
      price: basePrice,
      compareAtPrice: { amount: '75.00', currencyCode: 'GBP' },
      selectedOptions: [
        { name: 'Colour', value: colour },
        { name: 'Size', value: size }
      ],
      image: {
        url: colour === 'Maroon'
          ? '/assets/courtyard-jersey.png'
          : colour === 'Navy'
            ? '/assets/signature-product.png'
            : '/assets/bull-banner.png',
        altText: `VAHN Signature Oversized Jersey in ${colour}`,
        width: 1000,
        height: 1000
      }
    });
  });
});

export const MOCK_PRODUCT: Product = {
  id: 'gid://shopify/Product/mock-signature-jersey',
  title: 'VAHN Signature Oversized Jersey',
  handle: 'vahn-signature-oversized-jersey',
  description:
    'Made with care and unconditionally loved by our customers, this signature bestseller exceeds all expectations. Crafted from premium heavyweight organic cotton blend fabric with a bespoke oversized fit, designed to transition from the training field to the street.',
  descriptionHtml:
    '<p>Made with care and unconditionally loved by our customers, this signature bestseller exceeds all expectations. Crafted from premium heavyweight organic cotton blend fabric with a bespoke oversized fit, designed to transition from the training field to the street.</p><ul><li>Heavyweight 360gsm organic cotton blend</li><li>Bespoke relaxed oversized silhouette</li><li>Signature embroidered branding on chest</li><li>Ribbed crewneck collar</li></ul>',
  vendor: 'VAHN',
  productType: 'Jersey',
  tags: ['bestseller', 'jersey', 'signature'],
  availableForSale: true,
  options: [
    { id: 'opt-colour', name: 'Colour', values: colours },
    { id: 'opt-size', name: 'Size', values: sizes }
  ],
  priceRange: {
    minVariantPrice: basePrice,
    maxVariantPrice: basePrice
  },
  compareAtPriceRange: {
    minVariantPrice: { amount: '75.00', currencyCode: 'GBP' }
  },
  images: {
    edges: [
      {
        node: {
          url: '/assets/courtyard-jersey.png',
          altText: 'VAHN Signature Oversized Jersey - Front View',
          width: 1000,
          height: 1000
        }
      },
      {
        node: {
          url: '/assets/signature-product.png',
          altText: 'VAHN Signature Oversized Jersey - Detail View',
          width: 1000,
          height: 1000
        }
      },
      {
        node: {
          url: '/assets/bull-banner.png',
          altText: 'VAHN Signature Oversized Jersey - Lifestyle View',
          width: 1000,
          height: 1000
        }
      }
    ]
  },
  variants: {
    edges: mockVariants.map((v) => ({ node: v }))
  },
  seo: {
    title: 'VAHN Signature Oversized Jersey',
    description: 'Shop the signature oversized sportswear jersey by VAHN.'
  },
  featuredImage: {
    url: '/assets/courtyard-jersey.png',
    altText: 'VAHN Signature Oversized Jersey',
    width: 1000,
    height: 1000
  }
};

export const MOCK_COLLECTION: Collection = {
  id: 'gid://shopify/Collection/mock-beginning',
  handle: 'vahn-beginning',
  title: 'Vahn Beginning',
  description: 'The debut bespoke teamwear collection from VAHN.',
  descriptionHtml: '<p>The debut bespoke teamwear collection from VAHN.</p>',
  image: {
    url: '/assets/bull-banner.png',
    altText: 'Vahn Beginning Collection Banner',
    width: 1200,
    height: 900
  },
  seo: {
    title: 'Vahn Beginning Collection',
    description: 'The debut bespoke teamwear collection from VAHN.'
  },
  products: {
    edges: [
      { node: MOCK_PRODUCT, cursor: 'cursor-1' }
    ],
    pageInfo: {
      hasNextPage: false,
      endCursor: 'cursor-1'
    },
    filters: [
      {
        id: 'filter-size',
        label: 'Size',
        type: 'LIST',
        values: sizes.map((size) => ({ id: `size-${size}`, label: size, count: 1, input: `filter.size.${size}` }))
      },
      {
        id: 'filter-colour',
        label: 'Colour',
        type: 'LIST',
        values: colours.map((col) => ({ id: `col-${col}`, label: col, count: 1, input: `filter.colour.${col}` }))
      }
    ]
  }
};
