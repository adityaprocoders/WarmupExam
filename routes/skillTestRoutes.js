import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import * as skillTestController from "../controllers/skillTestController.js";

const router = express.Router();

router.get("/skill-tests/typing-test", wrapAsync(skillTestController.typingTest));
router.get("/skill-tests/data-entry-test", wrapAsync(skillTestController.dataEntryTest));
router.get("/skill-tests/calculation-test", wrapAsync(skillTestController.calculationTest));

export default router;