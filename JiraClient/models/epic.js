const mongoose = require('mongoose')


const epicSchema = new mongoose.Schema({
    epic: String,
    theme: String,
    storyStatusesCount: {
        toDo: Number,
        inProgress: Number,
        done: Number
    },
    relativeSize: Number,
    active: Boolean,
    delta: Number,
    monteCarloCurrent: Date,
    monteCarloRealistic: Date,
    monteCarloPessimistic: Date
})

epicSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

const Epic = mongoose.model('Epic', epicSchema)

module.exports = Epic