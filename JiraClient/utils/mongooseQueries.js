const Ticket = require('../models/ticket')


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

const featuresInEpic = async (epicId) => {
  return await Ticket.find({
    $and: [
      {
        'fields.issuelinks.outwardIssue.id': epicId
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
  storiesInFeature
}
