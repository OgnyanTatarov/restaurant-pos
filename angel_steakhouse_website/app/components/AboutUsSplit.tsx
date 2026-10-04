'use client';

import Image from 'next/image';

export default function AboutUsSplit() {
  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-black via-zinc-900 to-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(101,67,33,0.1)_0%,transparent_60%)]" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8">
            <div>
              <div className="text-xs sm:text-sm tracking-[3px] text-[#FF8A2A] uppercase mb-4">
                ABOUT US
              </div>
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight uppercase tracking-wide">
                Modern Dining, Timeless Craft
              </h2>
            </div>
            
            <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-xl">
              Angel Steakhouse is where modern dining meets timeless craft. From carefully sourced cuts to flame-driven technique, every detail is designed to deliver bold flavour with precision. Set in the heart of Ryde, Isle of Wight, we pair a warm, intimate atmosphere with the energy of a contemporary kitchen.
            </p>

            {/* Stats Cards */}
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="text-4xl sm:text-5xl font-bold text-white mb-1">10+</div>
                <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">
                  Years of Excellence
                </div>
              </div>
              
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="text-4xl sm:text-5xl font-bold text-white mb-1">45</div>
                <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">
                  Day Aged Prime Beef
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button className="mt-8 bg-[#FF8A2A] text-black px-8 py-4 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-[#FF9A3A] hover:shadow-[0_0_20px_rgba(255,138,42,0.4)] transition-all duration-300">
              Our Story
            </button>
          </div>

          {/* Right Column - Image */}
          <div className="relative lg:h-[700px] h-[500px] sm:h-[600px]">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              {/* Outer glow effect */}
              <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-br from-[#FF8A2A]/50 via-[#FF8A2A]/30 to-transparent blur-xl opacity-60" />
              <div className="absolute -inset-[1px] rounded-2xl bg-[#FF8A2A]/40 blur-sm" />
              
              {/* Image container with border */}
              <div className="relative w-full h-full rounded-2xl border-2 border-[#FF8A2A]/60 shadow-[0_0_40px_rgba(255,138,42,0.5),inset_0_0_30px_rgba(255,138,42,0.2)] overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1000&q=90"
                  alt="Chef cooking premium steak over open flame"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  quality={95}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                
                {/* Inner shine effect */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8A2A]/30 blur-3xl pointer-events-none" />
                <div className="absolute top-0 left-0 w-48 h-48 bg-[#FF8A2A]/20 blur-2xl pointer-events-none" />
                
                {/* Subtle reflection shine */}
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/5 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

