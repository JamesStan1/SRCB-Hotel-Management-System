"use client";

import { useState } from 'react';
import StaffList from './staff-list/page';
import AttendancePayroll from './attendance/page';
import PayrollPage from './payroll/page';
import ReportsPage from './reports/page';
import ArchivedStaff from './archived_staff/page';

export default function StaffManagement({ activeSubPage }) {
  return (
    <div className="p-6">
      {activeSubPage === 'staff-management' && <StaffList />}
      {activeSubPage === 'staff' && <StaffList />}
      {activeSubPage === 'attendance' && <AttendancePayroll activeTab="attendance" />}
      {activeSubPage === 'payroll' && <PayrollPage activeTab="payroll" />}
      {activeSubPage === 'reports' && <ReportsPage activeTab="reports" />}
      {activeSubPage === 'archived-staff' && <ArchivedStaff />}
    </div>
  );
}
