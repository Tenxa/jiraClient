const Ticket = require('../models/ticket')


const allEpics = async () => {
  return await Ticket.find({
    'fields.issuetype.name': 'Epic'
  })
}

const mongooseEpics = async () => {
  return await Ticket.find({
    $and: [
      {
        $or: [
          {
            'fields.status.statusCategory.name': 'To Do'
          },
          {
            'fields.status.statusCategory.name': 'In Progress'
          },
          {
            'fields.status.statusCategory.name': 'Done'
          }
        ]
      },
      {
        'fields.issuetype.name': 'Epic'
      }
    ]
  })
}

// There are 0 Features with epic as parent, but we'll leave it there on the query
const featuresInEpic = async (epicId) => {
  return await Ticket.find({
    $and: [
      {
        $or: [
          {
            'fields.issuelinks.outwardIssue.id': epicId
          },
          {
            'fields.parent.id': epicId
          },
        ],
      },
      {
        'fields.issuetype.name': 'Feature'
      }
    ]
  })
}

const storiesInFeature = async (featureId) => {
  return await Ticket.find({
    $and: [
      {
        $or: [
          {
            'fields.status.statusCategory.name': 'To Do'
          },
          {
            'fields.status.statusCategory.name': 'In Progress'
          },
          {
            'fields.status.statusCategory.name': 'Done'
          }
        ]
      },
      {
        'fields.issuelinks.outwardIssue.id': featureId
      },
      {
        'fields.issuetype.name': 'Story'
      }
    ]
  })
}

module.exports = {
  mongooseEpics,
  featuresInEpic,
  storiesInFeature,
  allEpics
}
