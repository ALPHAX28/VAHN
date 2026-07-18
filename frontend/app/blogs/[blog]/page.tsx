import type { Metadata } from 'next';
import { getBlog } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

interface Props {
  params: Promise<{ blog: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { blog: handle } = await params;
  const blog = await getBlog(handle).catch(() => null);
  return {
    title: blog?.title ?? 'Journal',
    description: `Read the latest from VAHN — ${blog?.title ?? 'our journal'}.`,
  };
}

export default async function BlogPage({ params }: Props) {
  const { blog: handle } = await params;
  const blog = await getBlog(handle, { first: 12 }).catch(() => null);
  const articles = blog?.articles.edges.map((e) => e.node) ?? [];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: 'var(--color-grey-light)',
          borderBottom: '1px solid var(--color-border)',
          padding: 'var(--space-2xl) var(--space-xl)',
          textAlign: 'center',
        }}
      >
        <p className="section-title">The Journal</p>
        <h1 style={{ marginTop: '8px' }}>{blog?.title ?? 'News'}</h1>
      </div>

      {/* Articles grid */}
      <div className="blog-grid">
        {articles.length === 0 && (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--color-grey-dark)' }}>
            No articles yet. Check back soon.
          </p>
        )}
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/blogs/${handle}/${article.handle}`}
            className="article-card"
          >
            <div className="article-card-image">
              {article.image ? (
                <Image
                  src={article.image.url}
                  alt={article.image.altText ?? article.title}
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--color-navy)' }} />
              )}
            </div>
            <div className="article-card-body">
              <p className="article-meta">
                {new Date(article.publishedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · {article.author.name}
              </p>
              <h3 className="article-card-title">{article.title}</h3>
              {article.excerpt && (
                <p className="article-card-excerpt">{article.excerpt}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
