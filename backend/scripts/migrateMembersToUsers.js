import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Member from '../src/models/Member.js';
import User from '../src/models/User.js';

const apply = process.argv.includes('--apply');

function memberProfileFrom(member) {
  return {
    memberId: member.memberId,
    fullName: member.fullName,
    email: member.email.toLowerCase(),
    phone: member.phone,
    gender: member.gender,
    dateOfBirth: member.dateOfBirth,
    address: member.address,
    joiningDate: member.joiningDate,
    plan: member.plan,
    startDate: member.startDate,
    expiryDate: member.expiryDate,
    lastMembershipPaymentAt: member.lastMembershipPaymentAt,
    status: member.status,
    sourceMember: member._id,
    recordCreatedAt: member.createdAt,
  };
}

function membershipFrom(member) {
  return {
    plan: member.plan,
    startDate: member.startDate,
    expiryDate: member.expiryDate,
    lastMembershipPaymentAt: member.lastMembershipPaymentAt,
    status: member.status,
  };
}

async function buildPlan(members) {
  const users = await User.collection.find({}).toArray();
  const userByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
  const userByLegacyMember = new Map(
    users.filter((user) => user.legacyMember).map((user) => [String(user.legacyMember), user])
  );
  const memberIds = new Set();
  const memberEmails = new Set();
  const plan = [];

  for (const member of members) {
    const email = member.email.toLowerCase();
    if (memberIds.has(member.memberId)) throw new Error(`Duplicate member ID in members: ${member.memberId}`);
    if (memberEmails.has(email)) throw new Error(`Duplicate member email in members: ${email}`);
    memberIds.add(member.memberId);
    memberEmails.add(email);

    const user = userByEmail.get(email);
    const linkedUser = userByLegacyMember.get(String(member._id));
    if (linkedUser && String(linkedUser._id) !== String(user?._id)) {
      throw new Error(`Member ${member.memberId} is already linked to a different user.`);
    }
    if (user?.legacyMember && String(user.legacyMember) !== String(member._id)) {
      throw new Error(`User ${email} is already linked to a different member.`);
    }
    if (user?.memberProfile?.sourceMember && String(user.memberProfile.sourceMember) !== String(member._id)) {
      throw new Error(`User ${email} already has a different migrated member profile.`);
    }
    if (user?.memberProfile?.memberId && user.memberProfile.memberId !== member.memberId) {
      throw new Error(`User ${email} already uses member ID ${user.memberProfile.memberId}.`);
    }
    if (user?.password && member.password && user.password !== member.password) {
      throw new Error(`User ${email} and member ${member.memberId} have different password hashes; refusing to overwrite either credential.`);
    }

    const idCollision = !user && await User.collection.findOne({ _id: member._id });
    const userId = user?._id || (idCollision ? new mongoose.Types.ObjectId() : member._id);
    plan.push({
      member,
      user,
      userId,
      action: user?.memberProfile?.sourceMember
        ? 'already migrated'
        : user
          ? 'merge member profile into existing user'
          : 'create user from member',
    });
  }
  return plan;
}

async function migrate({ member, user, userId }) {
  if (user?.memberProfile?.sourceMember) return 'already migrated';

  const now = new Date();
  const set = {
    legacyMember: member._id,
    memberProfile: memberProfileFrom(member),
    updatedAt: now,
  };
  if (!user?.password && member.password) set.password = member.password;
  if (!user?.accountStatus) {
    set.accountStatus = member.status === 'Inactive' ? 'Inactive' : 'Active';
  }
  if (!user?.membership?.plan) set.membership = membershipFrom(member);

  if (user) {
    await User.collection.updateOne(
      { _id: user._id, 'memberProfile.sourceMember': { $exists: false } },
      { $set: set }
    );
    const saved = await User.collection.findOne({ _id: user._id });
    if (String(saved?.memberProfile?.sourceMember) !== String(member._id)) {
      throw new Error(`Could not safely merge member ${member.memberId} into user ${user.email}.`);
    }
    return 'merged';
  }

  const newUser = {
    _id: userId,
    fullName: member.fullName,
    email: member.email.toLowerCase(),
    phone: member.phone,
    ...(member.password ? { password: member.password } : {}),
    role: 'member',
    accountStatus: member.status === 'Inactive' ? 'Inactive' : 'Active',
    legacyMember: member._id,
    membership: membershipFrom(member),
    memberProfile: memberProfileFrom(member),
    createdAt: member.createdAt || now,
    updatedAt: member.updatedAt || now,
  };
  await User.collection.insertOne(newUser);
  return 'created';
}

async function main() {
  await connectDB();
  await User.init();
  const members = await Member.find({}).select('+password').sort({ memberId: 1 }).lean();
  const plan = await buildPlan(members);

  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Member records inspected: ${members.length}`);
  for (const item of plan) console.log(`${item.action}: ${item.member.memberId}`);

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write User records. The members collection is never modified.');
    return;
  }

  let created = 0;
  let merged = 0;
  let alreadyMigrated = 0;
  for (const item of plan) {
    const result = await migrate(item);
    if (result === 'created') created += 1;
    else if (result === 'merged') merged += 1;
    else alreadyMigrated += 1;
  }

  const migratedCount = await User.countDocuments({ 'memberProfile.sourceMember': { $exists: true } });
  const passwordSetupRequired = await User.countDocuments({
    'memberProfile.sourceMember': { $exists: true },
    password: { $exists: false },
  });
  console.log(`Migration complete. Created: ${created}; merged: ${merged}; already migrated: ${alreadyMigrated}.`);
  console.log(`User member profiles: ${migratedCount}; password setup required: ${passwordSetupRequired}.`);
  console.log('Existing Member documents and payment references were left unchanged.');
}

main()
  .catch((error) => {
    console.error(`Member migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
