import crypto from "crypto";

// naya unique session id generate karo
export const generateSessionId = () => crypto.randomBytes(24).toString("hex");