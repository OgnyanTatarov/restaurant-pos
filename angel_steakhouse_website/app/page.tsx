import Link from 'next/link';
import SignatureDishesCarousel from './components/SignatureDishesCarousel';
import AboutUs from './components/AboutUs';
import AboutUsSplit from './components/AboutUsSplit';
import MenuCarousel from './components/MenuCarousel';
import Location from './components/Location';
import Reviews from './components/Reviews';
import OrderLink from './components/OrderLink';

export default function Home() {
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
          <a href="#home" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            Home
          </a>
          <a href="#menu" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            Menu
          </a>
          <OrderLink />
          <a href="#about" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            About
          </a>
          <a href="#location" className="text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap">
            Location
          </a>
          <Link href="/book-a-table" className="bg-[#ff8c00] text-black px-4 sm:px-6 md:px-8 py-2 md:py-3 text-xs sm:text-sm font-bold tracking-wide rounded hover:bg-[#ff9500] hover:-translate-y-0.5 transition-all whitespace-nowrap">
            BOOK A TABLE
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main id="home" className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 md:px-16 text-center pt-20 sm:pt-24 md:pt-0 pb-8 md:pb-0">
        <div className="mb-8 sm:mb-12 md:mb-16 max-w-4xl w-full">
          <div className="mb-3 sm:mb-4 md:mb-6 text-[10px] sm:text-xs md:text-sm tracking-[1px] sm:tracking-[2px] md:tracking-[3px] text-[#4a9eff] uppercase px-2 sm:px-0">
            PREMIUM DINING • RYDE, ISLE OF WIGHT
          </div>
          <h1 className="mb-4 sm:mb-6 md:mb-8 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight tracking-wide px-2 sm:px-0">
            <span className="bg-gradient-to-br from-white to-[#ff8c00] bg-clip-text text-transparent">
              TASTE THE FUTURE
            </span>
          </h1>
          <p className="mx-auto mb-8 md:mb-12 max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed text-[#cccccc] px-4 md:px-0">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
          </p>
          {/* Scroll Icon */}
          <div className="flex flex-col items-center gap-2 mt-4">
            <span className="text-xs tracking-[2px] text-[#888] uppercase">Scroll</span>
            <svg 
              className="animate-bounce-scroll w-6 h-6 text-[#888]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
              />
            </svg>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mt-6 sm:mt-8 md:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 w-full sm:w-auto px-4 sm:px-0 max-w-md sm:max-w-none mx-auto sm:mx-0">
          <Link href="/book-a-table" className="bg-[#ff8c00] text-black px-6 sm:px-8 md:px-12 py-3 sm:py-4 md:py-5 text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider rounded hover:bg-[#ff9500] hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(255,140,0,0.3)] transition-all w-full sm:w-auto text-center">
            RESERVE YOUR SPOT
          </Link>
          <a href="#menu" className="bg-[#1a1a1a] text-white border-2 border-[#333] px-6 sm:px-8 md:px-12 py-3 sm:py-4 md:py-5 text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider rounded hover:bg-[#2a2a2a] hover:border-[#ff8c00] hover:-translate-y-1 transition-all w-full sm:w-auto text-center">
            VIEW MENU
          </a>
          <OrderLink prominent />
        </div>
      </main>

      <SignatureDishesCarousel />
      <AboutUsSplit />
      <MenuCarousel />
      <Reviews />
      <Location />
    </div>
  );
}
