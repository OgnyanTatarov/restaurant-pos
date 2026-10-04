'use client';

import Link from 'next/link';

export default function Location() {
  const handleGetDirections = () => {
    // Open Google Maps directions to Angel Steakhouse
    const destination = '50.732391173097355,-1.1634409646573682';
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(url, '_blank');
  };
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
          {/* Left Section - Text Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 relative">
                LOCATION
                <div className="absolute bottom-0 left-0 w-24 h-[2px] bg-[#FF8A2A] shadow-[0_0_10px_rgba(255,138,42,0.6)]" />
              </h2>
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mt-6 mb-8 uppercase tracking-wide">
                ANGEL STEAKHOUSE
              </h3>
            </div>

            <div className="space-y-6 text-white">
              <div>
                <p className="text-lg sm:text-xl mb-1">2 Castle St</p>
                <p className="text-lg sm:text-xl">Ryde PO33 2EP</p>
              </div>

              <div className="space-y-2">
                <p className="text-base sm:text-lg">Wed-Thu: 16:00-21:00</p>
                <p className="text-base sm:text-lg">Fri-Sat: 16:00-23:00</p>
                <p className="text-base sm:text-lg">Sun: 16:00-21:00</p>
              </div>

              <div>
                <a 
                  href="tel:+441983303002"
                  className="inline-flex items-center gap-3 text-base sm:text-lg text-white hover:text-[#FF8A2A] transition-colors group"
                >
                  <svg 
                    className="w-6 h-6 group-hover:scale-110 transition-transform" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                    />
                  </svg>
                  <span>01983 303002</span>
                </a>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <button 
                onClick={handleGetDirections}
                className="bg-[#3a2a1a] text-white px-8 py-4 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-[#4a3a2a] hover:shadow-[0_0_20px_rgba(101,67,33,0.4)] transition-all duration-300"
              >
                GET DIRECTIONS
              </button>
              <Link href="/book-a-table" className="bg-[#FF8A2A] text-white px-8 py-4 text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-[#FF9A3A] hover:shadow-[0_0_20px_rgba(255,138,42,0.4)] transition-all duration-300 text-center">
                BOOK A TABLE
              </Link>
            </div>
          </div>

          {/* Right Section - Map */}
          <div className="relative h-[500px] sm:h-[600px] lg:h-[700px]">
            <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-[#FF8A2A]/50 shadow-[0_0_30px_rgba(255,138,42,0.3)]">
              {/* Map Container */}
              <div className="w-full h-full bg-[#1a1a1a] relative">
                {/* Embedded Google Map */}
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3044.8625310224734!2d-1.1634409646573682!3d50.732391173097355!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x48747d7fdfff64b5%3A0xdf8f73f29eb02e53!2sAngel%20Steakhouse!5e1!3m2!1sen!2suk!4v1766427475047!5m2!1sen!2suk"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: 'invert(0.85) hue-rotate(180deg) contrast(1.3) brightness(0.7) saturate(0.8)' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

