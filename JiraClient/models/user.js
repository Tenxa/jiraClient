const mongoose = require('mongoose')


const userSchema = new mongoose.Schema({
  accountId: String,
  username: String,
  name: String,
  passwordHash: String,
})

userSchema.statics.format = (user) => {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
  }
}

const User = mongoose.model('User', userSchema)

module.exports = User
