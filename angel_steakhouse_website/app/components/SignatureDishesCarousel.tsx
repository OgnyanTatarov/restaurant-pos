'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

interface Dish {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
}

interface SignatureDishesCarouselProps {
  dishes?: Dish[];
}

const defaultDishes: Dish[] = [
  {
    title: 'SIGNATURE RIBEYE',
    subtitle: 'Aged 45 Days • Smoky • Tender',
    description: 'Premium ribeye steak aged to perfection',
    imageUrl: 'https://images.unsplash.com/photo-1600804340584-c7da2c176e39?w=1200&q=80',
  },
  {
    title: 'WAGYU STRIPLOIN',
    subtitle: 'Marble 9 • Melt-in-your-mouth',
    description: 'Exceptional Wagyu with perfect marbling',
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=1200&q=80',
  },
  {
    title: 'TOMAHAWK SPECIAL',
    subtitle: 'Charred • Juicy • Impressive',
    description: 'Impressively large tomahawk cut',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=1200&q=80',
  },
];

export default function SignatureDishesCarousel({ dishes = defaultDishes }: SignatureDishesCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const totalDishes = dishes.length;

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setTimeout(() => setIsPaused(false), 10000);
  }, []);

  const nextSlide = useCallback(() => {
    goToSlide((currentIndex + 1) % totalDishes);
  }, [currentIndex, totalDishes, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide((currentIndex - 1 + totalDishes) % totalDishes);
  }, [currentIndex, totalDishes, goToSlide]);

  useEffect(() => {
    if (!isPaused) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % totalDishes);
      }, 6000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, totalDishes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sectionRef.current?.contains(document.activeElement) || document.activeElement === sectionRef.current) {
        if (e.key === 'ArrowLeft') {
          prevSlide();
        } else if (e.key === 'ArrowRight') {
          nextSlide();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevSlide, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextSlide();
    }
    if (isRightSwipe) {
      prevSlide();
    }
  };

  const getVisibleIndices = () => {
    const indices: number[] = [];
    for (let i = -1; i <= 1; i++) {
      const idx = (currentIndex + i + totalDishes) % totalDishes;
      indices.push(idx);
    }
    return indices;
  };

  const getCardStyle = (index: number, offset: number) => {
    const isCenter = offset === 0;
    
    if (isCenter) {
      return 'scale-100 opacity-100 z-10';
    } else {
      return 'scale-90 opacity-60 z-0';
    }
  };

  const visibleIndices = getVisibleIndices();

  return (
    <section
      ref={sectionRef}
      className="relative py-20 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      tabIndex={0}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(255,138,42,0.1)_0%,transparent_70%)]" />
      
      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="text-xs sm:text-sm tracking-[3px] text-[#FF8A2A] uppercase mb-2">
            PREMIUM SELECTION
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-wider uppercase text-white mb-4">
            SIGNATURE DISHES
          </h2>
          <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto">
            Experience our chef's most celebrated creations
          </p>
        </div>

        <div className="relative">
          <div className="flex items-center justify-center gap-6 md:gap-8 lg:gap-12">
            <button
              onClick={prevSlide}
              aria-label="Previous dish"
              className="hidden md:flex items-center justify-center w-14 h-14 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-[#FF8A2A]/50 transition-all z-20 flex-shrink-0"
            >
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex-1 overflow-hidden max-w-full">
              <div className="flex items-stretch justify-center gap-4 md:gap-6 lg:gap-8">
                {visibleIndices.map((dishIndex, position) => {
                  const dish = dishes[dishIndex];
                  const offset = position - 1;
                  const isVisible = Math.abs(offset) <= 1;
                  
                  if (!isVisible) return null;

                  return (
                    <div
                      key={`${dishIndex}-${position}`}
                      className={`flex-shrink-0 transition-all duration-500 ease-in-out ${
                        offset === 0 
                          ? 'w-full md:w-[500px] lg:w-[550px]' 
                          : 'hidden md:block lg:w-[450px] md:w-[400px]'
                      } ${getCardStyle(dishIndex, offset)}`}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <div className="relative rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden group cursor-pointer h-full">
                        <div className={`relative overflow-hidden w-full ${
                          offset === 0 ? 'aspect-[4/5] md:aspect-[3/4]' : 'aspect-[4/5] md:aspect-[3/4]'
                        }`}>
                          <Image
                            src={dish.imageUrl}
                            alt={dish.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 500px, 550px"
                            priority={offset === 0}
                            quality={95}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10 lg:p-12">
                          <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white uppercase tracking-wide mb-3">
                            {dish.title}
                          </h3>
                          <p className="text-base sm:text-lg md:text-xl text-[#FF8A2A] mb-3 font-medium">
                            {dish.subtitle}
                          </p>
                          <p className="text-sm sm:text-base text-gray-300 mb-6 hidden md:block">
                            {dish.description}
                          </p>
                          <button className="text-sm sm:text-base uppercase tracking-wider text-white border border-white/30 hover:border-[#FF8A2A] hover:text-[#FF8A2A] px-6 py-3 rounded transition-all">
                            VIEW DISH
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={nextSlide}
              aria-label="Next dish"
              className="hidden md:flex items-center justify-center w-14 h-14 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-[#FF8A2A]/50 transition-all z-20 flex-shrink-0"
            >
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-8">
            {dishes.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-[#FF8A2A] w-8'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
