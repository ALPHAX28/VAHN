'use client';

import { useState } from 'react';
import type { Review } from '@/lib/api/types';

interface Props {
  initialReviews: Review[];
  productHandle: string;
}

export default function ProductReviews({ initialReviews, productHandle }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [showForm, setShowForm] = useState(false);
  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [filterRating, setFilterRating] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(6);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');
      const response = await fetch(`${apiBase}/api/products/${productHandle}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          title,
          author,
          content,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to submit review');
      }
      const newReview = await response.json();
      setReviews((prev) => [newReview, ...prev]);
      setAuthor('');
      setTitle('');
      setRating(5);
      setContent('');
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalReviews = reviews.length;
  const averageScore = totalReviews > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
    : '0.0';

  const filteredReviews = reviews.filter((r) => {
    if (filterRating === 'all') return true;
    return Math.round(r.rating) === filterRating;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    const parseDate = (dStr: string) => {
      const parts = dStr.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      }
      return new Date(dStr).getTime();
    };

    if (sortBy === 'newest') {
      return parseDate(b.date) - parseDate(a.date);
    }
    if (sortBy === 'oldest') {
      return parseDate(a.date) - parseDate(b.date);
    }
    if (sortBy === 'highest') {
      return b.rating - a.rating;
    }
    if (sortBy === 'lowest') {
      return a.rating - b.rating;
    }
    return 0;
  });

  return (
    <section className="reviews-section">
      <div className="container">
        {/* Header and Controls */}
        <div className="reviews-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', textTransform: 'uppercase', fontFamily: 'var(--font-heading)' }}>Customer Reviews</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-black)' }}>{averageScore}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '3px', margin: '2px 0' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      viewBox="0 0 24 24"
                      width="26"
                      height="26"
                      fill={star <= Math.round(parseFloat(averageScore)) ? '#1056d1' : '#e0e0e0'}
                      style={{ display: 'inline-block' }}
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-grey-dark)' }}>{totalReviews} review{totalReviews !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
            <button 
              onClick={() => setShowForm(!showForm)} 
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.8125rem', borderRadius: '30px', backgroundColor: '#1056d1', color: '#fff', border: 'none' }}
            >
              Write a review
            </button>
            
            {/* Filter Button */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); }}
                className="btn-icon-outline"
                aria-label="Filter reviews"
                style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--color-white)', height: '38px', width: '38px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </button>
              {showFilterDropdown && (
                <div style={{ position: 'absolute', right: 0, top: '48px', zIndex: 10, background: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px', width: '160px', boxShadow: 'var(--shadow-md)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.75rem', padding: '6px 8px', textTransform: 'uppercase', color: 'var(--color-grey-dark)' }}>Filter by Rating</div>
                  {(['all', 5, 4, 3, 2, 1] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => { setFilterRating(r); setShowFilterDropdown(false); }}
                      style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer', backgroundColor: filterRating === r ? 'var(--color-grey-light)' : 'transparent', borderRadius: '4px' }}
                    >
                      {r === 'all' ? 'All Ratings' : `${r} Stars`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Button */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); }}
                className="btn-icon-outline"
                aria-label="Sort reviews"
                style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--color-white)', height: '38px', width: '38px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
              </button>
              {showSortDropdown && (
                <div style={{ position: 'absolute', right: 0, top: '48px', zIndex: 10, background: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px', width: '180px', boxShadow: 'var(--shadow-md)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.75rem', padding: '6px 8px', textTransform: 'uppercase', color: 'var(--color-grey-dark)' }}>Sort by</div>
                  {([
                    { value: 'newest', label: 'Newest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'highest', label: 'Highest Rating' },
                    { value: 'lowest', label: 'Lowest Rating' }
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                      style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer', backgroundColor: sortBy === opt.value ? 'var(--color-grey-light)' : 'transparent', borderRadius: '4px' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Review Form */}
        {showForm && (
          <form onSubmit={handleSubmitReview} style={{ background: 'var(--color-white)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '32px', maxWidth: '600px', marginLeft: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Write a Review</h3>
            
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px' }}>Your Name</label>
              <input 
                type="text" 
                value={author} 
                onChange={(e) => setAuthor(e.target.value)} 
                required 
                placeholder="Enter your name"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px' }}>Review Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                placeholder="e.g. Extremely comfortable"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px' }}>Rating</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="30"
                      height="30"
                      fill={star <= rating ? '#1056d1' : '#e0e0e0'}
                      style={{ display: 'inline-block' }}
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px' }}>Review</label>
              <textarea 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                required 
                rows={4}
                placeholder="Share your thoughts about this product..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--color-border)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {error && <p style={{ color: '#D93939', fontSize: '0.875rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.8125rem', backgroundColor: 'var(--color-black)', color: 'var(--color-white)', borderRadius: '4px' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="btn btn-secondary"
                style={{ padding: '10px 24px', fontSize: '0.8125rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Reviews List */}
        {sortedReviews.length === 0 ? (
          <div style={{ background: 'var(--color-white)', padding: '40px', textAlign: 'center', borderRadius: '8px', color: 'var(--color-grey-dark)' }}>
            No reviews found matching the selected rating.
          </div>
        ) : (
          <div style={{ position: 'relative', paddingBottom: sortedReviews.length > visibleCount ? '80px' : '0' }}>
            <div className="reviews-grid">
              {sortedReviews.slice(0, visibleCount).map((review) => {
                const isLong = review.content.length > 150;
                const isExpanded = expandedReviewIds[review.id];
                const displayContent = isLong && !isExpanded ? `${review.content.slice(0, 150)}...` : review.content;
                
                return (
                  <div key={review.id} className="review-card">
                    <div className="review-stars" style={{ display: 'flex', gap: '3px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          viewBox="0 0 24 24"
                          width="30"
                          height="30"
                          fill={star <= Math.round(review.rating) ? '#1056d1' : '#e0e0e0'}
                          style={{ display: 'inline-block' }}
                        >
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      ))}
                    </div>
                    
                    <div>
                      <span className="review-author">
                        {review.author}
                        {review.verified && (
                          <span className="review-verified-badge">
                            Verified
                          </span>
                        )}
                      </span>
                      <div className="review-date">{review.date}</div>
                    </div>

                    {review.title && (
                      <h4 className="review-title-text">
                        {review.title}
                      </h4>
                    )}
                    
                    <p className="review-content">"{displayContent}"</p>
                    
                    {isLong && (
                      <button
                        onClick={() => setExpandedReviewIds((prev) => ({ ...prev, [review.id]: !prev[review.id] }))}
                        className="review-read-more"
                      >
                        {isExpanded ? 'Read less' : 'Read more'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {sortedReviews.length > visibleCount && (
              <div className="reviews-fade-overlay">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 6)}
                  className="reviews-load-more-btn"
                >
                  Read More Reviews
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
