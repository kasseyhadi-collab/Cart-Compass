import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import storesRouter from "./stores";
import compareRouter from "./compare";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(storesRouter);
router.use(compareRouter);
router.use(adminRouter);

export default router;
