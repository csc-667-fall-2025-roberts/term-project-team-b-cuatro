import { GameRoom, UnoCard, UnoColor, Player } from "./game";

function randomBotTaunt(type: "draw2" | "draw4") {
  const draw2Lines = [
    "hahaha 😈 +2 for you!",
    "Oops… draw two!",
    "UNO says no 😎",
    "Take these cards!",
    "Bruh play a card already"
  ];

  const draw4Lines = [
    "HAHAHA +4 😈😈",
    "UNO gods demand sacrifice!",
    "This is personal. +4.",
    "Suffer 😎 +4",
    "gg2fuckingez"
  ];

  const list = type === "draw2" ? draw2Lines : draw4Lines;
  return list[Math.floor(Math.random() * list.length)];
}



function canPlay(card: UnoCard, top: UnoCard): boolean {
    if (card.value === "wild" || card.value === "wild_draw4") return true;
    return card.color === top.color || card.value === top.value;
}

function randomColor(): Exclude<UnoColor, "wild"> {
    const colors: Exclude<UnoColor, "wild">[] = ["red", "yellow", "green", "blue"];
    return colors[Math.floor(Math.random() * colors.length)];
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeIndex(i: number, n: number) {
    return ((i % n) + n) % n;
}

function nextTurn(game: GameRoom, steps = 1) {
    const n = game.players.length;
    game.currentTurnIndex = normalizeIndex(
        game.currentTurnIndex + steps * game.direction,
        n
    );
}

/**
 * Draw cards with discard->deck recycle (same idea as your game.ts drawCards)
 */
function drawCards(game: GameRoom, player: Player, count: number) {
    player.hand ??= [];

    for (let i = 0; i < count; i++) {
        if (game.deck.length === 0) {
        // recycle discard into deck (keep top)
        const top = game.discard.pop();
        const rest = game.discard.splice(0);
        // shuffle rest
        for (let j = rest.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [rest[j], rest[k]] = [rest[k], rest[j]];
        }
        game.deck = rest;
        game.discard = top ? [top] : [];
        }

        const c = game.deck.pop();
        if (c) player.hand.push(c);
    }
}

function applyPendingDrawAndSkip(game: GameRoom) {
    if (game.pendingDraw <= 0) return;

    const victim = game.players[game.currentTurnIndex];
    if (!victim) return;

    drawCards(game, victim, game.pendingDraw);
    game.pendingDraw = 0;

    // skip victim's turn
    nextTurn(game, 1);
}

export function runBotTurn(game: GameRoom) {
    const player = game.players[game.currentTurnIndex];

    // Safety checks
    if (!player?.username?.startsWith("BOT_")) return;
    player.hand ??= [];

    // IMPORTANT: bot must respect +2/+4 (pendingDraw) at start of its turn
    if (game.pendingDraw > 0) {
        drawCards(game, player, game.pendingDraw);
        game.pendingDraw = 0;
        nextTurn(game, 1);
        return;
    }

    const top = game.discard[game.discard.length - 1];
    if (!top) return;

    // Try to play a card
    const playable = player.hand.find((c) => canPlay(c, top));

    if (playable) {
        // remove from hand
        player.hand.splice(player.hand.indexOf(playable), 1);

        // wild: choose color
        if (playable.value === "wild" || playable.value === "wild_draw4") {
            playable.color = randomColor();
        }

        // place on discard
        game.discard.push(playable);

        // apply effects + advance turn
        if (playable.value === "reverse") {
            game.direction = game.direction === 1 ? -1 : 1;
            nextTurn(game, 1);
        } else if (playable.value === "skip") {
            nextTurn(game, 2);
        } else if (playable.value === "draw2") {
            game.pendingDraw += 2;

            game.chat.push({
                nickname: player.nickname,
                text: randomBotTaunt("draw2"),
                ts: Date.now()
            });

            nextTurn(game, 1);
            applyPendingDrawAndSkip(game);
        } else if (playable.value === "wild_draw4") {
            game.pendingDraw += 4;
            game.chat.push({
                nickname: player.nickname,
                text: randomBotTaunt("draw4"),
                ts: Date.now()
            });
            nextTurn(game, 1);
            applyPendingDrawAndSkip(game);
        } else {
            nextTurn(game, 1);
        }

        // win condition
        if (player.hand.length === 0) {
        game.status = "finished";
        game.winnerNickname = player.nickname;
        game.winnerUsername = player.username;
        return;
        }
    } else {
        // draw 1 and end turn
        drawCards(game, player, 1);
        nextTurn(game, 1);
    }
}

/**
 * Delay bot moves by a fixed 3 seconds.
 * Prevents multiple loops from starting at once.
 */
export function scheduleBotTurns(game: GameRoom) {
    const anyGame = game as any;
    if (anyGame._botLoopRunning) return;
    anyGame._botLoopRunning = true;

    const loop = async () => {
        try {
        while (
            game.status === "running" &&
            game.players[game.currentTurnIndex]?.username?.startsWith("BOT_")
        ) {
            await sleep(3000); // ✅ fixed 3s delay
            runBotTurn(game);
        }
        } finally {
        anyGame._botLoopRunning = false;
        }
    };

    void loop();
}

