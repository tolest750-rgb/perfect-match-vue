import { useState, useEffect } from 'react';
import { CarouselProvider } from '@/lib/carousel-store';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { OutputPanel } from '@/components/OutputPanel';
import { Lightbox } from '@/components/Lightbox';

function CarouselStudio() {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null);
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <>
      <Navbar />
      <div className="grid grid-cols-[340px_1fr] max-[900px]:grid-cols-1 min-h-[calc(100vh-60px)] mt-[60px]">
        <Sidebar />
        <OutputPanel onImageClick={setLightboxSrc} />
      </div>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}

const Index = () => (
  <CarouselProvider>
    <CarouselStudio />
  </CarouselProvider>
);

export default Index;
