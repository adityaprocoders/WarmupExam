import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from "dotenv";
dotenv.config(); 

import sanitizeMiddleware from "./middleware/sanitize.js";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import methodOverride from "method-override";
import session from "express-session";
import flash from "connect-flash";
import MongoStore from "connect-mongo";
import compression from "compression";   



import connectDB from "./config/Db.js";
import passport from "./config/passport.js";
import ExpressError from "./utils/ExpressError.js";
import errorHandler from "./middleware/errorHandler.js";
import ownerRoutes from "./routes/ownerRoutes.js";
import { doubleCsrfProtection, generateCsrfToken } from "./config/csrf.js";
import { safeJsonStringify } from "./utils/safeJson.js";



import pageRoutes from "./routes/pageRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import testBuilderRoutes from "./routes/testBuilderRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import attemptRoutes from "./routes/attemptRoutes.js";
import copyPasteRoutes from "./routes/copyPasteRoutes.js";
import enrollRoutes from "./routes/enrollRoutes.js";
import { isOwnerUser } from "./utils/authHelpers.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";




const app = express();
const isProd = process.env.NODE_ENV === "production";
app.set('trust proxy', 1);

// ---------------- SECURITY + PERFORMANCE ----------------
 
app.use(compression());
 

app.use(sanitizeMiddleware);
const PORT = process.env.PORT || 8080;

connectDB();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);





app.use(express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
}));


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(cookieParser());


// ---------------- GLOBAL SEO ----------------
app.use((req, res, next) => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    res.locals.title = "WarmupExam";
    res.locals.description =
        "Practice mock tests, PYQs and AI-powered exam preparation with WarmupExam.";

    res.locals.keywords =
        "WarmupExam, Mock Test, BOARD EXAM, NIMCET, UPSC, SSC, Banking, Railway, JEE, NEET";

    res.locals.ogImage = `${baseUrl}/images/og-banner.jpg`;

    res.locals.canonicalUrl = `${baseUrl}${req.originalUrl}`;
     
     res.locals.safeJsonStringify = safeJsonStringify;

    next();
});


// ---------------- SESSION + PASSPORT ----------------
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    }
}));


app.use((req, res, next) => {
    if (!req.session) return next();
    if (!req.session.initialized) {
        req.session.initialized = true;  
    }
    next();
});

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
 

 
app.use((req, res, next) => {
    const skipCsrfPrefixes = [
        "/api/upload-image",
        "/alltests",
        "/tests",
        "/test",
        "/profile",
        "/attempt",    
        "/api/attempt",
    ];

    const shouldSkip = skipCsrfPrefixes.some(prefix => req.path.startsWith(prefix));

    if (shouldSkip) {
        return next();
    }

    try {
        return doubleCsrfProtection(req, res, next);
    } catch (err) {
        return next(err);
    }
})


app.use((req, res, next) => {
    const hasExistingCsrfCookie = Boolean(req.cookies?.["csrf-token"]);
    res.locals.csrfToken = generateCsrfToken(req, res, !hasExistingCsrfCookie);

    next();
});


app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});



app.use(async (req, res, next) => {
    try {
        if (req.user && !isOwnerUser(req)) {
            await req.user.populate([
                { path: "enrolledListings.listing", select: "slug" },
                { path: "lastAccessedBatch", select: "slug" }
            ]);
        }

        res.locals.currentUser = req.user || null;
        res.locals.isOwner = isOwnerUser(req);
        res.locals.success = req.flash('success');
        res.locals.error = req.flash('error');
        next();
    } catch (err) {
        next(err);
    }
});


  

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(expressLayouts);
app.set("layout", "layouts/main");

// ---------------- ROUTES ----------------

app.use(pageRoutes);
app.use(authRoutes);
app.use("/", ownerRoutes);
app.use(listingRoutes);
app.use(enrollRoutes);
app.use(paymentRoutes);
app.use(couponRoutes); 
app.use(dashboardRoutes);
app.use(itemRoutes);
app.use(testBuilderRoutes);
app.use(uploadRoutes);
app.use(attemptRoutes);
app.use(copyPasteRoutes);
app.use(profileRoutes);
app.use("/", contactRoutes);
app.use(orderRoutes);

// Error

if (process.env.NODE_ENV !== "production") {
    app.get('/test-error', (req, res) => {
        res.render('pages/error', { message: 'This is a test error message.', layout: false });
    });
}


// ---------------- 404 ----------------
app.use((req, res, next) => {
    if (req.originalUrl === '/.well-known/appspecific/com.chrome.devtools.json') {
        return res.status(204).end();
    }
    console.log("❌ 404 Hit:", req.method, req.originalUrl);
    next(new ExpressError(404, "Page Not Found"));
});



app.use(errorHandler);


app.listen(PORT, () => {
    console.log(`Server Running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});
