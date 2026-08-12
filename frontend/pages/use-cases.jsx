import Head from 'next/head';
import Link from 'next/link';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import Chatbot from '../components/chatbot/Chatbot';
import ScrollFloat from '../components/ui/ScrollFloat';
import AnimatedCardGrid from '../components/ui/AnimatedCardGrid';
import AnimatedText from '../components/ui/AnimatedText';
import { 
  FiPackage, FiLayers, FiZap, FiBriefcase, FiSettings,
  FiCheck, FiArrowRight, FiTrendingUp, FiUsers, FiBarChart2
} from 'react-icons/fi';

export default function UseCasesPage() {
  const useCases = [
    {
      name: 'Retailers',
      icon: FiPackage,
      description: 'Perfect for retail businesses with point-of-sale needs',
      painPoints: [
        'Complex POS systems are expensive',
        'Inventory tracking is time-consuming',
        'GST compliance is confusing',
        'Customer management is scattered'
      ],
      features: [
        'Quick billing at point of sale',
        'Real-time inventory tracking',
        'GST-compliant invoices',
        'Customer database management',
        'Sales reports and analytics',
        'Barcode scanning support'
      ],
      benefits: [
        'Faster checkout process',
        'Reduced inventory errors',
        'Automatic GST calculations',
        'Better customer insights'
      ],
      pricing: 'Starter or Professional plan recommended'
    },
    {
      name: 'Distributors',
      icon: FiLayers,
      description: 'Built for wholesale and distribution businesses',
      painPoints: [
        'Managing multiple price lists is difficult',
        'Stock across warehouses is hard to track',
        'Bulk order processing is slow',
        'Credit management is complex'
      ],
      features: [
        'Multiple price lists (wholesale, retail, distributor)',
        'Multi-warehouse inventory management',
        'Bulk order processing',
        'Credit limit management',
        'Stock transfer between warehouses',
        'Advanced reporting'
      ],
      benefits: [
        'Efficient order processing',
        'Better stock visibility',
        'Improved credit control',
        'Accurate profit margins'
      ],
      pricing: 'Professional or Enterprise plan recommended'
    },
    {
      name: 'Startups',
      icon: FiZap,
      description: 'Simple accounting for growing businesses',
      painPoints: [
        'Accounting software is too complex',
        'Can\'t afford expensive solutions',
        'Need quick setup',
        'Want to focus on business, not accounting'
      ],
      features: [
        'Easy-to-use interface',
        'Affordable pricing',
        'Quick setup in minutes',
        'Essential accounting features',
        'GST filing support',
        'Basic reporting'
      ],
      benefits: [
        'Get started quickly',
        'Low cost of ownership',
        'No training required',
        'Focus on growth'
      ],
      pricing: 'Starter plan perfect for startups'
    },
    {
      name: 'Freelancers',
      icon: FiBriefcase,
      description: 'Professional invoicing made easy',
      painPoints: [
        'Creating invoices manually is tedious',
        'Tracking payments is difficult',
        'Tax calculations are confusing',
        'Client management is scattered'
      ],
      features: [
        'Professional invoice templates',
        'Payment tracking and reminders',
        'Tax calculation and filing',
        'Client database',
        'Expense tracking',
        'Time tracking (coming soon)'
      ],
      benefits: [
        'Professional image',
        'Faster payment collection',
        'Easy tax compliance',
        'Better client relationships'
      ],
      pricing: 'Starter plan is ideal'
    },
    {
      name: 'Service Providers',
      icon: FiSettings,
      description: 'Service billing and client management',
      painPoints: [
        'Service billing is different from product billing',
        'Recurring invoices are manual',
        'Project tracking is difficult',
        'Client communication is scattered'
      ],
      features: [
        'Service-specific templates',
        'Recurring invoice automation',
        'Project-based billing',
        'Client portal access',
        'WhatsApp and email sharing',
        'Service reports'
      ],
      benefits: [
        'Automated recurring billing',
        'Better project visibility',
        'Improved client communication',
        'Streamlined operations'
      ],
      pricing: 'Professional plan recommended'
    },
  ];

  return (
    <>
      <Head>
        <title>Use Cases - Fintranzact | Solutions for Every Business</title>
        <meta name="description" content="Discover how Fintranzact helps retailers, distributors, startups, freelancers, and service providers manage their accounting." />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-50 to-white pt-40 pb-12">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-3xl md:text-4xl font-medium text-gray-900 mb-5">
                Perfect for Your Business
              </h1>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Quick invoicing for retailers, distributors, startups, freelancers, and service providers using Fintranzact invoicing app.
              </p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-8 bg-white">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-7xl mx-auto space-y-6">
              {useCases.map((useCase, index) => {
                const Icon = useCase.icon;
                
                return (
                  <AnimatedCardGrid
                    key={useCase.name}
                    className="block"
                    stagger={0}
                    ease="power2.out"
                    scrollStart="top bottom-=200px"
                    duration={1}
                  >
                  <div
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="flex flex-col lg:flex-row">
                      {/* Left Side - Dark Blue Column */}
                      <div className="bg-primary-600 p-6 flex flex-col justify-between lg:w-64 flex-shrink-0">
                        <div>
                          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
                            <Icon className="text-white text-xl" />
                          </div>
                          <h2 className="text-2xl font-extrabold text-white mb-2">{useCase.name}</h2>
                          <p className="text-primary-100 text-sm leading-relaxed mb-4">{useCase.description}</p>
                        </div>
                        <div className="pt-4 border-t border-white/20">
                          <p className="text-xs text-primary-100 mb-1">Recommended Plan</p>
                          <p className="text-white font-semibold text-sm mb-4">{useCase.pricing}</p>
                          <a
                            href="/register"
                            className="w-full inline-flex items-center justify-center gap-2 bg-white text-primary-600 px-2.5 py-1 rounded-lg hover:bg-primary-50 transition font-semibold text-sm shadow-md"
                          >
                            Start Free Trial
                            <FiArrowRight className="text-sm" />
                          </a>
                        </div>
                      </div>

                      {/* Right Side - Four Cards in Row */}
                      <div className="flex-1 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                        {/* Pain Points Card */}
                        <div className="flex-1 bg-white p-5 min-w-0">
                          <h3 className="text-xs font-bold text-red-600 mb-3 uppercase tracking-wider">
                            Pain Points We Solve
                          </h3>
                          <ul className="space-y-2">
                            {useCase.painPoints.map((point) => (
                              <li key={point} className="flex items-start gap-2 text-gray-700 text-sm leading-relaxed">
                                <span className="text-red-500 mt-1 text-xs font-bold flex-shrink-0">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Features Card */}
                        <div className="flex-1 bg-white p-5 border-l-4 border-green-500 min-w-0">
                          <h3 className="text-xs font-bold text-green-600 mb-3 uppercase tracking-wider">
                            Key Features
                          </h3>
                          <ul className="space-y-2">
                            {useCase.features.map((feature) => (
                              <li key={feature} className="flex items-start gap-2 text-gray-700 text-sm leading-relaxed">
                                <FiCheck className="text-green-600 text-sm mt-0.5 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Benefits Card */}
                        <div className="flex-1 bg-white p-5 border-l-4 border-green-500 min-w-0">
                          <h3 className="text-xs font-bold text-green-600 mb-3 uppercase tracking-wider">
                            Benefits
                          </h3>
                          <ul className="space-y-2">
                            {useCase.benefits.map((benefit) => (
                              <li key={benefit} className="flex items-start gap-2 text-gray-700 text-sm leading-relaxed">
                                <FiTrendingUp className="text-green-600 text-sm mt-0.5 flex-shrink-0" />
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Get Started Card */}
                        <div className="flex-1 bg-white p-5 min-w-0 flex flex-col justify-center">
                          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center mb-3">
                            <Icon className="text-white text-lg" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-900 mb-2">Get Started Today</h3>
                          <p className="text-gray-600 text-xs mb-4 leading-relaxed">
                            Start managing your {useCase.name.toLowerCase()} business with Fintranzact
                          </p>
                          <a
                            href="/register"
                            className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-primary-700 transition font-normal text-sm shadow-md hover:shadow-lg"
                          >
                            Start Free Trial
                            <FiArrowRight className="text-sm" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  </AnimatedCardGrid>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-br from-gray-50 via-white to-primary-50">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-5xl mx-auto">
              <div className="relative bg-white rounded-2xl p-10 md:p-12 text-center border border-primary-200 shadow-lg overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary-100 rounded-full blur-3xl opacity-40 -mr-24 -mt-24"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-100 rounded-full blur-3xl opacity-40 -ml-24 -mb-24"></div>
                <div className="relative z-10">
                  <ScrollFloat
                    animationDuration={1}
                    ease='back.inOut(2)'
                    scrollStart='center bottom+=50%'
                    scrollEnd='bottom bottom-=40%'
                    stagger={0.03}
                    containerClassName="mb-5"
                    textClassName="text-3xl md:text-4xl font-medium text-gray-900"
                  >
                    Not Sure Which Plan Fits You?
                  </ScrollFloat>
                  <p className="text-base text-gray-600 mb-8 max-w-2xl mx-auto">
                    Our team can help you choose the perfect solution for your business
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                      href="/contact"
                      className="bg-primary-600 text-white px-5 py-2 rounded-xl hover:bg-primary-700 transition font-normal text-lg inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      Contact Sales
                      <FiArrowRight />
                    </Link>
                    <Link
                      href="/plans"
                      className="bg-white text-primary-600 px-5 py-2 rounded-xl hover:bg-primary-50 transition font-normal text-lg border-2 border-primary-600 shadow-lg hover:shadow-xl"
                    >
                      View Plans
                    </Link>
                  </div>
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

