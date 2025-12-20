import express from "express";
import { runBotTurn } from "./bots";
import { scheduleBotTurns } from "./bots";

type ChatMessage = {
  nickname: string;
  text: string;
  ts: number;
};

export type UnoColor = "red" | "yellow" | "green" | "blue" | "wild";
export type UnoValue =
    | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
    | "skip" | "reverse" | "draw2"
    | "wild" | "wild_draw4";

export type UnoCard = {
    id: string;         // unique id for click/play
    color: UnoColor;
    value: UnoValue;
};

export type Player = {
    username: string;
    nickname: string;
    hand?: UnoCard[];
};

export type GameStatus = "waiting" | "running" | "finished";

export type GameRoom = {
    roomCode: string;
    host: string;
    bots: number;
    //players: {username: string; nickname:string}[];
    players: Player[];
    chat: ChatMessage[];

    // ---- gameplay state ----
    status: GameStatus;
    deck: UnoCard[];
    discard: UnoCard[];
    currentTurnIndex: number;
    direction: 1 | -1;
    pendingDraw: number;     // e.g. 2 or 4
    pendingSkip: boolean;
    awaitingWildColor: boolean;
};


// Game Storage
export const games = new Map<string, GameRoom>();

function generateRoomCode(length = 6){
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < length; i++){
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}


// Uno Helpers
function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createDeck(): UnoCard[] {
    const colors: Exclude<UnoColor, "wild">[] = ["red", "yellow", "green", "blue"];
    const deck: UnoCard[] = [];

    // Standard-ish UNO (simplified but playable)
    // One 0 per color
    for (const c of colors) {
        deck.push({ id: uid(), color: c, value: "0" });
    }

    // Two of each 1-9, skip, reverse, draw2 per color
    const twice: UnoValue[] = ["1","2","3","4","5","6","7","8","9","skip","reverse","draw2"];
    for (const c of colors) {
        for (const v of twice) {
        deck.push({ id: uid(), color: c, value: v });
        deck.push({ id: uid(), color: c, value: v });
        }
    }

    // Wilds
    for (let i = 0; i < 4; i++) deck.push({ id: uid(), color: "wild", value: "wild" });
    for (let i = 0; i < 4; i++) deck.push({ id: uid(), color: "wild", value: "wild_draw4" });

    return deck;
}

function shuffle<T>(arr: T[]): T[] {
    // Fisher-Yates
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function topDiscard(room: GameRoom): UnoCard | undefined {
    return room.discard[room.discard.length - 1];
}

function normalizeIndex(i: number, n: number) {
    return ((i % n) + n) % n;
}

function nextTurn(room: GameRoom, steps = 1) {
    const n = room.players.length;
    room.currentTurnIndex = normalizeIndex(room.currentTurnIndex + steps * room.direction, n);
}

function findPlayer(room: GameRoom, username: string) {
    return room.players.find(p => p.username === username);
}

function isPlayersTurn(room: GameRoom, username: string) {
    return room.players[room.currentTurnIndex]?.username === username;
}

function canPlay(card: UnoCard, top: UnoCard): boolean {
    // wilds always playable
    if (card.value === "wild" || card.value === "wild_draw4") return true;
    // match color or value
    return card.color === top.color || card.value === top.value;
}

function drawCards(room: GameRoom, player: Player, count: number) {
    player.hand ??= [];
    for (let i = 0; i < count; i++) {
        if (room.deck.length === 0) {
        // recycle discard into deck (keep top)
        const top = room.discard.pop();
        const rest = room.discard.splice(0);
        room.deck = shuffle(rest);
        room.discard = top ? [top] : [];
        }
        const c = room.deck.pop();
        if (c) player.hand.push(c);
    }
}

function applyPendingDrawIfAny(game: GameRoom, player: Player) {
    if (game.pendingDraw > 0) {
        drawCards(game, player, game.pendingDraw);
        game.pendingDraw = 0;
        return true;
    }
    return false;
}

// Call this right after turns advance.
// If the next player must draw (because of +2/+4), do it immediately and end their turn.
function startTurn(game: GameRoom) {
    const player = game.players[game.currentTurnIndex];
    if (!player) return;

    // If the next player owes cards, they draw and lose the turn.
    if (applyPendingDrawIfAny(game, player)) {
        nextTurn(game, 1);
    }
}


// Router for API endpoints
// Mounted at /api/games
const gamesApiRouter = express.Router();

const MAX_BOTS = 3;
const MAX_TOTAL_PLAYERS = 4;

function isValidStartingCard(card: UnoCard) {
  return (
    card.value !== "wild" &&
    card.value !== "wild_draw4" &&
    card.value !== "skip" &&
    card.value !== "reverse" &&
    card.value !== "draw2"
  );
}

function startGame(game: GameRoom) {
  // init deck + deal
  game.deck = shuffle(createDeck());
  game.discard = [];
  game.direction = 1;
  game.pendingDraw = 0;
  game.pendingSkip = false;
  game.awaitingWildColor = false;

  // deal 7 each
  for (const p of game.players) p.hand = [];
  for (const p of game.players) drawCards(game, p, 7);

  // flip first non-wild card to discard
  let first = game.deck.pop();
  while (first && !isValidStartingCard(first)) {
    game.deck.unshift(first);
    first = game.deck.pop();
  }
  if (!first) return false;

  game.discard.push(first);

  // first player's turn
  game.currentTurnIndex = 0;
  game.chat = [];
  game.status = "running";

  scheduleBotTurns(game);
  return true;
}
 

gamesApiRouter.post("/create", (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Not logged in");
    }

    const { nickname, bots } = req.body;

    if (!nickname) {
        return res.status(400).send("Missing nickname");
    }


    const botCountRaw = Number(bots);
    if (isNaN(botCountRaw) || botCountRaw < 0 || botCountRaw > MAX_BOTS) {
        return res.status(400).send("Invalid bot count");
    }
    const botCount = (){
        if(botCountRaw == 0){
            return 1;
        }
        return botCountRaw;
    }
    // -------------------
//     const botCount = Number(bots);
//     if (isNaN(botCount) || botCount < 0 || botCount > 3) {
//         return res.status(400).send("Invalid bot count");
//     }

//     let roomCode = generateRoomCode();
//     while (games.has(roomCode)) {
//         roomCode = generateRoomCode();
//     }

//     const game: GameRoom = {
//         roomCode,
//         host: req.session.user.username,
//         bots: botCount,
//         players: [
//         {
//             username: req.session.user.username,
//             nickname,
//             hand:[]
//         }
//         ],
//         chat:[],

//         status: "waiting",
//         deck: [],
//         discard: [],
//         currentTurnIndex: 0,
//         direction: 1,
//         pendingDraw: 0,
//         pendingSkip: false,
//         awaitingWildColor: false,
//     };

//     // Add bots as players right away (no hands yet)
// for (let i = 0; i < botCount; i++) {
//     game.players.push({
//         username: `BOT_${i + 1}`,
//         nickname: `Bot ${i + 1}`,
//         hand: [] // will be dealt on start
//     });
//     }   

//     games.set(roomCode, game);

//     // store game info in session
//     req.session.game = {
//         roomCode,
//         role: "host",
//         nickname
//     };

//     return res.redirect(`/game/${roomCode}`);
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
        nickname,
        hand:[]
    });

    req.session.game = {
        roomCode: code,
        role: "player",
        nickname
    };

    return res.redirect(`/game/${code}`);
});


