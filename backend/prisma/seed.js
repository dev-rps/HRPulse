'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Starting database seeding...');

  // 1. Clean existing records to avoid conflicts
  console.log('[SEED] Cleaning existing database records...');
  await prisma.emailVerification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.document.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.user.deleteMany();

  // 2. Generate common password hash
  const passwordHash = await bcrypt.hash('Secret@123', 12);

  // 3. Create Admin User
  console.log('[SEED] Creating organizational users...');
  const admin = await prisma.user.create({
    data: {
      employee_id: 'ADM001',
      name: 'Aditya Sen',
      email: 'admin@hrpulse.dev',
      password_hash: passwordHash,
      role: 'admin',
      is_verified: true,
      department: 'HR',
      job_title: 'HR Director',
      date_of_joining: new Date('2024-01-01T00:00:00.000Z'),
    },
  });

  // 4. Create Employees across 2 departments (Engineering, Marketing)
  const employeesData = [
    {
      employee_id: 'EMP001',
      name: 'Riya Sharma',
      email: 'riya@hrpulse.dev',
      password_hash: passwordHash,
      role: 'employee',
      is_verified: true,
      department: 'Engineering',
      job_title: 'Senior Software Engineer',
      date_of_joining: new Date('2024-06-15T00:00:00.000Z'),
      phone: '+91-9000000001',
      address: 'Sector 62, Noida, UP, India',
    },
    {
      employee_id: 'EMP002',
      name: 'Aarav Mehta',
      email: 'aarav@hrpulse.dev',
      password_hash: passwordHash,
      role: 'employee',
      is_verified: true,
      department: 'Engineering',
      job_title: 'QA Engineer',
      date_of_joining: new Date('2024-10-01T00:00:00.000Z'),
      phone: '+91-9000000002',
      address: 'Andheri West, Mumbai, Maharashtra, India',
    },
    {
      employee_id: 'EMP003',
      name: 'Kabir Dev',
      email: 'kabir@hrpulse.dev',
      password_hash: passwordHash,
      role: 'employee',
      is_verified: true,
      department: 'Marketing',
      job_title: 'Content Specialist',
      date_of_joining: new Date('2024-03-10T00:00:00.000Z'),
      phone: '+91-9000000003',
      address: 'Indiranagar, Bengaluru, Karnataka, India',
    },
    {
      employee_id: 'EMP004',
      name: 'Aditi Rao',
      email: 'aditi@hrpulse.dev',
      password_hash: passwordHash,
      role: 'employee',
      is_verified: true,
      department: 'Marketing',
      job_title: 'Marketing Manager',
      date_of_joining: new Date('2024-02-01T00:00:00.000Z'),
      phone: '+91-9000000004',
      address: 'Gachibowli, Hyderabad, Telangana, India',
    },
  ];

  const employees = [];
  for (const empData of employeesData) {
    const emp = await prisma.user.create({ data: empData });
    employees.push(emp);
  }

  // 5. Seed default Leave Balances for all employees (year 2026)
  const currentYear = new Date().getFullYear();
  console.log(`[SEED] Seeding leave balances for year ${currentYear}...`);
  for (const emp of employees) {
    await prisma.leaveBalance.createMany({
      data: [
        { user_id: emp.id, leave_type: 'paid', total_days: 20, used_days: 0, year: currentYear },
        { user_id: emp.id, leave_type: 'sick', total_days: 10, used_days: 0, year: currentYear },
        { user_id: emp.id, leave_type: 'unpaid', total_days: 99, used_days: 0, year: currentYear },
      ],
    });
  }

  // 6. Seed Salary Structures for all employees (historical records)
  console.log('[SEED] Seeding employee compensation packages...');
  const baseSalaries = {
    EMP001: { basic: 60000, hra: 24000, allowances: 15000, deductions: 5000 },
    EMP002: { basic: 40000, hra: 16000, allowances: 10000, deductions: 3000 },
    EMP003: { basic: 35000, hra: 14000, allowances: 8000, deductions: 2500 },
    EMP004: { basic: 70000, hra: 28000, allowances: 20000, deductions: 6000 },
  };

  for (const emp of employees) {
    const sal = baseSalaries[emp.employee_id];
    const net = sal.basic + sal.hra + sal.allowances - sal.deductions;
    // Initial salary (6 months ago)
    await prisma.salaryStructure.create({
      data: {
        user_id: emp.id,
        basic: sal.basic - 5000,
        hra: sal.hra - 2000,
        allowances: sal.allowances,
        deductions: sal.deductions,
        net_salary: (sal.basic - 5000) + (sal.hra - 2000) + sal.allowances - sal.deductions,
        effective_from: new Date('2025-07-01T00:00:00.000Z'),
      },
    });
    // Current salary (effective from beginning of 2026)
    await prisma.salaryStructure.create({
      data: {
        user_id: emp.id,
        basic: sal.basic,
        hra: sal.hra,
        allowances: sal.allowances,
        deductions: sal.deductions,
        net_salary: net,
        effective_from: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  }

  // 7. Seed Attendance History (past 2 weeks of logs, weekdays only)
  console.log('[SEED] Creating attendance sheets for the past 2 weeks...');
  const checkInTimes = [
    { hour: 9, min: 15 }, // present
    { hour: 9, min: 45 }, // present
    { hour: 10, min: 15 }, // half_day
    { hour: 9, min: 30 }, // present
  ];

  const today = new Date();
  for (let i = 14; i >= 0; i--) {
    const logDate = new Date(today);
    logDate.setDate(today.getDate() - i);
    const dayOfWeek = logDate.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const dateStr = logDate.toISOString().split('T')[0];
    const dateMidnight = new Date(dateStr + 'T00:00:00.000Z');

    for (let j = 0; j < employees.length; j++) {
      const emp = employees[j];
      const punchTime = checkInTimes[j];
      
      // Randomize check-out vs check-in, sometimes absent
      const isAbsent = (i === 4 && j === 1) || (i === 8 && j === 3); // some absent days
      const isLeave = (i === 1 && j === 0); // riya was on approved leave

      if (isAbsent) {
        await prisma.attendance.create({
          data: {
            user_id: emp.id,
            date: dateMidnight,
            status: 'absent',
          },
        });
      } else if (isLeave) {
        await prisma.attendance.create({
          data: {
            user_id: emp.id,
            date: dateMidnight,
            status: 'leave',
          },
        });
      } else {
        const checkIn = new Date(dateMidnight);
        checkIn.setHours(punchTime.hour, punchTime.min, 0, 0);

        const checkOut = new Date(dateMidnight);
        checkOut.setHours(18, 0, 0, 0); // 6:00 PM check-out

        await prisma.attendance.create({
          data: {
            user_id: emp.id,
            date: dateMidnight,
            check_in_time: checkIn,
            check_out_time: checkOut,
            status: punchTime.hour >= 10 && punchTime.min > 0 ? 'half_day' : 'present',
            synced_offline: i % 5 === 0, // mock some synced offline
          },
        });
      }
    }
  }

  // 8. Seed Leave Requests (different statuses)
  console.log('[SEED] Creating sample leave requests...');
  // Pending request (Riya)
  await prisma.leaveRequest.create({
    data: {
      user_id: employees[0].id,
      leave_type: 'paid',
      start_date: new Date('2026-08-10T00:00:00.000Z'),
      end_date: new Date('2026-08-14T00:00:00.000Z'),
      remarks: 'Going for summer vacation with family.',
      status: 'pending',
    },
  });

  // Approved request (Aarav, overlaps Riya's past leave)
  const approvedReq = await prisma.leaveRequest.create({
    data: {
      user_id: employees[1].id,
      leave_type: 'sick',
      start_date: new Date('2026-07-02T00:00:00.000Z'),
      end_date: new Date('2026-07-03T00:00:00.000Z'),
      remarks: 'High fever and cold.',
      status: 'approved',
      approved_by: admin.id,
      admin_comment: 'Approved. Rest well and recover.',
      updated_at: new Date('2026-07-01T10:00:00.000Z'),
    },
  });

  // Record Aarav's leave balance consumption
  await prisma.leaveBalance.update({
    where: {
      user_id_leave_type_year: {
        user_id: employees[1].id,
        leave_type: 'sick',
        year: 2026,
      },
    },
    data: { used_days: 2 },
  });

  // Audit log for the approved request
  await prisma.auditLog.create({
    data: {
      actor_id: admin.id,
      action: 'LEAVE_APPROVED',
      entity: 'leave_requests',
      entity_id: approvedReq.id,
      timestamp: new Date('2026-07-01T10:00:00.000Z'),
    },
  });

  // Rejected request (Kabir)
  await prisma.leaveRequest.create({
    data: {
      user_id: employees[2].id,
      leave_type: 'paid',
      start_date: new Date('2026-09-01T00:00:00.000Z'),
      end_date: new Date('2026-09-05T00:00:00.000Z'),
      remarks: 'Attending friend\'s wedding.',
      status: 'rejected',
      approved_by: admin.id,
      admin_comment: 'Rejected due to major product launch during this week. Please reschedule.',
      updated_at: new Date('2026-07-03T14:30:00.000Z'),
    },
  });

  console.log('[SEED] Database seeding complete! ✓');
}

main()
  .catch((e) => {
    console.error('[SEED] Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
