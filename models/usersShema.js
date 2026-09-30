import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    username: {
        type: String,
        unique: true,
        sparse: true,      // 👈 FIX: null username duplicate-key error se bachne ke liye
        trim: true,
        lowercase: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        default: null
    },

    resetOtp: {
        type: String,
        default: null
    },

    resetOtpExpiry: {
        type: Date,
        default: null
    },

        resetToken: {
        type: String,
        default: null
    },

    resetTokenExpiry: {
        type: Date,
        default: null
    },

    authProvider: {
        type: String,
        enum: ["local", "google"],
        required: true
    },

    googleId: {
        type: String,
    },

    avatar: {
        type: String,
        default: null
    },

    avatarChangedAt: {
        type: Date,
        default: null
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    mobile: {
        type: String,
        default: null,
        trim: true
    },

    city: {
        type: String,
        default: null,
        trim: true
    },

    class: {
        type: String,
        default: null,
        trim: true
    },

    exam: {
        type: String,
        default: null,
        trim: true
    },

    passwordChangeLog: [
        {
            type: Date
        }
    ],

    enrolledListings: [
        {
            listing: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Listing"
            },
            enrolledAt: {
                type: Date,
                default: Date.now
            },
            expiresAt: {
                type: Date,
                default: null
            },
            paymentId: {
                type: String,
                default: null
            },
            orderId: {
                type: String,
                default: null
            },
            amountPaid: {
                type: Number,
                default: 0
            },
            suspendedByOwner: {
                type: Boolean,
                default: false
            }
        }
    ],

    lastAccessedBatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
        default: null
    },

        banned: {
        type: Boolean,
        default: false
    },
    banReason: {
        type: String,
        enum: [
            "CHEATING", "QUESTION_ANSWER_SHARING", "TEST_RESULT_MANIPULATION",
            "LEADERBOARD_MANIPULATION", "UNAUTHORIZED_TEST_ASSISTANCE",
            "ACCOUNT_SHARING", "MULTIPLE_ACCOUNT_ABUSE", "UNAUTHORIZED_ACCESS",
            "PAID_CONTENT_ABUSE", "COUPON_OFFER_ABUSE", "PAYMENT_REFUND_ABUSE",
            "BOT_AUTOMATION", "API_ABUSE", "DATA_SCRAPING",
            "VULNERABILITY_EXPLOITATION", "RESTRICTION_BYPASS",
            "SPAM", "HARASSMENT", "THREATENING_BEHAVIOR",
            "FRAUDULENT_ACTIVITY", "IMPERSONATION",
            "SUSPICIOUS_ACTIVITY", "COMPROMISED_ACCOUNT", "SECURITY_VIOLATION",
            "REPEATED_POLICY_VIOLATION", "TERMS_VIOLATION", "OTHER"
        ],
        default: null
    },
    banType: {
        type: String,
        enum: ["permanent", "temporary"],
        default: null
    },
    bannedAt: {
        type: Date,
        default: null
    },
    banExpiresAt: {
        type: Date,
        default: null
    },

    activeSessionId: {
        type: String,
        default: null
    },

    
    permissions: {
        type: [String],
        default: []
    },

    customTestTier: {
        type: String,
        enum: ["free", "pro", "promax"],
        default: "free"
    },

    customTestExpiresAt: {
        type: Date,
        default: null
    },

}, { timestamps: true });

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);