const mongoose = require('mongoose')


const changeLogSchema = new mongoose.Schema({
    self: String,
    maxResults: Number,
    startAt: Number,
    total: Number,
    isLast: Boolean,
    values: [
        {
            id: String,
            author: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'AtlassianUser',
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

/**{
                "id": "10001",
                "author": {
                    "self": "https://gofore-dashboard.atlassian.net/rest/api/2/user?accountId=61e1caf9ce3652006a4bedfc",
                    "accountId": "61e1caf9ce3652006a4bedfc",
                    "emailAddress": "teemu.lindgren@gofore.com",
                    "avatarUrls": {
                        "48x48": "https://secure.gravatar.com/avatar/25a4c49076edbf00335c3e175b7b1874?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTL-5.png",
                        "24x24": "https://secure.gravatar.com/avatar/25a4c49076edbf00335c3e175b7b1874?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTL-5.png",
                        "16x16": "https://secure.gravatar.com/avatar/25a4c49076edbf00335c3e175b7b1874?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTL-5.png",
                        "32x32": "https://secure.gravatar.com/avatar/25a4c49076edbf00335c3e175b7b1874?d=https%3A%2F%2Favatar-management--avatars.us-west-2.prod.public.atl-paas.net%2Finitials%2FTL-5.png"
                    },
                    "displayName": "Teemu Lindgren",
                    "active": true,
                    "timeZone": "Europe/Bucharest",
                    "accountType": "atlassian"
                },
                "created": "2022-02-07T10:04:28.282+0200",
                "items": [
                    {
                        "field": "summary",
                        "fieldtype": "jira",
                        "fieldId": "summary",
                        "from": null,
                        "fromString": "Jira Rest API via node.js TEST",
                        "to": null,
                        "toString": "Jira Rest API via node.js TEST2"
                    }
                ]
            }, */