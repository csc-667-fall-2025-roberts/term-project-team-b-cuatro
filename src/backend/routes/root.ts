// imports
import express from "express";
import path from "path";
import { pool } from "../databases/db";
import bcrypt from "bcrypt";

// routing to index
const router = express.Router();
router.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});
router.post("/", (_req, res) => {
  res.send("you posted");
});

// ---------- API ENDPOINTS ----------

// handle signups for new users
router.post("/auth/signup", async (req, res, next) => {
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

        // create user
        let query = `
        INSERT INTO users (username, email, password_hash) 
        VALUES ($1, $2, $3)
        `

        let result =  await pool.query(query, [username, email, password_hash])
        console.log("New user:", result.rows[0]);

        res.sendFile(path.join(__dirname, "../../frontend/login.html"));
        //   return res
        // .status(201)
        // .send(`Signed up as ${result.rows[0].username} with id ${result.rows[0].id}`);

    } catch (err: any) {

        // specific error code for accounts that exist already
        if(err.code === "23505"){
          return res.status(400).send("Email already in use!");
        }

        // generic error
        next(err)
    }
});

// handle logins for existing users
router.post("/auth/login", async (req, res, next) => {
    try{
        // get data
        const username = req.body.username; //or email!
        const password = req.body.password;

        // ensure data is present
        if(!username || !password){
            return res.status(400).send("Missing required fields");
        }

        // get and compare passwords for validation
        const query = `
          SELECT username, password_hash
          FROM users
          WHERE username = $1 OR email = $1
          LIMIT 1
        `;
        const result = await pool.query(query, [username]);
        // no user found
        if (result.rows.length === 0) {
          return res.status(400).send("user not found");
        }
        const user = result.rows[0];
        
        if(await bcrypt.compare(password, user.password_hash)){
          return res.sendFile(path.join(__dirname, "../../frontend/lobby.html"));
          // return res.render("lobby", { username: user.username });
        }
        
        console.log(bcrypt.hash(password, 10))
        console.log(user.password_hash)
        return res.status(400).send("password invalid");
       

    } catch (err: any) {
        // generic error
        next(err)
    }
});








export default router;