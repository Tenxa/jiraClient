const mongoose = require('mongoose')

const cfdSchema = new mongoose.Schema({
    theme: String,
    epic: String,
    project: String,
    time: String,
    issuetype: String,
    status: String,
    numberOfIssues: { type: Number, default: 0 },
    configurationDate: { type: Date, default: Date.now() }
})


cfdSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

const Cfd = mongoose.model('Cfd', cfdSchema)

module.exports = Cfd