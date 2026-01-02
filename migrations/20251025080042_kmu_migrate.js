/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

  await knex.schema.createTable('roles', (t) => {
    t.uuid('id').primary()
    t.text('name').notNullable().unique()
  })

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.text('username').notNullable().unique()
    t.text('email').notNullable().unique()
    t.text('displayName')
    t.text('avatarUrl')
    t.text('bio')
    t.text('passwordHash').notNullable()
    t.text('passwordSalt').notNullable()
    t.integer('reputation').notNullable().defaultTo(0)
    t.boolean('isBanned').notNullable().defaultTo(false)
    t.timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    t.uuid('roleId').notNullable().references('roles.id')
  })

  await knex.schema.createTable('languages', (t) => {
    t.string('code', 10).primary()
    t.text('name').notNullable()
    t.text('nativeName')
    t.timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('artists', (t) => {
    t.uuid('id').primary()
    t.text('name').notNullable()
    t.text('description')
    t.text('origin')
    t.timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('albums', (t) => {
    t.uuid('id').primary()
    t.text('title').notNullable()
    t.integer('releaseYear')
    t.text('label')
    t.text('coverUrl')
    t.timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    t.uuid('primaryArtistId').references('artists.id')
  })

  await knex.schema.createTable('songs', (t) => {
    t.uuid('id').primary()
    t.text('title').notNullable()
    t.integer('releaseYear')
    t.boolean('isPublished').notNullable().defaultTo(false)
    t.timestamp('createdAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    t.timestamp('updatedAt', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
    t.text('description')
    t.string('languageCode', 10).notNullable().references('languages.code')
    t.uuid('createdBy').references('users.id')
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema
    .dropTableIfExists('songs')
    .dropTableIfExists('albums')
    .dropTableIfExists('artists')
    .dropTableIfExists('languages')
    .dropTableIfExists('users')
    .dropTableIfExists('roles')
}
