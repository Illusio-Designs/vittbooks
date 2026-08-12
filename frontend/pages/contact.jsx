import { useState } from 'react';
import Head from 'next/head';
import WebsiteHeader from '../components/layouts/WebsiteHeader';
import WebsiteFooter from '../components/layouts/WebsiteFooter';
import Chatbot from '../components/chatbot/Chatbot';
import FormPhoneInput from '../components/forms/FormPhoneInput';
import AnimatedText from '../components/ui/AnimatedText';
import { FiMail, FiPhone, FiMapPin, FiVideo, FiMessageCircle, FiCalendar } from 'react-icons/fi';

export default function ContactPage() {
  const [phone, setPhone] = useState('');
  
  return (
    <>
      <Head>
        <title>Contact Us - Fintranzact | Get in Touch</title>
        <meta name="description" content="Contact Fintranzact for support, sales inquiries, or general questions" />
      </Head>

      <div className="min-h-screen bg-white">
        <WebsiteHeader />

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-50 to-white pt-40 pb-12">
          <div className="container mx-auto px-8 md:px-12 lg:px-20">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-3xl md:text-4xl font-medium text-gray-900 mb-3">
                Contact Us
              </h1>
              <p className="text-base text-gray-600 max-w-3xl mx-auto">
                Have questions? We&apos;d love to hear from you. Get in touch with our team.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <a
                  href="#request-demo"
                  className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-xl text-lg hover:bg-primary-700 transition font-normal"
                >
                  <FiVideo className="text-xl" />
                  Request a Demo
                </a>
                <a
                  href="#schedule-call"
                  className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 px-6 py-2.5 rounded-xl text-lg hover:bg-gray-50 transition font-normal border-2 border-primary-600"
                >
                  <FiCalendar className="text-xl" />
                  Schedule a Call
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Details and Form Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12">
                {/* Left Side - Contact Details */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-8">Get in Touch</h2>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FiMail className="text-primary-600 text-xl" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 mb-1">Email</div>
                        <div className="text-gray-600 text-sm">support@fintranzact.com</div>
                        <div className="text-gray-600 text-sm">sales@fintranzact.com</div>
                        <div className="text-xs text-gray-500 mt-1">Response within 24 hours</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FiPhone className="text-primary-600 text-xl" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 mb-1">Phone</div>
                        <div className="text-gray-600 text-sm">+91 84900 9684</div>
                        <div className="text-gray-600 text-sm">Mon-Fri 9AM-6PM IST</div>
                        <div className="text-xs text-gray-500 mt-1">Available for immediate support</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FiMessageCircle className="text-primary-600 text-xl" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 mb-1">WhatsApp</div>
                        <div className="text-gray-600 text-sm">+91 84900 9684</div>
                        <div className="text-xs text-gray-500 mt-1">Quick support via WhatsApp</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FiMapPin className="text-primary-600 text-xl" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 mb-1">Address</div>
                        <div className="text-gray-600 text-sm">212, 2nd floor, Runway Heights</div>
                        <div className="text-gray-600 text-sm">Ayodhya Chowk, Rajkot - 360001</div>
                        <div className="text-gray-600 text-sm">India</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Request Demo Form */}
                <div>
                  <div id="request-demo" className="bg-gradient-to-br from-primary-50 to-white p-6 rounded-2xl shadow-xl border border-primary-100">
                    <div className="flex items-center gap-2 mb-4">
                      <FiVideo className="text-primary-600 text-xl" />
                      <h3 className="text-xl font-bold text-gray-900">Request a Demo</h3>
                    </div>
                    <form className="space-y-4">
                      <div>
                        <input
                          type="text"
                          placeholder="Your Name"
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="email"
                          placeholder="Your Email"
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Company Name"
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                        />
                      </div>
                      <div>
                        <FormPhoneInput
                          name="phone"
                          value={phone}
                          onChange={(name, value) => setPhone(value)}
                          defaultCountry="IN"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition font-normal text-sm shadow-lg"
                      >
                        Request Demo
                      </button>
                    </form>
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
