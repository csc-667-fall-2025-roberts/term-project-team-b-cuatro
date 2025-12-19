// imports
import express from "express";
import session from "express-session";
import path from "path";
import { pool } from "../databases/db";
import bcrypt from "bcrypt";


type ChatMessage = {
  nickname: string;
  text: string;
  ts: number;
};


type GameRoom = {
  roomCode: string;
  host: string;
  bots: number;
  players: {username: string; nickname:string}[];
  chat: ChatMessage[];
};

const games = new Map<string, GameRoom>();

function generateRoomCode(length = 6){
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++){
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}


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


router.post("/api/games/create", (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Not logged in");
  }

  const { nickname, bots } = req.body;

  if (!nickname) {
    return res.status(400).send("Missing nickname");
  }

  const botCount = Number(bots);
  if (isNaN(botCount) || botCount < 0 || botCount > 9) {
    return res.status(400).send("Invalid bot count");
  }

  let roomCode = generateRoomCode();
  while (games.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  const game: GameRoom = {
    roomCode,
    host: req.session.user.username,
    bots: botCount,
    players: [
      {
        username: req.session.user.username,
        nickname
      }
    ],
    chat:[]
  };

  games.set(roomCode, game);

  // store game info in session
  req.session.game = {
    roomCode,
    role: "host",
    nickname
  };

  return res.redirect(`/game/${roomCode}`);
});


router.post("/api/games/join", (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Not logged in");
  }

  const { nickname, roomCode } = req.body;

  if (!nickname || !roomCode) {
    return res.status(400).send("Missing fields");
  }

  const code = roomCode.trim().toUpperCase();
  const game = games.get(code);

  if (!game) {
    return res.status(404).send("Room not found");
  }

  game.players.push({
    username: req.session.user.username,
    nickname
  });

  req.session.game = {
    roomCode: code,
    role: "player",
    nickname
  };

  return res.redirect(`/game/${code}`);
});


router.get("/game/:roomCode", (req, res) => {
  if (!req.session.user || !req.session.game) {
    return res.redirect("/lobby");
  }

  // const roomCode = req.params.roomCode.trim().toUpperCase();
  const game = games.get(req.params.roomCode);
  if (!game) return res.redirect("/lobby");

  const isHost = game.host === req.session.user.username;

return res.render("game-waiting", {
  roomCode: game.roomCode,
  players: game.players,
  chat: game.chat,
  isHost,
  myNickname: req.session.game.nickname

  });
});

router.get("/api/games/:roomCode/players", (req, res) => {
  const roomCode = req.params.roomCode.trim().toUpperCase();
  const game = games.get(roomCode);
  if (!game) return res.status(404).json([]);
  return res.json(game.players);
});



router.get("/api/games/:roomCode/chat", (req, res) => {
  const roomCode = req.params.roomCode.trim().toUpperCase();
  const game = games.get(roomCode);
  if (!game) return res.status(404).json([]);
  return res.json(game.chat.slice(-50));
});

router.post("/api/games/:roomCode/chat", (req, res) => {
  if (!req.session.user || !req.session.game) {
    return res.status(401).send("Not logged in");
  }

  const roomCode = req.params.roomCode.trim().toUpperCase();

  if (req.session.game.roomCode !== roomCode) {
    return res.status(403).send("Not in this room");
  }

  const game = games.get(roomCode);
  if (!game) return res.status(404).send("Room not found");

  const text = (req.body.text || "").toString().trim();
  if (!text) return res.status(400).send("Empty message");
  if (text.length > 200) return res.status(400).send("Message too long");

  game.chat.push({
    nickname: req.session.game.nickname,
    text,
    ts: Date.now()
  });

  return res.status(201).json({ ok: true });
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