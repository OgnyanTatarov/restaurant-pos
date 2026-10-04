import Link from 'next/link';
import OrderLink from '../components/OrderLink';

export default function BookATable() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Background with smoky effects */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,69,0,0.15)_0%,transparent_50%),radial-gradient(circle_at_80%_50%,rgba(0,100,255,0.15)_0%,transparent_50%)] animate-pulse" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 md:px-16 py-4 sm:py-6 md:py-8 bg-[#0a0a0a]/30 backdrop-blur-md gap-3 sm:gap-4 md:gap-0">
        <Link href="/" className="text-lg sm:text-xl md:text-2xl font-bold text-[#ff8c00] tracking-wider text-center sm:text-left">
          ANGEL STEAKHOUSE
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 md:gap-10 flex-wrap justify-center">
          <Link href="/#home" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            Home
          </Link>
          <Link href="/#menu" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            Menu
          </Link>
          <OrderLink />
          <Link href="/#about" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            About
          </Link>
          <Link href="/#location" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            Location
          </Link>
          <Link href="/book-a-table" className="bg-[#ff8c00] text-black px-4 sm:px-6 md:px-8 py-2 md:py-3 text-xs sm:text-sm font-bold tracking-wide rounded hover:bg-[#ff9500] hover:-translate-y-0.5 transition-all whitespace-nowrap">
            BOOK A TABLE
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 md:px-16 text-center pt-20 sm:pt-24 md:pt-0 pb-8 md:pb-0">
        <div className="max-w-3xl w-full space-y-8">
          <div className="mb-8">
            <div className="text-xs sm:text-sm tracking-[3px] text-[#FF8A2A] uppercase mb-4">
              RESERVATIONS
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight tracking-wide mb-6">
              <span className="bg-gradient-to-br from-white to-[#ff8c00] bg-clip-text text-transparent">
                BOOK A TABLE
              </span>
            </h1>
          </div>

          <div className="space-y-6 text-white">
            <p className="text-lg sm:text-xl md:text-2xl leading-relaxed text-gray-300">
              To make a reservation, please give us a call
            </p>

            <div className="flex flex-col items-center gap-6 mt-12">
              {/* Phone Number with Icon */}
              <a 
                href="tel:+441983303002"
                className="inline-flex items-center gap-4 text-2xl sm:text-3xl md:text-4xl font-bold text-white hover:text-[#FF8A2A] transition-all group"
              >
                <svg 
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 group-hover:scale-110 transition-transform" 
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

              <div className="text-sm sm:text-base text-gray-400 mt-4">
                Click the number to call us directly
              </div>
            </div>

            {/* Opening Hours */}
            <div className="mt-16 p-8 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm">
              <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-wide mb-6">
                Opening Hours
              </h2>
              <div className="space-y-3 text-left max-w-md mx-auto">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Wednesday - Thursday</span>
                  <span className="text-white font-semibold">16:00 - 21:00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Friday - Saturday</span>
                  <span className="text-white font-semibold">16:00 - 23:00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Sunday</span>
                  <span className="text-white font-semibold">16:00 - 21:00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Monday - Tuesday</span>
                  <span className="text-gray-500">Closed</span>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <div className="mt-12">
              <Link 
                href="/"
                className="inline-flex items-center gap-2 text-white border-2 border-white/30 hover:border-[#ff8c00] hover:text-[#ff8c00] px-8 py-4 text-sm font-bold uppercase tracking-wider rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

