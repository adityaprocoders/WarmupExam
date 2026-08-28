import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isOwner } from "../middleware/isLoggedIn.js";
import * as categoryController from "../controllers/categoryController.js";
import { validateBody } from "../middleware/validate.js";
import { createCategorySchema } from "../utils/schemas.js";

const router = express.Router();

router.get("/categories", wrapAsync(categoryController.getAllCategories));

router.post(
    "/categories",
    isOwner,
    validateBody(createCategorySchema, "category"),
    wrapAsync(categoryController.createCategory)
);

router.get("/categories/:id/edit", isOwner, wrapAsync(categoryController.editCategoryForm));

router.put(
    "/categories/:id",
    isOwner,
    validateBody(createCategorySchema, "category"),
    wrapAsync(categoryController.updateCategory)
);

router.delete("/categories/:id", isOwner, wrapAsync(categoryController.deleteCategory));

router.get("/api/categories/:slug/tests", wrapAsync(categoryController.getCategoryTestsApi));

router.get("/categories/:slug", wrapAsync(categoryController.showCategory));

  
router.get("/api/categories/:slug/search-suggestions", wrapAsync(categoryController.getCategorySearchSuggestions));
 
export default router;