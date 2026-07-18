import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getArticle } from '@/lib/api';

interface Props {
  params: Promise<{ blog: string; article: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { blog: blogHandle, article: articleHandle } = await params;
  const article = await getArticle(blogHandle, articleHandle).catch(() => null);
  if (!article) return { title: 'Article Not Found' };
  return {
    title: article.seo.title ?? article.title,
    description: article.seo.description ?? article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.image ? [{ url: article.image.url, alt: article.image.altText ?? article.title }] : [],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { blog: blogHandle, article: articleHandle } = await params;
  const article = await getArticle(blogHandle, articleHandle).catch(() => null);
  if (!article) notFound();

  return (
    <article>
      {/* Header */}
      <div
        style={{
          background: 'var(--color-grey-light)',
          padding: 'var(--space-2xl) var(--space-xl)',
          textAlign: 'center',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Link
          href={`/blogs/${blogHandle}`}
          style={{ fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-grey-dark)' }}
        >
          ← {article.blog.title}
        </Link>
        <h1 style={{ marginTop: '24px', fontSize: 'clamp(2rem, 4vw, 4rem)', maxWidth: '800px', margin: '24px auto 0' }}>
          {article.title}
        </h1>
        <p className="article-meta" style={{ marginTop: '16px' }}>
          {new Date(article.publishedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          · {article.author.name}
        </p>
      </div>

      {/* Featured image */}
      {article.image && (
        <div style={{ maxHeight: '60vh', overflow: 'hidden', position: 'relative', aspectRatio: '16/7' }}>
          <Image
            src={article.image.url}
            alt={article.image.altText ?? article.title}
            fill
            priority
            style={{ objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Body */}
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: 'var(--space-2xl) var(--space-xl)',
        }}
      >
        <div
          className="product-description"
          style={{ border: 'none', paddingTop: 0 }}
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />
      </div>
    </article>
  );
}
