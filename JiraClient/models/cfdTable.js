const mongoose = require('mongoose')

const cfdSchema = new mongoose.Schema({
    theme: String,
    epic: String,
    businessProcess: String,
    feature: String,
    project: {type: String, required: true},
    time: {type: Date, required: true},
    issuetype: {type: String, required: true},
    status: {type: String, required: true},
    numberOfIssues: { type: Number, default: 0 },
    configurationDate: Date
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