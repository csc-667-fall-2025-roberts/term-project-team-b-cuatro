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
    //------------------------------------------------------------------------------
    pgm.createTable('messages', {
        id: 'id',
        game_id: {type: 'integer', notNull: true, references: '"games"', onDelete: 'CASCADE'},
        user_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE'},
        message: { type: 'text', notNull: true },
        created_at: 'timestamp_now'
    });//end of messages
    //------------------------------------------------------------------------------
    //TODO: Future maybe add some index for players 
    //------------------------------------------------------------------------------


}
exports.down = (pgm) => {
  pgm.dropTable('messages');
  pgm.dropTable('players');
  pgm.dropTable('games');
  pgm.dropTable('users');
};