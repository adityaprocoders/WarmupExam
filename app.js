import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);


import crypto from 'crypto';
import dotenv from "dotenv";
dotenv.config(); 

import sanitizeMiddleware from "./middleware/sanitize.js";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import methodOverride from "method-override";
import session from "express-session";
import flash from "connect-flash";
import MongoStore from "connect-mongo";
import compression from "compression";   
import helmet from "helmet";


import connectDB from "./config/Db.js";
import passport from "./config/passport.js";
import ExpressError from "./utils/ExpressError.js";
import errorHandler from "./middleware/errorHandler.js";
import ownerRoutes from "./routes/ownerRoutes.js";
import { doubleCsrfProtection, generateCsrfToken } from "./config/csrf.js";
import { safeJsonStringify } from "./utils/safeJson.js";
import { checkSingleSession } from "./middleware/checkSingleSession.js";


import pageRoutes from "./routes/pageRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import contentBlockRoutes from "./routes/contentBlockRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import testBuilderRoutes from "./routes/testBuilderRoutes.js";
import ownerDailyWarmupRoutes from "./routes/ownerDailyWarmupRoutes.js";
import dailyWarmupRoutes from "./routes/dailyWarmupRoutes.js";
import generatePaperRoutes from "./routes/generatePaperRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import attemptRoutes from "./routes/attemptRoutes.js";
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import copyPasteRoutes from "./routes/copyPasteRoutes.js";
import enrollRoutes from "./routes/enrollRoutes.js";
import { isOwnerUser } from "./utils/authHelpers.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

import minifyHTML from "express-minify-html-terser";


const app = express();
const isProd = process.env.NODE_ENV === "production";
app.set('trust proxy', 1);


// ---------------- FORCE HTTPS (production only) ----------------
if (isProd) {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        next();
    });
}

// ---------------- SECURITY + PERFORMANCE ----------------
 
app.use(compression());
  
 
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
});
 
app.use((req, res, next) => {
    helmet({
        contentSecurityPolicy: isProd ? {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    (req, res) => `'nonce-${res.locals.cspNonce}'`,    
                    "https://checkout.razorpay.com",
                    "https://cdnjs.cloudflare.com",
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com",
                    "https://checkout-static-next.razorpay.com",
                    "https://browser.sentry-cdn.com",
                    "https://api.sardine.ai",
                    "https://pagead2.googlesyndication.com",
                    "https://googleads.g.doubleclick.net",
                    "https://www.googletagservices.com",
                    "https://adservice.google.com"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",  
                    "https://cdnjs.cloudflare.com",
                    "https://cdn.jsdelivr.net",
                    "https://fonts.googleapis.com"
                ],
                fontSrc: [
                    "'self'",
                    "https://cdnjs.cloudflare.com",
                    "https://cdn.jsdelivr.net",
                    "https://fonts.gstatic.com",
                    "data:"
                ],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: [
                    "'self'",
                    "https://api.razorpay.com",
                    "https://lumberjack.razorpay.com",
                    "https://api.sardine.ai",
                    "https://pagead2.googlesyndication.com",
                    "https://googleads.g.doubleclick.net"
                ],
                frameSrc: [
                    "https://api.razorpay.com",
                    "https://checkout.razorpay.com",
                    "https://googleads.g.doubleclick.net",
                    "https://tpc.googlesyndication.com",
                    "https://www.google.com"
                ],
                workerSrc: ["'self'", "blob:"],
                manifestSrc: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'", "https://checkout.razorpay.com"],
                frameAncestors: ["'self'"],
                upgradeInsecureRequests: [],
                reportUri: ['/csp-violation-report'],
            },
        } : false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })(req, res, next);
});





app.use((req, res, next) => {
    const richTextRoutes = ['/tests', '/owner/content-library'];
    const isRichTextRoute = richTextRoutes.some(prefix =>
        req.path.startsWith(prefix) && ['POST', 'PUT'].includes(req.method)
    );
    if (isRichTextRoute) return next();
    sanitizeMiddleware(req, res, next);
});


const PORT = process.env.PORT || 8080;

connectDB();

// cron

import "./cron/dailyWarmupCron.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.get("/sw.js", (req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(__dirname, "public", "sw.js"));
});

app.use(express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
}));


app.use('/vendor/ckeditor5', express.static(path.join(__dirname, 'node_modules/ckeditor5/dist')));

app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));
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
app.use(checkSingleSession);

 
app.use((req, res, next) => {
    const skipCsrfPrefixes = [
        "/api/upload-image",
        "/alltests",
        "/tests",
        "/test",
        "/attempt",    
        "/api/attempt",
        "/content-blocks",
        "/owner/content-library",
        
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
                { path: "enrolledListings.listing", select: "slug title type price" },
                { path: "lastAccessedBatch", select: "slug title type price" }
            ]);
        }

        res.locals.currentUser = req.user || null;
        res.locals.isOwner = isOwnerUser(req);
        res.locals.success = req.flash('success');
        res.locals.error = req.flash('error');

        const now = new Date();
        const hasActivePaidEnrollment = req.user?.enrolledListings?.some(
            (e) => e.amountPaid > 0 && (!e.expiresAt || e.expiresAt > now)
        );
        res.locals.showAds = res.locals.isOwner ? false : !hasActivePaidEnrollment;

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

    app.use(
        minifyHTML({
            override: true,
            exception_url: false,
            htmlMinifier: {
                removeComments: true,
                collapseWhitespace: true,
                collapseBooleanAttributes: true,
                removeEmptyAttributes: true,
                removeRedundantAttributes: true,
                minifyJS: false,    
                minifyCSS: false,   
            },
        })
    );


app.use(pageRoutes);
app.use("/", categoryRoutes);
app.use(authRoutes);
app.use("/", ownerRoutes);
app.use(listingRoutes);
app.use(contentBlockRoutes);
app.use(enrollRoutes);
app.use(paymentRoutes);
app.use(couponRoutes); 
app.use(dashboardRoutes);
app.use(itemRoutes);
app.use(testBuilderRoutes);
app.use(dailyWarmupRoutes);
app.use(ownerDailyWarmupRoutes);
app.use(generatePaperRoutes);
app.use(uploadRoutes);
app.use(attemptRoutes);
app.use('/', leaderboardRoutes);
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



app.post(
    '/csp-violation-report',
    express.json({ type: ['application/json', 'application/csp-report'] }),
    (req, res) => {
        console.warn('🚨 CSP Violation:', JSON.stringify(req.body, null, 2));
        res.status(204).end();
    }
);


// ---------------- 404 ----------------
app.use((req, res, next) => {
    if (req.originalUrl === '/.well-known/appspecific/com.chrome.devtools.json') {
        return res.status(204).end();
    }
    if (!isProd) {
        console.log("❌ 404 Hit:", req.method, req.originalUrl);
    }
    next(new ExpressError(404, "Page Not Found"));
});

 

app.use(errorHandler);


app.listen(PORT, () => {
    console.log(`Server Running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});
 