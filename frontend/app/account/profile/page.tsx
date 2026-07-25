"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPinIcon, UserIcon, LockIcon, ChevronRightIcon } from '@/components/icons/Icons';

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
        <div style={{ width: 36, height: 36, border: "3px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#888", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Loading profile...</p>
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
    } catch (err: unknown) {
      setProfileErr(err instanceof Error ? err.message : 'Failed to update profile name.');
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
    } catch (err: unknown) {
      setPasswordErr(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="account-page-container">
      <div className="account-header">
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
          Account Settings
        </div>
        <h1 className="account-title" style={{ textTransform: "uppercase" }}>My Profile</h1>
        <p className="account-subtitle">Manage your personal information and account security.</p>
      </div>

      <div className="account-grid">
        {/* Personal Details Card */}
        <div className="account-card" style={{ border: "2px solid #000" }}>
          {/* Card Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14, borderBottom: "2px solid #000", marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <UserIcon size={16} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: "0.85rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>Personal Details</h2>
              <p style={{ fontSize: "0.72rem", color: "#888", margin: 0 }}>Your account name and email</p>
            </div>
          </div>

          {profileMsg && (
            <div style={{ borderLeft: "4px solid #16a34a", background: "#f0fdf4", color: "#15803d", padding: "11px 14px", fontSize: "0.83rem", fontWeight: 700 }}>
              {profileMsg}
            </div>
          )}
          {profileErr && (
            <div style={{ borderLeft: "4px solid #dc2626", background: "#fef2f2", color: "#dc2626", padding: "11px 14px", fontSize: "0.83rem", fontWeight: 700 }}>
              {profileErr}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="auth-form">
            <div className="auth-input-group">
              <label className="auth-label">Email Address</label>
              <input
                type="email" disabled value={user.email}
                className="auth-input disabled"
                style={{ borderRadius: 0, background: "#f8fafc", color: "#888", cursor: "not-allowed" }}
              />
              <p style={{ fontSize: "0.72rem", color: "#aaa", margin: "4px 0 0", fontStyle: "italic" }}>
                Email cannot be changed
              </p>
            </div>
            <div className="auth-input-group">
              <label className="auth-label">Full Name</label>
              <input
                type="text" required value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="auth-input"
                style={{ borderRadius: 0 }}
              />
            </div>
            <button type="submit" disabled={profileLoading} className="auth-submit-btn"
              style={{ borderRadius: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {profileLoading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="account-card" style={{ border: "2px solid #000" }}>
          {/* Card Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14, borderBottom: "2px solid #000", marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LockIcon size={16} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: "0.85rem", fontWeight: 900, margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>Security & Password</h2>
              <p style={{ fontSize: "0.72rem", color: "#888", margin: 0 }}>Change your account password</p>
            </div>
          </div>

          {passwordMsg && (
            <div style={{ borderLeft: "4px solid #16a34a", background: "#f0fdf4", color: "#15803d", padding: "11px 14px", fontSize: "0.83rem", fontWeight: 700 }}>
              {passwordMsg}
            </div>
          )}
          {passwordErr && (
            <div style={{ borderLeft: "4px solid #dc2626", background: "#fef2f2", color: "#dc2626", padding: "11px 14px", fontSize: "0.83rem", fontWeight: 700 }}>
              {passwordErr}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="auth-form">
            <div className="auth-input-group">
              <label className="auth-label">Current Password</label>
              <input type="password" required placeholder="••••••••"
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                className="auth-input" style={{ borderRadius: 0 }}
              />
            </div>
            <div className="auth-input-group">
              <label className="auth-label">New Password</label>
              <input type="password" required placeholder="••••••••"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="auth-input" style={{ borderRadius: 0 }}
              />
            </div>
            <div className="auth-input-group">
              <label className="auth-label">Confirm New Password</label>
              <input type="password" required placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="auth-input" style={{ borderRadius: 0 }}
              />
            </div>
            <button type="submit" disabled={passwordLoading} className="auth-submit-btn"
              style={{ borderRadius: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Delivery Addresses Shortcut Card */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Link href="/account/addresses" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div
              style={{
                background: "#fff", border: "2px solid #000",
                padding: "20px 24px", display: "flex", justifyContent: "space-between",
                alignItems: "center", transition: "box-shadow 0.15s, background 0.15s",
                cursor: "pointer"
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = "#f8fafc";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "4px 4px 0px #000";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = "#fff";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MapPinIcon size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: "#000" }}>
                    Saved Delivery Addresses
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#777", marginTop: 2 }}>
                    Add, label and manage your Indian shipping locations
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#000", flexShrink: 0 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em" }}>Manage</span>
                <ChevronRightIcon size={16} color="#000" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
