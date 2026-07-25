import { Router } from "express";
import { optimizeRoute, saveRoute, listRoutes, deleteRoute } from "../controllers/routeController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// anyone can optimize, even guests - login is only needed to save/view history
router.post("/optimize", optimizeRoute);
router.post("/", requireAuth, saveRoute);
router.get("/", requireAuth, listRoutes);
router.delete("/:id", requireAuth, deleteRoute);

export default router;
