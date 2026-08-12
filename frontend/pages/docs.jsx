import Head from 'next/head';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import Chatbot from '../components/chatbot/Chatbot';
import ScrollFloat from '../components/ui/ScrollFloat';
import { FiBook, FiFileText, FiCode, FiDatabase, FiSettings, FiShield, FiSearch, FiVideo, FiCheck } from 'react-icons/fi';

export default function DocsPage() {
  const docSections = [
    {
      icon: FiFileText,
      title: 'Getting Started',
      description: 'Learn the basics of using Fintranzact',
      topics: ['Account Setup', 'First Steps', 'Dashboard Overview']
    },
    {
      icon: FiDatabase,
      title: 'Accounting',
      description: 'Manage your accounting and ledgers',
      topics: ['Ledgers', 'Vouchers', 'Reports']
    },
    {
      icon: FiShield,
      title: 'GST & Compliance',
      description: 'GST filing and tax compliance',
      topics: ['GSTR-1', 'GSTR-3B', 'E-Invoicing']
    },
    {
      icon: FiSettings,
      title: 'Configuration',
      description: 'Configure your account settings',
      topics: ['Company Setup', 'User Management', 'Preferences']
    },
    {
      icon: FiCode,
      title: 'API Documentation',
      description: 'Integrate Fintranzact with your systems',
      topics: ['Authentication', 'Endpoints', 'Webhooks']
    },
    {
      icon: FiBook,
      title: 'Best Practices',
      description: 'Tips and best practices',
      topics: ['Data Management', 'Security', 'Backup']
    }
  ];

  return (
    <>
      <Head>
        <title>Documentation - Fintranzact | User Guides & API Docs</title>
        <meta name="description" content="Complete documentation for Fintranzact accounting platform" />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-50 to-white pt-40 pb-12">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-3xl md:text-4xl font-medium text-gray-900 mb-3">
                Documentation
              </h1>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Complete guides, tutorials, and API documentation to help you get the most out of Fintranzact.
              </p>
            </div>
          </div>
        </section>

        {/* Documentation Sections */}
        <section className="py-10 bg-white">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {docSections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <div key={index} className="bg-gradient-to-br from-primary-50 to-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition border border-primary-100">
                    <div className="w-14 h-14 bg-primary-600 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="text-white text-xl" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{section.title}</h3>
                    <p className="text-gray-600 mb-4 text-sm">{section.description}</p>
                    <ul className="space-y-2">
                      {section.topics.map((topic, topicIndex) => (
                        <li key={topicIndex} className="flex items-center text-gray-700">
                          <span className="w-2 h-2 bg-primary-600 rounded-full mr-3"></span>
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Search Section */}
        <section className="py-6 bg-white border-y border-gray-100">
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  className="w-full pl-12 pr-5 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Video Tutorials Section */}
        <section className="py-10 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center mb-6">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-3"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Video Tutorials
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Learn Fintranzact with step-by-step video guides
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {[
                { title: 'Getting Started', desc: 'Learn the basics of Fintranzact', duration: '5 min' },
                { title: 'Creating Your First Invoice', desc: 'Step-by-step invoice creation', duration: '8 min' },
                { title: 'GST Filing Guide', desc: 'How to file GST returns', duration: '12 min' },
                { title: 'E-Invoice Generation', desc: 'Generate e-invoices with IRN', duration: '10 min' },
                { title: 'Inventory Management', desc: 'Manage your inventory efficiently', duration: '15 min' },
                { title: 'Financial Reports', desc: 'Generate and understand reports', duration: '10 min' },
              ].map((tutorial, index) => (
                <div key={index} className="bg-gradient-to-br from-primary-50 to-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition border border-primary-100 cursor-pointer">
                  <div className="aspect-video bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                    <FiVideo className="text-3xl text-gray-400" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{tutorial.title}</h3>
                    <span className="text-sm text-gray-500">{tutorial.duration}</span>
                  </div>
                  <p className="text-gray-600 text-sm">{tutorial.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Start Guide */}
        <section className="py-10 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <ScrollFloat
                animationDuration={1}
                ease='back.inOut(2)'
                scrollStart='center bottom+=50%'
                scrollEnd='bottom bottom-=40%'
                stagger={0.03}
                containerClassName="mb-6 text-center"
                textClassName="text-3xl md:text-4xl font-medium text-gray-900"
              >
                Quick Start Guide
              </ScrollFloat>
              <div className="bg-white p-8 rounded-2xl shadow-xl">
                <ol className="space-y-4">
                  <li className="flex items-start">
                    <span className="w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">1</span>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">Create Your Account</h4>
                      <p className="text-gray-600 text-sm">Sign up for a free account and verify your email address.</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">2</span>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">Setup Your Company</h4>
                      <p className="text-gray-600 text-sm">Add your company details, GSTIN, and configure your preferences.</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">3</span>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">Add Your Data</h4>
                      <p className="text-gray-600 text-sm">Start adding ledgers, creating vouchers, and managing your transactions.</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0 text-sm">4</span>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">Generate Reports</h4>
                      <p className="text-gray-600 text-sm">Create financial reports, file GST returns, and generate e-invoices.</p>
                    </div>
                  </li>
                </ol>
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
