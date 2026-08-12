import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import Chatbot from '../components/chatbot/Chatbot';
import ScrollFloat from '../components/ui/ScrollFloat';
import AnimatedCardGrid from '../components/ui/AnimatedCardGrid';
import AnimatedText from '../components/ui/AnimatedText';
import { FiTarget, FiUsers, FiAward, FiTrendingUp, FiShield, FiLink, FiCheck, FiArrowRight } from 'react-icons/fi';

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Us - Fintranzact | Your Trustable Accounting Partner</title>
        <meta name="description" content="Learn about Fintranzact - your trusted accounting partner providing comprehensive accounting solutions" />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-50 to-white pt-40 pb-12">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-3xl md:text-4xl font-medium text-gray-900 mb-5">
                About Fintranzact
              </h1>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Your Trustable Accounting Partner. We&apos;re dedicated to providing comprehensive accounting solutions 
                that help businesses manage their finances efficiently and stay compliant.
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
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
                    Our Mission
                  </ScrollFloat>
                  <p className="text-base text-gray-600 leading-relaxed mb-4">
                    At Fintranzact, our mission is to simplify accounting and financial management for businesses of all sizes. 
                    We believe that every business deserves access to professional-grade accounting tools that are both 
                    powerful and easy to use.
                  </p>
                  <p className="text-base text-gray-600 leading-relaxed">
                    We&apos;re committed to helping businesses stay compliant with tax regulations, manage their finances 
                    efficiently, and make informed decisions based on accurate financial data.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-white p-10 rounded-2xl shadow-xl">
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiTarget className="text-white text-xl" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Our Vision</h3>
                        <p className="text-base text-gray-600">To become the most trusted accounting platform in India</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiUsers className="text-white text-xl" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Our Values</h3>
                        <p className="text-base text-gray-600">Trust, reliability, and customer-first approach</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why We Started Section */}
        <section className="py-20 bg-gradient-to-br from-primary-50 to-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Why We Started
              </ScrollFloat>
              <p className="text-base text-gray-600 leading-relaxed">
                We recognized that many businesses struggle with complex accounting processes, GST compliance, 
                and financial reporting. Fintranzact was created to solve these challenges by providing an 
                all-in-one platform that simplifies accounting while ensuring compliance with Indian tax regulations.
              </p>
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
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Trusted integrations for seamless business operations
              </p>
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
                  <div className="h-20 flex items-center justify-center">
                    {partner.image ? (
                      <Image
                        src={partner.image}
                        alt={partner.name}
                        width={200}
                        height={80}
                        className="max-w-full w-auto object-contain"
                        style={{ maxHeight: '7rem', minHeight: '40px' }}
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

        {/* Security & Trust Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-3xl md:text-4xl font-medium text-gray-900"
                >
                  Security & Trust
                </ScrollFloat>
                <p className="text-base text-gray-600 max-w-3xl mx-auto">
                  Your data security is our top priority
                </p>
              </div>
              <AnimatedCardGrid
                className="grid md:grid-cols-3 gap-8"
                stagger={0.08}
                ease="power3.out"
              >
                <div className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-lg border border-primary-100 text-center">
                  <FiShield className="text-5xl text-primary-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Bank-Level Security</h3>
                  <p className="text-base text-gray-600">256-bit encryption and industry-standard security practices</p>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-lg border border-primary-100 text-center">
                  <FiAward className="text-5xl text-primary-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Compliance</h3>
                  <p className="text-base text-gray-600">GDPR compliant and data protection regulations</p>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-lg border border-primary-100 text-center">
                  <FiCheck className="text-5xl text-primary-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Reliability</h3>
                  <p className="text-base text-gray-600">99.9% uptime guarantee with automated backups</p>
                </div>
              </AnimatedCardGrid>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 bg-gradient-to-br from-primary-50 via-white to-primary-100">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FiUsers className="text-white text-2xl" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">10K+</div>
                <div className="text-base text-gray-600">Active Users</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FiTrendingUp className="text-white text-2xl" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">50K+</div>
                <div className="text-base text-gray-600">Invoices Generated</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FiAward className="text-white text-2xl" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">99.9%</div>
                <div className="text-base text-gray-600">Uptime</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <FiTarget className="text-white text-2xl" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">24/7</div>
                <div className="text-base text-gray-600">Support</div>
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
