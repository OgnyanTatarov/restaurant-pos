'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Review {
  id: string;
  author_name: string;
  author_photo?: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Place ID for Angel Steakhouse (you'll need to get this from Google)
  const PLACE_ID = 'ChIJ...'; // Replace with actual Place ID
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '';

  useEffect(() => {
    // If API key is available, fetch reviews
    if (API_KEY && PLACE_ID && PLACE_ID !== 'ChIJ...') {
      fetchReviews();
    } else {
      // Use sample reviews for now
      setReviews(getSampleReviews());
      setLoading(false);
    }
  }, []);

  const fetchReviews = async () => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=reviews&key=${API_KEY}`
      );
      const data = await response.json();
      
      if (data.result?.reviews) {
        // Filter only 5-star reviews
        const fiveStarReviews = data.result.reviews.filter(
          (review: Review) => review.rating === 5
        );
        setReviews(fiveStarReviews);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      // Fallback to sample reviews
      setReviews(getSampleReviews());
    } finally {
      setLoading(false);
    }
  };

  const getSampleReviews = (): Review[] => {
    return [
      {
        id: '1',
        author_name: 'Sarah Johnson',
        rating: 5,
        text: 'Absolutely exceptional dining experience! The steak was perfectly cooked and the service was outstanding. Highly recommend!',
        time: Date.now(),
        relative_time_description: '2 weeks ago',
      },
      {
        id: '2',
        author_name: 'Michael Chen',
        rating: 5,
        text: 'Best steakhouse in the area! The Wagyu was incredible and the atmosphere is perfect for a special occasion.',
        time: Date.now(),
        relative_time_description: '1 month ago',
      },
      {
        id: '3',
        author_name: 'Emma Williams',
        rating: 5,
        text: 'Outstanding food and service. Every dish was a masterpiece. Will definitely be returning soon!',
        time: Date.now(),
        relative_time_description: '3 weeks ago',
      },
    ];
  };

  if (loading) {
    return (
      <section className="relative py-20 md:py-32 overflow-hidden bg-[#0a0a0a]">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">Loading reviews...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-20 md:py-32 overflow-hidden bg-[#0a0a0a]">
      {/* Background with warm gradients */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(101,67,33,0.15)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="text-xs sm:text-sm tracking-[3px] text-[#FF8A2A] uppercase mb-2">
            TESTIMONIALS
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-wider uppercase text-white mb-4">
            WHAT OUR GUESTS SAY
          </h2>
          <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto">
            Experience the excellence our guests rave about
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="relative rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-6 lg:p-8 hover:border-[#FF8A2A]/50 transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-[#FF8A2A]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Review Text */}
              <p className="text-white text-sm sm:text-base leading-relaxed mb-6">
                "{review.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                {review.author_photo ? (
                  <Image
                    src={review.author_photo}
                    alt={review.author_name}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FF8A2A]/20 flex items-center justify-center">
                    <span className="text-[#FF8A2A] font-bold text-lg">
                      {review.author_name.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold">{review.author_name}</p>
                  <p className="text-gray-400 text-xs sm:text-sm">
                    {review.relative_time_description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


