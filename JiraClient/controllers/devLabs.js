const devlabsRouter = require('express').Router()
const utils = require('../utils/utils')
const config = require('../utils/config')
const JiraClient = require('jira-connector')
const fs = require('fs');


devlabsRouter.get('/:id', async (request, response) => {

  const jira = new JiraClient({
    protocol: 'https',
    strictSSL: false,
    host: config.jiraDevLabsUrl,
    apiVersion: '2',
    basic_auth: {
      email: config.jiraDevLabsUser.trim(),
      api_token: config.jiraToken.trim()
    }
  })

  const issue = await jira.issue.getChangelog({ issueKey: request.params.id });

  //console.log('issue in changeLog', issue);

  response.json({ issue: issue })

})

devlabsRouter.get('/sprint/:id', async (request, response) => {

  const jira = new JiraClient({
    protocol: 'https',
    strictSSL: false,
    host: config.jiraDevLabsUrl,
    //port: '8443',
    apiVersion: '2',
    basic_auth: {
      email: config.jiraDevLabsUser.trim(),
      api_token: config.jiraToken.trim()
    }
  })
  const issue = jira.sprint
    .getSprint({ sprintId: request.params.id })
    .then(issue => {
      response.json({ issue: issue })
    })
    .catch(error => { throw error });

})

devlabsRouter.get('/search', async (request, response) => {
  console.log('devlabs without id');
  let jql_string = 'issuetype in (Story, Task) AND project = AD AND component not in ("FI Development", "Cloud Infra") AND Sprint in (openSprints())'
  const jira = new JiraClient({
    protocol: 'https',
    strictSSL: false,
    host: config.jiraDevLabsUrl,
    apiVersion: '2',
    basic_auth: {
      email: config.jiraDevLabsUser.trim(),
      api_token: config.jiraToken.trim()
    }
  })

  //const jira = utils.createJiraClientWithToken()
  //console.log('req body: ', request.body.jql)


  try {
    //const issue = await jira.search.search({ jql: jql_string });

    const issue = await jira.issue.getIssue({ issueKey: 'AD-1' })
    response.json({ issue: issue })
  } catch (error) {
    console.log('error in /search first try/catch', error)
  }

})

devlabsRouter.post('/write2file', async (request, response) => {
  // validating own call
  validCall = utils.isValidCall(request)
  if (validCall.statuscode !== 200) {
    response.status(validCall.statuscode).json(validCall.status)
    console.log('not valid call');
    return
  }

  console.log('data in w2f', request.body);
  fs.appendFile('message.txt', request.body.string + '\r\n', function (err) {
    if (err) throw err;
    console.log('Saved!');
  });
  response.status(200).json("ok")

})

devlabsRouter.post('/', async (request, response) => {
  // validating own call
  validCall = utils.isValidCall(request)
  if (validCall.statuscode !== 200) {
    response.status(validCall.statuscode).json(validCall.status)
    console.log('not valid call');
    return
  }

  // trying with direct call
  const result = await jiraCreateCalls(request.body)
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
    const iss = 'LC-' + i
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

// const jiraGetIssue = async (id) => {
//   const jira = new JiraClient({
//     host: config.jiraURL,
//     basic_auth: {
//       base64: utils.createJiraToken()
//     }
//   })
//   const issue = jira.issue.getIssue({
//     issueKey: 'LC-8'
//   }, function (error, issue) {
//     //console.log('error', error);
//     console.log(issue);
//   })
// }

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

module.exports = devlabsRouter
