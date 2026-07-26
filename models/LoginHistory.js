import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema({
  ownerEmail: { type: String, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  device: { type: String },
  location: { type: String },
  status: { type: String, enum: ["success", "failed"], default: "success" },
  createdAt: { type: Date, default: Date.now, expires: 2592000 },
});

const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);
export default LoginHistory;