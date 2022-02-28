const jiraRouter = require('express').Router()
const utils = require('../utils/utils')
const Issue = require('../models/issue')
require('express-async-errors')


// Tarkista vielä vaikuttaako miten tuo changelog maxResult = 100 mitenkä
// Tarvitaanko parametreja changelog "created", jotta ei haeta koko historiaa?
// Toisaalta, grafana voi hoitaa haun tietokannasta omilla parametreilla?.
jiraRouter.get('/cl', async (request, response, next) => {
  const idAndMongoId = await Issue.find({}, { id: 1 })
    .then(result => result)
    .catch(error => console.log(error))

  const idOnly = idAndMongoId.map(is => parseInt(is.id))

  try {
    const updatedResults = await utils.changelogsByIdArray(idOnly)
    //console.log(updatedResults)
    response.json({ ...updatedResults })
  } catch (error) {
    console.log(error)
    response.status(404).end()
  }
})

// 1. suodatetaan issue collecionista epicit ja viedään omaan epics collectioniin.
// 2. Tehdäänkö Epic collectioni tietokantaan. Vai käytetäänkö tätä sovellista rajapintana
// Grafanalle. Jolloin riittäisi laittaa suodatuksen tulos responseen.
// 3. Epicit suoraan jirasta saadaan /search endpointista 
jiraRouter.get('/epicsFromDB', async (request, response) => {
  const epicsFromDb = await Issue.find({ 'fields.issuetype.name': "Epic" })
  response.json(epicsFromDb)
})

// Upserttaa samalla tietokantaan.
jiraRouter.post('/search', async (request, response) => {
  if (!request.body.jql) {
    return response.send({
      error: 'You must provide a JQL query'
    })
  }
  const jql = request.body.jql
  const startAt = 0
  const maxResults = 10

  try {
    const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
    response.json({ ...resArray })
  } catch (error) {
    console.log('error at api/jira/search', error)
    response.status(404).end()
  }
})


jiraRouter.get('/:id', async (request, response) => {
  try {
    const issue = await jiraGetIssue(request.params.id)
    response.json({ ...issue })
  } catch (error) {
    console.error(error)
  }
})



// Käyttää Jira /search endpointtia ja hakee kaikki issuet looppaamalla,
// jos kaikki ei mahdu yhteen responseen.
jiraRouter.post('/', async (request, response, next) => {
  console.log('Getting all issues with Search');

  // API dokumentaation mukaan maxResult defaulttina 50.
  // Kokeiltavana vielä maxResultin nostamista. Ensin pitäisi tehdä lisää testi dataa.
  let startAt = 0
  let maxResults = 10
  let jql = 'ORDER BY Created DESC'

  try {
    const resArray = await utils.issueSearchLoop(startAt, maxResults, jql)
    response.json({ ...resArray })
  } catch (error) {
    console.log('error at api/jira/', error)
    response.status(404).end()
  }
})


const jiraGetIssue = async (issueKey) => {
  const jira = utils.createJiraClientWithToken()
  const issue = await jira.issue.getIssue({
    issueKey: issueKey
  })
  return issue
}


module.exports = jiraRouter
