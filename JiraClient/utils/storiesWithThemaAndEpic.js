
// Fact table           Esimerkki
// Thema                CPS-3040
// Epic                 GCT-20
// Project              project.key
// Release (Drop)       releaseName?
// Time                 20.06.2020
// Component            componentti
// issuetype            Story
// status               To Do
// numberOfIssues       17


const utils = require('./helperFunctions')
const mongooseQuery = require('./mongooseQueries')

// Palautetaan Storyt, Taskit ja Bugit joilla on theme ja epic. (Tietokannasta)
const storiesWithThemaAndEpic = async () => {
  const themes = await mongooseQuery.byIssuetypeName('Theme')

  const themeEpicStoryMapping = themes.map(async (theme) => {
    const epicsForTheme = await mongooseQuery.issuesByParentOrOutwardLinkId(theme.id, 'Epic')
    if (epicsForTheme.length === 0) return
    const storiesForEpic = epicsForTheme.map(async (epic) => {
      const stories = await mongooseQuery.storiesByParentId(epic.id, 'Story')
      let storyStatusesCount = {
        toDo: 0,
        inProgress: 0,
        done: 0
      } 
      stories.forEach(story => storyStatusesCount = utils.switchCaseStatus(story.fields.status.statusCategory.name, storyStatusesCount))
      return {
        theme: theme.key,
        epic: epic.key,
        numberOfIssues: stories.length,
        stories: stories.map(story => {
          return {
            id: story.id,
            key: story.key,
            project: story.fields.project.key,
            time: story.fields.created,
            issuetype: story.fields.issuetype.name,
            status: story.fields.status.statusCategory.name,
          }
        })
      }
    })
    return await Promise.all(storiesForEpic)
  })

  const resolve = await Promise.all(themeEpicStoryMapping)
  return resolve.flat().filter(e => e)
}

module.exports = {
  storiesWithThemaAndEpic
}