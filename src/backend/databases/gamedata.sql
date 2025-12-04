Enum card_color {
  red
  blue
  green
  yellow
  wild
}

Enum card_number {
  "0"
  "1"
  "2"
  "3"
  "4"
  "5"
  "6"
  "7"
  "8"
  "9"
  skip
  reverse
  draw2
  wild
  wild_draw4
}

Enum card_status {
  in_deck
  in_hand
  discarded
}

Enum game_state {
  waiting
  active
  ended
}

Table users {
  id            int [pk, increment]
  username      varchar(50) [not null, unique]
  email         varchar(255) [not null, unique]
  password_hash varchar(255) [not null]
  created_at    timestamptz [not null, default: `now()`]
}

Table games {
  id                   int [pk, increment]
  display_name                 varchar(100) [not null] // display name for the lobby
  created_by           int [not null, ref: > users.id]
  state                game_state [not null, default: 'waiting']
  current_player_id    int [ref: > users.id]
  max_players          int [not null, default: 4]
  turn_timeout_seconds int [not null, default: 0]
  created_at           timestamptz [not null, default: `now()`]
  ended_at             timestamptz
}

Table game_players {
  id         int [pk, increment]
  game_id    int [not null, ref: > games.id]
  user_id    int [not null, ref: > users.id]
  is_host    boolean [not null, default: false]
  seat_order smallint [not null] // turn order
  joined_at  timestamptz [not null, default: `now()`]

  indexes {
    (game_id, user_id) [unique]
    game_id
  }
}

Table card {
  id     int [pk, increment]
  color  card_color [not null]
  number card_number [not null]
}

Table deck {
 id          int [pk, increment]
  card_id     int [not null, ref: > card.id]
  game_id     int [not null, ref: > games.id]
  player_id   int [ref: > users.id] // NULL when not in a hand
  card_status card_status [not null]
  position    int // ordering within deck/hand/discard pile
  created_at  timestamptz [not null, default: `now()`]

  indexes {
    game_id
    (game_id, card_status)
  }
}

Table chat_messages {
  id         int [pk, increment]
  game_id    int [not null, ref: > games.id]
  user_id    int [not null, ref: > users.id]
  message    text [not null]
  created_at timestamptz [not null, default: `now()`]

  indexes {
    game_id
  }
}
