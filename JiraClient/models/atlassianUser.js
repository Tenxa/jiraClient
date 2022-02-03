const mongoose = require('mongoose')


const atlassianUserSchema = new mongoose.Schema({
  accountId: String,
  emailAddress: String,
  displayName: String,
})

atlassianUserSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

const AtlassianUser = mongoose.model('AtlassianUser', atlassianUserSchema)

module.exports = AtlassianUser
