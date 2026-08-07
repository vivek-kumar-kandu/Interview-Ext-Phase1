import React from 'react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="space-y-4">{children}</div>;
};
