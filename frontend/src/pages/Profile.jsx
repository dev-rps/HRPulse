import React, { useState } from 'react';
import ProfileView from './Profile/ProfileView.jsx';
import ProfileEdit from './Profile/ProfileEdit.jsx';

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveComplete = (updatedUser) => {
    setIsEditing(false);
    // Reload state if needed. React AuthProvider will handle global updates.
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-sans text-text">My Profile</h1>
        <p className="text-sm text-text-muted mt-1">
          Manage your personal identifiers, corporate employment metadata, and payroll compensation.
        </p>
      </div>

      {isEditing ? (
        <ProfileEdit
          onCancel={() => setIsEditing(false)}
          onSaveComplete={handleSaveComplete}
        />
      ) : (
        <ProfileView onEditClick={() => setIsEditing(true)} />
      )}
    </div>
  );
}
