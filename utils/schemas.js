import Joi from "joi";

// ==================== AUTH & PROFILE (already done) ====================

export const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required().messages({
        "string.empty": "Name is required",
        "string.min": "Name must be at least 2 characters",
        "string.max": "Name cannot exceed 50 characters"
    }),
    email: Joi.string().trim().lowercase().email().required().messages({
        "string.empty": "Email is required",
        "string.email": "Please enter a valid email address"
    }),
    password: Joi.string().min(6).required().messages({
        "string.empty": "Password is required",
        "string.min": "Password must be at least 6 characters"
    }),
    returnTo: Joi.string().allow("", null)
});

export const loginSchema = Joi.object({
    email: Joi.string().trim().required().messages({
        "string.empty": "Email or username is required"
    }),
    password: Joi.string().required().messages({
        "string.empty": "Password is required"
    }),
    returnTo: Joi.string().allow("", null)
});

export const forgotPasswordSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required().messages({
        "string.empty": "Email is required",
        "string.email": "Please enter a valid email address"
    })
});

export const resetPasswordSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    otp: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
        "string.length": "OTP must be 6 digits",
        "string.pattern.base": "OTP must contain only numbers"
    }),
    newPassword: Joi.string().min(6).required().messages({
        "string.min": "Password must be at least 6 characters"
    })
});

export const updateProfileSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    username: Joi.string().trim().lowercase().pattern(/^[a-z0-9_]{3,20}$/).allow("", null).messages({
        "string.pattern.base": "Username must be 3-20 characters (letters, numbers, underscore only)"
    }),
    email: Joi.string().trim().lowercase().email().allow("", null),
    mobile: Joi.string().trim().pattern(/^[6-9]\d{9}$/).allow("", null).messages({
        "string.pattern.base": "Please enter a valid 10-digit Indian mobile number"
    }),
    city: Joi.string().trim().max(50).allow("", null),
    class: Joi.string().trim().allow("", null),
    exam: Joi.string().trim().allow("", null)
});

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        "string.empty": "Current password is required"
    }),
    newPassword: Joi.string().min(6).required().messages({
        "string.empty": "New password is required",
        "string.min": "New password must be at least 6 characters"
    })
});


// ==================== COUPON ====================

export const createCouponSchema = Joi.object({
    code: Joi.string().trim().uppercase().min(3).max(20).required().messages({
        "string.empty": "Coupon code is required",
        "string.min": "Coupon code must be at least 3 characters",
        "string.max": "Coupon code cannot exceed 20 characters"
    }),

    discountType: Joi.string().valid("flat", "percentage").required().messages({
        "any.only": "Discount type must be 'flat' or 'percentage'",
        "string.empty": "Discount type is required"
    }),

    discountValue: Joi.number().positive().required().messages({
        "number.base": "Discount value must be a number",
        "number.positive": "Discount value must be greater than 0",
        "any.required": "Discount value is required"
    }),

    // Percentage discount 100% se zyada nahi ho sakta
    maxDiscount: Joi.number().min(0).allow(null),

    minPurchase: Joi.number().min(0).default(0),

    applicableListings: Joi.array().items(
        Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
            "string.pattern.base": "Invalid listing ID"
        })
    ).default([]),

    expiryDate: Joi.date().greater("now").allow(null).messages({
        "date.greater": "Expiry date must be in the future"
    }),

    usageLimit: Joi.number().integer().min(1).allow(null),

    perUserLimit: Joi.number().integer().min(1).default(1),

    isActive: Joi.boolean().default(true)
})
// Custom rule: discountValue percentage type ho to 100 se zyada nahi ho sakta
.custom((value, helpers) => {
    if (value.discountType === "percentage" && value.discountValue > 100) {
        return helpers.error("any.invalid", { message: "Percentage discount cannot exceed 100" });
    }
    return value;
}, "Percentage discount validation")
.messages({
    "any.invalid": "Percentage discount cannot exceed 100"
});

export const applyCouponSchema = Joi.object({
    code: Joi.string().trim().uppercase().required().messages({
        "string.empty": "Coupon code is required"
    }),
    listingId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        "string.pattern.base": "Invalid listing ID"
    }),
    cartAmount: Joi.number().min(0).required()
});


// ==================== LISTING ====================



export const createListingSchema = Joi.object({
    title: Joi.string().trim().min(3).max(150).required().messages({
        "string.empty": "Title is required",
        "string.min": "Title must be at least 3 characters"
    }),

    shortDescription: Joi.string().trim().max(150).required().messages({
        "string.empty": "Short description is required",
        "string.max": "Short description cannot exceed 150 characters"
    }),

    description: Joi.string().trim().min(10).required().messages({
        "string.empty": "Description is required",
        "string.min": "Description must be at least 10 characters"
    }),

    // Image file se aata hai (multer), body me sirf URL string ho sakta hai agar kabhi manually diya jaye
    image: Joi.string().uri().allow("", null).messages({
        "string.uri": "Image must be a valid URL"
    }),

    type: Joi.string().valid("Free", "Paid").default("Free"),

    price: Joi.number().min(0).default(0),

    originalPrice: Joi.number().min(0).required().messages({
        "any.required": "Original price is required",
        "number.min": "Original price cannot be negative"
    }),

    discountPercentage: Joi.number().min(0).max(100).default(0),

    language: Joi.string().trim().default("English"),

    exam: Joi.string().trim().required().messages({
        "string.empty": "Exam is required"
    }),

    marks: Joi.array().items(
        Joi.object({
            subject: Joi.string().trim().required().messages({
                "string.empty": "Subject name is required"
            }),
            positiveMarks: Joi.number().default(0),
            negativeMarks: Joi.number().default(0),
            qualifyingOnly: Joi.boolean().truthy("true").falsy("false", "").default(false)
        })
    ).default([]),

    rankPredictorData: Joi.array().items(
        Joi.object({
            marks: Joi.alternatives().try(Joi.number(), Joi.string().allow("")).optional(),
            rank: Joi.alternatives().try(Joi.number(), Joi.string().allow("")).optional()
        })
    ).default([]),

    validityDays: Joi.number().integer().min(1).default(365),

    visibility: Joi.string().valid("private", "public").default("private")
})
.custom((value, helpers) => {
    if (value.type === "Paid" && (!value.price || value.price <= 0)) {
        return helpers.error("any.invalid");
    }
    return value;
}, "Paid listing price validation")
.messages({
    "any.invalid": "Price must be greater than 0 for paid listings"
});


