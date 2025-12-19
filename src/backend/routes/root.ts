// imports
import express from "express";
import session from "express-session";
import path from "path";
import { pool } from "../databases/db";
import bcrypt from "bcrypt";

import { games } from "./game";

// routing to index
const router = express.Router();

router.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});
router.post("/", (_req, res) => {
  res.send("you posted");
});
router.get("/lobby", (req, res)=> {
  if(!req.session.user){
    return res.redirect("/login.html");
  }
  return res.render("lobby", {username: req.session.user.username});
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
          SELECT id, username, email, password_hash
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
          req.session.user = {
            id: user.id,
            username: user.username,
            email:user.email
          };
          return res.redirect("/lobby");
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

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Logout failed");
    res.redirect("/");
  });
});

router.post("/messages/send", (req, res) => {
  if (!req.session.user || !req.session.game) {
    return res.redirect("/login.html");
  }

  const roomCode = String(req.session.game.roomCode || "").trim().toUpperCase();
  if (!roomCode) return res.redirect("/lobby");

  const game = games.get(roomCode);
  if (!game) return res.redirect("/lobby");

  const text = String(req.body.message || "").trim();
  if (!text) return res.redirect(`/game.html?roomCode=${roomCode}`);
  if (text.length > 200) return res.redirect(`/game.html?roomCode=${roomCode}`);

  game.chat.push({
    nickname: req.session.game.nickname,
    text,
    ts: Date.now(),
  });

  // game.html lives at /game.html, not /game/:code
  return res.redirect(`/game.html?roomCode=${roomCode}`);
});

// router.post("/api/games/:roomCode", (req, res) => {
//   if (!req.session.user || !req.session.game) {
//     return res.status(401).send("Not logged in");
//   }

//   const roomCode = req.params.roomCode.trim().toUpperCase();

//   // only allow posting to the room the user is actually in
//   if (req.session.game.roomCode !== roomCode) {
//     return res.status(403).send("Not in this room");
//   }

//   const text = (req.body.text || "").toString().trim();
//   if (!text) return res.status(400).send("Empty message");
//   if (text.length > 200) return res.status(400).send("Message too long");

//   const nickname = req.session.game.nickname;

//   const arr = chats.get(roomCode) ?? [];
//   arr.push({ nickname, text, ts: Date.now() });
//   chats.set(roomCode, arr);

//   return res.status(201).json({ ok: true });
// });


// router.post("/api/chat/:roomCode", (req, res) => {
//   if (!req.session.user || !req.session.game) {
//     return res.redirect("/lobby");
//   }

//   const game = games.get(req.params.roomCode);
//   if (!game) {
//     return res.redirect("/lobby");
//   }

//   const message = req.body.message;
//   if (!message) {
//     return res.redirect(`/game/${req.params.roomCode}`);
//   }

//   game.chat.push({
//     sender: req.session.game.nickname,
//     text: message,
//     time: new Date().toLocaleTimeString([], {
//       hour: "2-digit",
//       minute: "2-digit"
//     })
//   });

//   return res.redirect(`/game/${req.params.roomCode}`);
// });




export default router;