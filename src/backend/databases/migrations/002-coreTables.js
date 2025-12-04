//handeling all my enums: card color, card number, card status, state
exports.shorthands = {
    id: {
    type: 'serial',
    primaryKey: true,
  },
  timestamp_now: {
    type: 'timestamptz',
    notNull: true,
    default: 'now()',
  },
};//end of shorthands

exports.up = (pgm) =>{
    //------------------------------------------------------------------------------
    pgm.createTable('users',{
        id: 'id',
        username: { type: 'varchar(50)', notNull: true, unique: false },
        email: { type: 'varchar(255)', notNull: true, unique: true },
        password_hash: { type: 'text', notNull: true },
        created_at: 'timestamp_now'
    });//end of users

    //------------------------------------------------------------------------------
    pgm.createTable('games',{
        id: 'id',
        name: {type: 'varchar(100)', notNull: true},
        created_by: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE'},
        state: {type: 'varchar(20)', notNull: true, default: 'waiting'},
        max_players: {type: 'integer', notNull: true, default: 4 },
        created_at: 'timestamp_now'
    });//end of games
    //------------------------------------------------------------------------------
    pgm.createTable('players',{
        id: 'id',
        game_id: { type: 'integer', notNull: true, references: '"games"', onDelete: 'CASCADE'},
        user_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE'},
        joined_at: 'timestamp_now',

    });//end of game players

    //making sure we get no duplicate players
    pgm.addConstraint('players', 'players_unique_game_user',{unique: ['game_id', 'user_id']});
    //------------------------------------------------------------------------------
    pgm.createTable('messages', {
        id: 'id',
        game_id: {type: 'integer', notNull: true, references: '"games"', onDelete: 'CASCADE'},
        user_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE'},
        message: { type: 'text', notNull: true },
        created_at: 'timestamp_now'
    });//end of messages
    //------------------------------------------------------------------------------
    pgm.addIndex('games', 'created_by', { name: 'idx_games_created_by' });
    pgm.addIndex('games', 'state', { name: 'idx_games_state' });
    pgm.addIndex('games', 'created_at', { name: 'idx_games_created_at' });

    pgm.addIndex('players', 'game_id', { name: 'idx_players_game_id' });
    pgm.addIndex('players', 'user_id', { name: 'idx_players_user_id' });

    pgm.addIndex('messages', ['game_id', 'created_at'], {name: 'idx_messages_game_created_at'});

    //TODO: Future maybe add some index for cards/deck
    //------------------------------------------------------------------------------


}
exports.down = (pgm) => {
  pgm.dropIndex('messages', ['game_id', 'created_at'], {name: 'idx_messages_game_created_at'});

  pgm.dropIndex('players', 'user_id', { name: 'idx_players_user_id'});
  pgm.dropIndex('players', 'game_id', { name: 'idx_players_game_id' });
  pgm.dropConstraint('players', 'players_unique_game_user');

  pgm.dropIndex('games', 'created_at', { name: 'idx_games_created_at' });
  pgm.dropIndex('games', 'state', { name: 'idx_games_state' });
  pgm.dropIndex('games', 'created_by', { name: 'idx_games_created_by' });

  pgm.dropTable('messages');
  pgm.dropTable('players');
  pgm.dropTable('games');
  pgm.dropTable('users');
};