import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import FormInput from '../../components/forms/FormInput';
import FormPasswordInput from '../../components/forms/FormPasswordInput';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ElectronWindowControls from '../../components/electron/ElectronWindowControls';
import { pricingAPI } from '../../lib/api';
import { validateGSTIN } from '../../lib/formatters';

export default function ClientRegister() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    gstin: '',
  });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const { register } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // Get plan_id and billing_cycle from URL query params
    const { plan_id, billing_cycle } = router.query;
    if (plan_id) {
      setBillingCycle(billing_cycle || 'monthly');
      fetchPlan(plan_id);
    }
  }, [router.query]);
  
  const fetchPlan = async (planId) => {
    try {
      const response = await pricingAPI.get(planId);
      if (response.data) {
        setPlan(response.data);
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
      toast.error('Failed to load plan details');
    }
  };

  const handleChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate GSTIN if provided
    if (formData.gstin && !validateGSTIN(formData.gstin)) {
      toast.error('Invalid GSTIN format. GSTIN must be 15 alphanumeric characters.');
      setLoading(false);
      return;
    }

    try {
      // Backend expects: email, password, company_name, full_name, gstin
      const registerData = {
        email: formData.email,
        password: formData.password,
        company_name: formData.company_name,
        full_name: formData.full_name,
        gstin: formData.gstin || undefined, // Send only if provided
      };

      const result = await register(registerData);
      
      if (result.success) {
        toast.success('Registration successful!');
        // If plan was selected, redirect to subscription page
        if (router.query.plan_id) {
          router.push(`/client/subscribe?plan_id=${router.query.plan_id}&billing_cycle=${billingCycle}`);
        } else {
          // No plan selected - redirect to plans page to choose a plan
          router.push('/client/plans');
        }
      } else {
        toast.error(result.message || 'Registration failed');
      }
    } catch (error) {
      toast.error('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4 sm:px-6 lg:px-8 overflow-hidden py-2">
      {/* Electron Window Controls */}
      <ElectronWindowControls className="fixed top-4 right-4 z-50" />
      
      <Toaster />
      <div className="max-w-md w-full">
        <Card className="p-3 max-h-[98vh] overflow-y-auto">
          <div>
            <h2 className="text-center text-lg font-extrabold text-gray-900">
              Create Account
            </h2>
            <p className="text-center text-sm text-gray-600">
              Sign up for your Fintranzact account
            </p>
          </div>
          
          {/* Plan Selection Display */}
          {plan && (
            <div className="mb-3 p-2 bg-primary-50 rounded-lg border border-primary-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-900">{plan.plan_name}</h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      billingCycle === 'monthly'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      billingCycle === 'yearly'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>
              <div className="text-center">
                <span className="text-base font-bold text-gray-900">
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: plan.currency || 'INR',
                    minimumFractionDigits: 0,
                  }).format(
                    billingCycle === 'yearly' && plan.discounted_price
                      ? plan.discounted_price * 12
                      : billingCycle === 'yearly'
                      ? plan.base_price * 12
                      : plan.base_price
                  )}
                </span>
                <span className="text-gray-600 ml-1 text-xs">
                  {billingCycle === 'yearly' ? '/year' : '/month'}
                </span>
                {billingCycle === 'yearly' && plan.discounted_price && (
                  <div className="mt-0.5">
                    <span className="text-xs text-gray-500 line-through">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: plan.currency || 'INR',
                        minimumFractionDigits: 0,
                      }).format(plan.base_price * 12)}
                    </span>
                    <span className="ml-1 text-xs text-green-600 font-semibold">
                      Save {Math.round(((plan.base_price * 12 - plan.discounted_price * 12) / (plan.base_price * 12)) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <form className="mt-3 space-y-2" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <FormInput
                name="full_name"
                label="Full Name"
                type="text"
                required
                placeholder="John Doe"
                value={formData.full_name}
                onChange={handleChange}
              />

              <FormInput
                name="company_name"
                label="Company Name"
                type="text"
                required
                placeholder="ABC Company"
                value={formData.company_name}
                onChange={handleChange}
              />

              <FormInput
                name="gstin"
                label="GST Number (for invoicing)"
                type="text"
                placeholder="24ABKPZ9119Q1ZL (15 characters)"
                value={formData.gstin}
                onChange={(name, value) => {
                  // Convert to uppercase automatically
                  const upperValue = value.toUpperCase();
                  handleChange(name, upperValue);
                }}
                maxLength={15}
                style={{ textTransform: 'uppercase' }}
              />

              <FormInput
                name="email"
                label="Email Address"
                type="email"
                autoComplete="email"
                required
                placeholder="email@example.com"
                value={formData.email}
                onChange={handleChange}
              />

              <FormPasswordInput
                name="password"
                label="Password"
                autoComplete="new-password"
                required
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                loading={loading}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </div>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mb-2">
              <button
                type="button"
                onClick={() => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                  window.location.href = `${apiUrl}/auth/google`;
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium shadow-sm text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Sign up with Google</span>
              </button>
            </div>

            <div className="text-center mt-2 mb-1">
              <span className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  href="/client/login"
                  className="font-medium text-primary-600 hover:text-primary-500"
                >
                  Sign in
                </Link>
              </span>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

