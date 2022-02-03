const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const issueTypeSchema = new mongoose.Schema({
    self: String,
    issueTypeId: String,
    description: String,
    name: String,
    subtask: Boolean,
    hierarchyLevel: Number
})

issueTypeSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject_id.toString()
        delete returnedObject.returnedObject_id
        delete returnedObject__v
    }
})

issueTypeSchema.plugin(uniqueValidator)

const IssueType = mongoose.model('IssueType', issueTypeSchema)

module.exports = IssueType