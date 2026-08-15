import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import * as itemController from "../controllers/itemController.js";

const router = express.Router();

router.post("/api/create-item", isLoggedIn, isOwner, wrapAsync(itemController.createItem));
router.get("/api/item/:type/:id", isLoggedIn, isOwner, wrapAsync(itemController.getItem));
router.put("/api/update-item/:id", isLoggedIn, isOwner, wrapAsync(itemController.updateItem));
router.delete("/api/delete-item/:id", isLoggedIn, isOwner, wrapAsync(itemController.deleteItem));

export default router;