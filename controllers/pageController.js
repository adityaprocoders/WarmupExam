import Listing from "../models/listing.js";
import Test from "../models/Test.js";

export const home = async (req, res) => {
    const isOwner = req.user && req.user.role === "owner";

    const filter = isOwner ? {} : { visibility: "public" };
    const tests = await Listing.find(filter).limit(6).lean();

    // Total tests count nikalo har listing ke liye
    const listingIds = tests.map(l => l._id);
    const testCounts = await Test.aggregate([
        { $match: { listing: { $in: listingIds } } },
        { $group: { _id: "$listing", count: { $sum: 1 } } }
    ]);
    const testCountMap = {};
    testCounts.forEach(t => { testCountMap[String(t._id)] = t.count; });

    tests.forEach(l => {
        l.totalTestCount = testCountMap[String(l._id)] || 0;
    });

    let enrolledIds = [];
    let enrolledExpiryMap = {};
    if (req.user && req.user.enrolledListings) {
        req.user.enrolledListings.forEach(e => {
            const id = e.listing && e.listing._id ? e.listing._id : e.listing;
            enrolledIds.push(String(id));
            enrolledExpiryMap[String(id)] = e.expiresAt;
        });
    }

    res.render("pages/home", { tests, enrolledIds, enrolledExpiryMap, isOwner });
};

export const aboutUs = (req, res) => res.render("pages/UI/AboutUs");
export const contactUs = (req, res) => res.render("pages/UI/contactUs");
export const termsOfUse = (req, res) => res.render("pages/UI/termsOfUse");
export const privacyPolicy = (req, res) => res.render("pages/UI/privacyPolicy");
export const features = (req, res) => res.render("pages/UI/features");