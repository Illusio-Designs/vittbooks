import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../components/ProtectedRoute';
import ClientLayout from '../../components/layouts/ClientLayout';
import PageLayout from '../../components/layouts/PageLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormInput from '../../components/forms/FormInput';
import FormTextarea from '../../components/forms/FormTextarea';
import { reviewAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiStar, FiSave, FiCheck, FiEdit2 } from 'react-icons/fi';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function ReviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [formData, setFormData] = useState({
    rating: 0,
    title: '',
    comment: '',
    reviewer_name: '',
    reviewer_designation: '',
    reviewer_company: '',
  });
  const [errors, setErrors] = useState({});

  const fetchMyReview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await reviewAPI.getMy();
      if (response.data?.data) {
        const review = response.data.data;
        setExistingReview(review);
        setFormData({
          rating: review.rating || 0,
          title: review.title || '',
          comment: review.comment || '',
          reviewer_name: review.reviewer_name || user?.name || '',
          reviewer_designation: review.reviewer_designation || '',
          reviewer_company: review.reviewer_company || '',
        });
      } else {
        // Set default values if no review exists
        setFormData({
          rating: 0,
          title: '',
          comment: '',
          reviewer_name: user?.name || '',
          reviewer_designation: '',
          reviewer_company: '',
        });
      }
    } catch (error) {
      // If 404, no review exists yet - that's fine
      if (error.response?.status !== 404) {
        console.error('Error fetching review:', error);
        toast.error('Failed to load review');
      }
      // Set default values
      setFormData({
        rating: 0,
        title: '',
        comment: '',
        reviewer_name: user?.name || '',
        reviewer_designation: '',
        reviewer_company: '',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    fetchMyReview();
  }, [fetchMyReview]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleRatingClick = (rating) => {
    setFormData((prev) => ({
      ...prev,
      rating,
    }));
    if (errors.rating) {
      setErrors((prev) => ({
        ...prev,
        rating: undefined,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.rating || formData.rating < 1 || formData.rating > 5) {
      newErrors.rating = 'Please select a rating';
    }

    if (!formData.reviewer_name || formData.reviewer_name.trim() === '') {
      newErrors.reviewer_name = 'Reviewer name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      setSaving(true);
      if (existingReview) {
        // Update existing review
        await reviewAPI.update(existingReview.id, formData);
        toast.success('Review updated successfully! It will be republished after admin approval.');
      } else {
        // Submit new review
        await reviewAPI.submit(formData);
        toast.success('Thank you for your review! It will be published after admin approval.');
      }
      // Refresh the review
      await fetchMyReview();
    } catch (error) {
      console.error('Error submitting review:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to submit review';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute portalType="client">
        <ClientLayout title="Submit Review">
          <PageLayout
            title="Submit Review"
            breadcrumbs={[
              { label: 'Client', href: '/client/dashboard' },
              { label: 'Submit Review' },
            ]}
          >
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          </PageLayout>
        </ClientLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute portalType="client">
      <ClientLayout title="Submit Review">
        <PageLayout
          title="Submit Review"
          breadcrumbs={[
            { label: 'Client', href: '/client/dashboard' },
            { label: 'Submit Review' },
          ]}
        >
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="shadow-sm border border-gray-200">
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {existingReview ? 'Update Your Review' : 'Share Your Experience'}
                </h2>
                <p className="text-gray-600 mb-6">
                  {existingReview
                    ? 'Update your review below. Changes will require admin approval before being published.'
                    : 'Help us improve by sharing your experience with Fintranzact. Your review will be published after admin approval.'}
                </p>

                {existingReview && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-900">
                      <FiCheck className="h-5 w-5" />
                      <span className="font-medium">
                        {existingReview.is_approved
                          ? 'Your review is currently published on our website.'
                          : 'Your review is pending admin approval.'}
                      </span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Rating <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => handleRatingClick(rating)}
                          className="focus:outline-none transition-transform hover:scale-110"
                          aria-label={`${rating} star${rating > 1 ? 's' : ''}`}
                        >
                          <FiStar
                            className={`h-10 w-10 ${
                              rating <= formData.rating
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formData.rating === 0 && 'Click to select a rating'}
                      {formData.rating === 1 && 'Poor'}
                      {formData.rating === 2 && 'Fair'}
                      {formData.rating === 3 && 'Good'}
                      {formData.rating === 4 && 'Very Good'}
                      {formData.rating === 5 && 'Excellent'}
                    </p>
                    {errors.rating && (
                      <p className="text-sm text-red-600 mt-1">{errors.rating}</p>
                    )}
                  </div>

                  {/* Title */}
                  <FormInput
                    name="title"
                    label="Review Title (Optional)"
                    value={formData.title}
                    onChange={handleInputChange}
                    error={errors.title}
                    placeholder="e.g., Great accounting software!"
                  />

                  {/* Comment */}
                  <FormTextarea
                    name="comment"
                    label="Your Review (Optional)"
                    value={formData.comment}
                    onChange={handleInputChange}
                    error={errors.comment}
                    rows={6}
                    placeholder="Share your experience with Fintranzact..."
                  />

                  {/* Reviewer Name */}
                  <FormInput
                    name="reviewer_name"
                    label="Your Name"
                    value={formData.reviewer_name}
                    onChange={handleInputChange}
                    error={errors.reviewer_name}
                    required
                    placeholder="Enter your name"
                  />

                  {/* Reviewer Designation */}
                  <FormInput
                    name="reviewer_designation"
                    label="Your Designation (Optional)"
                    value={formData.reviewer_designation}
                    onChange={handleInputChange}
                    error={errors.reviewer_designation}
                    placeholder="e.g., CEO, Finance Manager"
                  />

                  {/* Reviewer Company */}
                  <FormInput
                    name="reviewer_company"
                    label="Company Name (Optional)"
                    value={formData.reviewer_company}
                    onChange={handleInputChange}
                    error={errors.reviewer_company}
                    placeholder="Enter company name"
                  />

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      loading={saving}
                    >
                      {existingReview ? (
                        <>
                          <FiEdit2 className="h-4 w-4 mr-2" />
                          Update Review
                        </>
                      ) : (
                        <>
                          <FiSave className="h-4 w-4 mr-2" />
                          Submit Review
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        </PageLayout>
      </ClientLayout>
    </ProtectedRoute>
  );
}