/** Start game (host only) */
gamesApiRouter.post("/:roomCode/start", (req, res) => {
    if (!req.session.user || !req.session.game) return res.status(401).send("Not logged in");

    const roomCode = req.params.roomCode.trim().toUpperCase();
    const game = games.get(roomCode);
    if (!game) return res.status(404).send("Room not found");

    if (req.session.game.roomCode !== roomCode) return res.status(403).send("Not in this room");
    if (game.host !== req.session.user.username) return res.status(403).send("Only host can start");
    if (game.status !== "waiting") return res.status(400).send("Game already started");

    // init deck + deal
    game.deck = shuffle(createDeck());
    game.discard = [];
    game.direction = 1;
    game.pendingDraw = 0;
    game.pendingSkip = false;
    game.awaitingWildColor = false;

    // deal 7 each
    for (const p of game.players) p.hand = [];
    for (const p of game.players) drawCards(game, p, 7);

    // flip first non-wild card to discard to start (simple rule)
    let first = game.deck.pop();
    while (first && (first.value === "wild" || first.value === "wild_draw4")) {
        // put it back somewhere
        game.deck.unshift(first);
        first = game.deck.pop();
    }
    if (!first) return res.status(500).send("Deck init failed");
    game.discard.push(first);

    // first player's turn
    game.currentTurnIndex = 0;
    game.chat = [];
    game.status = "running";

    scheduleBotTurns(game);

    return res.json({ ok: true });
});

/** State endpoint (what your frontend should poll) */
gamesApiRouter.get("/:roomCode/state", (req, res) => {
    if (!req.session.user || !req.session.game) return res.status(401).send("Not logged in");

    const roomCode = req.params.roomCode.trim().toUpperCase();
    const game = games.get(roomCode);
    if (!game) return res.status(404).send("Room not found");

    if (req.session.game.roomCode !== roomCode) return res.status(403).send("Not in this room");

    const me = findPlayer(game, req.session.user.username);
    const top = topDiscard(game);

    return res.json({
        roomCode: game.roomCode,
        status: game.status,
        players: game.players.map(p => ({ username: p.username, nickname: p.nickname, handCount: p.hand?.length ?? 0 })),
        currentTurnUsername: game.players[game.currentTurnIndex]?.username,
        topCard: top ? { color: top.color, value: top.value } : null,
        yourHand: me?.hand ?? [],
        direction: game.direction,
        pendingDraw: game.pendingDraw,
        pendingSkip: game.pendingSkip,
        awaitingWildColor: game.awaitingWildColor,
    });
});

