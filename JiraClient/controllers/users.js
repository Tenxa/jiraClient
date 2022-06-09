const bcrypt = require('bcrypt')
const usersRouter = require('express').Router()
const User = require('../models/user')
const config = require('../utils/config')
require('express-async-errors')

usersRouter.get('/', async (request, response) => {
  const users = await User.find({})
  response.json(users.map(user => User.format(user)))
})

usersRouter.post('/', async (request, response) => {
  const body = request.body

  if (!body.password) {
    console.log('no password', body.password)
    response.status(400).json({ error: 'no password' })
    return
  }
  if (body.password.length < 3) {
    console.log('too short password', body.password)
    response.status(400).json({ error: 'too small password' })
    return
  }

  const saltRounds = 10
  const passwordHash = await bcrypt.hash(body.password, saltRounds)

  const user = new User({
    username: body.username,
    name: body.name,
    passwordHash
  })

  const savedUser = await user.save()
  response.json(savedUser)

})

module.exports = usersRouter
