export default function VideoSection() {
  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        minHeight: '420px',
        maxHeight: '85vh',
        overflow: 'hidden',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTop: '3px solid #ffffff',
        borderBottom: '3px solid #ffffff',
      }}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      >
        <source src="/assets/main-banner-desktop.mp4" type="video/mp4" />
      </video>
    </section>
  );
}
