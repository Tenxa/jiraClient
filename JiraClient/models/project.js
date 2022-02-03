const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')

const projectSchema = mongoose.Schema({
    key: {
        type: String,
        required: true
    },
    projectId: {
        type: String,
        unique: true,
        required: true
    },
    name: String,
    projectTypeKey: String,
    simplified: Boolean
})

projectSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
    }
})

projectSchema.plugin(uniqueValidator)

const Project = mongoose.model('Project', projectSchema)

module.exports = Project

/**
 * Example from postman request: 
 * project": {
        "self": "https://gofore-dashboard.atlassian.net/rest/api/2/project/10000",
        "id": "10000",
        "key": "AD",
        "name": "Aimo Dashboard",
        "projectTypeKey": "software",
        "simplified": false,
    },
 */