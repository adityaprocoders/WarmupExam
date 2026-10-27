import mongoose from "mongoose";
import { retryPendingPurchaseEmails } from "../utils/sendPurchaseEmail.js";

const EVERY_MS = 10 * 60 * 1000;   // har 30 minute
let running = false;

async function tick() {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try {
        const r = await retryPendingPurchaseEmails();
        if (r.tried) console.log(`[PurchaseEmailRetry] tried=${r.tried} sent=${r.sent}`);
    } catch (e) {
        console.error("[PurchaseEmailRetry] failed:", e.message);
    } finally {
        running = false;
    }
}

setInterval(tick, EVERY_MS).unref();