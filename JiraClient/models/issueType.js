const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const issueTypeSchema = new mongoose.Schema({
    self: String,
    issueTypeId: {
        type: String,
        unique: true,
        required: true
    },
    description: String,
    name: String,
    subtask: Boolean,
    hierarchyLevel: Number
})

issueTypeSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

issueTypeSchema.plugin(uniqueValidator)

const IssueType = mongoose.model('IssueType', issueTypeSchema)

module.exports = IssueType