// ==================== SECTION / FOLDER / FILE ====================

export const createSectionSchema = Joi.object({
    title: Joi.string().trim().min(2).max(100).required().messages({
        "string.empty": "Section title is required"
    }),
    icon: Joi.string().trim().allow("", null)
});

export const createFolderSchema = Joi.object({
    title: Joi.string().trim().min(1).max(100).required().messages({
        "string.empty": "Folder name is required"
    }),
    icon: Joi.string().trim().allow("", null),
    section: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        "string.pattern.base": "Invalid section ID"
    })
});

export const createFileSchema = Joi.object({
    title: Joi.string().trim().min(1).max(150).required().messages({
        "string.empty": "File name is required"
    }),
    fileUrl: Joi.string().uri().allow("", null),
    fileType: Joi.string().trim().allow("", null),
    size: Joi.number().min(0).default(0)
});


// ==================== TEST BUILDER ====================

// ==================== TEST BUILDER ====================

export const createTestSchema = Joi.object({
    title: Joi.string().trim().min(2).max(150).required().messages({
        "string.empty": "Test title zaroori hai"
    }),

    listingId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        "string.pattern.base": "Invalid listing ID",
        "any.required": "listingId missing hai"
    }),

    sectionId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, ""),

    parentType: Joi.string().valid("section", "folder", "file").default("section"),
    parentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, ""),

    timeStrategy: Joi.string().valid("total", "subject").default("total"),

    duration: Joi.number().integer().min(1).default(60),

    subjectTime: Joi.array().items(
        Joi.object({
            subject: Joi.string().trim().required(),
            duration: Joi.number().integer().min(1).required()
        })
    ).default([]),

    visibility: Joi.string().valid("public", "private", "scheduled").default("private"),

    publishAt: Joi.date().when("visibility", {
        is: "scheduled",
        then: Joi.date().required().messages({
            "any.required": "Schedule ke liye publish date/time zaroori hai"
        }),
        otherwise: Joi.date().allow(null, "")
    }),

    totalQuestions: Joi.number().integer().min(0),

    questions: Joi.array().items(
        Joi.object({
            subject: Joi.string().trim().allow("", null),
            type: Joi.string().valid("mcq", "numeric").default("mcq"),
            topic: Joi.string().trim().allow("", null),
            subTopic: Joi.string().trim().allow("", null),
            difficulty: Joi.string().valid("Easy", "Medium", "Hard").default("Medium"),
            question: Joi.string().trim().allow("", null),
            questionImage: Joi.string().uri().allow("", null),
            options: Joi.array().items(Joi.any()).default([]),
            correctAnswers: Joi.array().items(Joi.any()).default([]),
            numericAnswer: Joi.number().allow(null),
            solution: Joi.object({
                text: Joi.string().allow("", null),
                image: Joi.string().uri().allow("", null)
            }).default({ text: "", image: null }),
            order: Joi.number().integer().min(1),
            _id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, "")
        }).unknown(true)
    ).default([])
})
.unknown(true);

export const updateTestSchema = createTestSchema.fork(["listingId"], (schema) =>
    schema.optional()
);

export const addTestQuestionSchema = Joi.object({
    test: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    question: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    order: Joi.number().integer().min(1).required(),
    positiveMarks: Joi.number().min(0).default(0),
    negativeMarks: Joi.number().min(0).default(0)
});

 

// ==================== PAYMENT / RAZORPAY ====================

export const createOrderSchema = Joi.object({
    listingId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        "string.pattern.base": "Invalid listing ID",
        "any.required": "listingId is required"
    }),

    donationAmount: Joi.number().min(0).default(0).messages({
        "number.base": "Donation amount must be a number",
        "number.min": "Donation amount cannot be negative"
    }),

    couponCode: Joi.string().trim().uppercase().allow("", null)
});

export const verifyPaymentSchema = Joi.object({
    razorpay_order_id: Joi.string().trim().required().messages({
        "string.empty": "razorpay_order_id is required"
    }),

    razorpay_payment_id: Joi.string().trim().required().messages({
        "string.empty": "razorpay_payment_id is required"
    }),

    razorpay_signature: Joi.string().trim().required().messages({
        "string.empty": "razorpay_signature is required"
    }),

    listingId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
        "string.pattern.base": "Invalid listing ID",
        "any.required": "listingId is required"
    }),

    couponId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, "").messages({
        "string.pattern.base": "Invalid coupon ID"
    })
});