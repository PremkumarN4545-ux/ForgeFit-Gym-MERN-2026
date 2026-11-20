// Usage:
//   npm run seed               -> creates the initial admin + the 4 default plans
//   npm run seed:demo          -> also adds sample members and payments (only if no members exist)
//   node seed.js --reset-password -> resets the admin's password to ADMIN_PASSWORD from .env
import { env } from './src/config/env.js';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import Admin from './src/models/Admin.js';
import Plan from './src/models/Plan.js';
import Member from './src/models/Member.js';
import User from './src/models/User.js';
import Payment from './src/models/Payment.js';
import { nextSequence } from './src/models/Counter.js';
import { addMonths, deriveStatus, todayUTC } from './src/utils/dates.js';
import { EMAIL_RE } from './src/utils/validators.js';

const withDemo = process.argv.includes('--demo');
const resetPassword = process.argv.includes('--reset-password');

const DEFAULT_PLANS = [
  { name: 'Monthly', durationMonths: 1, price: 1000, description: 'Flexible month-to-month access to the gym floor.', benefits: ['Full gym access', 'Locker room access', 'Free fitness assessment'] },
  { name: 'Quarterly', durationMonths: 3, price: 2700, description: 'Three months of training at a reduced rate.', benefits: ['Full gym access', 'Locker room access', 'Group classes', 'One trainer consultation'] },
  { name: 'Half-Yearly', durationMonths: 6, price: 5000, description: 'Six months of commitment with extra savings.', benefits: ['Full gym access', 'Group classes', 'Monthly progress check', 'Diet guidance'] },
  { name: 'Yearly', durationMonths: 12, price: 9000, description: 'Best value: a full year of training.', benefits: ['Full gym access', 'Group classes', 'Monthly progress check', 'Diet guidance', 'Two guest passes'] },
];

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'ForgeFit Admin').trim();
  if (!EMAIL_RE.test(email)) throw new Error('ADMIN_EMAIL in .env is missing or invalid');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD in .env must be at least 8 characters');

  const existing = await Admin.findOne({ email });
  if (!existing) {
    await Admin.create({ name, email, password }); // password is bcrypt-hashed by the model hook
    console.log(`Admin created: ${email}`);
  } else if (resetPassword) {
    existing.password = password;
    await existing.save();
    console.log(`Admin password reset: ${email}`);
  } else {
    console.log(`Admin already exists: ${email} (use --reset-password to change the password)`);
  }
}

async function seedPlans() {
  for (const p of DEFAULT_PLANS) {
    const res = await Plan.updateOne({ name: p.name }, { $setOnInsert: { ...p, status: 'Active' } }, { upsert: true });
    console.log(res.upsertedCount ? `Plan created: ${p.name}` : `Plan exists: ${p.name}`);
  }
}

async function seedDemo() {
  if ((await Member.countDocuments()) > 0 || (await User.countDocuments({ 'memberProfile.memberId': { $exists: true } })) > 0) {
    console.log('Member records already exist - skipping demo data.');
    return;
  }
  const people = [
    ['Arjun Kumar', 'Male'], ['Priya Nair', 'Female'], ['Rahul Menon', 'Male'], ['Divya Raj', 'Female'],
    ['Karthik S', 'Male'], ['Meena Iyer', 'Female'], ['Sanjay Patel', 'Male'], ['Anita Joseph', 'Female'],
    ['Vikram Rao', 'Male'], ['Lakshmi P', 'Female'], ['Naveen B', 'Male'], ['Sneha Das', 'Female'],
  ];
  const demoEmails = people.map(([fullName]) => `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`);
  if (await User.exists({ email: { $in: demoEmails } })) {
    console.log('A demo account email already exists - skipping demo data.');
    return;
  }
  const plans = await Plan.find().sort({ durationMonths: 1 });
  const today = todayUTC();
  const methods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

  for (let i = 0; i < people.length; i += 1) {
    const [fullName, gender] = people[i];
    const plan = plans[i % plans.length];
    const monthsAgo = (i * 2) % 9; // spread joins over the last ~9 months
    const startDate = addMonths(today, -monthsAgo);
    const expiryDate = addMonths(startDate, plan.durationMonths);
    const seq = await nextSequence('member');
    const memberId = `FF-${String(seq).padStart(4, '0')}`;
    const status = deriveStatus(expiryDate, 'Active');
    const user = await User.create({
      fullName,
      email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      phone: `98765${String(10000 + i * 137).slice(0, 5)}`,
      accountStatus: 'Active',
      membership: { plan: plan._id, startDate, expiryDate, status },
      memberProfile: {
        memberId,
        fullName,
        email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        phone: `98765${String(10000 + i * 137).slice(0, 5)}`,
        gender,
        dateOfBirth: new Date(Date.UTC(1990 + (i % 10), i % 12, 10 + i)),
        address: `${10 + i}, Demo Street, Sample City`,
        joiningDate: startDate,
        plan: plan._id,
        startDate,
        expiryDate,
        status,
        recordCreatedAt: new Date(),
      },
    });

    const pseq = await nextSequence('payment');
    await Payment.create({
      paymentId: `PAY-${String(pseq).padStart(5, '0')}`,
      user: user._id,
      memberCode: memberId,
      memberName: fullName,
      memberEmail: user.email,
      memberPhone: user.phone,
      plan: plan._id,
      planName: plan.name,
      planDurationMonths: plan.durationMonths,
      membershipStartDate: startDate,
      membershipExpiryDate: expiryDate,
      amount: plan.price,
      paymentDate: startDate,
      method: methods[i % methods.length],
      transactionRef: i % 2 ? `DEMO-TXN-${1000 + i}` : undefined,
      // A couple of non-paid rows so the "only Paid counts as revenue" rule is visible.
      status: i === 3 ? 'Pending' : i === 7 ? 'Failed' : 'Paid',
    });
  }
  console.log(`Demo data created: ${people.length} members with payments.`);
}

async function main() {
  await connectDB();
  await seedAdmin();
  await seedPlans();
  if (withDemo) await seedDemo();
  await mongoose.connection.close();
  console.log('Seeding finished.');
}

main().catch(async (err) => {
  console.error(`Seed failed: ${err.message}`);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
