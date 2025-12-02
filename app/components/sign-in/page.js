"use client";

import { useState, useRef } from 'react';
import Loading from '../Loading';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { LockClosedIcon, EnvelopeIcon, EyeIcon, EyeSlashIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// Loading Component with Hotel Logo
const LoadingComponent = () => (
  <Loading fullScreen message="Signing in..." size="xl" />
);

export default function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { login, error: authError } = useAuth();
  const router = useRouter();
  const [showQrModal, setShowQrModal] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data.message || 'Login failed. Please try again.';
        // Normalize specific backend messages
        if (msg.includes('Incorrect Username')) {
          throw new Error('Incorrect Username');
        }
        if (msg.includes('Incorrect Password')) {
          throw new Error('Incorrect Password');
        }
        throw new Error(msg);
      }

      await login(data.user, data.token, rememberMe);
    } catch (err) {
      console.error('Login error:', err);
      setLocalError(err.message || 'An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  const startQrScanner = async () => {
    try {
      setLocalError("");
      setShowQrModal(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const video = videoRef.current;
        const tryPlay = () => {
          if (!video) return;
          video.play().catch(() => {
            // Some browsers require a user gesture; ignore transient play errors
          });
        };
        if (video.readyState >= 2) {
          tryPlay();
        } else {
          video.onloadedmetadata = () => {
            tryPlay();
          };
        }
      }

      const hasBarcode = 'BarcodeDetector' in window;
      let detector = null;
      // lazy-load jsQR only when BarcodeDetector is not available
      let jsqrLib = null;
      if (hasBarcode) {
        try {
          // @ts-ignore
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (_) {
          detector = null;
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // If BarcodeDetector is not available, pre-load jsQR once before starting scans
      if (!detector) {
        try {
          const mod = await import('jsqr');
          jsqrLib = mod && (mod.default || mod);
        } catch (e) {
          jsqrLib = null;
        }
      }

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (detector) {
          try {
            const barcodes = await detector.detect(canvas);
            if (barcodes && barcodes.length > 0) {
              const raw = barcodes[0].rawValue || '';
              await handleQrCode(raw);
            }
          } catch (_) {
            // ignore detection errors
          }
        } else {
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (jsqrLib) {
              const code = jsqrLib(imageData.data, imageData.width, imageData.height);
              if (code && code.data) {
                await handleQrCode(code.data);
              }
            }
          } catch (_) {
            // ignore jsQR errors
          }
        }
      }, 400);
    } catch (err) {
      console.error('QR scanner error:', err);
      setLocalError('Unable to access camera for QR sign-in.');
      stopQrScanner();
      setShowQrModal(false);
    }
  };

  const stopQrScanner = () => {
    try { if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; } } catch (_) {}
    try {
      if (videoRef.current) { videoRef.current.pause(); }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) { videoRef.current.srcObject = null; }
    } catch (_) {}
  };

  const handleQrCode = async (raw) => {
    if (!raw) return;
    // Prevent multiple scans
    stopQrScanner();
    setShowQrModal(false);
    try {
      const response = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: String(raw).trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'QR login failed');
      }
      await login(data.user, data.token, rememberMe);
    } catch (err) {
      console.error('QR login error:', err);
      setLocalError(err.message || 'Failed to sign in with QR code.');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prevState) => !prevState);
  };

  const toggleContactModal = () => {
    setShowContactModal((prevState) => !prevState);
  };

  const toggleForgotPasswordModal = () => {
    setShowForgotPasswordModal((prevState) => {
      console.log('Toggling forgot password modal, current state:', prevState);
      const newState = !prevState;
      if (!newState) {
        // Reset form when closing modal
        setForgotPasswordStep(1);
        setResetEmail('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
        setResetError('');
      }
      return newState;
    });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    if (forgotPasswordStep === 1) {
      if (!resetEmail) {
        setResetError('Please enter your email address');
        setResetLoading(false);
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(resetEmail)) {
        setResetError('Please enter a valid email address');
        setResetLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/forgot_password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to send verification code');
        }

        setResetError('Verification code sent to your email.');
        setForgotPasswordStep(2);
      } catch (err) {
        setResetError(err.message || 'An error occurred. Please try again.');
      } finally {
        setResetLoading(false);
      }
    } else if (forgotPasswordStep === 2) {
      if (!resetCode) {
        setResetError('Please enter the verification code');
        setResetLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, code: resetCode, step: 'verify' }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Invalid verification code');
        }

        setForgotPasswordStep(3);
      } catch (err) {
        setResetError(err.message || 'An error occurred. Please try again.');
      } finally {
        setResetLoading(false);
      }
    } else if (forgotPasswordStep === 3) {
      if (!newPassword || !confirmPassword) {
        setResetError('Please fill in all fields');
        setResetLoading(false);
        return;
      }
      if (newPassword.length < 6) {
        setResetError('Password must be at least 6 characters');
        setResetLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setResetError('Passwords do not match');
        setResetLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, code: resetCode, password: newPassword, step: 'reset' }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to reset password');
        }

        toggleForgotPasswordModal(); // Close modal on success
        setLocalError('Password reset successfully. Please sign in.');
      } catch (err) {
        setResetError(err.message || 'An error occurred. Please try again.');
      } finally {
        setResetLoading(false);
      }
    }
  };

  // Show LoadingComponent during login or password reset
  if (loading || resetLoading) {
    return <LoadingComponent />;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/food.jpg')" }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/45" />

      {/* Centered Login Form */}
      <div className="w-full flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md sm:max-w-m pace-y-6 bg-white p-6 sm:p-8 md:p-12 rounded-lg shadow-lg backdrop-blur-sm">
          <div className="text-center">
            <Image
              src="/Joannaslogo.png"
              alt="Hotel Logo"
              width={120}
              height={120}
              className="object-contain mx-auto"
              priority
            />
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Sign in to access your dashboard
            </p>
          </div>

          {(localError || authError) && (
            <div className={`bg-${localError === 'Password reset successfully. Please sign in.' ? 'green' : 'red'}-50 border-l-4 border-${localError === 'Password reset successfully. Please sign in.' ? 'green' : 'red'}-500 p-4 rounded-md`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {localError === 'Password reset successfully. Please sign in.' ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />
                  ) : (
                    <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm sm:text-base ${localError === 'Password reset successfully. Please sign in.' ? 'text-green-700' : 'text-red-700'}`}>{localError || authError}</p>
                </div>
              </div>
            </div>
          )}

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <input type="hidden" name="remember" value={rememberMe} />
            <div className="rounded-md space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm sm:text-base font-medium text-gray-600">
                  Email address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 sm:h-6 w-5 sm:w-4 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-gray-700 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:pl-10 text-sm sm:text-base border-gray-300 rounded-md py-2 sm:py-2 border"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm sm:text-base font-medium text-gray-600">
                  Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 sm:h-6 w-5 sm:w-4 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-gray-700 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:pl-10 pr-10 sm:pr-12 text-sm sm:text-base border-gray-300 rounded-md py-2 sm:py-2 border"
                    placeholder="••••••••"
                    minLength="6"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm sm:text-base text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm sm:text-base">
                <button
                  type="button"
                  onClick={toggleForgotPasswordModal}
                  className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                >
                  Forgot your password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full flex justify-center py-2 sm:py-2 px-4 border border-transparent text-sm sm:text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 sm:h-5 w-4 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-2">
            <button
              type="button"
              onClick={startQrScanner}
              className="w-full py-2 sm:py-2 px-4 border border-green-600 text-green-700 rounded-md hover:bg-green-50 text-sm sm:text-base"
            >
              Sign in with QR Code
            </button>
          </div>

          <div className="mt-3">
            <Link href="/" className="w-full block text-center py-2 sm:py-2 px-4 border border-gray-300 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm sm:text-base">
              Back to Homepage
            </Link>
          </div>

          <hr className="my-4 border-gray-300" />

          <div className="text-center text-sm sm:text-base text-gray-600">
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={toggleContactModal}
                className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
              >
                {showContactModal ? 'Hide contact info' : 'Contact administrator'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Contact Info Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Administrator Contact</h3>
              <button
                type="button"
                onClick={toggleContactModal}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <XMarkIcon className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="text-sm sm:text-base text-gray-600">
              <p>
                <strong>Email:</strong>{' '}
                <a href="mailto:Jamesstanleymacarulay@gmail.com" className="text-green-600 hover:text-green-700 font-semibold underline">
                  Jamesstanleymacarulay@gmail.com
                </a>
              </p>
              <p className="mt-2">
                <strong>Phone:</strong>{' '}
                <a href="tel:+639754276334" className="text-blue-600 hover:text-blue-500 underline">
                  +639754276334
                </a>
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={toggleContactModal}
                className="px-4 py-2 bg-green-600 text-white text-sm sm:text-base font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <Image
                src="/Joannaslogo.png"
                alt="Hotel Logo"
                width={120}
                height={120}
                className="object-contain mx-auto"
                priority
              />
              <h3 className="mt-4 text-lg sm:text-xl font-semibold text-gray-900">Reset Your Password</h3>
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                {forgotPasswordStep === 1 && 'Enter your email to receive a verification code.'}
                {forgotPasswordStep === 2 && `Enter the code sent to ${resetEmail}.`}
                {forgotPasswordStep === 3 && 'Enter your new password.'}
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-6">
              {resetError && (
                <div className={`bg-${resetError.includes('sent') ? 'green' : 'red'}-50 border-l-4 border-${resetError.includes('sent') ? 'green' : 'red'}-500 p-4 mb-4 rounded-md`}>
                  <p className={`text-sm sm:text-base text-${resetError.includes('sent') ? 'green' : 'red'}-700`}>{resetError}</p>
                </div>
              )}
              {forgotPasswordStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm sm:text-base font-medium text-gray-600">
                      Email Address
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <EnvelopeIcon className="h-5 sm:h-6 w-5 sm:w-6 text-gray-400" />
                      </div>
                      <input
                        id="reset-email"
                        name="reset-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="text-gray-700 focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:pl-12 text-sm sm:text-base border-gray-300 rounded-md py-2 sm:py-3 border transition duration-150 ease-in-out"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                </div>
              )}
              {forgotPasswordStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="reset-code" className="block text-sm sm:text-base font-medium text-gray-600">
                      Verification Code
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        id="reset-code"
                        name="reset-code"
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="text-gray-700 focus:ring-green-500 focus:border-green-500 block w-full text-sm sm:text-base border-gray-300 rounded-md py-2 sm:py-3 border transition duration-150 ease-in-out"
                        placeholder="Enter 6-digit code"
                      />
                    </div>
                  </div>
                </div>
              )}
              {forgotPasswordStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="new-password" className="block text-sm sm:text-base font-medium text-gray-600">
                      New Password
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 sm:h-6 w-5 sm:w-6 text-gray-400" />
                      </div>
                      <input
                        id="new-password"
                        name="new-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="text-gray-700 focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:pl-12 pr-10 sm:pr-12 text-sm sm:text-base border-gray-300 rounded-md py-2 sm:py-3 border transition duration-150 ease-in-out"
                        placeholder="••••••••"
                        minLength="6"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="text-gray-400 hover:text-gray-500 focus:outline-none"
                        >
                          {showPassword ? (
                            <EyeSlashIcon className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />
                          ) : (
                            <EyeIcon className="h-5 sm:h-6 w-5 sm:w-6" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm sm:text-base font-medium text-gray-600">
                      Confirm Password
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 sm:h-6 w-5 sm:w-6 text-gray-400" />
                      </div>
                      <input
                        id="confirm-password"
                        name="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="text-gray-700 focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:pl-12 text-sm sm:text-base border-gray-300 rounded-md py-2 sm:py-3 border transition duration-150 ease-in-out"
                        placeholder="••••••••"
                        minLength="6"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={toggleForgotPasswordModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm sm:text-base font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-150 ease-in-out"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className={`px-4 py-2 bg-green-600 text-white text-sm sm:text-base font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out ${resetLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  {resetLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 sm:h-5 w-4 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : forgotPasswordStep === 3 ? 'Reset Password' : 'Next'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Sign-in Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full mx-4">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Scan QR Code</h3>
            <div className="w-full rounded overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-auto max-h-[60vh]" playsInline muted />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { stopQrScanner(); setShowQrModal(false); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Point your camera at your employee QR code.</p>
          </div>
        </div>
      )}
    </div>
  );
}