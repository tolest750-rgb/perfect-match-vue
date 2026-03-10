import { useState, useEffect } from 'react';
import { CarouselProvider } from '@/lib/carousel-store';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { OutputPanel } from '@/components/OutputPanel';
import { ApiModal } from '@/components/ApiModal';
import { Lightbox } from '@/components/Lightbox';

function CarouselStudio() {
  const [modalOpen, setModalOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxSrc(null);
        setModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  return (
    <>
      <Navbar onOpenModal={() => setModalOpen(true)} />
      <div className="grid grid-cols-[340px_1fr] max-[900px]:grid-cols-1 min-h-[calc(100vh-60px)] mt-[60px]">
        <Sidebar />
        <OutputPanel onImageClick={setLightboxSrc} />
      </div>
      <ApiModal open={modalOpen} onClose={() => setModalOpen(false)} />
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
