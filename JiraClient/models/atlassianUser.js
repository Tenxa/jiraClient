const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')


const atlassianUserSchema = new mongoose.Schema({
  accountId: String,
  emailAddress: {
      type: String,
      unique: true,
      required: true
  },
  displayName: String,
  active: Boolean,
  accountType: String
})

atlassianUserSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

atlassianUserSchema.plugin(uniqueValidator)

const AtlassianUser = mongoose.model('AtlassianUser', atlassianUserSchema)

module.exports = AtlassianUser
