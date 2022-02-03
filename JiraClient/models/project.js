const mongoose = require('mongoose')

const projectSchema = mongoose.Schema({
    key: String,
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