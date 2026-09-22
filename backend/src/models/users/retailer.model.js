import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const retailerSchema = new mongoose.Schema(
  {
    retailerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Icchhamati MATM outlets are provider-provisioned and may differ from
    // the normal retailer/AEPS merchant code.
    matmOutletId: {
      type: String,
      trim: true,
      default: null,
    },
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minLength: [3, 'Name must be at least 3 characters long'],
    },
    prefix: { type: String, default: 'Mr' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: String },

    // Packages
    dmtPackage: { type: String },
    rechargePackage: { type: String },
    aepsPackage: { type: String },
    bbpsPackage: { type: String },
    payoutPackage: { type: String },
    cmsPackage: { type: String },
    ccpayPackage: { type: String },
    payinPackage: { type: String },
    upiPackage: { type: String },

    // Branding / Info
    website: { type: String },
    brandName: { type: String },
    companyRegisterName: { type: String },
    supportEmail: { type: String },
    supportMobile: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    contactNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      city: { type: String, required: true },
      landmark: { type: String },
      district: { type: String, required: true },
      state: { type: String, required: true },
    },
    businessName: { type: String, required: true },
    businessAddress: { type: String, required: true },
    aadhaarNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^[2-9]{1}[0-9]{11}$/, 'Please enter a valid Aadhar number'],
    },
    aadhaarPicture: { type: String, required: true }, // Cloudinary URL
    panNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number'],
    },
    panPicture: { type: String, required: true }, // Cloudinary URL
    hasGst: { type: Boolean, default: false },
    gstNumber: { type: String },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      default: 'retailer',
    },
    profilePicture: {
      type: String,
      default: null,
    },
    customers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
      },
    ],
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
    },
    lastDailyAuthDate: {
      type: Date,
      default: null,
    },
    dailyAuthDates: {
      type: Map,
      of: Date,
      default: {},
    },
    isMerchantKycComplete: {
      type: Boolean,
      default: false,
    },
    isExistingMerchant: {
      type: Boolean,
      default: false,
    },
    activeAepsPipes: [
      {
        type: String,
      },
    ],
    lastPipeCheckDate: {
      type: Date,
      default: null,
    },
    // PaySprint's registered base location for AEPS geo-fencing, and the audit
    // trail behind it. PaySprint caps base-location changes at three per
    // merchant per calendar year and silently no-ops past that, so every
    // successful change is counted here — otherwise a retailer burns the quota
    // without anyone knowing and every later attempt appears to work while
    // changing nothing.
    aepsBaseLocation: {
      lat: { type: Number, default: null },
      long: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
      // Reset when the calendar year in `countYear` no longer matches today's.
      countYear: { type: Number, default: null },
      countThisYear: { type: Number, default: 0 },
    },

    // The virtual account behind this retailer's collection QR. Standing, not
    // per-payment, so it is kept rather than regenerated on every visit.
    collectionQr: {
      virtualAccountId: { type: String, default: null },
      upiHandle: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      settlement: { type: String, default: 'ICCHHAMATI_MAIN_WALLET' },
    },
  },
  { timestamps: true }
);

retailerSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

const Retailer = mongoose.model('Retailer', retailerSchema);
export default Retailer;
