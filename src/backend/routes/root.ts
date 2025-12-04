// imports
import express from "express";
import path from "path";
import { pool } from "../databases/db";

// routing to index
const router = express.Router();
router.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});
router.post("/", (_req, res) => {
  res.send("you posted");
});

// // api endpoints
// router.get("/games", async (_req, res,) => {
//   try{
//     const result = await pool.query("SELECT * FROM games");
//     res.json(result.rows)
//   } catch (err){
//     res.status(500);
//   }
// });

export default router;