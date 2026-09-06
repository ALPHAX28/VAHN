'use client';

import React from 'react';
import Link from 'next/link';
import TrustBadgesBar from '@/components/ui/TrustBadgesBar';

export default function OurStoryPage() {
  const pillars = [
    {
      num: '01',
      title: 'What is VAHN',
      content: [
        'VAHN is an Indian sport-lifestyle brand for people who play any sport and care how they look while playing.',
        "Most sportswear here assumes you're training for something. That you're on a programme, chasing a number, becoming a better version of yourself. We're not built on that. We're built on the part that came before all of it, the part where you played because you wanted to, until it got dark, and then argued about it on the walk home.",
        "Sport isn't something you do. It's how you see. It decides your week, your friendships, your mood on a Monday. That deserves to be dressed properly.",
      ],
    },
    {
      num: '02',
      title: 'The Name',
      content: [
        'VAHN comes from vāhana, Sanskrit for the vehicle, the thing that carries. In the old stories the vāhana is never the god. It\'s what the god rides.',
        'That felt right for a sports-lifestyle brand. What you wear isn\'t the point. It\'s what gets you to the ground, through the match, and home again.',
      ],
    },
    {
      num: '03',
      title: 'The Gap',
      content: [
        'India has never had a shortage of people who play. It has a shortage of kit made for them.',
        'The global brands arrive with campaigns built somewhere else and translated badly. The homegrown ones sell gym culture, grind, transformation, before and after. Neither is about the Sunday match, the Wednesday court, or the group chat that decides the fixture.',
      ],
    },
    {
      num: '04',
      title: 'How We Build',
      content: [
        'Every fabric is chosen for the conditions it\'ll actually meet: the heat, the monsoon, the wash it gets that night because you\'re playing again tomorrow. Every cut is tested on the body it\'s for, moving the way that body moves.',
        'Panelling goes where the heat collects, not where it looks good on a flat lay. Stitching is built to be pulled at. Marks and detailing are made to still be there in a year, not just on the first wear.',
        'Some of these decisions take weeks and none of them are visible from across a room. That\'s the point.',
      ],
    },
  ];

  return (
    <div style={{ background: '#111111', color: '#ffffff', minHeight: '100vh' }}>
      {/* ── Hero Section ── */}
      <section
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: 'clamp(64px, 8vw, 110px) clamp(24px, 5vw, 64px) clamp(48px, 6vw, 80px)',
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            color: '#4232d9',
            marginBottom: '20px',
          }}
        >
          About VAHN
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.75rem, 4.2vw, 3.5rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
            lineHeight: 1.15,
            margin: '0 auto 28px',
            maxWidth: '1000px',
            color: '#ffffff',
          }}
        >
          Sports Isn&apos;t Something You Do. It&apos;s How You See.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body), Georgia, serif',
            fontSize: 'clamp(1rem, 1.3vw, 1.25rem)',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.75)',
            maxWidth: '720px',
            margin: '0 auto',
            fontStyle: 'italic',
          }}
        >
          Indian sport-lifestyle apparel engineered for the field, the street, and every moment between.
        </p>
      </section>

      {/* ── 4 Brand Pillars ── */}
      <section
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: 'clamp(48px, 6vw, 80px) clamp(24px, 5vw, 64px)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))',
            gap: '24px',
          }}
        >
          {pillars.map((pillar) => (
            <div
              key={pillar.num}
              style={{
                background: '#181818',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: 'clamp(28px, 3.5vw, 44px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                position: 'relative',
                transition: 'border-color 0.2s ease, transform 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingBottom: '16px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#4232d9',
                  }}
                >
                  {pillar.num}
                </span>
                <h3
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    margin: 0,
                  }}
                >
                  {pillar.title}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {pillar.content.map((p, idx) => (
                  <p
                    key={idx}
                    style={{
                      fontFamily: 'var(--font-body), Georgia, serif',
                      fontSize: '1rem',
                      lineHeight: 1.8,
                      color: 'rgba(255, 255, 255, 0.92)',
                      margin: 0,
                    }}
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Founder's Note ── */}
      <section
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '0 clamp(24px, 5vw, 64px) clamp(64px, 8vw, 100px)',
        }}
      >
        <div
          style={{
            background: '#1c1c1c',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderLeft: '4px solid #4232d9',
            padding: 'clamp(32px, 5vw, 56px)',
            position: 'relative',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: '#4232d9',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Personal Statement
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
                color: '#ffffff',
                margin: 0,
              }}
            >
              Founder&apos;s Note
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              fontFamily: 'var(--font-body), Georgia, serif',
            }}
          >
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.92)', fontSize: '1.0625rem', lineHeight: 1.85 }}>
              I grew up playing until the light went. Every afternoon until sunset, however long that happened to be — cricket on cracked concrete, football on a field that flooded every monsoon and never quite drained. Mostly with my brother and four of his friends, all older than me, which meant I spent years being the worst player on the ground.
            </p>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.92)', fontSize: '1.0625rem', lineHeight: 1.85 }}>
              I&apos;m a designer by trade, so somewhere along the way I started looking at what we were all wearing. Kit made for a body somewhere else, or made for a gym none of us went to. Everything was translated or borrowed. Nothing was made by anyone who had been on that ground.
            </p>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.92)', fontSize: '1.0625rem', lineHeight: 1.85 }}>
              VAHN is my attempt at the thing I wanted and couldn&apos;t buy. I design all of it — the jerseys, the box, the type you&apos;re reading now. Two friends build it with me, and all three of us play.
            </p>
            <p style={{ margin: 0, color: '#ffffff', fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.85 }}>
              We&apos;ll get things wrong. The fit and the fabric won&apos;t be among them.
            </p>
          </div>

          <div
            style={{
              marginTop: '36px',
              paddingTop: '24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#ffffff',
                display: 'block',
                letterSpacing: '-0.01em',
              }}
            >
              — Abhinandan
            </span>
            <span
              style={{
                fontSize: '0.8125rem',
                color: 'rgba(255, 255, 255, 0.65)',
                fontFamily: 'var(--font-ui)',
                marginTop: '2px',
                display: 'block',
              }}
            >
              Founder &amp; Designer, VAHN
            </span>
          </div>
        </div>
      </section>

      {/* ── Bottom Trust Badges ── */}
      <TrustBadgesBar />
    </div>
  );
}
