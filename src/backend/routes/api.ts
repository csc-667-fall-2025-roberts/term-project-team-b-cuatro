// imports
import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../databases/db";

const router = express.Router();

// ---------- API ENDPOINTS ----------

// handle signups
router.post("/signup", async (req, res) => {
    try{
        // get data
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        // ensure data is present
        if(!username || !email || !password){
            return res.status(400).send("Missing required fields");
        }

        // hash password (for security reasons)
        const password_hash = await bcrypt.hash(password, 10);

        // attempt to insert data
        let query = `
            INSERT INTO users (username, email, password_hash)
            VALUES (${username}, ${email}, ${password_hash}})
        `

        let result =  await pool.query(query)
    } catch (err: any) {

        // specific error code for accounts that exist already
        if(err.code === "23505"){
            return res.status(400).send("Email already in use!");
        }

        // generic error
        return res.status(500); 
    }
});
