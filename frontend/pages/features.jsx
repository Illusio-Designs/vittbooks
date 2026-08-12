import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import ScrollFloat from '../components/ui/ScrollFloat';
import AnimatedCardGrid from '../components/ui/AnimatedCardGrid';
import AnimatedText from '../components/ui/AnimatedText';
import { 
  FiBarChart2, FiFileText, FiDollarSign, FiTrendingUp, 
  FiBriefcase, FiTarget, FiShield, FiZap, FiSmartphone, 
  FiAward, FiCheck, FiUsers, FiDatabase, FiSettings,
  FiCloud, FiRefreshCw, FiDownload, FiPackage, FiShare2,
  FiUpload, FiLayers, FiPrinter, FiMail, FiArrowRight
} from 'react-icons/fi';

export default function FeaturesPage() {
  const [clientUrl, setClientUrl] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
      
      if (isLocalhost) {
        setClientUrl('http://client.localhost:3001');
      } else {
        // In production, always use https and detect domain from current hostname
        const mainDomain = hostname.replace(/^(www|admin|client)\./, '');
        setClientUrl(`https://client.${mainDomain}`);
      }
    }
  }, []);
  
  const getClientUrl = () => {
    return clientUrl || 'https://client.fintranzact.com';
  };
  const mainFeatures = [
    {
      icon: FiBarChart2,
      title: 'GST Filing & Reports',
      description: 'Complete GST solution with automated filing, JSON export, and comprehensive reporting. Stay compliant with ease.',
      details: [
        'Automated GSTR-1, GSTR-3B filing with validation',
        'GSTR JSON export (GSTR-1, 3B, 2A, 9)',
        'GSTR-2A import and reconciliation',
        'Tax liability and input tax credit reports',
        'Portal-ready format with auto-population'
      ]
    },
    {
      icon: FiFileText,
      title: 'E-Invoicing',
      description: 'Generate and manage e-invoices with IRN and QR code generation. Fully compliant with government regulations.',
      details: [
        'IRN and QR code generation',
        'Bulk invoice processing',
        'Real-time invoice validation',
        'E-invoice cancellation',
        'Integration with GST portal'
      ]
    },
    {
      icon: FiDollarSign,
      title: 'Complete Accounting',
      description: 'Full accounting with ledgers, vouchers, and financial reports. Manage all your transactions efficiently.',
      details: [
        'Chart of accounts management',
        'Multiple voucher types',
        'Bank reconciliation',
        'Journal entries',
        'Transaction history tracking'
      ]
    },
    {
      icon: FiTrendingUp,
      title: 'Financial Reports',
      description: 'Balance sheet, P&L, trial balance, and custom reports. Get insights into your business performance.',
      details: [
        'Balance Sheet & P&L Statement',
        'Trial Balance',
        'Cash Flow Statement',
        'Custom report builder',
        'Export to Excel/PDF'
      ]
    },
    {
      icon: FiUsers,
      title: 'User Management',
      description: 'Manage multiple users with role-based access control. Secure and organized user management for your team.',
      details: [
        'Role-based access control',
        'User permission management',
        'Team collaboration tools',
        'Activity tracking and audit logs',
        'Secure user authentication'
      ]
    },
    {
      icon: FiPackage,
      title: 'Inventory Management',
      description: 'Inventory so simple, it feels like magic. Add items, track stock, and manage everything in seconds.',
      details: [
        'Stock In and Stock Out tracking',
        'Live inventory status',
        'Bulk import from Excel',
        'Multi-warehouse management',
        'Batch and expiry tracking',
        'Low stock alerts'
      ]
    },
    {
      icon: FiDollarSign,
      title: 'Payment Tracking',
      description: 'Record payments effortlessly. Track every payment, every time — without lifting a finger.',
      details: [
        'Automatic payment tracking',
        'Payment reminders',
        'Outstanding reports',
        'Payment history',
        'Multiple payment methods',
        'Bank reconciliation'
      ]
    },
    {
      icon: FiShare2,
      title: 'WhatsApp/Email Sharing',
      description: 'Share anywhere. Get paid faster. Send invoices instantly via WhatsApp, email, or SMS.',
      details: [
        'WhatsApp sharing',
        'Email delivery',
        'SMS notifications',
        'Auto-reminders',
        'Payment tracking',
        'Customer communication'
      ]
    },
    {
      icon: FiFileText,
      title: 'E-way Bills',
      description: 'Create in seconds, anywhere. Generate e-way bills instantly from your phone — AI-filled and portal-ready.',
      details: [
        'Instant e-way bill generation',
        'AI-filled transport details',
        'Portal-ready format',
        'Bulk creation',
        'Status tracking',
        'Print and download'
      ]
    },
    {
      icon: FiUpload,
      title: 'Bulk Operations',
      description: 'Bulk uploads and bulk processing with Excel import. Save time with batch operations.',
      details: [
        'Bulk invoice upload',
        'Excel import/export',
        'Bulk item import',
        'Bulk ledger import',
        'CSV support',
        'Data validation'
      ]
    },
    {
      icon: FiDatabase,
      title: 'Tally Sync',
      description: 'Import from Tally with seamless integration. Migrate your existing data effortlessly.',
      details: [
        'Import ledgers from Tally',
        'Import stock items',
        'Import vouchers',
        'Import groups',
        'Bulk import support',
        'Data mapping tools'
      ]
    },
    {
      icon: FiSettings,
      title: 'Custom Columns & Headers',
      description: 'Invoice customization options. Make your invoices truly yours with extensive customization.',
      details: [
        'Custom invoice columns',
        'Custom headers and footers',
        'Logo and branding',
        'Color scheme customization',
        'Font selection',
        'Template builder'
      ]
    },
    {
      icon: FiPrinter,
      title: 'Export Invoices',
      description: 'Multiple format support. Export invoices in various formats for your needs.',
      details: [
        'PDF export',
        'Excel export',
        'CSV export',
        'Print options (A4, A5, thermal)',
        'Email as PDF',
        'Bulk export'
      ]
    }
  ];

  const additionalFeatures = [
    {
      icon: FiShield,
      title: 'Bank-Level Security',
      description: 'Your data is encrypted and secure with industry-standard security practices.'
    },
    {
      icon: FiCloud,
      title: 'Cloud-Based',
      description: 'Access your data from anywhere, anytime. No installation required.'
    },
    {
      icon: FiZap,
      title: 'Fast & Efficient',
      description: 'Lightning-fast performance with optimized workflows to save you time.'
    },
    {
      icon: FiSmartphone,
      title: 'Mobile Responsive',
      description: 'Fully responsive design that works seamlessly on all devices.'
    },
    {
      icon: FiRefreshCw,
      title: 'Auto Backup',
      description: 'Automatic daily backups ensure your data is always safe and recoverable.'
    },
    {
      icon: FiDownload,
      title: 'Data Export',
      description: 'Export your data in multiple formats including Excel, PDF, and CSV.'
    },
    {
      icon: FiDatabase,
      title: 'Unlimited Storage',
      description: 'Store unlimited invoices, transactions, and documents without worry.'
    },
    {
      icon: FiSettings,
      title: 'Customizable',
      description: 'Customize workflows, reports, and settings to match your business needs.'
    }
  ];

  return (
    <>
      <Head>
        <title>Features - Fintranzact | Complete Accounting Solution</title>
        <meta name="description" content="Discover all the powerful features of Fintranzact - GST filing, e-invoicing, accounting, and more" />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />


        {/* Main Features Section */}
        <section className="py-24 pt-40 bg-white">
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
                Powerful Features
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
              Everything you need to manage your accounting and compliance in one place. 
              Built for businesses of all sizes.
              </p>
            </div>
            <div className="max-w-7xl mx-auto space-y-8">
              {(() => {
                // Split features into rows of 3 for row-by-row animation
                const rows = [];
                for (let i = 0; i < mainFeatures.length; i += 3) {
                  rows.push(mainFeatures.slice(i, i + 3));
                }
                return rows.map((row, rowIndex) => (
                  <AnimatedCardGrid
                    key={rowIndex}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
                    stagger={0.08}
                    ease="power3.out"
                  >
                    {row.map((feature, index) => {
                      const Icon = feature.icon;
                      const globalIndex = rowIndex * 3 + index;
                      return (
                        <div key={globalIndex} className="group bg-gradient-to-br from-primary-50 to-white p-10 rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-primary-100 hover:border-primary-300">
                          <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Icon className="text-white text-2xl" />
                          </div>
                          <h3 className="text-2xl font-bold mb-4 text-gray-900">{feature.title}</h3>
                          <p className="text-gray-600 leading-relaxed text-base mb-6">
                            {feature.description}
                          </p>
                          <ul className="space-y-2">
                            {feature.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start text-gray-700">
                                <FiCheck className="text-primary-600 mr-2 mt-1 flex-shrink-0" />
                                <span className="text-sm">{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </AnimatedCardGrid>
                ));
              })()}
            </div>
          </div>
        </section>

        {/* Additional Features Section */}
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
                Additional Benefits
              </ScrollFloat>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                More reasons why thousands of businesses trust Fintranzact
              </p>
            </div>
            <AnimatedCardGrid
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto"
              stagger={0.08}
              ease="power3.out"
            >
              {additionalFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-primary-300">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="text-primary-600 text-xl" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h4>
                    <p className="text-base text-gray-600">{feature.description}</p>
                  </div>
                );
              })}
            </AnimatedCardGrid>
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
                    Join thousands of businesses using Fintranzact to streamline their accounting
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <a
                      href={getClientUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 transition font-normal text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 inline-flex items-center justify-center gap-2"
                    >
                      Start Free Trial
                      <FiArrowRight />
                    </a>
                    <Link
                      href="/contact"
                      className="bg-white text-primary-600 px-5 py-2 rounded-lg hover:bg-primary-50 transition font-normal text-lg border-2 border-primary-600 shadow-lg hover:shadow-xl"
                    >
                      Contact Sales
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <WebsiteFooter />
      </div>
    </>
  );
}
