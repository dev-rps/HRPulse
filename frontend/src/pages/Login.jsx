import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  // Error/validation states
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [verifyMessage, setVerifyMessage] = useState(null);

  const validateField = (name, value) => {
    let errorMsg = '';
    if (name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value.trim()) {
        errorMsg = 'Email address is required';
      } else if (!emailRegex.test(value)) {
        errorMsg = 'Please enter a valid email address';
      }
    } else if (name === 'password') {
      if (!value) {
        errorMsg = 'Password is required';
      }
    }
    setErrors(prev => ({ ...prev, [name]: errorMsg }));
    return errorMsg;
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    validateField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate fields
    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);

    if (emailErr || passErr) {
      setSubmitError('Please resolve validation errors.');
      return;
    }

    try {
      setSubmitting(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err.message.includes('verify your email') || err.message.includes('NOT_VERIFIED')) {
        setNeedsVerification(true);
        setSubmitError('Your email address needs to be verified. Enter the verification token below.');
      } else {
        setSubmitError(err.message || 'Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setVerifyMessage(null);

    if (!verifyToken.trim()) {
      setSubmitError('Verification token is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Invalid verification token.');
      }

      setVerifyMessage('Email verified successfully! You can now log in.');
      setNeedsVerification(false);
      setVerifyToken('');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Login Card */}
      <div className="w-full max-w-md bg-surface border border-border p-6 md:p-8 rounded-lg shadow-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <span className="text-4xl block">🏢</span>
          <h1 className="text-xl md:text-2xl font-bold font-sans text-text">Sign in to HRPulse</h1>
          <p className="text-xs text-text-muted">Enter corporate credentials to access your dashboard</p>
        </div>

        {/* Global Submit Error Banner */}
        {submitError && (
          <div className="text-xs text-error font-medium bg-error-light/50 border border-error p-2.5 rounded">
            ⚠️ {submitError}
          </div>
        )}

        {/* Global Success Banner */}
        {verifyMessage && (
          <div className="text-xs text-success font-medium bg-success-light/50 border border-success p-2.5 rounded">
            ✅ {verifyMessage}
          </div>
        )}

        {/* Verification Form (Conditional display if email unverified) */}
        {needsVerification ? (
          <form onSubmit={handleVerifyEmail} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-text font-medium block">Verification Token</label>
              <input
                type="text"
                name="verifyToken"
                placeholder="Paste verification token here..."
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                disabled={submitting}
                className="w-full p-2.5 border border-border bg-bg text-text rounded-md focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNeedsVerification(false);
                  setSubmitError(null);
                }}
                disabled={submitting}
                className="flex-1 py-2 border border-border text-text hover:bg-slate-50 rounded-md font-semibold transition-colors disabled:opacity-50"
              >
                Back to Login
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-md font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Verifying...' : 'Verify Account'}
              </button>
            </div>
          </form>
        ) : (
          /* Login Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-text font-medium block">Corporate Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="riya@hrpulse.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleBlur}
                disabled={submitting}
                className="w-full p-2.5 border border-border bg-bg text-text rounded-md focus:outline-none focus:border-primary"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-text font-medium block">Account Password</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handleBlur}
                disabled={submitting}
                className="w-full p-2.5 border border-border bg-bg text-text rounded-md focus:outline-none focus:border-primary"
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-primary text-text-inverse hover:bg-primary-hover rounded-md font-semibold transition-colors disabled:opacity-50 text-xs mt-2"
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Hackathon Quick Hint Footer */}
        <div className="text-center border-t border-border/40 pt-4 text-[10px] text-text-muted leading-relaxed">
          <span className="font-semibold block text-text mb-0.5">Hackathon Dev Helper</span>
          To create accounts, use the signup page stubs or backend endpoint directly. Dev tokens are printed to the server terminal console.
        </div>
      </div>
    </div>
  );
}
