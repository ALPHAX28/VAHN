"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPinIcon } from '@/components/icons/Icons';

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
        <h1 className="account-title" style={{ textTransform: "uppercase" }}>My Profile</h1>
        <p className="account-subtitle">Manage your personal information and account security settings.</p>
      </div>

      <div className="account-grid">
        {/* Profile Details Card */}
        <div className="account-card" style={{ borderRadius: 0, border: "1px solid #000000" }}>
          <h2 className="account-card-title" style={{ textTransform: "uppercase" }}>Personal Details</h2>

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
                style={{ borderRadius: 0 }}
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
                style={{ borderRadius: 0 }}
              />
            </div>

            <button type="submit" disabled={profileLoading} className="auth-submit-btn" style={{ borderRadius: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {profileLoading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="account-card" style={{ borderRadius: 0, border: "1px solid #000000" }}>
          <h2 className="account-card-title" style={{ textTransform: "uppercase" }}>Security & Password</h2>

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
                style={{ borderRadius: 0 }}
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
                style={{ borderRadius: 0 }}
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
                style={{ borderRadius: 0 }}
              />
            </div>

            <button type="submit" disabled={passwordLoading} className="auth-submit-btn" style={{ borderRadius: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {passwordLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Saved Delivery Addresses Card */}
        <div className="account-card" style={{ gridColumn: "1 / -1", marginTop: 8, borderRadius: 0, border: "1px solid #000000" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 className="account-card-title" style={{ margin: 0, textTransform: "uppercase" }}>Saved Delivery Addresses</h2>
              <p style={{ fontSize: "0.85rem", color: "#555555", margin: "4px 0 0" }}>
                Add, label, and manage your Indian shipping addresses for fast checkout.
              </p>
            </div>
            <Link
              href="/account/addresses"
              style={{
                background: "#000000", color: "#ffffff", padding: "12px 22px",
                borderRadius: 0, fontWeight: 900, fontSize: "0.82rem", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em"
              }}
            >
              Manage Saved Addresses →
            </Link>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #000000", padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 0, background: "#f8fafc", border: "1px solid #000000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MapPinIcon size={20} color="#000000" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#000000", textTransform: "uppercase" }}>Manage Multiple Delivery Locations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
