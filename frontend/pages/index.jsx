import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import Chatbot from '../components/chatbot/Chatbot';
import ScrollFloat from '../components/ui/ScrollFloat';
import AnimatedCardGrid from '../components/ui/AnimatedCardGrid';
import AnimatedText from '../components/ui/AnimatedText';
import AnimatedList from '../components/ui/AnimatedList';
import { pricingAPI, reviewAPI } from '../lib/api';
import { TEMPLATES } from '../lib/invoiceTemplates';
import { 
  FiBarChart2, FiFileText, FiDollarSign, FiTrendingUp, 
  FiBriefcase, FiTarget, FiCheck, FiZap, FiSmartphone, 
  FiAward, FiMail, FiPhone, FiMapPin, FiArrowRight,
  FiShield, FiUsers, FiStar, FiPackage, FiRefreshCw,
  FiShare2, FiPrinter, FiDownload, FiLayers, FiSettings, FiUpload,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import Image from 'next/image';

export default function LandingPage() {
  const [clientRegisterUrl, setClientRegisterUrl] = useState('');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  useEffect(() => {
    // Set client register URL only on client side
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
      
      if (isLocalhost) {
        setClientRegisterUrl('http://client.localhost:3001/register');
      } else {
        // In production, always use https and detect domain from current hostname
        const mainDomain = hostname.replace(/^(www|admin|client)\./, '');
        setClientRegisterUrl(`https://client.${mainDomain}/register`);
      }
    }
  }, []);

  useEffect(() => {
    // Fetch pricing plans from API
    const fetchPlans = async () => {
      // Skip during build time
      if (typeof window === 'undefined') return;
      
      try {
        setLoading(true);
        const response = await pricingAPI.list({ 
          is_active: 'true', 
          is_visible: 'true',
          limit: 10 
        });
        if (response.data && response.data.data) {
          setPlans(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
        // Keep empty array on error, will show fallback
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const response = await reviewAPI.getPublic({ limit: 6, featured_only: 'false' });
      if (response.data && response.data.data) {
        setReviews(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      // Keep empty array on error, will show fallback
    } finally {
      setReviewsLoading(false);
    }
  };
  
  const getClientRegisterUrl = () => {
    return clientRegisterUrl || 'https://client.fintranzact.com/register';
  };

  const formatPrice = (price, currency = 'INR') => {
    if (!price && price !== 0) return 'Custom';
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(price);
  };

  const getPlanIcon = (planName) => {
    const name = planName?.toLowerCase() || '';
    if (name.includes('starter') || name.includes('basic')) return FiZap;
    if (name.includes('professional') || name.includes('pro') || name.includes('business')) return FiBriefcase;
    if (name.includes('enterprise') || name.includes('premium')) return FiAward;
    return FiBriefcase;
  };

  useEffect(() => {
    // Smooth scroll for anchor links
    const handleAnchorClick = (e) => {
      const href = e.target.getAttribute('href') || e.target.closest('a')?.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', handleAnchorClick);
    });

    return () => {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.removeEventListener('click', handleAnchorClick);
      });
    };
  }, []);

  const nextSlide = () => {
    const maxSlides = Math.max(0, TEMPLATES.length - 4);
    setCurrentSlide(prev => prev >= maxSlides ? maxSlides : prev + 1);
  };

  const prevSlide = () => {
    setCurrentSlide(prev => prev <= 0 ? 0 : prev - 1);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <>
      <Head>
        <title>Fintranzact - Your Trustable Accounting Partner | Complete Accounting Software</title>
        <meta name="description" content="Complete accounting software for businesses with GST filing, e-invoicing, and comprehensive financial management" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-100 pt-36 pb-14 overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 left-0 w-96 h-96 bg-primary-600 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-800 rounded-full blur-3xl"></div>
              </div>
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-5xl mx-auto text-center">
              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md">
                  <FiShield className="text-green-600" />
                  <span className="text-sm font-semibold text-gray-700">100% Safe & Secure</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md">
                  <FiUsers className="text-primary-600" />
                  <span className="text-sm font-semibold text-gray-700">Trusted by 10,000+ Businesses</span>
                </div>
              </div>
              
              {/* Simple Accounting Tagline */}
              <div className="mb-4">
                <span className="inline-block bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold">
                  Simple Accounting
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
                Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-800">GST Invoices</span> for<br /><span className="block mt-4">free in 10 seconds ⚡</span>
              </h1>
              <AnimatedText className="text-[1.2rem] text-gray-600 mb-4 max-w-3xl mx-auto leading-relaxed">
                Customize templates, share bills on WhatsApp, collect payments!
              </AnimatedText>
              <AnimatedText className="text-base text-gray-500 mb-8 max-w-2xl mx-auto">
                Fast, Simple, Compliant • No training needed
              </AnimatedText>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <a
                  href={getClientRegisterUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-primary-600 text-white px-6 py-2.5 rounded-xl text-lg font-normal hover:bg-primary-700 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center gap-2"
                >
                  Sign up for free
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="#features"
                  className="bg-white text-primary-600 px-6 py-2.5 rounded-xl text-lg font-normal hover:bg-gray-50 transition-all shadow-xl border-2 border-primary-600 hover:border-primary-700"
                >
                  Learn More
                </a>
              </div>

              {/* Download App Section - Desktop App Available */}
              <div className="mt-8">
                <p className="text-sm text-gray-600 mb-3">Download Desktop App</p>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="#"
                    className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition text-sm font-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 4h8v4h-8v-4z"/>
                    </svg>
                    Windows
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition text-sm font-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    macOS
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="text-center mb-16">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-4"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Powerful Features
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-2xl mx-auto">
                Everything you need to manage your accounting and compliance in one place
              </p>
            </div>
            <AnimatedCardGrid
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
              stagger={0.08}
              ease="power3.out"
            >
              <div className="group bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200">
                <div className="w-14 h-14 bg-primary-600 rounded-lg flex items-center justify-center mb-5">
                  <FiBarChart2 className="text-white text-xl" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">GST Filing</h3>
                <AnimatedText className="text-base text-gray-600 leading-relaxed">
                  Automated GST return filing with GSTR-1 and GSTR-3B support. Stay compliant with ease and save time.
                </AnimatedText>
              </div>

              <div className="group bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200">
                <div className="w-14 h-14 bg-primary-600 rounded-lg flex items-center justify-center mb-5">
                  <FiFileText className="text-white text-xl" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">E-Invoicing</h3>
                <AnimatedText className="text-base text-gray-600 leading-relaxed">
                  Generate and manage e-invoices with IRN and QR code generation. Fully compliant with government regulations.
                </AnimatedText>
              </div>

              <div className="group bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200">
                <div className="w-14 h-14 bg-primary-600 rounded-lg flex items-center justify-center mb-5">
                  <FiDollarSign className="text-white text-xl" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">Complete Accounting</h3>
                <AnimatedText className="text-base text-gray-600 leading-relaxed">
                  Full accounting with ledgers, vouchers, and financial reports. Manage all your transactions efficiently.
                </AnimatedText>
              </div>

              <div className="group bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200">
                <div className="w-14 h-14 bg-primary-600 rounded-lg flex items-center justify-center mb-5">
                  <FiTrendingUp className="text-white text-xl" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">Financial Reports</h3>
                <AnimatedText className="text-base text-gray-600 leading-relaxed">
                  Balance sheet, P&L, trial balance, and custom reports. Get insights into your business performance.
                </AnimatedText>
              </div>

              <div className="group bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200">
                <div className="w-14 h-14 bg-primary-600 rounded-lg flex items-center justify-center mb-5">
                  <FiUsers className="text-white text-xl" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">User Management</h3>
                <AnimatedText className="text-base text-gray-600 leading-relaxed">
                  Manage multiple users with role-based access control. Secure and organized user management for your team.
                </AnimatedText>
              </div>

              <div className="group bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200">
                <div className="w-14 h-14 bg-primary-600 rounded-lg flex items-center justify-center mb-5">
                  <FiTarget className="text-white text-xl" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">Referral System</h3>
                <AnimatedText className="text-base text-gray-600 leading-relaxed">
                  Earn commissions through our distributor and salesman network. Grow your business with referrals.
                </AnimatedText>
              </div>
            </AnimatedCardGrid>
          </div>
        </section>

        {/* Invoice Templates Showcase Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Awesome Templates
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Tailor made, professional, and hand crafted templates for your business to stand out.
              </p>
            </div>
            
            {/* Desktop Slider */}
            <div className="hidden lg:block max-w-7xl mx-auto relative">
              {/* Navigation Arrows */}
              {TEMPLATES.length > 4 && (
                <>
                  <button
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                    className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all group ${
                      currentSlide === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-50 hover:border-primary-200'
                    }`}
                  >
                    <FiChevronLeft className={`text-xl ${currentSlide === 0 ? 'text-gray-400' : 'text-gray-600 group-hover:text-primary-600'}`} />
                  </button>
                  <button
                    onClick={nextSlide}
                    disabled={currentSlide >= TEMPLATES.length - 4}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all group ${
                      currentSlide >= TEMPLATES.length - 4 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-50 hover:border-primary-200'
                    }`}
                  >
                    <FiChevronRight className={`text-xl ${currentSlide >= TEMPLATES.length - 4 ? 'text-gray-400' : 'text-gray-600 group-hover:text-primary-600'}`} />
                  </button>
                </>
              )}
              
              {/* Slider Container */}
              <div className="overflow-hidden">
                <div 
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ 
                    transform: `translateX(-${currentSlide * 25}%)`,
                  }}
                >
                  {TEMPLATES.map((template, index) => (
                    <div key={template.id} className="w-1/4 px-2.5 flex-shrink-0">
                      <div className="group bg-gradient-to-br from-primary-50 to-white p-5 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200 cursor-pointer h-full">
                        <div className="aspect-[3/4] bg-white rounded-lg mb-3 flex items-center justify-center border border-gray-200 overflow-hidden relative">
                          {template.previewImage ? (
                            <Image
                              src={template.previewImage}
                              alt={template.name}
                              fill
                              className="object-contain"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                            />
                          ) : (
                            <FiFileText className="text-4xl text-primary-200" />
                          )}
                        </div>
                        <h3 className="text-base font-bold text-gray-900 text-center">{template.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Dots Indicator */}
              {TEMPLATES.length > 4 && (
                <div className="flex justify-center mt-8 space-x-2">
                  {Array.from({ length: Math.max(0, TEMPLATES.length - 4) + 1 }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        currentSlide === index 
                          ? 'bg-primary-600 w-8' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Mobile/Tablet Grid */}
            <div className="lg:hidden">
              <AnimatedCardGrid
                className="grid md:grid-cols-2 gap-5 max-w-7xl mx-auto"
                stagger={0.08}
                ease="power3.out"
              >
                {TEMPLATES.map((template) => (
                  <div key={template.id} className="group bg-gradient-to-br from-primary-50 to-white p-5 rounded-xl shadow-sm hover:shadow-md transition-all border border-primary-100 hover:border-primary-200 cursor-pointer">
                    <div className="aspect-[3/4] bg-white rounded-lg mb-3 flex items-center justify-center border border-gray-200 overflow-hidden relative">
                      {template.previewImage ? (
                        <Image
                          src={template.previewImage}
                          alt={template.name}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        />
                      ) : (
                        <FiFileText className="text-4xl text-primary-200" />
                      )}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 text-center">{template.name}</h3>
                  </div>
                ))}
              </AnimatedCardGrid>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-24 bg-gradient-to-br from-primary-50 via-white to-primary-100">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Perfect for Your Business
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Quick invoicing for retailers, distributors, startups, freelancers, and service providers
              </p>
            </div>
            <AnimatedCardGrid
              className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto"
              stagger={0.08}
              ease="power3.out"
            >
              {[
                { name: 'Retailers', icon: FiPackage, desc: 'Point of sale billing and inventory management' },
                { name: 'Distributors', icon: FiLayers, desc: 'Wholesale pricing and stock management' },
                { name: 'Startups', icon: FiZap, desc: 'Simple accounting for growing businesses' },
                { name: 'Freelancers', icon: FiBriefcase, desc: 'Professional invoicing made easy' },
                { name: 'Service Providers', icon: FiSettings, desc: 'Service billing and client management' },
              ].map((useCase) => {
                const Icon = useCase.icon;
                return (
                  <div key={useCase.name} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-primary-300 text-center">
                    <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="text-primary-600 text-2xl" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{useCase.name}</h3>
                    <AnimatedText className="text-gray-600 text-sm">{useCase.desc}</AnimatedText>
                  </div>
                );
              })}
            </AnimatedCardGrid>
            <div className="text-center mt-12">
              <Link
                href="/use-cases"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold text-lg"
              >
                Explore All Use Cases
                <FiArrowRight />
              </Link>
            </div>
          </div>
        </section>

        {/* Key Features Highlight Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-7xl mx-auto">
              {/* Inventory Management */}
              <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
                <div>
                  <ScrollFloat
                    animationDuration={1}
                    ease='back.inOut(2)'
                    scrollStart='center bottom+=50%'
                    scrollEnd='bottom bottom-=40%'
                    stagger={0.03}
                    containerClassName="mb-6"
                    textClassName="text-3xl md:text-4xl font-medium text-gray-900"
                  >
                    Inventory so simple, it feels like magic
                  </ScrollFloat>
                  <AnimatedText className="text-gray-600 mb-6 leading-relaxed" delay={0.1}>
                    Add items, track stock, and manage everything in seconds. No training needed. It&apos;s that easy.
                  </AnimatedText>
                  <AnimatedList className="space-y-3" stagger={0.1}>
                    {['Stock In and Stock Out tracking', 'Live inventory status', 'Bulk import from Excel', 'Better sales statistics', 'Maximize profits'].map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <FiCheck className="text-primary-600 text-xl mt-1 flex-shrink-0" />
                        <span className="text-gray-700 text-lg">{feature}</span>
                      </li>
                    ))}
                  </AnimatedList>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-white aspect-square rounded-2xl shadow-xl border border-primary-100 flex items-center justify-center">
                  <div className="w-32 h-32 bg-primary-100 rounded-xl flex items-center justify-center">
                    <FiPackage className="text-5xl text-primary-600" />
                  </div>
                </div>
              </div>

              {/* Payment Tracking */}
              <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
                <div className="order-2 md:order-1 bg-gradient-to-br from-primary-50 to-white aspect-square rounded-2xl shadow-xl border border-primary-100 flex items-center justify-center">
                  <div className="w-32 h-32 bg-primary-100 rounded-xl flex items-center justify-center">
                    <FiDollarSign className="text-5xl text-primary-600" />
                  </div>
                </div>
                <div className="order-1 md:order-2">
                  <ScrollFloat
                    animationDuration={1}
                    ease='back.inOut(2)'
                    scrollStart='center bottom+=50%'
                    scrollEnd='bottom bottom-=40%'
                    stagger={0.03}
                    containerClassName="mb-6"
                    textClassName="text-3xl md:text-4xl font-medium text-gray-900"
                  >
                    Record payments effortlessly
                  </ScrollFloat>
                  <AnimatedText className="text-gray-600 mb-6 leading-relaxed" delay={0.1}>
                    Track every payment, every time — without lifting a finger. While others make it complicated, we make it simple.
                  </AnimatedText>
                  <AnimatedList className="space-y-3" stagger={0.1}>
                    {['Automatic payment tracking', 'Payment reminders', 'Outstanding reports', 'Payment history', 'Multiple payment methods'].map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <FiCheck className="text-primary-600 text-xl mt-1 flex-shrink-0" />
                        <span className="text-gray-700 text-lg">{feature}</span>
                      </li>
                    ))}
                  </AnimatedList>
                </div>
              </div>

              {/* WhatsApp/Email Sharing */}
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <ScrollFloat
                    animationDuration={1}
                    ease='back.inOut(2)'
                    scrollStart='center bottom+=50%'
                    scrollEnd='bottom bottom-=40%'
                    stagger={0.03}
                    containerClassName="mb-6"
                    textClassName="text-3xl md:text-4xl font-medium text-gray-900"
                  >
                    Share anywhere. Get paid faster.
                  </ScrollFloat>
                  <AnimatedText className="text-gray-600 mb-6 leading-relaxed" delay={0.1}>
                    Send invoices instantly via WhatsApp, email, or SMS. And with smart auto-reminders, you don&apos;t have to chase anyone.
                  </AnimatedText>
                  <AnimatedList className="space-y-3" stagger={0.1}>
                    {['WhatsApp sharing', 'Email delivery', 'SMS notifications', 'Auto-reminders', 'Payment tracking'].map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <FiCheck className="text-primary-600 text-xl mt-1 flex-shrink-0" />
                        <span className="text-gray-700 text-lg">{feature}</span>
                      </li>
                    ))}
                  </AnimatedList>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-white aspect-square rounded-2xl shadow-xl border border-primary-100 flex items-center justify-center">
                  <div className="w-32 h-32 bg-primary-100 rounded-xl flex items-center justify-center">
                    <FiShare2 className="text-5xl text-primary-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* E-way Bill Section */}
        <section className="py-24 bg-gradient-to-br from-primary-50 via-white to-primary-100">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto text-center">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                E-way Bills
              </ScrollFloat>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                Create in seconds, anywhere
              </h3>
              <p className="text-base text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                Generate e-way bills <strong>instantly from your phone</strong> — no delays, no errors. <strong>AI-filled and portal-ready</strong>, even when you&apos;re on the move.
              </p>
              <a
                href={getClientRegisterUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2 rounded-xl text-lg font-normal hover:bg-primary-700 transition shadow-lg"
              >
                Try for Free
                <FiArrowRight />
              </a>
            </div>
          </div>
        </section>

        {/* Mind-blowing Convenience Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Mind-blowing convenience
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Fintranzact is built to make your life easier. We&apos;re always doing things for you to experience ultimate convenience.
              </p>
            </div>
            <AnimatedCardGrid
              className="grid md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-7xl mx-auto"
              stagger={0.08}
              ease="power3.out"
            >
              {[
                { name: 'E-way Bills', icon: FiFileText },
                { name: 'E-invoices', icon: FiFileText },
                { name: 'Custom Columns & Headers', icon: FiSettings },
                { name: 'GSTR JSON', icon: FiDownload },
                { name: 'Advanced GST Reports', icon: FiBarChart2 },
                { name: 'Bulk Uploads', icon: FiUpload },
                { name: 'Export Invoices', icon: FiDownload },
                { name: 'Tally Sync', icon: FiRefreshCw },
                { name: 'Manage Batches & Expiry', icon: FiPackage },
                { name: 'Print Options', icon: FiPrinter },
                { name: 'WhatsApp Sharing', icon: FiShare2 },
                { name: 'Auto Reminders', icon: FiRefreshCw },
              ].map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.name} className="bg-gradient-to-br from-primary-50 to-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all border border-primary-100 hover:border-primary-300 text-center">
                    <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Icon className="text-white text-xl" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-900">{feature.name}</h4>
                  </div>
                );
              })}
            </AnimatedCardGrid>
          </div>
        </section>

        {/* Security Section */}
        <section className="py-24 bg-gradient-to-br from-primary-50 via-white 
        to-primary-100">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-6xl mx-auto text-center">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-5"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Invisible security. Unbreakable trust.
              </ScrollFloat>
              <p className="text-[1.2rem] text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
                Your data stays private. Always encrypted.
              </p>
              <AnimatedCardGrid
                className="grid md:grid-cols-3 gap-8"
                stagger={0.08}
                ease="power3.out"
              >
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
                  <div className="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center mx-auto mb-5">
                    <FiShield className="text-2xl text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Bank-Level Security</h3>
                  <AnimatedText className="text-base text-gray-600">256-bit encryption</AnimatedText>
                </div>
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
                  <div className="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center mx-auto mb-5">
                    <FiRefreshCw className="text-2xl text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Auto Backup</h3>
                  <AnimatedText className="text-base text-gray-600">Daily automated backups</AnimatedText>
                </div>
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
                  <div className="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center mx-auto mb-5">
                    <FiShield className="text-2xl text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Compliance</h3>
                  <AnimatedText className="text-base text-gray-600">GDPR & Data Protection</AnimatedText>
                </div>
              </AnimatedCardGrid>
            </div>
          </div>
        </section>

        {/* Partnerships Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="text-center mb-12">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-5"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Our app is integrated with
              </ScrollFloat>
            </div>
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-5 max-w-7xl mx-auto items-center">
              {[
                { name: 'Tally', image: '/tally.png' },
                { name: 'Sandbox API', image: '/sanbox.png' },
                { name: 'FinBox', image: '/finbox.png' },
                { name: 'GST Portal', image: '/GST.PNG' },
                { name: 'E-Invoice Portal', image: null },
                { name: 'E-Way Bill Portal', image: null }
              ].map((partner) => (
                <div key={partner.name} className="bg-white p-5 rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-sm transition text-center">
                  <div className="h-16 flex items-center justify-center">
                    {partner.image ? (
                      <Image
                        src={partner.image}
                        alt={partner.name}
                        width={200}
                        height={80}
                        className="max-w-full w-auto object-contain"
                        style={{ maxHeight: '6rem', minHeight: '100px' }}
                      />
                    ) : (
                      <span className="text-base font-medium text-gray-600">{partner.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-24 bg-gradient-to-br from-primary-50 via-white to-primary-100">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Our Services
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Comprehensive accounting solutions tailored for your business needs
              </p>
            </div>
            <AnimatedCardGrid
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto"
              stagger={0.08}
              ease="power3.out"
            >
              <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-primary-300">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <FiFileText className="text-primary-600 text-xl" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Bookkeeping</h4>
                <AnimatedText className="text-gray-600">Maintain accurate financial records</AnimatedText>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-primary-300">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <FiShield className="text-primary-600 text-xl" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Tax Compliance</h4>
                <AnimatedText className="text-gray-600">Stay compliant with tax regulations</AnimatedText>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-primary-300">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <FiTrendingUp className="text-primary-600 text-xl" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Financial Analysis</h4>
                <AnimatedText className="text-gray-600">Get insights into your business</AnimatedText>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-primary-300">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <FiCheck className="text-primary-600 text-xl" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Audit Support</h4>
                <AnimatedText className="text-gray-600">Prepare for audits with confidence</AnimatedText>
              </div>
            </AnimatedCardGrid>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-5"
                  textClassName="text-3xl md:text-4xl font-medium text-gray-900"
                >
                  Why Choose Fintranzact?
                </ScrollFloat>
                <AnimatedText className="text-base text-gray-600 max-w-3xl mx-auto">
                  Trusted by businesses for reliable accounting solutions
                </AnimatedText>
              </div>
              <AnimatedCardGrid
                className="grid md:grid-cols-2 gap-6"
                stagger={0.08}
                ease="power3.out"
              >
                <div className="flex items-start gap-5 p-6 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/50 transition">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-primary-50 rounded-lg flex items-center justify-center">
                      <FiShield className="text-primary-600 text-xl" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Secure & Reliable</h3>
                    <AnimatedText className="text-base text-gray-600 leading-relaxed">Your data is encrypted and secure. We follow industry best practices for data protection and compliance.</AnimatedText>
                  </div>
                </div>
                <div className="flex items-start gap-5 p-6 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/50 transition">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-primary-50 rounded-lg flex items-center justify-center">
                      <FiZap className="text-primary-600 text-xl" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Fast & Efficient</h3>
                    <AnimatedText className="text-base text-gray-600 leading-relaxed">Automate repetitive tasks and save time. Focus on growing your business instead of managing paperwork.</AnimatedText>
                  </div>
                </div>
                <div className="flex items-start gap-5 p-6 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/50 transition">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-primary-50 rounded-lg flex items-center justify-center">
                      <FiSmartphone className="text-primary-600 text-xl" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Easy to Use</h3>
                    <AnimatedText className="text-base text-gray-600 leading-relaxed">Intuitive interface designed for users of all technical levels. No training required.</AnimatedText>
                  </div>
                </div>
                <div className="flex items-start gap-5 p-6 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/50 transition">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-primary-50 rounded-lg flex items-center justify-center">
                      <FiAward className="text-primary-600 text-xl" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Comprehensive</h3>
                    <AnimatedText className="text-base text-gray-600 leading-relaxed">All-in-one solution for accounting, GST, invoicing, and reporting. Everything you need in one platform.</AnimatedText>
                  </div>
                </div>
              </AnimatedCardGrid>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="text-center mb-16">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-5"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                How It Works
              </ScrollFloat>
              <AnimatedText className="text-base text-gray-600 max-w-3xl mx-auto">
                Get started in minutes with our simple process
              </AnimatedText>
            </div>
            <div className="max-w-5xl mx-auto">
              <AnimatedCardGrid
                className="grid md:grid-cols-3 gap-8"
                stagger={0.08}
                ease="power3.out"
              >
                <div className="text-center">
                  <div className="w-20 h-20 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-5">
                    <span className="text-primary-600 text-3xl font-bold">1</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Sign Up</h3>
                  <AnimatedText className="text-[1.2rem] text-gray-600 leading-relaxed">Create your account in seconds. No credit card required for free trial.</AnimatedText>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-5">
                    <span className="text-primary-600 text-3xl font-bold">2</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Setup Your Business</h3>
                  <AnimatedText className="text-[1.2rem] text-gray-600 leading-relaxed">Add your company details and configure your preferences in minutes.</AnimatedText>
                </div>
                <div className="text-center">
                  <div className="w-20 h-20 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-5">
                    <span className="text-primary-600 text-3xl font-bold">3</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Start Managing</h3>
                  <AnimatedText className="text-[1.2rem] text-gray-600 leading-relaxed">Begin managing your accounts, invoices, and compliance right away.</AnimatedText>
                </div>
              </AnimatedCardGrid>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                What Our Clients Say
              </ScrollFloat>
              <AnimatedText className="text-base text-gray-600 max-w-3xl mx-auto">
                Trusted by businesses across industries
              </AnimatedText>
            </div>
            {reviewsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                <AnimatedText className="mt-4 text-gray-600">Loading reviews...</AnimatedText>
              </div>
            ) : reviews.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className={`bg-gradient-to-br from-primary-50 to-white p-10 rounded-2xl border border-primary-100 shadow-lg ${
                      review.is_featured ? 'ring-2 ring-primary-300' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <FiStar
                            key={i}
                            className={`h-5 w-5 ${
                              i < review.rating
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      {review.is_featured && (
                        <span className="text-xs font-semibold text-primary-600 bg-primary-100 px-2 py-1 rounded">
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="text-primary-600 text-5xl mb-6 font-serif">&quot;</div>
                    {review.title && (
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        {review.title}
                      </h4>
                    )}
                    <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                      {review.comment || 'Thank you for using Fintranzact!'}
                    </p>
                    <div className="font-bold text-gray-900 text-lg">
                      {review.reviewer_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {review.reviewer_designation && `${review.reviewer_designation}, `}
                      {review.reviewer_company || review.tenant?.company_name || ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <AnimatedCardGrid
              className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto"
              stagger={0.08}
              ease="power3.out"
            >
                {/* Fallback testimonials if no reviews available */}
              <div className="bg-gradient-to-br from-primary-50 to-white p-10 rounded-2xl border border-primary-100 shadow-lg">
                <div className="text-primary-600 text-5xl mb-6 font-serif">&quot;</div>
                <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                  Fintranzact has transformed how we manage our accounting. The GST filing feature alone saves us hours every month.
                </p>
                <div className="font-bold text-gray-900 text-lg">Rajesh Kumar</div>
                <div className="text-sm text-gray-600">CEO, Tech Solutions Pvt Ltd</div>
              </div>
              <div className="bg-gradient-to-br from-primary-50 to-white p-10 rounded-2xl border border-primary-100 shadow-lg">
                <div className="text-primary-600 text-5xl mb-6 font-serif">&quot;</div>
                <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                  The e-invoicing feature is a game-changer. We can generate compliant invoices in seconds.
                </p>
                <div className="font-bold text-gray-900 text-lg">Priya Sharma</div>
                <div className="text-sm text-gray-600">Finance Manager, Retail Corp</div>
              </div>
              <div className="bg-gradient-to-br from-primary-50 to-white p-10 rounded-2xl border border-primary-100 shadow-lg">
                <div className="text-primary-600 text-5xl mb-6 font-serif">&quot;</div>
                <p className="text-gray-700 mb-6 italic text-lg leading-relaxed">
                  Excellent support and easy to use. Our accounting firm uses Fintranzact for all our clients.
                </p>
                <div className="font-bold text-gray-900 text-lg">Amit Patel</div>
                <div className="text-sm text-gray-600">Partner, ABC Accounting Services</div>
              </div>
            </AnimatedCardGrid>
            )}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-white">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="text-center mb-8">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-5"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Simple, Transparent Pricing
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Choose the plan that fits your business needs
              </p>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                <p className="mt-4 text-gray-600">Loading pricing plans...</p>
              </div>
            ) : plans.length > 0 ? (
              (() => {
                const popularPlan = plans.find(plan => plan.is_featured);
                const otherPlans = plans.filter(plan => !plan.is_featured);
                const renderPlanCard = (plan, index, isPopular = false, customClasses = '') => {
                  const Icon = getPlanIcon(plan.plan_name);
                  const originalPrice = plan.base_price;
                  const discountedPrice = plan.discounted_price;
                  const price = discountedPrice || originalPrice;
                  const features = plan.features && typeof plan.features === 'object' 
                    ? (Array.isArray(plan.features) ? plan.features : Object.values(plan.features))
                    : [];
                  const billingPeriod = plan.billing_cycle === 'yearly' ? '/year' : plan.billing_cycle === 'monthly' ? '/month' : '';
                  const hasCustomPrice = !price && price !== 0;
                  const hasDiscount = discountedPrice && discountedPrice < originalPrice;
                  
                  return (
                    <div
                      key={plan.id || index}
                      className={`relative ${
                        isPopular
                          ? 'bg-primary-600 p-8 rounded-xl border-2 border-primary-500'
                          : 'bg-white p-8 rounded-xl border border-gray-200 hover:border-primary-200'
                      } transition ${customClasses}`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                          <span className="bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                            MOST POPULAR
                          </span>
                        </div>
                      )}
                      
                      {/* Plan Header */}
                      <div className="text-center mb-6">
                        <div className={`w-14 h-14 ${isPopular ? 'bg-white' : 'bg-primary-50'} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                          <Icon className={`${isPopular ? 'text-primary-600' : 'text-primary-600'} text-xl`} />
                        </div>
                        <h3 className={`text-xl font-bold mb-2 ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                          {plan.plan_name}
                        </h3>
                        {plan.description && (
                          <p className={`text-sm mb-4 ${isPopular ? 'text-primary-100' : 'text-gray-600'}`}>
                            {plan.description}
                          </p>
                        )}
                      </div>

                      {/* Pricing */}
                      <div className="mb-6 text-center">
                        {hasDiscount && (
                          <div className="mb-2">
                            <span className={`text-base line-through ${isPopular ? 'text-primary-200' : 'text-gray-400'}`}>
                              {formatPrice(originalPrice, plan.currency)}
                            </span>
                            <span className={`ml-2 text-xs font-medium ${isPopular ? 'text-primary-700 bg-white' : 'text-green-600 bg-green-50'} px-2 py-0.5 rounded`}>
                              Save {formatPrice(originalPrice - discountedPrice, plan.currency)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className={`text-3xl font-bold ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                            {formatPrice(price, plan.currency)}
                          </span>
                          {billingPeriod && (
                            <span className={`text-sm ml-2 ${isPopular ? 'text-primary-200' : 'text-gray-600'}`}>
                              {billingPeriod}
                            </span>
                          )}
                        </div>
                        {plan.trial_days > 0 && (
                          <p className={`text-xs mt-2 ${isPopular ? 'text-primary-100' : 'text-gray-500'}`}>
                            {plan.trial_days} days free trial
                          </p>
                        )}
                      </div>

                      {/* Plan Limits */}
                      <div className={`mb-6 p-4 rounded-lg ${isPopular ? 'bg-primary-500/20' : 'bg-gray-50'}`}>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className={`font-medium ${isPopular ? 'text-primary-200' : 'text-gray-600'}`}>Users:</span>
                            <span className={`ml-2 ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                              {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
                            </span>
                          </div>
                          <div>
                            <span className={`font-medium ${isPopular ? 'text-primary-200' : 'text-gray-600'}`}>Invoices:</span>
                            <span className={`ml-2 ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                              {plan.max_invoices_per_month === -1 ? 'Unlimited' : plan.max_invoices_per_month}/mo
                            </span>
                          </div>
                          {plan.max_companies && (
                            <div>
                              <span className={`font-medium ${isPopular ? 'text-primary-200' : 'text-gray-600'}`}>Companies:</span>
                              <span className={`ml-2 ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                                {plan.max_companies === -1 ? 'Unlimited' : plan.max_companies}
                              </span>
                            </div>
                          )}
                          {plan.storage_limit_gb && (
                            <div>
                              <span className={`font-medium ${isPopular ? 'text-primary-200' : 'text-gray-600'}`}>Storage:</span>
                              <span className={`ml-2 ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                                {plan.storage_limit_gb === -1 ? 'Unlimited' : `${plan.storage_limit_gb} GB`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Features */}
                      {features.length > 0 && (
                        <div className="mb-6">
                          <h4 className={`text-xs font-medium uppercase tracking-wide mb-3 ${isPopular ? 'text-primary-200' : 'text-gray-500'}`}>
                            Features Included
                          </h4>
                          <ul className="space-y-2 max-h-64 overflow-y-auto">
                            {features.map((feature, featureIndex) => (
                              <li key={featureIndex} className={`flex items-start text-sm ${isPopular ? 'text-white' : 'text-gray-700'}`}>
                                <FiCheck className={`mr-2 mt-0.5 flex-shrink-0 ${isPopular ? 'text-primary-200' : 'text-primary-600'}`} />
                                <span>{typeof feature === 'string' ? feature : feature.name || feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* CTA Button */}
                      <a
                        href={!hasCustomPrice ? getClientRegisterUrl() : '#contact'}
                        target={!hasCustomPrice ? '_blank' : undefined}
                        rel={!hasCustomPrice ? 'noopener noreferrer' : undefined}
                        className={`block w-full text-center py-3 rounded-lg hover:opacity-90 transition font-normal text-base ${
                          isPopular
                            ? 'bg-white text-primary-600 hover:bg-gray-50'
                            : !hasCustomPrice
                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {!hasCustomPrice ? 'Get Started' : 'Contact Sales'}
                      </a>
                    </div>
                  );
                };

                return (
                  <div className="max-w-6xl mx-auto">
                    {/* Top Row: Left, Popular (Center), Right */}
                    <div className="grid md:grid-cols-3 gap-6">
                      {otherPlans.length > 0 && (
                        <div>
                          {renderPlanCard(otherPlans[0], 0)}
                        </div>
                      )}
                      {popularPlan && (
                        <div>
                          {renderPlanCard(popularPlan, 'popular', true)}
                        </div>
                      )}
                      {otherPlans.length > 1 && (
                        <div>
                          {renderPlanCard(otherPlans[1], 1)}
                        </div>
                      )}
                    </div>
                    {/* Bottom Row: Center (4th card) */}
                    {otherPlans.length > 2 && (
                      <div className="flex justify-center md:-mt-48">
                        <div className="w-full md:w-1/3">
                          {renderPlanCard(otherPlans[2], 2)}
                        </div>
                      </div>
                    )}
                    {/* If more than 4 plans, show remaining in a grid */}
                    {otherPlans.length > 3 && (
                      <div className="grid md:grid-cols-3 gap-6 mt-6">
                        {otherPlans.slice(3).map((plan, index) => 
                          renderPlanCard(plan, index + 3)
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No pricing plans available at the moment. Please check back later.</p>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-primary-50">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <div className="relative bg-white rounded-3xl p-10 md:p-16 text-center border-2 border-primary-200 shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100 rounded-full blur-3xl opacity-50 -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-100 rounded-full blur-3xl opacity-50 -ml-32 -mb-32"></div>
                <div className="relative z-10">
                  <ScrollFloat
                    animationDuration={1}
                    ease='back.inOut(2)'
                    scrollStart='center bottom+=50%'
                    scrollEnd='bottom bottom-=40%'
                    stagger={0.03}
                    containerClassName="mb-6"
                    textClassName="text-3xl md:text-4xl font-medium text-gray-900"
                  >
                    Ready to Get Started?
                  </ScrollFloat>
                  <p className="text-base text-gray-600 mb-8">
                    Join thousands of businesses using Fintranzact for their accounting needs
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <a
                      href={getClientRegisterUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-primary-600 text-white px-6 py-2.5 rounded-xl text-lg font-normal hover:bg-primary-500 transition shadow-xl hover:shadow-2xl transform hover:-translate-y-1 inline-flex items-center justify-center gap-2"
                    >
                      Start Free Trial
                      <FiArrowRight />
                    </a>
                    <a
                      href="#contact"
                      className="bg-white text-primary-600 px-6 py-2.5 rounded-xl text-lg font-normal hover:bg-primary-50 transition border-2 border-primary-500 shadow-lg hover:shadow-xl"
                    >
                      Contact Us
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-16 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-4"
                  textClassName="text-2xl md:text-3xl font-medium text-gray-900"
                >
                  Get in Touch
                </ScrollFloat>
                <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                  Have questions? We&apos;d love to hear from you
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiMail className="text-white text-sm" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 text-sm">Email</div>
                        <a href="mailto:support@fintranzact.com" className="text-gray-600 text-sm hover:text-primary-600 transition">
                          support@fintranzact.com
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiPhone className="text-white text-sm" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 text-sm">Phone</div>
                        <a href="tel:+91849009684" className="text-gray-600 text-sm hover:text-primary-600 transition">
                          +91 84900 9684
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiMapPin className="text-white text-sm" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 text-sm">Address</div>
                        <div className="text-gray-600 text-sm leading-relaxed">212, 2nd floor, Runway Heights, Ayodhya Chowk, Rajkot - 360001</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Send us a Message</h3>
                  <form className="space-y-4">
                    <input
                      type="text"
                      placeholder="Your Name"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm transition"
                    />
                    <input
                      type="email"
                      placeholder="Your Email"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm transition"
                    />
                    <textarea
                      placeholder="Your Message"
                      rows="4"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 text-sm transition resize-none"
                    ></textarea>
                    <button
                      type="submit"
                      className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 transition font-medium text-sm shadow-sm hover:shadow-md"
                    >
                      Send Message
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <WebsiteFooter />
        
        {/* Chatbot */}
        <Chatbot />
      </div>
    </>
  );
}
