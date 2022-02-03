const axios = require('axios')

const jiraRouter = require('express').Router()
const mongoose = require('mongoose')
const utils = require('../utils/utils')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const JiraClient = require('jira-connector')
const Issue = require('../models/issue')
const IssueType = require('../models/issueType')
const Project = require('../models/project')
require('express-async-errors')


jiraRouter.get('/changeLog/:id', async (request, response) => {
  console.log('jira withID');
  validCall = utils.isValidCall(request)
  if (validCall.statuscode !== 200) {
    response.status(validCall.statuscode).json(validCall.status)
    return
  }
  const jira = utils.createJiraClientWithToken()

  try {
    const issue = await jira.issue.getChangelog({
      issueKey: request.params.id
    })
    response.json({ issue: issue })
  } catch (error) {
    console.log('error:', error)
  }
})

// Here we get the issue with id from Jira and save it to db
jiraRouter.get('/:id', async (request, response) => {
  console.log('GET issue with id')
  validCall = utils.isValidCall(request)
  if (validCall.statuscode !== 200) {
    response.status(validCall.statuscode).json(validCall.status)
    return
  }

  try {
    const issue = await jiraGetIssue(request.params.id)

    let newIssue = new Issue({
      issueId: issue.id,
      key: issue.key,
      fields: {
        issuetype: null,
        project: null,
        created: issue.fields.created,
        priority: {
          ...issue.fields.priority
        },
        status: {
          ...issue.fields.status
        },
        description: issue.fields.description,
        summary: issue.fields.summary
      },
    })

    let issueType = new IssueType({
      ...issue.fields.issuetype,
      issueTypeId: issue.fields.issuetype.id
    })
    await IssueType.countDocuments({ issueTypeId: issueType.issueTypeId }, async (err, count) => {
      if (count === 0) {
        console.log('IssueType Saved!')
        await issueType.save()
      } else {
        const foundIssueType = await IssueType.findOne({ key: issueType.key })
        issueType._id = foundIssueType._id
        newIssue.fields.issuetype = foundIssueType.id
      }
    })

    let issueProject = new Project({
      ...issue.fields.project,
      projectId: issue.fields.project.id
    })
    await Project.countDocuments({ projectId: issueProject.projectId }, async (err, count) => {
      console.log(count)
      if (count === 0) {
        console.log('Project saved!')
        await issueProject.save()
      } else {
        const foundProject = await Project.findOne({ projectId: issueProject.projectId })
        issueProject._id = foundProject._id
        newIssue.fields.project = foundProject.id
      }
    })

    await newIssue.save()
    response.json(newIssue)
  } catch (error) {
    console.log('error at api/jira/:id', error)
    response.status(404).end()
  }

})

jiraRouter.get('/', async (request, response) => {
  console.log('noID');
  validCall = utils.isValidCall(request)
  if (validCall.statuscode !== 200) {
    response.status(validCall.statuscode).json(validCall.status)
    return
  }

  // jiraGetIssue parameter would be smarter to get from the request.body later.
  try {
    const issue = await jiraGetIssue('AD-1')
    response.json({ issue: issue })
  } catch (error) {
    console.log('error at api/jira/', error)
    response.status(404).end()
  }
})

// Post endpoint for creating issues. Created just for confirming the 
// connection. From Postman make a POST req with body as "status": "success"
jiraRouter.post('/createIssue', async (request, response) => {
  const jira = utils.createJiraClientWithMailAndToken()

  response.send('Created a new issue')
  jira.issue.createIssue({
    fields: {
      project: {
        key: 'AD',
      },
      summary: 'Jira Rest API via node.js TEST',
      description: 'Created this issue with jira-connector',
      issuetype: {
        name: 'Story',
      },
      //customfield_10014: 'AD-03',
    },
    function(error, issue) {
      console.log('error', error)
      console.log('issue', issue)
    }
  })

})

jiraRouter.post('/', async (request, response) => {
  // validating own call
  validCall = utils.isValidCall(request)
  if (validCall.statuscode !== 200) {
    response.status(validCall.statuscode).json(validCall.status)
    console.log('not valid call');
    return
  }
  // trying with direct call
  const result = await jiraCreateCalls(request.body)
  //const result = await jiraDeleteAll(request.body)
  //const result = await jiraGetIssue(request.body)
  response.status(200).json(result)
})

const jiraDeleteAll = async (array) => {
  const jira = new JiraClient({
    host: config.jiraURL,
    basic_auth: {
      base64: utils.createJiraToken()
    }
  })

  for (let i = 2; i < 43; i++) {
    const iss = 'AD-' + i
    jira.issue.deleteIssue({
      issueKey: iss
    },
      function (error, issue) {
        tmpObject = issue
        console.log(issue);
        console.log(error);
      })
  }
}

const jiraGetIssue = async (issueKey) => {
  // const jira = new JiraClient({
  //   host: config.jiraURL,
  //   basic_auth: {
  //     base64: utils.createJiraToken()
  //   }
  // })
  const jira = utils.createJiraClientWithToken()
  const issue = await jira.issue.getIssue({
    issueKey: issueKey
  })
  return issue
}

const jiraCreateCalls = async (array) => {
  const jira = new JiraClient({
    host: config.jiraURL,
    basic_auth: {
      base64: utils.createJiraToken()
    }
  })
  try {
    for (let i = 0; i < array.length; i++) {
      const tmpObject = JSON.parse(JSON.stringify(array[i]))
      tmpObject.issues = undefined
      const epicResult = await createIssue(tmpObject, array[i], jira)
    }
    return 'OK'
  }
  catch (e) {
    console.log(e);
    return 'NOK'
  }
}

const createIssue = async (issue2, issue3, jira) => {
  let tmpObject = {}
  tmpObject.fields = issue2
  const test = await jira.issue.createIssue({
    fields: issue2
  },
    function (error, issue) {
      tmpObject = issue
      console.log('issue', issue);
      console.log(error);
      for (let j = 0; j < issue3.issues.length; j++) {
        issue3.issues[j].customfield_10013 = issue.key
        console.log('issue2.issues[j]', issue3.issues[j]);
        const result2 = createIssue(issue3.issues[j], jira)
        const test = jira.issue.createIssue({
          fields: issue3.issues[j]
        },
          function (error, issue) {
            console.log(issue);
          })
      }
    })
  return tmpObject.id

}



module.exports = jiraRouter