/** Draw a card (basic rule: draw 1 and end turn) */
gamesApiRouter.post("/:roomCode/draw", (req, res) => {
    if (!req.session.user || !req.session.game) return res.status(401).send("Not logged in");

    const roomCode = req.params.roomCode.trim().toUpperCase();
    const game = games.get(roomCode);
    if (!game) return res.status(404).send("Room not found");

    if (req.session.game.roomCode !== roomCode) return res.status(403).send("Not in this room");
    if (game.status !== "running") return res.status(400).send("Game not running");
    if (!isPlayersTurn(game, req.session.user.username)) return res.status(403).send("Not your turn");

    const player = findPlayer(game, req.session.user.username);
    if (!player) return res.status(404).send("Player not found");

    if (!applyPendingDrawIfAny(game, player)) {
        drawCards(game, player, 1);
    }

    nextTurn(game, 1);
    startTurn(game);

    // Bot AI
    scheduleBotTurns(game);
    return res.json({ ok: true });
});

/** Play a card */
gamesApiRouter.post("/:roomCode/play", (req, res) => {
    if (!req.session.user || !req.session.game) return res.status(401).send("Not logged in");

    const roomCode = req.params.roomCode.trim().toUpperCase();
    const game = games.get(roomCode);
    if (!game) return res.status(404).send("Room not found");

    if (req.session.game.roomCode !== roomCode) return res.status(403).send("Not in this room");
    if (game.status !== "running") return res.status(400).send("Game not running");
    if (!isPlayersTurn(game, req.session.user.username)) return res.status(403).send("Not your turn");

    const player = findPlayer(game, req.session.user.username);
    if (!player || !player.hand) return res.status(404).send("Player not found");

    const { cardId, wildColor } = req.body as { cardId?: string; wildColor?: UnoColor };

    if (!cardId) return res.status(400).send("Missing cardId");

    const idx = player.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return res.status(400).send("You don't have that card");

    const card = player.hand[idx];
    const top = topDiscard(game);
    if (!top) return res.status(500).send("No top card");

    if (!canPlay(card, top)) return res.status(400).send("Illegal move");

    // remove from hand and place on discard
    player.hand.splice(idx, 1);

    // wild handling: require color choice
    if (card.value === "wild" || card.value === "wild_draw4") {
        if (!wildColor || wildColor === "wild") {
            // put card on discard but mark awaiting color
            game.discard.push({ ...card, color: "wild" });
            game.awaitingWildColor = true;
            return res.status(400).send("Must choose wildColor (red/yellow/green/blue)");
        }
            game.discard.push({ ...card, color: wildColor });
            game.awaitingWildColor = false;
    } else {
        game.discard.push(card);
    }

    // apply effects
    if (card.value === "reverse") {
        game.direction = (game.direction === 1 ? -1 : 1);
    } else if (card.value === "skip") {
        // skip next player
        nextTurn(game, 2);
    } else if (card.value === "draw2") {
        game.pendingDraw += 2;
        nextTurn(game, 1);
    } else if (card.value === "wild_draw4") {
        game.pendingDraw += 4;
        nextTurn(game, 1);
    } else {
        // normal card
        nextTurn(game, 1);
    }

    if (game.pendingDraw > 0 && game.status === "running") {
        const victim = game.players[game.currentTurnIndex];
        if (victim) {
        drawCards(game, victim, game.pendingDraw);
        game.pendingDraw = 0;
        nextTurn(game, 1); // skip victim
        }
  }

    // win check
    if (player.hand.length === 0) {
        game.status = "finished";
    }

    startTurn(game);

    // Bot AI
    scheduleBotTurns(game);

    return res.json({ ok: true });
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

    // keep users inside their own room
    if (req.session.game.roomCode !== roomCode) {
        return res.redirect("/lobby");
    }

    const game = games.get(roomCode);
    if (!game) return res.redirect("/lobby");

    const isHost = game.host === req.session.user.username;

    // If not running, show waiting room (host can start)
    if (game.status !== "running") {
        return res.render("game-waiting", {
        roomCode: game.roomCode,
        players: game.players,
        chat: game.chat,
        isHost,
        myNickname: req.session.game.nickname,
        });
    }

    // If running, show the real game UI
    const me = req.session.user.username;
    const opponents = game.players
        .filter(p => p.username !== me)
        .map(p => ({
        nickname: p.nickname,
        handCount: p.hand?.length ?? 0,
        }));

    return res.render("game", {
        roomCode: game.roomCode,
        players: game.players,
        opponents,
        currentPlayer: game.players[game.currentTurnIndex],
        chat: game.chat,
        myNickname: req.session.game.nickname,

        //for glow usage:
        username: req.session.game.nickname,
    });

});

export { gamesApiRouter, gamePageRouter };