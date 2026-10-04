'use client';

import Image from 'next/image';

export default function AboutUs() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden bg-[#0a0a0a]">
      {/* Background with warm reddish-brown gradients */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(101,67,33,0.25)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_70%,rgba(139,69,19,0.2)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(120,53,15,0.15)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-6">
            <div>
              <div className="text-xs sm:text-sm tracking-[3px] text-[#FF8A2A] uppercase mb-3">
                ABOUT US
              </div>
              <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-8 leading-tight">
                ABOUT US
              </h2>
            </div>
            
            <p className="text-base sm:text-lg text-white leading-relaxed max-w-2xl">
              Angel Steakhouse is where modern dining meets timeless craft. From carefully sourced cuts to flame-driven technique, every detail is designed to deliver bold flavour with precision. Set in the heart of Ryde, Isle of Wight, we pair a warm, intimate atmosphere with the energy of a contemporary kitchen—so every visit feels elevated, effortless, and unforgettable.
            </p>

            {/* Stats Boxes */}
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <div className="flex-1 rounded-lg border border-white/20 bg-black/50 backdrop-blur-sm p-6">
                <div className="text-5xl sm:text-6xl font-bold text-white mb-1">10+</div>
                <div className="text-sm sm:text-base text-white uppercase tracking-wide mb-1">
                  YEARS
                </div>
                <div className="text-sm sm:text-base text-white uppercase tracking-wide">
                  EXCELLENCE
                </div>
              </div>
              
              <div className="flex-1 rounded-lg border border-white/20 bg-black/50 backdrop-blur-sm p-6">
                <div className="text-5xl sm:text-6xl font-bold text-white mb-1">45</div>
                <div className="text-sm sm:text-base text-white uppercase tracking-wide mb-1">
                  DAY AGED
                </div>
                <div className="text-sm sm:text-base text-white uppercase tracking-wide">
                  PRIME BEEF
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Image */}
          <div className="relative lg:h-[700px] h-[500px] sm:h-[600px]">
            <div className="relative w-full h-full rounded-lg overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1000&q=90"
                alt="Chef cooking steak on grill with flames"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={95}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              {/* Orange glowing border on top and right */}
              <div className="absolute top-0 right-0 w-full h-full pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#FF8A2A] shadow-[0_0_25px_rgba(255,138,42,0.8)]" />
                <div className="absolute top-0 right-0 bottom-0 w-[3px] bg-[#FF8A2A] shadow-[0_0_25px_rgba(255,138,42,0.8)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
