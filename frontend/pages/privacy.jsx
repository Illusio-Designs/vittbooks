import Head from 'next/head';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import Chatbot from '../components/chatbot/Chatbot';
import ScrollFloat from '../components/ui/ScrollFloat';

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Fintranzact</title>
        <meta name="description" content="Fintranzact Privacy Policy - How we collect, use, and protect your data" />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />

        <section className="bg-gradient-to-br from-primary-50 to-white pt-40 pb-0">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-medium text-gray-900 mb-5">Privacy Policy</h1>
              <p className="text-base text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </section>

        <section className="py-20 pt-5 bg-white">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto space-y-12">
              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  1. Introduction
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed font-normal">
                    Fintranzact (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains 
                    how we collect, use, disclose, and safeguard your information when you use our accounting software 
                    and services.
                  </p>
                </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  2. Information We Collect
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed mb-4 font-normal">
                  We collect information that you provide directly to us, including:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4 text-sm font-normal">
                    <li>Account information (name, email, phone number)</li>
                    <li>Company and business information</li>
                    <li>Financial and accounting data</li>
                    <li>Payment information</li>
                    <li>Usage data and analytics</li>
                    <li>Credit score information (when you apply for loans through FinBox)</li>
                    <li>Bank statement data (when you use Account Aggregator services)</li>
                    <li>GST, tax, and compliance-related data</li>
                  </ul>
                </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  3. How We Use Your Information
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed mb-4 font-normal">
                  We use the information we collect to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4 text-sm font-normal">
                    <li>Provide, maintain, and improve our services</li>
                    <li>Process transactions and send related information</li>
                    <li>Send technical notices and support messages</li>
                    <li>Respond to your comments and questions</li>
                    <li>Monitor and analyze usage patterns</li>
                    <li>Process loan applications and assess credit eligibility (through FinBox)</li>
                    <li>Verify income and analyze cash flow for loan offers (through Account Aggregator)</li>
                    <li>Generate e-invoices, e-way bills, and tax compliance documents (through Sandbox API)</li>
                    <li>Validate GSTINs, calculate taxes, and file returns (through Sandbox API)</li>
                  </ul>
                </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  3.1. Third-Party Service Providers
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed mb-4 font-normal">
                    We use third-party service providers to deliver certain features of our platform. These providers have access to your information only to perform specific tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                  </p>
                  
                <div className="bg-gray-50 p-6 rounded-lg mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">FinBox (Loan Services)</h3>
                  <p className="text-base text-gray-600 leading-relaxed mb-3">
                      <strong>Provider:</strong> FinBox (https://api.finbox.in, https://insights.finbox.in)
                    </p>
                  <p className="text-base text-gray-600 leading-relaxed mb-3">
                    <strong>Purpose:</strong> We integrate with FinBox to provide loan services, credit score checks, and financial analysis. When you apply for a loan through our platform:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4 mb-3 text-sm font-normal">
                    <li><strong>Credit Score Check:</strong> FinBox accesses your credit score from credit bureaus (CIBIL/Experian) for loan eligibility assessment. This is a soft inquiry and will not affect your credit score.</li>
                    <li><strong>Bank Statement Access:</strong> Your bank statement data is shared through the Account Aggregator framework for income verification and cash flow analysis. This helps in providing better loan offers.</li>
                    <li><strong>Data Sharing:</strong> Your financial data is shared with FinBox and their lending partners for loan processing, credit assessment, and related services.</li>
                  </ul>
                  <p className="text-base text-gray-600 leading-relaxed">
                    <strong>Data Shared:</strong> Customer information, financial data, credit information, bank statements (via Account Aggregator), and loan application details.
                  </p>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Sandbox API (Tax Compliance Services)</h3>
                  <p className="text-base text-gray-600 leading-relaxed mb-3">
                    <strong>Provider:</strong> Sandbox (https://api.sandbox.co.in)
                  </p>
                  <p className="text-base text-gray-600 leading-relaxed mb-3">
                    <strong>Purpose:</strong> We use Sandbox API for various tax compliance and GST-related services:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4 mb-3 text-sm font-normal">
                    <li><strong>E-Invoice Generation:</strong> Generate Invoice Reference Numbers (IRN) and QR codes for invoices</li>
                    <li><strong>E-Way Bill:</strong> Generate and manage e-way bills for goods transportation</li>
                    <li><strong>GST Services:</strong> Validate GSTINs, lookup GST rates, and generate GST returns (GSTR-1, GSTR-3B)</li>
                    <li><strong>HSN/SAC Lookup:</strong> Search and validate HSN/SAC codes</li>
                    <li><strong>TDS Services:</strong> Calculate TDS, generate TDS returns, and Form 16A</li>
                    <li><strong>Income Tax:</strong> Calculate income tax, prepare and file ITR, parse Form 16</li>
                  </ul>
                  <p className="text-base text-gray-600 leading-relaxed">
                    <strong>Data Shared:</strong> Invoice data, GST information, tax calculation data, HSN codes, and compliance-related information.
                  </p>
                </div>
              </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  4. Data Security
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed mb-4 font-normal">
                    We implement appropriate technical and organizational security measures to protect your personal 
                    information against unauthorized access, alteration, disclosure, or destruction. This includes 
                    encryption, secure servers, and regular security audits.
                  </p>
                <p className="text-base text-gray-600 leading-relaxed mb-4 font-normal">
                  All third-party API integrations use secure, encrypted connections (HTTPS) and API keys are stored 
                  securely. We ensure that all third-party service providers maintain industry-standard security 
                  practices and comply with applicable data protection regulations.
                </p>
                <p className="text-base text-gray-600 leading-relaxed font-normal">
                  When using Account Aggregator services for bank statement access, your data is shared through 
                  secure, regulated frameworks that comply with RBI guidelines for data protection and user consent.
                </p>
              </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  5. Data Retention
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed font-normal">
                  We retain your personal information for as long as necessary to provide our services and comply 
                  with legal obligations. You can request deletion of your data at any time.
                </p>
              </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  6. Your Rights and Consents
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed mb-4 font-normal">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4 mb-6 text-sm">
                    <li>Access your personal information</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Object to processing of your data</li>
                    <li>Data portability</li>
                    <li>Withdraw consent for third-party data sharing at any time</li>
                  </ul>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Loan Application Consents</h3>
                  <p className="text-base text-gray-600 leading-relaxed mb-4">
                    When applying for loans through our platform, you will be asked to provide the following consents:
                  </p>
                  <ul className="list-disc list-inside space-y-3 text-gray-600 ml-4 text-sm font-normal">
                    <li>
                      <strong>Credit Score Check Consent:</strong> I consent to FinBox accessing my credit score 
                      from credit bureaus (CIBIL/Experian) for loan eligibility assessment. This is a soft inquiry 
                      and will not affect my credit score.
                    </li>
                    <li>
                      <strong>Bank Statement Access Consent:</strong> I consent to share my bank statement data 
                      through Account Aggregator framework for income verification and cash flow analysis. This helps 
                      in better loan offers.
                    </li>
                    <li>
                      <strong>Data Sharing with FinBox:</strong> I consent to share my financial data with FinBox 
                      and their lending partners for loan processing, credit assessment, and related services.
                    </li>
                  </ul>
                  <p className="text-base text-gray-600 leading-relaxed mt-4">
                    You can withdraw these consents at any time by contacting us, though this may affect your ability 
                    to use certain loan-related features.
                  </p>
                </div>
              </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  7. Data Sharing and Third-Party Access
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed mb-4 font-normal">
                  We share your information with third-party service providers only as necessary to provide our services. 
                  These providers are contractually obligated to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-600 ml-4 mb-4 text-sm">
                  <li>Use your information only for the purposes specified in our agreements</li>
                  <li>Maintain appropriate security measures to protect your data</li>
                  <li>Comply with applicable data protection laws and regulations</li>
                  <li>Not share your information with unauthorized third parties</li>
                </ul>
                <p className="text-base text-gray-600 leading-relaxed font-normal">
                  We do not sell your personal information to third parties. We may share aggregated, anonymized data 
                  for analytics and service improvement purposes.
                </p>
              </section>

              <section>
                <ScrollFloat
                  animationDuration={1}
                  ease='back.inOut(2)'
                  scrollStart='center bottom+=50%'
                  scrollEnd='bottom bottom-=40%'
                  stagger={0.03}
                  containerClassName="mb-6"
                  textClassName="text-2xl font-medium text-gray-900"
                >
                  8. Contact Us
                </ScrollFloat>
                <p className="text-base text-gray-600 leading-relaxed font-normal">
                  If you have questions about this Privacy Policy, wish to exercise your rights, or want to withdraw 
                  consent for data sharing, please contact us at privacy@fintranzact.com
                </p>
              </section>
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
