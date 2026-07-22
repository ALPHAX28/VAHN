'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, updateProfile, changePassword, loading, openAuthModal } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      openAuthModal('login');
    } else if (user) {
      setFullName(user.full_name);
    }
  }, [user, loading, router, openAuthModal]);

  if (loading || !user) {
    return (
      <div className="account-page-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <p>Loading profile details...</p>
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setProfileLoading(true);

    try {
      await updateProfile(fullName);
      setProfileMsg('Profile name updated successfully.');
    } catch (err: any) {
      setProfileErr(err.message || 'Failed to update profile name.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (newPassword !== confirmPassword) {
      setPasswordErr('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordErr('Password must be at least 6 characters long.');
      return;
    }

    setPasswordLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordErr(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="account-page-container">
      <div className="account-header">
        <h1 className="account-title">My Profile</h1>
        <p className="account-subtitle">Manage your personal information and account security settings.</p>
      </div>

      <div className="account-grid">
        {/* Profile Details Card */}
        <div className="account-card">
          <h2 className="account-card-title">Personal Details</h2>

          {profileMsg && <div className="auth-success-banner">{profileMsg}</div>}
          {profileErr && <div className="auth-error-banner">{profileErr}</div>}

          <form onSubmit={handleUpdateProfile} className="auth-form">
            <div className="auth-input-group">
              <label className="auth-label">Email Address (Read-only)</label>
              <input
                type="email"
                disabled
                value={user.email}
                className="auth-input disabled"
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="auth-input"
              />
            </div>

            <button type="submit" disabled={profileLoading} className="auth-submit-btn">
              {profileLoading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="account-card">
          <h2 className="account-card-title">Security & Password</h2>

          {passwordMsg && <div className="auth-success-banner">{passwordMsg}</div>}
          {passwordErr && <div className="auth-error-banner">{passwordErr}</div>}

          <form onSubmit={handleChangePassword} className="auth-form">
            <div className="auth-input-group">
              <label className="auth-label">Current Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="auth-input"
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="auth-input"
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="auth-input"
              />
            </div>

            <button type="submit" disabled={passwordLoading} className="auth-submit-btn">
              {passwordLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
