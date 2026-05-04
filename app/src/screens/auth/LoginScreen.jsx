import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Linking, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { authAPI } from '../../lib/api.js';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_CONFIG, buildStorageKey, API_CONFIG } from '../../config/env';
import { FONT_STYLES } from '../../utils/fonts';

/**
 * LoginScreen with integrated company selection
 * 
 * Flow:
 * 1. User enters email/password
 * 2. System checks if user has multiple companies (via checkUserCompanies API)
 * 3. If multiple companies: Show company selection UI
 * 4. If single company: Proceed directly with login
 * 5. User selects company and login completes
 * 
 * This provides a seamless login experience without requiring post-login navigation.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCompanySelection, setShowCompanySelection] = useState(false);
  const [userCompanies, setUserCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('biometric'); // 'fingerprint', 'facial', or 'biometric'
  const [savedCredentials, setSavedCredentials] = useState(null);
  const [allSavedCredentials, setAllSavedCredentials] = useState([]);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const { login } = useAuth();
  const { showSuccess, showError } = useNotification();
  const { showInfoConfirmation } = useConfirmation();

  // Check biometric availability on component mount
  useEffect(() => {
    checkBiometricAvailability();
    checkSavedCredentials();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      const available = hasHardware && isEnrolled && supportedTypes.length > 0;
      setBiometricAvailable(available);

      // Determine biometric type for better UX
      if (available && supportedTypes.length > 0) {
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('facial');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('iris');
        } else {
          setBiometricType('biometric');
        }
      }
    } catch (error) {
      console.error('Biometric check error:', error);
      setBiometricAvailable(false);
    }
  };

  const checkSavedCredentials = async () => {
    try {
      // Get all saved biometric credentials (multiple accounts)
      const credentialsKey = buildStorageKey('biometric_credentials_list');
      const oldCredentialsKey = buildStorageKey('biometric_credentials');
      
      let saved = await AsyncStorage.getItem(credentialsKey);
      
      // Migration: Check if old format exists and migrate
      if (!saved) {
        const oldSaved = await AsyncStorage.getItem(oldCredentialsKey);
        if (oldSaved) {
          console.log('🔄 Migrating old biometric credentials to new format...');
          const oldCredential = JSON.parse(oldSaved);
          const newList = [oldCredential];
          await AsyncStorage.setItem(credentialsKey, JSON.stringify(newList));
          await AsyncStorage.removeItem(oldCredentialsKey);
          saved = JSON.stringify(newList);
          console.log('✅ Migration complete');
        }
      }
      
      if (saved) {
        const credentialsList = JSON.parse(saved);
        
        // If there are saved credentials, use the most recent one
        if (credentialsList && credentialsList.length > 0) {
          // Sort by savedAt to get the most recent
          const sortedCredentials = credentialsList.sort((a, b) => 
            new Date(b.savedAt) - new Date(a.savedAt)
          );
          
          const mostRecent = sortedCredentials[0];
          setSavedCredentials(mostRecent);
          setAllSavedCredentials(sortedCredentials);
          // Don't auto-fill email - let user type their own
          // setEmail(mostRecent.email || '');
          console.log('✅ Biometric credentials found for:', mostRecent.email);
          console.log(`📋 Total saved accounts: ${credentialsList.length}`);
        }
      } else {
        console.log('ℹ️  No biometric credentials saved yet');
      }
    } catch (error) {
      console.error('Error checking saved credentials:', error);
    }
  };

  const saveBiometricCredentials = async (email, password) => {
    try {
      const credentialsKey = buildStorageKey('biometric_credentials_list');
      const saved = await AsyncStorage.getItem(credentialsKey);
      
      let credentialsList = [];
      if (saved) {
        credentialsList = JSON.parse(saved);
      }
      
      // Check if this email already exists
      const existingIndex = credentialsList.findIndex(cred => cred.email === email);
      
      const newCredential = {
        email,
        password,
        savedAt: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        // Update existing credential
        credentialsList[existingIndex] = newCredential;
        console.log('🔄 Updated biometric credentials for:', email);
      } else {
        // Add new credential
        credentialsList.push(newCredential);
        console.log('➕ Added new biometric credentials for:', email);
      }
      
      // Save the updated list
      await AsyncStorage.setItem(credentialsKey, JSON.stringify(credentialsList));
      console.log(`💾 Total saved accounts: ${credentialsList.length}`);
    } catch (error) {
      console.error('Error saving biometric credentials:', error);
    }
  };

  const handleBiometricLogin = async (selectedCredential = null) => {
    const credToUse = selectedCredential || savedCredentials;
    
    if (!biometricAvailable || !credToUse) {
      showError('Biometric Login', 'Biometric authentication is not available or no credentials saved');
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to login as ${credToUse.email}`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setEmail(credToUse.email);
        setPassword(credToUse.password);
        setShowAccountSelection(false);
        // Proceed with login using saved credentials - mark as biometric
        await handleLoginWithCredentials(credToUse.email, credToUse.password, true);
      } else {
        showError('Authentication Failed', 'Authentication was cancelled or failed');
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      showError('Authentication Error', 'Failed to authenticate');
    }
  };

  const handleShowAccountSelection = () => {
    if (allSavedCredentials.length > 1) {
      setShowAccountSelection(true);
    } else {
      handleBiometricLogin();
    }
  };

  const handleSelectAccount = (credential) => {
    handleBiometricLogin(credential);
  };

  const handleLoginWithCredentials = async (emailParam, passwordParam, isBiometric = false) => {
    // Only use params if explicitly provided (biometric login)
    // Otherwise always use the form values
    const loginEmail = isBiometric ? emailParam : (emailParam || email);
    const loginPassword = isBiometric ? passwordParam : (passwordParam || password);

    if (!loginEmail || !loginPassword) {
      showError('Missing Information', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    
    try {
      // Add a small delay to prevent rapid successive API calls during development
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 1: Authenticate user and get companies
      const authResult = await authAPI.authenticate(loginEmail, loginPassword);
      
      if (authResult.data.success) {
        const { user, companies, requiresCompanySelection, needsCompanyCreation } = authResult.data;
        
        if (needsCompanyCreation) {
          showError('No Company Found', 'Please create your company first');
          setLoading(false);
          return;
        }
        
        if (requiresCompanySelection && companies.length > 1) {
          // Multiple companies - show selection
          setAuthenticatedUser(user);
          setUserCompanies(companies);
          setShowCompanySelection(true);
          setLoading(false);
          
          // Save credentials for biometric login if not using biometric already
          if (!emailParam && biometricAvailable && !savedCredentials) {
            const confirmed = await showInfoConfirmation(
              'Save for Quick Login?',
              'Would you like to save your credentials for quick biometric login next time?',
              {
                confirmText: 'Yes',
                cancelText: 'No',
              }
            );
            
            if (confirmed) {
              saveBiometricCredentials(loginEmail, loginPassword);
            }
          }
          return;
        } else if (companies.length === 1) {
          // Single company - proceed with login
          await completeLogin(user.id, companies[0].id, loginEmail, loginPassword);
          return;
        } else {
          // No companies but no creation needed - proceed with regular login
          await completeLogin(user.id, null, loginEmail, loginPassword);
          return;
        }
      }
      
    } catch (error) {
      console.error('Authentication error:', error);
      handleLoginError(error);
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (userId, companyId, loginEmail, loginPassword) => {
    try {
      setLoading(true);
      
      // Add a small delay to avoid rate limiting from rapid authentication calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Complete login with selected company
      const result = await login(loginEmail, loginPassword, 'client', companyId, userId);
      
      if (result.success) {
        showSuccess('Welcome Back!', 'Login successful. Loading dashboard...');
        
        // Save credentials for biometric login if successful and not already saved
        if (biometricAvailable && !savedCredentials) {
          const confirmed = await showInfoConfirmation(
            'Save for Quick Login?',
            'Would you like to save your credentials for quick biometric login next time?',
            {
              confirmText: 'Yes',
              cancelText: 'No',
            }
          );
          
          if (confirmed) {
            saveBiometricCredentials(loginEmail, loginPassword);
          }
        }
        
        // Navigation will happen automatically through AppNavigator's isAuthenticated check
        // But we can add a small delay to ensure state is updated
        setTimeout(() => {
          // Reset any local state that might interfere with navigation
          setShowCompanySelection(false);
          setUserCompanies([]);
          setSelectedCompany(null);
          setAuthenticatedUser(null);
        }, 100);
        
      } else {
        handleLoginError({ response: { data: { message: result.message } } });
      }
    } catch (error) {
      console.error('Login completion error:', error);
      handleLoginError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const apiUrl = API_CONFIG.BASE_URL;
      // Pass `platform=mobile` so the backend can pick the mobile redirect
      // URI on completion. The backend's `state` query parameter is now
      // reserved for the OAuth CSRF token, so we no longer reuse it for
      // platform detection.
      const googleAuthUrl = `${apiUrl}/api/auth/google?platform=mobile`;
      
      // Open Google OAuth in browser
      const supported = await Linking.canOpenURL(googleAuthUrl);
      if (supported) {
        await Linking.openURL(googleAuthUrl);
      } else {
        showError('Error', 'Unable to open Google authentication');
      }
    } catch (error) {
      console.error('Google login error:', error);
      showError('Error', 'Failed to initiate Google login');
    }
  };

  const handleLogin = async () => {
    await handleLoginWithCredentials();
  };

  const handleLoginError = (error) => {
    // Handle specific error responses from backend
    if (error.response?.status === 429) {
      showError('Rate Limited', 'Too many login attempts. Please wait a few minutes before trying again.');
    } else if (error.response?.status === 401) {
      showError('Invalid Credentials', 'Invalid email or password. Please check your credentials.');
    } else if (error.response?.status === 403) {
      showError('Account Restricted', 'Account access is restricted. Please contact support.');
    } else if (error.response?.status >= 500) {
      showError('Server Error', 'Server error. Please try again in a few minutes.');
    } else if (error.response?.data) {
      const errorData = error.response.data;
      showError('Login Failed', errorData.message || 'Please check your credentials and try again.');
    } else if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      showError('Connection Error', 'Network error. Please check your internet connection and try again.');
    } else {
      showError('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleCompanySelect = async (company) => {
    if (!authenticatedUser) {
      showError('Session Error', 'Please try logging in again');
      handleBackToLogin();
      return;
    }
    
    setSelectedCompany(company);
    await completeLogin(authenticatedUser.id, company.id, email, password);
  };

  const handleBackToLogin = () => {
    setShowCompanySelection(false);
    setUserCompanies([]);
    setSelectedCompany(null);
    setAuthenticatedUser(null);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      {/* Compact Header */}
      <View style={styles.compactHeader}>
        <View style={styles.roundLogo}>
          <Image 
            source={require('../../../assets/icon.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Fintranzact</Text>
        <Text style={styles.tagline}>Simplify Your Business</Text>
      </View>

      {/* Conditional Content */}
      {showAccountSelection ? (
        /* Account Selection for Biometric Login */
        <View style={styles.formContainer}>
          <View style={styles.form}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setShowAccountSelection(false)}
            >
              <Ionicons name="arrow-back" size={20} color="#3e60ab" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            
            <Text style={styles.formTitle}>Select Account</Text>
            <Text style={styles.companySubtitle}>
              Choose which account to login with biometrics
            </Text>
            
            <View style={styles.companiesContainer}>
              {allSavedCredentials.map((credential, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.companyCard}
                  onPress={() => handleSelectAccount(credential)}
                  disabled={loading}
                >
                  <View style={styles.companyIcon}>
                    <Ionicons 
                      name="person-circle" 
                      size={24} 
                      color="#3e60ab" 
                    />
                  </View>
                  <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>
                      {credential.email}
                    </Text>
                    <Text style={styles.companyType}>
                      Last used: {new Date(credential.savedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="finger-print" size={20} color="#3e60ab" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : showCompanySelection ? (
        /* Company Selection Form */
        <View style={styles.formContainer}>
          <View style={styles.form}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackToLogin}
            >
              <Ionicons name="arrow-back" size={20} color="#3e60ab" />
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
            
            <Text style={styles.formTitle}>Select Your Company</Text>
            <Text style={styles.companySubtitle}>
              Choose which company you'd like to access
            </Text>
            
            <View style={styles.companiesContainer}>
              {userCompanies.map((company, index) => (
                <TouchableOpacity
                  key={company.id || index}
                  style={[
                    styles.companyCard,
                    selectedCompany?.id === company.id && styles.selectedCompanyCard
                  ]}
                  onPress={() => handleCompanySelect(company)}
                  disabled={loading}
                >
                  <View style={styles.companyIcon}>
                    <Ionicons 
                      name="business" 
                      size={24} 
                      color={selectedCompany?.id === company.id ? '#3e60ab' : '#6b7280'} 
                    />
                  </View>
                  <View style={styles.companyInfo}>
                    <Text style={[
                      styles.companyName,
                      selectedCompany?.id === company.id && styles.selectedCompanyName
                    ]}>
                      {company.company_name || company.name}
                    </Text>
                    <Text style={styles.companyType}>
                      {company.company_type?.replace('_', ' ').toUpperCase() || 'BUSINESS'}
                    </Text>
                  </View>
                  {selectedCompany?.id === company.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#3e60ab" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            {loading && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Signing in...</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Login Form */
        <View style={styles.formContainer}>
          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign in to your account</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9ca3af"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Text>
            </TouchableOpacity>

            {/* Biometric Login Button */}
            {biometricAvailable && savedCredentials && (
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleShowAccountSelection}
                disabled={loading}
              >
                <View style={styles.biometricButtonContent}>
                  <Text style={styles.biometricButtonText}>
                    {allSavedCredentials.length > 1 
                      ? `Login with Biometrics (${allSavedCredentials.length} accounts)` 
                      : 'Login with Biometrics'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Biometric Setup Message */}
            {biometricAvailable && !savedCredentials && (
              <View style={styles.biometricInfoContainer}>
                <Ionicons 
                  name="information-circle-outline"
                  size={16} 
                  color="#6b7280" 
                />
                <Text style={styles.biometricInfoText}>
                  Biometric login will be available after your first login
                </Text>
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
              <View style={styles.googleButtonContent}>
                <Image 
                  source={require('../../../assets/google-logo.png')} 
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 50,
  },
  compactHeader: {
    paddingTop: 80,
    paddingBottom: 30,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  roundLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  appName: {
    ...FONT_STYLES.h2,
    color: '#3e60ab',
    marginBottom: 4,
  },
  tagline: {
    ...FONT_STYLES.body,
    color: '#6b7280',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    ...FONT_STYLES.h3,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    ...FONT_STYLES.label,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    ...FONT_STYLES.body,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    color: '#111827',
    textAlignVertical: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    paddingRight: 4,
  },
  passwordInput: {
    ...FONT_STYLES.body,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#111827',
    textAlignVertical: 'center',
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#3e60ab',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#3e60ab',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...FONT_STYLES.button,
    color: 'white',
    textAlign: 'center',
  },
  biometricButton: {
    borderWidth: 1,
    borderColor: '#3e60ab',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  biometricButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricButtonText: {
    ...FONT_STYLES.button,
    color: '#3e60ab',
    textAlign: 'center',
    marginLeft: 8,
  },
  biometricInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    gap: 8,
  },
  biometricInfoText: {
    ...FONT_STYLES.caption,
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    ...FONT_STYLES.body,
    paddingHorizontal: 16,
    color: '#6b7280',
  },
  googleButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    backgroundColor: 'white',
    marginBottom: 24,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    ...FONT_STYLES.button,
    color: '#374151',
    textAlign: 'center',
  },
  // Company Selection Styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  backButtonText: {
    ...FONT_STYLES.button,
    marginLeft: 8,
    color: '#3e60ab',
  },
  companySubtitle: {
    ...FONT_STYLES.body,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  companiesContainer: {
    marginBottom: 20,
  },
  companyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  selectedCompanyCard: {
    borderColor: '#3e60ab',
    backgroundColor: '#eff6ff',
  },
  companyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    ...FONT_STYLES.button,
    color: '#111827',
    marginBottom: 4,
  },
  selectedCompanyName: {
    color: '#3e60ab',
  },
  companyType: {
    ...FONT_STYLES.caption,
    color: '#6b7280',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    ...FONT_STYLES.body,
    color: '#6b7280',
  },
});