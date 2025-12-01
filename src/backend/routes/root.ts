import express from "express";
import path from "path";

const router = express.Router();

router.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

router.post("/", (_req, res) => {
  res.send("you posted");
});

export default router;
