const mongoose = require('mongoose')


const changeLogSchema = new mongoose.Schema({
    self: String,
    maxResults: Number,
    startAt: Number,
    total: Number,
    isLast: Boolean,
    issueId: {
        type: String,
        required: true,
    },
    values: [
        {
            id: String,
            author: {
                accountId: String,
                emailAddress: String,
                displayName: String,
                active: Boolean,
                accountType: String
            },
            created: Date,
            items: [
                {
                    field: String,
                    fieldtype: String,
                    fieldId: String,
                    from: String,
                    fromString: String,
                    to: String,
                    toString: String,
                }
            ]
        }
    ]
})

changeLogSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

const ChangeLog = mongoose.model('ChangeLog', changeLogSchema)

module.exports = ChangeLog
