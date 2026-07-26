import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import User from "../models/usersShema.js"; 


passport.use(
    "user-local",
    new LocalStrategy(
        { usernameField: "email" },
        async (identifier, password, done) => {
            try {
                const cleaned = identifier.trim().toLowerCase();

                const user = await User.findOne({
                    authProvider: "local",
                    $or: [
                        { email: cleaned },
                        { username: cleaned }
                    ]
                });

                if (!user) {
                    return done(null, false, { message: "User not found" });
                }
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return done(null, false, { message: "Incorrect password" });
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    )
);

passport.use(
    "user-google",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/api/auth/google/callback"
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });
                if (!user) {
                    user = await User.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id,
                        avatar: profile.photos?.[0]?.value || null,
                        authProvider: "google",
                        isVerified: true
                    });
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    )
);

 
passport.use(
    "owner-local",
    new LocalStrategy(
        { usernameField: "email" },
        async (email, password, done) => {
            try {
                if (email !== process.env.OWNER_EMAIL) {
                    return done(null, false, { message: "Owner not found" });
                }

                const isMatch = await bcrypt.compare(password, process.env.OWNER_PASSWORD_HASH);
                if (!isMatch) {
                    return done(null, false, { message: "Incorrect password" });
                }

                const ownerUser = {
                    id: "owner",
                    email: process.env.OWNER_EMAIL,
                    role: "owner",
                    enrolledListings: [],
                    lastAccessedBatch: null
                };

                return done(null, ownerUser);
            } catch (err) {
                return done(err);
            }
        }
    )
);



passport.serializeUser((user, done) => {
    if (user.role === "owner") {
        return done(null, { id: "owner", type: "owner" });
    }
    done(null, { id: user.id, type: "user" });
});

passport.deserializeUser(async (obj, done) => {
    try {
        if (obj.type === "owner") {
            return done(null, { id: "owner", email: process.env.OWNER_EMAIL, role: "owner" });
        }
        const user = await User.findById(obj.id)
            .populate("enrolledListings.listing")
            .populate("lastAccessedBatch");
        return done(null, user);
    } catch (err) {
        done(err);
    }
})
 

export default passport;