import Head from 'next/head';
import Link from 'next/link';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import Chatbot from '../components/chatbot/Chatbot';
import ScrollFloat from '../components/ui/ScrollFloat';
import { FiSearch, FiBook, FiMessageCircle, FiVideo, FiHelpCircle, FiPlus, FiMinus } from 'react-icons/fi';
import { useState } from 'react';
import AnimatedList from '../components/ui/AnimatedList';
import AnimatedText from '../components/ui/AnimatedText';

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const faqs = [
    {
      question: 'How do I get started with Fintranzact?',
      answer: 'Simply sign up for a free account, add your business details, and start managing your accounting. No credit card required for the free trial.'
    },
    {
      question: 'How do I file GST returns?',
      answer: 'Navigate to the GST section, select the return type (GSTR-1 or GSTR-3B), review your data, and submit. Our system will handle the filing process.'
    },
    {
      question: 'Can I generate e-invoices?',
      answer: 'Yes! Go to the E-Invoice section, create your invoice, and our system will generate the IRN and QR code automatically.'
    },
    {
      question: 'How secure is my data?',
      answer: 'We use industry-standard encryption and security practices. Your data is stored securely and backed up regularly.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, debit cards, UPI, and bank transfers for subscription payments.'
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time. You&apos;ll continue to have access until the end of your billing period.'
    }
  ];

  return (
    <>
      <Head>
        <title>Help Center - Fintranzact | Support & Documentation</title>
        <meta name="description" content="Get help with Fintranzact. Find answers to common questions and learn how to use our platform." />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />

        {/* Hero Section */}
        <section className="bg-white pt-40 pb-12">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-3xl md:text-4xl font-medium text-gray-900 mb-5">
                How can we help?
              </h1>
              <div className="relative max-w-xl mx-auto">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  placeholder="Search for help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-5 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto mb-20">
              <Link href="/docs" className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-lg hover:shadow-xl transition border border-primary-100 text-center">
                <FiBook className="text-primary-600 text-4xl mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Documentation</h3>
                <AnimatedText className="text-gray-600">Complete guides and tutorials</AnimatedText>
              </Link>
              <a href="#faq" className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-lg hover:shadow-xl transition border border-primary-100 text-center">
                <FiHelpCircle className="text-primary-600 text-4xl mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">FAQs</h3>
                <AnimatedText className="text-gray-600">Common questions answered</AnimatedText>
              </a>
              <Link href="/contact" className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-lg hover:shadow-xl transition border border-primary-100 text-center">
                <FiMessageCircle className="text-primary-600 text-4xl mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Contact Support</h3>
                <AnimatedText className="text-gray-600">Get help from our team</AnimatedText>
              </Link>
              <a href="#" className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-xl shadow-lg hover:shadow-xl transition border border-primary-100 text-center">
                <FiVideo className="text-primary-600 text-4xl mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Video Tutorials</h3>
                <AnimatedText className="text-gray-600">Watch and learn</AnimatedText>
              </a>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-gradient-to-br from-primary-50 via-white to-primary-100">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-12 text-center"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Frequently Asked Questions
              </ScrollFloat>
              <div className="mb-8">
                <div className="flex flex-wrap gap-3 justify-center">
                  {['Getting Started', 'Billing', 'GST & Compliance', 'Account Management', 'Technical Support'].map((category) => (
                    <button
                      key={category}
                      className="px-2.5 py-1 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition font-medium text-sm"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <AnimatedList
                items={faqs}
                onItemSelect={(item, index) => {
                  setOpenFaqIndex(openFaqIndex === index ? null : index);
                }}
                showGradients={true}
                enableArrowNavigation={true}
                displayScrollbar={true}
                renderItem={(faq, index, isSelected) => (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                      className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <h3 className="text-lg font-bold text-gray-900 text-left pr-4">
                        {faq.question}
                      </h3>
                      <div className="flex-shrink-0">
                        {openFaqIndex === index ? (
                          <FiMinus className="text-primary-600 text-2xl" />
                        ) : (
                          <FiPlus className="text-primary-600 text-2xl" />
                        )}
                      </div>
                    </button>
                    {openFaqIndex === index && (
                      <div className="px-6 pb-6">
                        <p className="text-base text-gray-600 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              />
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
