const mongoose = require('mongoose')

const statusChangeSchema = new mongoose.Schema({
    theme: String,
    epic: String,
    businessProcess: String,
    feature: String,
    project: {type: String, required: true},
    time: {type: Date, required: true},
    issuetype: {type: String, required: true},
    status: {type: String, required: true},
})


statusChangeSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

const StatusChange = mongoose.model('StatusChange', statusChangeSchema)

module.exports = StatusChange