import crypto from 'crypto';
import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  otp: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // Document will be automatically deleted after 5 minutes (300 seconds)
  },
});

// Every endpoint that issues an OTP stores it in plaintext, so every endpoint
// that checks one must compare it the same way. Keeping that in one place is
// what stops another `bcrypt.compare(otp, plaintextOtp)` — a check that can
// never succeed, which is how change-password silently stopped working.
//
// A wrong code burns an attempt and the record dies after MAX_ATTEMPTS, so a
// six-digit code guarding a wallet PIN cannot simply be brute-forced inside
// its five-minute life.
const MAX_ATTEMPTS = 5;

otpSchema.statics.consume = async function (email, otp) {
  const record = await this.findOne({ email });
  if (!record) return false;

  if (record.otp !== String(otp)) {
    record.attempts += 1;
    if (record.attempts >= MAX_ATTEMPTS) await this.deleteOne({ _id: record._id });
    else await record.save();
    return false;
  }

  await this.deleteOne({ _id: record._id });
  return true;
};

// Same attempt accounting as consume, but leaves a correct code in place for a
// later step (signup verifies the email first and creates the account after).
otpSchema.statics.check = async function (email, otp) {
  const record = await this.findOne({ email });
  if (!record) return false;
  if (record.otp === String(otp)) return true;
  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) await this.deleteOne({ _id: record._id });
  else await record.save();
  return false;
};

// Issues a fresh code: CSPRNG, and a new code always starts with a full set of attempts.
otpSchema.statics.issue = async function (email) {
  const otp = String(crypto.randomInt(100000, 1000000));
  await this.findOneAndUpdate(
    { email },
    { otp, attempts: 0, createdAt: Date.now() },
    { upsert: true, returnDocument: 'after' }
  );
  return otp;
};

// Avoid recompiling the model if it already exists
const Otp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);

export default Otp;
