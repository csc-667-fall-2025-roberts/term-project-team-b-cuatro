import express from "express";


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

// Router for API endpoints
// Mounted at /api/games
const gamesApiRouter = express.Router();

gamesApiRouter.post("/create", (req, res) => {
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


gamesApiRouter.post("/join", (req, res) => {
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

gamesApiRouter.get("/:roomCode/players", (req, res) => {
  const roomCode = req.params.roomCode.trim().toUpperCase();
  const game = games.get(roomCode);
  if (!game) return res.status(404).json([]);
  return res.json(game.players);
});


gamesApiRouter.get("/:roomCode/chat", (req, res) => {
  const roomCode = req.params.roomCode.trim().toUpperCase();
  const game = games.get(roomCode);
  if (!game) return res.status(404).json([]);
  return res.json(game.chat.slice(-50));
});

gamesApiRouter.post("/:roomCode/chat", (req, res) => {
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


/**
 * Router for game pages:
 * Mounted at: /game
 */

const gamePageRouter = express.Router();

gamePageRouter.get("/:roomCode", (req, res) => {
  if (!req.session.user || !req.session.game) {
    return res.redirect("/lobby");
  }

  const roomCode = req.params.roomCode.trim().toUpperCase();
  const game = games.get(roomCode);
  if (!game) return res.redirect("/lobby");

  const isHost = game.host === req.session.user.username;

  return res.render("game-waiting", {
    roomCode: game.roomCode,
    players: game.players,
    chat: game.chat,
    isHost,
    myNickname: req.session.game.nickname,
  });
});

export { gamesApiRouter, gamePageRouter };